import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  CASHFLOW_PROJECTION_WARNINGS,
  calculateCashflowProjection,
  type ProjectionEvent,
} from "../shared/cashflow-projection";
import {
  partialPeriodWarnings,
  saoPauloCivilDate,
  zonedMidnightUtc,
} from "../shared/cashflow";
import { todayIso } from "../shared/dates";
import { mcpError } from "../shared/errors";
import {
  addIsoDays,
  inclusiveDays,
  validateBoundedDateRange,
} from "../shared/phase-1.1b-core";
import {
  projectRecurringTemplates,
  recurringItem,
  type RecurringItem,
  type RecurringRow,
} from "../shared/recurring";
import type { McpScope } from "../shared/scope";
import { supabaseForUser } from "../shared/supabase-client";

const TRANSACTION_CAP = 10_000;
const TEMPLATE_CAP = 100;
const OCCURRENCE_CAP = 1_000;
const warningSchema = z.enum(CASHFLOW_PROJECTION_WARNINGS);
const periodSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
}).strict();
const optionalPeriodSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  days: z.number().int().positive(),
}).strict().nullable();
const componentSchema = z.object({
  income: z.number(),
  expenses: z.number(),
  balance: z.number(),
  income_count: z.number().int().nonnegative(),
  expense_count: z.number().int().nonnegative(),
  transaction_count: z.number().int().nonnegative(),
}).strict();
const recurringComponentSchema = componentSchema.extend({
  templates_considered: z.number().int().nonnegative(),
  occurrence_count: z.number().int().nonnegative(),
}).strict();
const pointSchema = z.object({
  period_start: z.string(),
  period_end: z.string(),
  label: z.string(),
  realized_income: z.number(),
  realized_expenses: z.number(),
  realized_balance: z.number(),
  future_materialized_income: z.number(),
  future_materialized_expenses: z.number(),
  future_materialized_balance: z.number(),
  recurring_projected_income: z.number(),
  recurring_projected_expenses: z.number(),
  recurring_projected_balance: z.number(),
  combined_income: z.number(),
  combined_expenses: z.number(),
  combined_balance: z.number(),
  cumulative_combined_balance: z.number(),
  realized_transaction_count: z.number().int().nonnegative(),
  future_materialized_transaction_count: z.number().int().nonnegative(),
  recurring_occurrence_count: z.number().int().nonnegative(),
}).strict();

interface ExpenseProjectionRow {
  amount: number;
  expense_date: string;
}

interface IncomeProjectionRow {
  amount: number;
  income_date: string;
}

export default defineTool({
  name: "get_cashflow_projection",
  title: "Projetar fluxo de caixa por componentes",
  description:
    "Combina matematicamente realizado, lançamentos futuros materializados e templates recorrentes, mantendo os três componentes separados. Não representa saldo bancário nem previsão garantida.",
  inputSchema: {
    start_date: z.string(),
    end_date: z.string(),
    scope: z.enum(["personal", "shared", "all_accessible"]).optional(),
    group_id: z.string().uuid().optional(),
    granularity: z.enum(["day", "week", "month"]).optional(),
    include_empty_periods: z.boolean().optional(),
    include_realized: z.boolean().optional(),
    include_future_materialized: z.boolean().optional(),
    include_recurring_templates: z.boolean().optional(),
  },
  outputSchema: {
    requested_period: periodSchema,
    realized_period: optionalPeriodSchema,
    future_projection_period: optionalPeriodSchema,
    today: z.string(),
    granularity: z.enum(["day", "week", "month"]),
    scope: z.enum(["personal", "shared", "all_accessible"]),
    data_complete: z.boolean(),
    realized: componentSchema,
    future_materialized: componentSchema,
    recurring_projection: recurringComponentSchema,
    combined_income: z.number(),
    combined_expenses: z.number(),
    combined_balance: z.number(),
    opening_cumulative_balance: z.literal(0),
    closing_cumulative_balance: z.number(),
    series: z.array(pointSchema),
    warnings: z.array(warningSchema),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const userId = ctx.getUserId();
    if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
    const range = validateBoundedDateRange(input.start_date, input.end_date);
    if (!range.ok) return mcpError(range.code);
    const scope: McpScope = input.scope ?? "personal";
    const granularity = input.granularity ?? "month";
    const includeEmpty = input.include_empty_periods ?? true;
    const includeRealized = input.include_realized ?? true;
    const includeFuture = input.include_future_materialized ?? true;
    const includeRecurring = input.include_recurring_templates ?? true;
    const today = todayIso();
    const tomorrow = addIsoDays(today, 1);
    const realizedPeriod =
      input.start_date <= today
        ? {
            start_date: input.start_date,
            end_date: input.end_date < today ? input.end_date : today,
            days: inclusiveDays(
              input.start_date,
              input.end_date < today ? input.end_date : today,
            ),
          }
        : null;
    const futurePeriod =
      input.end_date > today
        ? {
            start_date: input.start_date > tomorrow ? input.start_date : tomorrow,
            end_date: input.end_date,
            days: inclusiveDays(
              input.start_date > tomorrow ? input.start_date : tomorrow,
              input.end_date,
            ),
          }
        : null;
    const warnings = new Set<
      (typeof CASHFLOW_PROJECTION_WARNINGS)[number]
    >();
    if (!futurePeriod) warnings.add("PAST_PERIOD_NO_FUTURE_PROJECTION");
    if (!realizedPeriod) warnings.add("FUTURE_PERIOD_NO_REALIZED_DATA");
    for (const warning of partialPeriodWarnings(
      input.start_date,
      input.end_date,
      granularity,
    )) {
      warnings.add(warning);
    }
    const supabase = supabaseForUser(ctx);
    const configure = <
      T extends {
        eq(column: string, value: string | boolean): T;
        not(column: string, operator: string, value: null): T;
      },
    >(query: T): T => {
      let configured = query;
      if (scope === "personal") configured = configured.eq("user_id", userId);
      if (scope === "shared") {
        configured = configured.not("shared_group_id", "is", null);
      }
      if (input.group_id) {
        configured = configured.eq("shared_group_id", input.group_id);
      }
      return configured;
    };

    const transactionStart =
      includeRealized && realizedPeriod
        ? realizedPeriod.start_date
        : includeFuture && futurePeriod
          ? futurePeriod.start_date
          : null;
    const transactionEnd =
      includeFuture && futurePeriod
        ? futurePeriod.end_date
        : includeRealized && realizedPeriod
          ? realizedPeriod.end_date
          : null;
    const fetchTransactions = async (
      table: "expenses" | "incomes",
    ): Promise<
      | { ok: true; rows: Array<ExpenseProjectionRow | IncomeProjectionRow> }
      | { ok: false; tooLarge: boolean }
    > => {
      if (!transactionStart || !transactionEnd) return { ok: true, rows: [] };
      const dateColumn = table === "expenses" ? "expense_date" : "income_date";
      const rows: Array<ExpenseProjectionRow | IncomeProjectionRow> = [];
      let offset = 0;
      while (offset <= TRANSACTION_CAP) {
        const end = Math.min(offset + 999, TRANSACTION_CAP);
        let query = configure(
          supabase.from(table).select(`amount,${dateColumn}`),
        );
        if (table === "expenses") {
          query = query
            .gte(dateColumn, transactionStart)
            .lte(dateColumn, transactionEnd);
        } else {
          query = query
            .gte(dateColumn, zonedMidnightUtc(transactionStart))
            .lt(
              dateColumn,
              zonedMidnightUtc(addIsoDays(transactionEnd, 1)),
            );
        }
        const { data, error } = await query
          .order(dateColumn, { ascending: true })
          .range(offset, end);
        if (error) return { ok: false, tooLarge: false };
        const page = (data ?? []) as Array<
          ExpenseProjectionRow | IncomeProjectionRow
        >;
        rows.push(...page);
        if (rows.length > TRANSACTION_CAP) {
          return { ok: false, tooLarge: true };
        }
        if (page.length < end - offset + 1) return { ok: true, rows };
        offset = end + 1;
      }
      return { ok: false, tooLarge: true };
    };
    const [expenseResult, incomeResult] = await Promise.all([
      fetchTransactions("expenses"),
      fetchTransactions("incomes"),
    ]);
    if (!expenseResult.ok || !incomeResult.ok) {
      return mcpError(
        (expenseResult.ok === false && expenseResult.tooLarge) ||
          (incomeResult.ok === false && incomeResult.tooLarge)
          ? "RESULT_SET_TOO_LARGE"
          : "INTERNAL_ERROR",
      );
    }

    const events: ProjectionEvent[] = [];
    const addTransaction = (
      type: "expense" | "income",
      amountValue: number,
      rawDate: string,
    ) => {
      const date = saoPauloCivilDate(rawDate);
      if (!date) {
        warnings.add("INVALID_TRANSACTION_DATE");
        return;
      }
      const amount = Number(amountValue);
      if (amount < 0) {
        warnings.add(
          type === "expense"
            ? "NEGATIVE_EXPENSE_VALUE"
            : "NEGATIVE_INCOME_VALUE",
        );
      }
      if (date <= today && includeRealized) {
        events.push({ component: "realized", transaction_type: type, amount, date });
      } else if (date > today && includeFuture) {
        events.push({
          component: "future_materialized",
          transaction_type: type,
          amount,
          date,
        });
      }
    };
    for (const row of expenseResult.rows as ExpenseProjectionRow[]) {
      addTransaction("expense", row.amount, row.expense_date);
    }
    for (const row of incomeResult.rows as IncomeProjectionRow[]) {
      addTransaction("income", row.amount, row.income_date);
    }

    let templatesConsidered = 0;
    let recurringOccurrenceCount = 0;
    if (includeRecurring && futurePeriod) {
      const expenseTemplatesPromise = configure(
        supabase
          .from("recurring_expenses")
          .select(
            "id,user_id,description,amount,day_of_month,start_date,end_date,is_active,category_id,category_name,shared_group_id,created_at,updated_at,payment_method,card_id,card_name",
          ),
      ).eq("is_active", true).limit(TEMPLATE_CAP + 1);
      const incomeTemplatesPromise = configure(
        supabase
          .from("recurring_incomes")
          .select(
            "id,user_id,description,amount,day_of_month,start_date,end_date,is_active,income_category_id,category_name,shared_group_id,created_at,updated_at",
          ),
      ).eq("is_active", true).limit(TEMPLATE_CAP + 1);
      const [expenseTemplates, incomeTemplates] = await Promise.all([
        expenseTemplatesPromise,
        incomeTemplatesPromise,
      ]);
      if (expenseTemplates.error || incomeTemplates.error) {
        return mcpError("INTERNAL_ERROR");
      }
      const templates: RecurringItem[] = [
        ...((expenseTemplates.data ?? []) as RecurringRow[]).map((row) =>
          recurringItem(row, "expense", userId)),
        ...((incomeTemplates.data ?? []) as RecurringRow[]).map((row) =>
          recurringItem(row, "income", userId)),
      ];
      if (templates.length > TEMPLATE_CAP) {
        return mcpError("RESULT_SET_TOO_LARGE");
      }
      templatesConsidered = templates.length;
      const projection = projectRecurringTemplates(
        templates,
        futurePeriod.start_date,
        futurePeriod.end_date,
        granularity,
        OCCURRENCE_CAP,
      );
      if (!projection.ok) return mcpError(projection.code);
      for (const warning of projection.warnings) {
        if (warning === "MISSING_START_DATE_USING_CREATED_AT") {
          warnings.add("RECURRING_START_DATE_FALLBACK");
        } else if (warning === "DAY_NOT_PRESENT_IN_MONTH") {
          warnings.add("RECURRING_DAY_NOT_AVAILABLE");
        } else {
          warnings.add("INVALID_RECURRING_TEMPLATE");
        }
      }
      const validOccurrences = projection.occurrences.filter(
        (occurrence) =>
          !occurrence.data_warnings.includes("NON_POSITIVE_AMOUNT"),
      );
      recurringOccurrenceCount = validOccurrences.length;
      for (const occurrence of validOccurrences) {
        events.push({
          component: "recurring_projection",
          transaction_type: occurrence.transaction_type,
          amount: occurrence.amount,
          date: occurrence.date,
        });
      }
      if (validOccurrences.length > 0) {
        warnings.add("POTENTIAL_RECURRING_OVERLAP");
      }
    }

    const projection = calculateCashflowProjection(events, {
      start_date: input.start_date,
      end_date: input.end_date,
      granularity,
      include_empty_periods: includeEmpty,
    });
    const dataComplete = !warnings.has("INVALID_TRANSACTION_DATE");
    const result = {
      requested_period: {
        start_date: input.start_date,
        end_date: input.end_date,
      },
      realized_period: realizedPeriod,
      future_projection_period: futurePeriod,
      today,
      granularity,
      scope,
      data_complete: dataComplete,
      realized: projection.realized,
      future_materialized: projection.future_materialized,
      recurring_projection: {
        ...projection.recurring_projection,
        templates_considered: templatesConsidered,
        occurrence_count: recurringOccurrenceCount,
      },
      combined_income: projection.combined_income,
      combined_expenses: projection.combined_expenses,
      combined_balance: projection.combined_balance,
      opening_cumulative_balance: projection.opening_cumulative_balance,
      closing_cumulative_balance: projection.closing_cumulative_balance,
      series: projection.series,
      warnings: [...warnings],
    };
    const detailed = projection.series.slice(0, 24);
    const compact = projection.series.slice(24).map((point) => ({
      period_start: point.period_start,
      period_end: point.period_end,
      combined_income: point.combined_income,
      combined_expenses: point.combined_expenses,
      combined_balance: point.combined_balance,
      cumulative_combined_balance: point.cumulative_combined_balance,
      realized_transaction_count: point.realized_transaction_count,
      future_materialized_transaction_count:
        point.future_materialized_transaction_count,
      recurring_occurrence_count: point.recurring_occurrence_count,
    }));
    return {
      content: [
        {
          type: "text",
          text:
            `Projeção de caixa por componentes; requested_period=${JSON.stringify(result.requested_period)}; ` +
            `realized_period=${JSON.stringify(realizedPeriod)}; future_projection_period=${JSON.stringify(futurePeriod)}; ` +
            `today=${today}; scope=${scope}; granularity=${granularity}; data_complete=${dataComplete}. ` +
            `Componentes ativados={realized:${includeRealized},future_materialized:${includeFuture},` +
            `recurring_templates:${includeRecurring}}. Realizado=${JSON.stringify(result.realized)}. ` +
            `Futuro materializado=${JSON.stringify(result.future_materialized)}. ` +
            `Recorrência projetada=${JSON.stringify(result.recurring_projection)}. ` +
            `Soma combinada={income:${result.combined_income},expenses:${result.combined_expenses},` +
            `balance:${result.combined_balance}}; opening_cumulative_balance=0; ` +
            `closing_cumulative_balance=${result.closing_cumulative_balance}. ` +
            `Pontos detalhados=${JSON.stringify(detailed)}. Pontos compactos restantes=${JSON.stringify(compact)}. ` +
            `warnings=${JSON.stringify(result.warnings)}. Templates podem representar compromissos já lançados ` +
            "manualmente; não existe vínculo para deduplicação segura. O total combinado é somente a soma " +
            "matemática dos componentes, não uma previsão garantida. O cumulative_combined_balance começa " +
            "em zero no intervalo e não representa saldo anterior ou saldo de conta bancária.",
        },
      ],
      structuredContent: result,
    };
  },
});
