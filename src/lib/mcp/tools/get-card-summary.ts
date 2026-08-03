import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  CARD_SUMMARY_WARNINGS,
  resolveCardBillingPeriod,
} from "../shared/card-summary";
import { hasInstallmentEvidence, installmentWarnings } from "../shared/card-factual";
import { currentMonthRange, todayIso } from "../shared/dates";
import { mcpError } from "../shared/errors";
import { roundFinancial } from "../shared/phase-1.1b-core";
import { supabaseForUser } from "../shared/supabase-client";

const HARD_CAP = 10_000;
const BILLING_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const warningSchema = z.enum(CARD_SUMMARY_WARNINGS);

const cardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  card_type: z.enum(["credit", "debit", "both"]),
  is_active: z.boolean(),
  card_limit: z.number().nullable(),
  opening_day: z.number().int().nullable(),
  closing_day: z.number().int().nullable(),
  due_day: z.number().int().nullable(),
  days_before_due: z.number().int().nullable(),
}).strict();

const billingPeriodSchema = z.object({
  billing_month: z.string().regex(BILLING_MONTH_RE),
  start_date: z.string(),
  end_date: z.string(),
  closing_date: z.string().nullable(),
  due_date: z.string().nullable(),
  calculation_mode: z.enum(["due_date", "legacy_opening_closing"]),
}).strict();

const largestTransactionSchema = z.object({
  transaction_id: z.string().uuid(),
  description: z.string(),
  amount: z.number(),
  date: z.string(),
  category_name: z.string().nullable(),
  installment_number: z.number().int().nullable(),
  total_installments: z.number().int().nullable(),
}).strict();

const categorySummarySchema = z.object({
  category_name: z.string(),
  total: z.number(),
  transaction_count: z.number().int().nonnegative(),
  percentage: z.number(),
}).strict();

export default defineTool({
  name: "get_card_summary",
  title: "Resumir lançamentos do cartão",
  description:
    "Calcula um resumo factual dos lançamentos próprios de crédito registrados no Gastinho para o período do cartão. billing_month é o mês de referência da fatura calculada; não informa pagamento, quitação, saldo bancário ou fatura oficial do emissor.",
  inputSchema: {
    card_id: z.string().uuid(),
    billing_month: z.string().regex(BILLING_MONTH_RE).optional(),
    time_scope: z.enum(["occurred", "all"]).optional(),
  },
  outputSchema: {
    card: cardSchema,
    billing_period: billingPeriodSchema,
    metrics: z.object({
      registered_total: z.number(),
      occurred_total: z.number(),
      future_materialized_total: z.number(),
      transaction_count: z.number().int().nonnegative(),
      occurred_transaction_count: z.number().int().nonnegative(),
      future_transaction_count: z.number().int().nonnegative(),
      installment_total: z.number(),
      non_installment_total: z.number(),
    }).strict(),
    largest_transaction: largestTransactionSchema.nullable(),
    categories_summary: z.array(categorySummarySchema).max(10),
    data_complete: z.boolean(),
    warnings: z.array(warningSchema),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const userId = ctx.getUserId();
    if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
    const billingMonth = input.billing_month ?? currentMonthRange().from.slice(0, 7);
    const timeScope = input.time_scope ?? "all";

    const supabase = supabaseForUser(ctx);
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select(
        "id,name,card_type,is_active,card_limit,opening_day,closing_day,due_day,days_before_due",
      )
      .eq("id", input.card_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (cardError) return mcpError("INTERNAL_ERROR");
    if (!card) return mcpError("RESOURCE_NOT_FOUND");
    if (!["credit", "debit", "both"].includes(card.card_type)) {
      return mcpError("INVALID_CARD_TYPE");
    }
    const parsedCard = cardSchema.safeParse(card);
    if (!parsedCard.success) return mcpError("INVALID_DATA");

    const resolvedPeriod = resolveCardBillingPeriod(billingMonth, parsedCard.data as never);
    if (!resolvedPeriod) {
      return mcpError(
        "INVALID_DATA",
        "A configuração do cartão não permite determinar o período de cobrança com segurança.",
      );
    }

    let query = supabase
      .from("expenses")
      .select(
        "id,description,amount,expense_date,payment_method,card_id,card_name,category_id,category_name,installment_group_id,installment_number,total_installments",
      )
      .eq("user_id", userId)
      .eq("card_id", input.card_id)
      .eq("payment_method", "credit")
      .gte("expense_date", resolvedPeriod.start_date)
      .lte("expense_date", resolvedPeriod.end_date);
    const today = todayIso();
    if (timeScope === "occurred") query = query.lte("expense_date", today);
    const { data, error } = await query.limit(HARD_CAP + 1);
    if (error) return mcpError("INTERNAL_ERROR");
    const rows = data ?? [];
    if (rows.length > HARD_CAP) return mcpError("RESULT_SET_TOO_LARGE");

    const occurred = rows.filter((row) => row.expense_date <= today);
    const future = rows.filter((row) => row.expense_date > today);
    const installmentRows = rows.filter(hasInstallmentEvidence);
    const nonInstallmentRows = rows.filter((row) => !hasInstallmentEvidence(row));
    const sum = (items: typeof rows) =>
      roundFinancial(items.reduce((total, row) => total + Number(row.amount), 0));
    const registeredTotal = sum(rows);

    const largestRow = [...rows].sort(
      (left, right) =>
        Number(right.amount) - Number(left.amount) ||
        left.expense_date.localeCompare(right.expense_date) ||
        left.id.localeCompare(right.id),
    )[0];
    const largestTransaction = largestRow
      ? {
          transaction_id: largestRow.id,
          description: largestRow.description,
          amount: roundFinancial(Number(largestRow.amount)),
          date: largestRow.expense_date,
          category_name: largestRow.category_name,
          installment_number: largestRow.installment_number,
          total_installments: largestRow.total_installments,
        }
      : null;

    const categories = new Map<string, { total: number; count: number }>();
    for (const row of rows) {
      const name = row.category_name ?? "Sem categoria";
      const current = categories.get(name) ?? { total: 0, count: 0 };
      current.total += Number(row.amount);
      current.count += 1;
      categories.set(name, current);
    }
    const categoriesSummary = [...categories.entries()]
      .map(([category_name, value]) => ({
        category_name,
        total: roundFinancial(value.total),
        transaction_count: value.count,
        percentage:
          registeredTotal === 0
            ? 0
            : roundFinancial((value.total / registeredTotal) * 100),
      }))
      .sort(
        (left, right) =>
          right.total - left.total ||
          left.category_name.localeCompare(right.category_name, "pt-BR"),
      )
      .slice(0, 10);

    const warnings: Array<(typeof CARD_SUMMARY_WARNINGS)[number]> = [];
    if (!parsedCard.data.is_active) warnings.push("INACTIVE_CARD");
    if (resolvedPeriod.configuration_warning) {
      warnings.push("INVALID_CARD_CONFIGURATION");
    }
    if (
      rows.some(
        (row) =>
          row.card_name === null ||
          (hasInstallmentEvidence(row) &&
            installmentWarnings(row).some(
              (warning) =>
                warning !== "MISSING_CATEGORY" &&
                warning !== "NON_CREDIT_PAYMENT_METHOD",
            )),
      )
    ) {
      warnings.push("CREDIT_EXPENSE_WITHOUT_EXPECTED_METADATA");
    }
    warnings.push("BILLING_TOTAL_IS_CALCULATED", "PAYMENT_STATUS_NOT_AVAILABLE");

    const billingPeriod = {
      billing_month: resolvedPeriod.billing_month,
      start_date: resolvedPeriod.start_date,
      end_date: resolvedPeriod.end_date,
      closing_date: resolvedPeriod.closing_date,
      due_date: resolvedPeriod.due_date,
      calculation_mode: resolvedPeriod.calculation_mode,
    };
    const metrics = {
      registered_total: registeredTotal,
      occurred_total: sum(occurred),
      future_materialized_total: sum(future),
      transaction_count: rows.length,
      occurred_transaction_count: occurred.length,
      future_transaction_count: future.length,
      installment_total: sum(installmentRows),
      non_installment_total: sum(nonInstallmentRows),
    };
    const result = {
      card: parsedCard.data,
      billing_period: billingPeriod,
      metrics,
      largest_transaction: largestTransaction,
      categories_summary: categoriesSummary,
      data_complete: true,
      warnings,
    };
    const categoryText = categoriesSummary
      .map(
        (category) =>
          `${category.category_name}: ${category.total} (${category.transaction_count}; ${category.percentage}%)`,
      )
      .join("; ");
    const largestText = largestTransaction
      ? `${largestTransaction.description}, ${largestTransaction.amount}, em ${largestTransaction.date}`
      : "nenhuma";
    return {
      content: [
        {
          type: "text",
          text:
            `Cartão: ${parsedCard.data.name}; status: ${parsedCard.data.is_active ? "ativo" : "inativo"}. ` +
            `Período calculado (${billingMonth}, mês de referência): ${billingPeriod.start_date} a ${billingPeriod.end_date}; ` +
            `fechamento=${billingPeriod.closing_date ?? "não disponível"}; vencimento=${billingPeriod.due_date ?? "não disponível"}; ` +
            `modo=${billingPeriod.calculation_mode}; time_scope=${timeScope}. ` +
            `Total registrado no Gastinho para o período calculado: ${metrics.registered_total}; ` +
            `parte já ocorrida: ${metrics.occurred_total}; parte futura materializada: ${metrics.future_materialized_total}; ` +
            `lançamentos: ${metrics.transaction_count} (ocorridos=${metrics.occurred_transaction_count}, futuros=${metrics.future_transaction_count}); ` +
            `total parcelado=${metrics.installment_total}; total não parcelado=${metrics.non_installment_total}. ` +
            `Maior transação: ${largestText}. Principais categorias (máximo 10): ${categoryText || "nenhuma"}. ` +
            `Avisos: ${warnings.join(", ")}. Os valores refletem somente lançamentos registrados no Gastinho; ` +
            "não existe tabela real de faturas e pagamento ou quitação não são conhecidos.",
        },
      ],
      structuredContent: result,
    };
  },
});
