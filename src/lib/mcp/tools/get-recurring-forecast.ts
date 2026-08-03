import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ISO_DATE_RE } from "../shared/dates";
import { mcpError } from "../shared/errors";
import {
  inclusiveDays,
  validateBoundedDateRange,
} from "../shared/phase-1.1b-core";
import {
  projectRecurringTemplates,
  RECURRING_DATA_WARNINGS,
  recurringItem,
  type RecurringGranularity,
  type RecurringItem,
  type RecurringRow,
} from "../shared/recurring";
import type { McpScope } from "../shared/scope";
import { supabaseForUser, type McpQueryLike } from "../shared/supabase-client";

const TEMPLATE_CAP = 100;
const OCCURRENCE_CAP = 1_000;
const warningSchema = z.enum(RECURRING_DATA_WARNINGS);

const occurrenceSchema = z.object({
  date: z.string().regex(ISO_DATE_RE),
  transaction_type: z.enum(["expense", "income"]),
  amount: z.number(),
  recurring_transaction_id: z.string().uuid(),
  description: z.string(),
  category_name: z.string().nullable(),
  source: z.literal("recurring_template"),
  shared_group_id: z.string().uuid().nullable(),
  is_owner: z.boolean(),
  data_warnings: z.array(warningSchema),
}).strict();

const seriesPointSchema = z.object({
  period: z.string(),
  projected_income: z.number(),
  projected_expenses: z.number(),
  projected_balance: z.number(),
  occurrence_count: z.number().int().nonnegative(),
}).strict();

export default defineTool({
  name: "get_recurring_forecast",
  title: "Projetar templates recorrentes",
  description:
    "Projeta ocorrências mensais exclusivamente a partir dos templates recorrentes cadastrados. Não consulta nem representa despesas, receitas ou parcelas já materializadas.",
  inputSchema: {
    start_date: z.string().regex(ISO_DATE_RE),
    end_date: z.string().regex(ISO_DATE_RE),
    transaction_type: z.enum(["expense", "income", "all"]).optional(),
    scope: z.enum(["personal", "shared", "all_accessible"]).optional(),
    group_id: z.string().uuid().optional(),
    granularity: z.enum(["day", "week", "month"]).optional(),
    include_occurrences: z.boolean().optional(),
  },
  outputSchema: {
    requested_period: z.object({
      start_date: z.string().regex(ISO_DATE_RE),
      end_date: z.string().regex(ISO_DATE_RE),
    }).strict(),
    effective_period: z.object({
      start_date: z.string().regex(ISO_DATE_RE),
      end_date: z.string().regex(ISO_DATE_RE),
      days: z.number().int().positive(),
    }).strict(),
    scope: z.enum(["personal", "shared", "all_accessible"]),
    templates_considered: z.number().int().nonnegative(),
    occurrences: z.array(occurrenceSchema),
    series: z.array(seriesPointSchema),
    projected_income: z.number(),
    projected_expenses: z.number(),
    projected_balance: z.number(),
    warnings: z.array(warningSchema),
    data_complete: z.boolean(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const userId = ctx.getUserId();
    if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
    const range = validateBoundedDateRange(input.start_date, input.end_date);
    if (range.ok === false) return mcpError(range.code);

    const transactionType = input.transaction_type ?? "all";
    const scope: McpScope = input.scope ?? "personal";
    const granularity: RecurringGranularity = input.granularity ?? "month";
    const includeOccurrences = input.include_occurrences ?? true;
    const supabase = supabaseForUser(ctx);
    const configure = <
      T extends {
        eq(column: string, value: string | boolean): T;
        not(column: string, operator: string, value: null): T;
      },
    >(query: T): T => {
      let configured = query.eq("is_active", true);
      if (scope === "personal") configured = configured.eq("user_id", userId);
      if (scope === "shared") {
        configured = configured.not("shared_group_id", "is", null);
      }
      if (input.group_id) {
        configured = configured.eq("shared_group_id", input.group_id);
      }
      return configured;
    };

    const expensePromise =
      transactionType === "income"
        ? Promise.resolve({ data: [], error: null })
        : configure(
            supabase
              .from("recurring_expenses")
              .select(
                "id,user_id,description,amount,day_of_month,start_date,end_date,is_active,category_id,category_name,shared_group_id,created_at,updated_at,payment_method,card_id,card_name",
              ) as unknown as McpQueryLike,
          ).limit(TEMPLATE_CAP + 1);
    const incomePromise =
      transactionType === "expense"
        ? Promise.resolve({ data: [], error: null })
        : configure(
            supabase
              .from("recurring_incomes")
              .select(
                "id,user_id,description,amount,day_of_month,start_date,end_date,is_active,income_category_id,category_name,shared_group_id,created_at,updated_at",
              ) as unknown as McpQueryLike,
          ).limit(TEMPLATE_CAP + 1);
    const [expenseResult, incomeResult] = await Promise.all([
      expensePromise,
      incomePromise,
    ]);
    if (expenseResult.error || incomeResult.error) return mcpError("INTERNAL_ERROR");
    const templates: RecurringItem[] = [
      ...((expenseResult.data ?? []) as RecurringRow[]).map((row) =>
        recurringItem(row, "expense", userId)),
      ...((incomeResult.data ?? []) as RecurringRow[]).map((row) =>
        recurringItem(row, "income", userId)),
    ];
    if (templates.length > TEMPLATE_CAP) return mcpError("RESULT_SET_TOO_LARGE");

    const projection = projectRecurringTemplates(
      templates,
      input.start_date,
      input.end_date,
      granularity,
      OCCURRENCE_CAP,
    );
    if (projection.ok === false) return mcpError(projection.code);

    const requestedPeriod = {
      start_date: input.start_date,
      end_date: input.end_date,
    };
    const effectivePeriod = {
      ...requestedPeriod,
      days: inclusiveDays(input.start_date, input.end_date),
    };
    const result = {
      requested_period: requestedPeriod,
      effective_period: effectivePeriod,
      scope,
      templates_considered: templates.length,
      occurrences: includeOccurrences ? projection.occurrences : [],
      series: projection.series,
      projected_income: projection.projected_income,
      projected_expenses: projection.projected_expenses,
      projected_balance: projection.projected_balance,
      warnings: projection.warnings,
      data_complete: true,
    };
    const templatePreview = templates.slice(0, 10).map((template) => ({
      id: template.id,
      transaction_type: template.transaction_type,
      description: template.description,
      amount: template.amount,
      day_of_month: template.day_of_month,
      data_warnings: template.data_warnings,
    }));
    return {
      content: [
        {
          type: "text",
          text:
            "Esta é uma projeção baseada somente nos templates recorrentes cadastrados. " +
            "Ela não inclui lançamentos reais nem parcelas futuras já materializadas. " +
            `Filtros={start_date=${input.start_date}; end_date=${input.end_date}; ` +
            `transaction_type=${transactionType}; scope=${scope}; group_id=${input.group_id ?? "null"}; ` +
            `granularity=${granularity}; include_occurrences=${includeOccurrences}}. ` +
            `Período efetivo=${JSON.stringify(effectivePeriod)}; templates_considered=${templates.length}. ` +
            `Templates (máximo 10)=${JSON.stringify(templatePreview)}. ` +
            `Ocorrências (máximo 20)=${JSON.stringify(projection.occurrences.slice(0, 20))}; ` +
            `ocorrências omitidas do content=${Math.max(0, projection.occurrences.length - 20)}. ` +
            `Série (máximo 12 pontos)=${JSON.stringify(projection.series.slice(0, 12))}; ` +
            `pontos omitidos do content=${Math.max(0, projection.series.length - 12)}. ` +
            `projected_income=${projection.projected_income}; projected_expenses=${projection.projected_expenses}; ` +
            `projected_balance=${projection.projected_balance}; warnings=${JSON.stringify(projection.warnings)}; ` +
            "data_complete=true.",
        },
      ],
      structuredContent: result,
    };
  },
});
