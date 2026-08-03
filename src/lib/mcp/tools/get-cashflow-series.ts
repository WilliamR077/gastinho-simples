import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  CASHFLOW_WARNINGS,
  calculateCashflowSeries,
  partialPeriodWarnings,
  saoPauloCivilDate,
  zonedMidnightUtc,
  type CashflowTransaction,
} from "../shared/cashflow";
import { todayIso } from "../shared/dates";
import { mcpError } from "../shared/errors";
import {
  addIsoDays,
  inclusiveDays,
  roundFinancial,
  validateBoundedDateRange,
} from "../shared/phase-1.1b-core";
import type { McpScope } from "../shared/scope";
import { supabaseForUser, type McpQueryLike } from "../shared/supabase-client";

const TRANSACTION_CAP = 10_000;
const warningSchema = z.enum(CASHFLOW_WARNINGS);
const periodSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
}).strict();
const effectivePeriodSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  days: z.number().int().positive(),
}).strict().nullable();
const pointSchema = z.object({
  period_start: z.string(),
  period_end: z.string(),
  label: z.string(),
  realized_income: z.number(),
  realized_expenses: z.number(),
  realized_balance: z.number(),
  cumulative_balance: z.number(),
  income_count: z.number().int().nonnegative(),
  expense_count: z.number().int().nonnegative(),
  transaction_count: z.number().int().nonnegative(),
}).strict();

interface ExpenseCashflowRow {
  amount: number;
  expense_date: string;
}

interface IncomeCashflowRow {
  amount: number;
  income_date: string;
}

export default defineTool({
  name: "get_cashflow_series",
  title: "Consultar fluxo de caixa realizado",
  description:
    "Apresenta uma série factual de receitas e despesas efetivamente registradas até hoje. Não inclui projeções, templates recorrentes ou transações futuras e não representa saldo bancário.",
  inputSchema: {
    start_date: z.string(),
    end_date: z.string(),
    scope: z.enum(["personal", "shared", "all_accessible"]).optional(),
    group_id: z.string().uuid().optional(),
    granularity: z.enum(["day", "week", "month"]).optional(),
    include_empty_periods: z.boolean().optional(),
  },
  outputSchema: {
    requested_period: periodSchema,
    effective_period: effectivePeriodSchema,
    coverage_warning: z.string().nullable(),
    granularity: z.enum(["day", "week", "month"]),
    scope: z.enum(["personal", "shared", "all_accessible"]),
    data_complete: z.boolean(),
    series: z.array(pointSchema),
    total_income: z.number(),
    total_expenses: z.number(),
    total_balance: z.number(),
    income_count: z.number().int().nonnegative(),
    expense_count: z.number().int().nonnegative(),
    transaction_count: z.number().int().nonnegative(),
    opening_cumulative_balance: z.literal(0),
    closing_cumulative_balance: z.number(),
    warnings: z.array(warningSchema),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const userId = ctx.getUserId();
    if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
    const range = validateBoundedDateRange(input.start_date, input.end_date);
    if (!range.ok) {
      return mcpError((range as Extract<typeof range, { ok: false }>).code);
    }
    const scope: McpScope = input.scope ?? "personal";
    const granularity = input.granularity ?? "month";
    const includeEmptyPeriods = input.include_empty_periods ?? true;
    const today = todayIso();
    const entirelyFuture = input.start_date > today;
    const truncated = input.end_date > today && !entirelyFuture;
    const effectiveEnd = input.end_date > today ? today : input.end_date;
    const effectivePeriod = entirelyFuture
      ? null
      : {
          start_date: input.start_date,
          end_date: effectiveEnd,
          days: inclusiveDays(input.start_date, effectiveEnd),
        };
    const coverageWarning = entirelyFuture
      ? "O período solicitado está totalmente no futuro e não contém dados realizados."
      : truncated
        ? "O período efetivo foi limitado à data de hoje em America/Sao_Paulo."
        : null;
    const warnings = new Set<(typeof CASHFLOW_WARNINGS)[number]>();
    if (entirelyFuture) warnings.add("FUTURE_PERIOD_NO_REALIZED_DATA");
    if (truncated) warnings.add("PERIOD_TRUNCATED_TO_TODAY");
    const seriesStart = input.start_date;
    const seriesEnd = entirelyFuture ? input.end_date : effectiveEnd;
    for (const warning of partialPeriodWarnings(
      seriesStart,
      seriesEnd,
      granularity,
    )) {
      warnings.add(warning);
    }

    const supabase = supabaseForUser(ctx);
    const applyScope = <
      T extends {
        eq(column: string, value: string): T;
        not(column: string, operator: string, value: null): T;
      },
    >(query: T): T => {
      let scoped = query;
      if (scope === "personal") scoped = scoped.eq("user_id", userId);
      if (scope === "shared") {
        scoped = scoped.not("shared_group_id", "is", null);
      }
      if (input.group_id) {
        scoped = scoped.eq("shared_group_id", input.group_id);
      }
      return scoped;
    };
    const fetchRows = async (
      table: "expenses" | "incomes",
    ): Promise<
      | { ok: true; data: Array<ExpenseCashflowRow | IncomeCashflowRow> }
      | { ok: false; tooLarge: boolean }
    > => {
      if (!effectivePeriod) return { ok: true, data: [] };
      const dateColumn = table === "expenses" ? "expense_date" : "income_date";
      const columns = `amount,${dateColumn}`;
      const rows: Array<ExpenseCashflowRow | IncomeCashflowRow> = [];
      let offset = 0;
      while (offset <= TRANSACTION_CAP) {
        const end = Math.min(offset + 999, TRANSACTION_CAP);
        let query = applyScope(
          supabase.from(table).select(columns) as unknown as McpQueryLike,
        );
        if (table === "expenses") {
          query = query
            .gte(dateColumn, effectivePeriod.start_date)
            .lte(dateColumn, effectivePeriod.end_date);
        } else {
          query = query
            .gte(dateColumn, zonedMidnightUtc(effectivePeriod.start_date))
            .lt(
              dateColumn,
              zonedMidnightUtc(addIsoDays(effectivePeriod.end_date, 1)),
            );
        }
        const { data, error } = await query
          .order(dateColumn, { ascending: true })
          .range(offset, end);
        if (error) return { ok: false, tooLarge: false };
        const page = (data ?? []) as unknown as Array<
          ExpenseCashflowRow | IncomeCashflowRow
        >;
        rows.push(...page);
        if (rows.length > TRANSACTION_CAP) {
          return { ok: false, tooLarge: true };
        }
        if (page.length < end - offset + 1) return { ok: true, data: rows };
        offset = end + 1;
      }
      return { ok: false, tooLarge: true };
    };
    const [expenseResult, incomeResult] = await Promise.all([
      fetchRows("expenses"),
      fetchRows("incomes"),
    ]);
    if (!expenseResult.ok || !incomeResult.ok) {
      return mcpError(
        (expenseResult.ok === false && expenseResult.tooLarge) ||
          (incomeResult.ok === false && incomeResult.tooLarge)
          ? "RESULT_SET_TOO_LARGE"
          : "INTERNAL_ERROR",
      );
    }

    const transactions: CashflowTransaction[] = [];
    for (const raw of expenseResult.data as ExpenseCashflowRow[]) {
      const date = saoPauloCivilDate(raw.expense_date);
      if (!date) {
        warnings.add("INVALID_TRANSACTION_DATE");
        continue;
      }
      const amount = Number(raw.amount);
      if (amount < 0) warnings.add("NEGATIVE_EXPENSE_VALUE");
      transactions.push({ transaction_type: "expense", amount, date });
    }
    for (const raw of incomeResult.data as IncomeCashflowRow[]) {
      const date = saoPauloCivilDate(raw.income_date);
      if (!date) {
        warnings.add("INVALID_TRANSACTION_DATE");
        continue;
      }
      const amount = Number(raw.amount);
      if (amount < 0) warnings.add("NEGATIVE_INCOME_VALUE");
      transactions.push({ transaction_type: "income", amount, date });
    }
    const totals = calculateCashflowSeries(transactions, {
      start_date: seriesStart,
      end_date: seriesEnd,
      granularity,
      include_empty_periods: includeEmptyPeriods,
    });
    const dataComplete = !warnings.has("INVALID_TRANSACTION_DATE");
    const result = {
      requested_period: {
        start_date: input.start_date,
        end_date: input.end_date,
      },
      effective_period: effectivePeriod,
      coverage_warning: coverageWarning,
      granularity,
      scope,
      data_complete: dataComplete,
      ...totals,
      warnings: [...warnings],
    };
    const detailedPoints = totals.series.slice(0, 31);
    const compactPoints = totals.series.slice(31).map((point) => ({
      period_start: point.period_start,
      period_end: point.period_end,
      realized_income: point.realized_income,
      realized_expenses: point.realized_expenses,
      realized_balance: point.realized_balance,
      cumulative_balance: point.cumulative_balance,
      transaction_count: point.transaction_count,
    }));
    return {
      content: [
        {
          type: "text",
          text:
            `Fluxo de caixa realizado; requested_period=${JSON.stringify(result.requested_period)}; ` +
            `effective_period=${JSON.stringify(effectivePeriod)}; coverage_warning=${coverageWarning ?? "null"}; ` +
            `scope=${scope}; granularity=${granularity}; data_complete=${dataComplete}. ` +
            `Totais: income=${totals.total_income}; expenses=${totals.total_expenses}; ` +
            `balance=${totals.total_balance}; income_count=${totals.income_count}; ` +
            `expense_count=${totals.expense_count}; transaction_count=${totals.transaction_count}; ` +
            `opening_cumulative_balance=0; closing_cumulative_balance=${totals.closing_cumulative_balance}. ` +
            `Pontos detalhados=${JSON.stringify(detailedPoints)}. ` +
            `Pontos compactos restantes=${JSON.stringify(compactPoints)}. ` +
            `warnings=${JSON.stringify([...warnings])}. ` +
            "O cumulative_balance começa em zero no início do intervalo solicitado e acumula somente " +
            "os movimentos realizados desse intervalo; não representa saldo de conta bancária. " +
            "Templates recorrentes e transações com data futura não estão incluídos.",
        },
      ],
      structuredContent: result,
    };
  },
});
