import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpError } from "../shared/errors";
import {
  GOAL_TYPES,
  GOAL_WARNINGS,
  PROJECTION_WARNINGS,
  expenseMatchesGoalCategory,
  goalDataWarnings,
  goalDirection,
  goalItem,
  goalMetrics,
  incomeMatchesGoalCategory,
  resolveGoalReferencePeriod,
  type GoalRow,
} from "../shared/goals";
import { roundFinancial } from "../shared/phase-1.1b-core";
import {
  projectRecurringTemplates,
  recurringItem,
  type RecurringItem,
  type RecurringRow,
} from "../shared/recurring";
import { supabaseForUser } from "../shared/supabase-client";

const TRANSACTION_CAP = 10_000;
const TEMPLATE_CAP = 100;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const goalTypeSchema = z.enum(GOAL_TYPES);
const goalWarningSchema = z.enum(GOAL_WARNINGS);
const projectionWarningSchema = z.enum(PROJECTION_WARNINGS);

const goalSchema = z.object({
  id: z.string().uuid(),
  type: goalTypeSchema,
  category_reference: z.string().nullable(),
  limit_amount: z.number(),
  shared_group_id: z.string().uuid().nullable(),
  is_shared: z.boolean(),
  is_owner: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  data_warnings: z.array(goalWarningSchema),
}).strict();

interface ExpenseProgressRow {
  id: string;
  amount: number;
  category: string | null;
  category_id: string | null;
  category_name: string | null;
}

interface IncomeProgressRow {
  id: string;
  amount: number;
  category: string | null;
  income_category_id: string | null;
  category_name: string | null;
}

export default defineTool({
  name: "get_goal_progress",
  title: "Consultar progresso mensal da meta",
  description:
    "Calcula o progresso factual de uma meta ou limite mensal a partir dos lançamentos acessíveis. A projeção recorrente, quando solicitada, permanece separada e pode sobrepor lançamentos manuais.",
  inputSchema: {
    goal_id: z.string().uuid(),
    reference_month: z.string().regex(MONTH_RE).optional(),
    projection_mode: z.enum(["none", "recurring_templates"]).optional(),
  },
  outputSchema: {
    goal: goalSchema,
    reference_period: z.object({
      requested_period: z.object({
        start_date: z.string(),
        end_date: z.string(),
      }).strict(),
      effective_period: z.object({
        start_date: z.string(),
        end_date: z.string(),
      }).strict().nullable(),
    }).strict(),
    actual_value: z.number(),
    target_value: z.number(),
    actual_percentage: z.number().nullable(),
    actual_remaining: z.number(),
    actual_excess: z.number(),
    target_direction: z.enum(["maximum", "minimum"]),
    days_in_month: z.number().int().positive(),
    elapsed_days: z.number().int().nonnegative(),
    remaining_days: z.number().int().nonnegative(),
    transaction_count: z.number().int().nonnegative(),
    warnings: z.array(goalWarningSchema),
    projection_mode: z.enum(["none", "recurring_templates"]),
    recurring_projected_value: z.number().nullable(),
    projected_value: z.number().nullable(),
    projected_percentage: z.number().nullable(),
    projected_remaining: z.number().nullable(),
    projected_excess: z.number().nullable(),
    recurring_templates_considered: z.number().int().nonnegative().nullable(),
    projection_warnings: z.array(projectionWarningSchema),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const userId = ctx.getUserId();
    if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
    const projectionMode = input.projection_mode ?? "none";
    const supabase = supabaseForUser(ctx);
    const { data: rawGoal, error: goalError } = await supabase
      .from("budget_goals")
      .select(
        "id,user_id,type,category,limit_amount,shared_group_id,created_at,updated_at",
      )
      .eq("id", input.goal_id)
      .maybeSingle();
    if (goalError) return mcpError("INTERNAL_ERROR");
    if (!rawGoal) return mcpError("RESOURCE_NOT_FOUND");
    if (!GOAL_TYPES.includes(rawGoal.type)) return mcpError("INVALID_DATA");
    const goalRow = rawGoal as GoalRow;
    const publicGoal = goalItem(goalRow, userId);
    const reference = resolveGoalReferencePeriod(input.reference_month);

    const configureGoalScope = <
      T extends {
        eq(column: string, value: string | boolean): T;
        is(column: string, value: null): T;
      },
    >(query: T): T => {
      if (goalRow.shared_group_id !== null) {
        return query.eq("shared_group_id", goalRow.shared_group_id);
      }
      return query
        .eq("user_id", goalRow.user_id)
        .is("shared_group_id", null);
    };

    const fetchRows = async <T>(
      table: "expenses" | "incomes",
      columns: string,
      dateColumn: "expense_date" | "income_date",
    ): Promise<{ ok: true; rows: T[] } | { ok: false; tooLarge: boolean }> => {
      if (!reference.effective_period) return { ok: true, rows: [] };
      const rows: T[] = [];
      let offset = 0;
      while (offset <= TRANSACTION_CAP) {
        const end = Math.min(offset + 999, TRANSACTION_CAP);
        const query = configureGoalScope(
          supabase
            .from(table)
            .select(columns)
            .gte(dateColumn, reference.effective_period.start_date)
            .lte(dateColumn, reference.effective_period.end_date)
            .order("id", { ascending: true }),
        ).range(offset, end);
        const { data, error } = await query;
        if (error) return { ok: false, tooLarge: false };
        const page = (data ?? []) as T[];
        rows.push(...page);
        if (rows.length > TRANSACTION_CAP) {
          return { ok: false, tooLarge: true };
        }
        if (page.length < end - offset + 1) return { ok: true, rows };
        offset = end + 1;
      }
      return { ok: false, tooLarge: true };
    };

    const needsExpenses =
      goalRow.type === "monthly_total" ||
      goalRow.type === "category" ||
      goalRow.type === "balance_target";
    const needsIncomes =
      goalRow.type === "income_monthly_total" ||
      goalRow.type === "income_category" ||
      goalRow.type === "balance_target";
    const [expenseResult, incomeResult] = await Promise.all([
      needsExpenses
        ? fetchRows<ExpenseProgressRow>(
            "expenses",
            "id,amount,category,category_id,category_name",
            "expense_date",
          )
        : Promise.resolve({ ok: true as const, rows: [] }),
      needsIncomes
        ? fetchRows<IncomeProgressRow>(
            "incomes",
            "id,amount,category,income_category_id,category_name",
            "income_date",
          )
        : Promise.resolve({ ok: true as const, rows: [] }),
    ]);
    if (!expenseResult.ok || !incomeResult.ok) {
      return mcpError(
        expenseResult.ok === false && expenseResult.tooLarge ||
          incomeResult.ok === false && incomeResult.tooLarge
          ? "RESULT_SET_TOO_LARGE"
          : "INTERNAL_ERROR",
      );
    }

    const categoryReference = goalRow.category;
    const matchingExpenses =
      goalRow.type === "category" && categoryReference
        ? expenseResult.rows.filter((row) =>
            expenseMatchesGoalCategory(row, categoryReference))
        : expenseResult.rows;
    const matchingIncomes =
      goalRow.type === "income_category" && categoryReference
        ? incomeResult.rows.filter((row) =>
            incomeMatchesGoalCategory(row, categoryReference))
        : incomeResult.rows;
    const expenseTotal = roundFinancial(
      matchingExpenses.reduce((sum, row) => sum + Number(row.amount), 0),
    );
    const incomeTotal = roundFinancial(
      matchingIncomes.reduce((sum, row) => sum + Number(row.amount), 0),
    );
    const actualValue =
      goalRow.type === "balance_target"
        ? roundFinancial(incomeTotal - expenseTotal)
        : goalRow.type === "income_monthly_total" ||
            goalRow.type === "income_category"
          ? incomeTotal
          : expenseTotal;
    const transactionCount =
      goalRow.type === "balance_target"
        ? matchingExpenses.length + matchingIncomes.length
        : goalRow.type === "income_monthly_total" ||
            goalRow.type === "income_category"
          ? matchingIncomes.length
          : matchingExpenses.length;
    const warnings = goalDataWarnings(goalRow);
    if (reference.is_future) warnings.push("FUTURE_MONTH_NO_ACTUAL_DATA");
    if (
      (goalRow.type === "category" || goalRow.type === "income_category") &&
      transactionCount === 0
    ) {
      warnings.push("CATEGORY_NOT_FOUND");
    }
    const uniqueWarnings = [...new Set(warnings)];
    const actualMetrics = goalMetrics(actualValue, Number(goalRow.limit_amount));

    let recurringProjectedValue: number | null = null;
    let projectedValue: number | null = null;
    let projectedPercentage: number | null = null;
    let projectedRemaining: number | null = null;
    let projectedExcess: number | null = null;
    let recurringTemplatesConsidered: number | null = null;
    let projectionWarnings: Array<(typeof PROJECTION_WARNINGS)[number]> = [];

    if (projectionMode === "recurring_templates") {
      const configureTemplateQuery = <
        T extends {
          eq(column: string, value: string | boolean): T;
          is(column: string, value: null): T;
        },
      >(query: T): T => configureGoalScope(query.eq("is_active", true));
      const expenseTemplatesPromise =
        needsExpenses
          ? configureTemplateQuery(
              supabase
                .from("recurring_expenses")
                .select(
                  "id,user_id,description,amount,day_of_month,start_date,end_date,is_active,category,category_id,category_name,shared_group_id,created_at,updated_at,payment_method,card_id,card_name",
                ) as never,
            ).limit(TEMPLATE_CAP + 1)
          : Promise.resolve({ data: [], error: null });
      const incomeTemplatesPromise =
        needsIncomes
          ? configureTemplateQuery(
              supabase
                .from("recurring_incomes")
                .select(
                  "id,user_id,description,amount,day_of_month,start_date,end_date,is_active,category,income_category_id,category_name,shared_group_id,created_at,updated_at",
                ) as never,
            ).limit(TEMPLATE_CAP + 1)
          : Promise.resolve({ data: [], error: null });
      const [expenseTemplatesResult, incomeTemplatesResult] = await Promise.all([
        expenseTemplatesPromise,
        incomeTemplatesPromise,
      ]);
      if (expenseTemplatesResult.error || incomeTemplatesResult.error) {
        return mcpError("INTERNAL_ERROR");
      }
      let expenseTemplateRows =
        (expenseTemplatesResult.data ?? []) as RecurringRow[];
      let incomeTemplateRows =
        (incomeTemplatesResult.data ?? []) as RecurringRow[];
      if (expenseTemplateRows.length + incomeTemplateRows.length > TEMPLATE_CAP) {
        return mcpError("RESULT_SET_TOO_LARGE");
      }
      if (goalRow.type === "category" && categoryReference) {
        expenseTemplateRows = expenseTemplateRows.filter((row) =>
          expenseMatchesGoalCategory(
            {
              category: row.category ?? null,
              category_id: row.category_id ?? null,
              category_name: row.category_name,
            },
            categoryReference,
          ));
      }
      if (goalRow.type === "income_category" && categoryReference) {
        incomeTemplateRows = incomeTemplateRows.filter((row) =>
          incomeMatchesGoalCategory(
            {
              category: row.category ?? null,
              income_category_id: row.income_category_id ?? null,
              category_name: row.category_name,
            },
            categoryReference,
          ));
      }
      const templates: RecurringItem[] = [
        ...expenseTemplateRows.map((row) => recurringItem(row, "expense", userId)),
        ...incomeTemplateRows.map((row) => recurringItem(row, "income", userId)),
      ];
      const projection = projectRecurringTemplates(
        templates,
        reference.requested_period.start_date,
        reference.requested_period.end_date,
        "month",
      );
      if (projection.ok === false) return mcpError(projection.code);
      const today = reference.effective_period?.end_date ??
        (reference.is_future ? "" : reference.requested_period.end_date);
      const remainingOccurrences = projection.occurrences.filter(
        (occurrence) => reference.is_future || occurrence.date > today,
      );
      const validRemaining = remainingOccurrences.filter(
        (occurrence) =>
          !occurrence.data_warnings.includes("NON_POSITIVE_AMOUNT"),
      );
      const recurringExpenses = roundFinancial(
        validRemaining
          .filter((item) => item.transaction_type === "expense")
          .reduce((sum, item) => sum + item.amount, 0),
      );
      const recurringIncome = roundFinancial(
        validRemaining
          .filter((item) => item.transaction_type === "income")
          .reduce((sum, item) => sum + item.amount, 0),
      );
      recurringProjectedValue =
        goalRow.type === "balance_target"
          ? roundFinancial(recurringIncome - recurringExpenses)
          : goalRow.type === "income_monthly_total" ||
              goalRow.type === "income_category"
            ? recurringIncome
            : recurringExpenses;
      projectedValue = roundFinancial(actualValue + recurringProjectedValue);
      const projectedMetrics = goalMetrics(
        projectedValue,
        Number(goalRow.limit_amount),
      );
      projectedPercentage = projectedMetrics.actual_percentage;
      projectedRemaining = projectedMetrics.actual_remaining;
      projectedExcess = projectedMetrics.actual_excess;
      recurringTemplatesConsidered = templates.length;
      projectionWarnings = [
        ...(templates.length > 0 ? ["POTENTIAL_RECURRING_OVERLAP" as const] : []),
        ...projection.warnings,
      ];
      projectionWarnings = [...new Set(projectionWarnings)];
    }

    const result = {
      goal: publicGoal,
      reference_period: {
        requested_period: reference.requested_period,
        effective_period: reference.effective_period,
      },
      ...actualMetrics,
      target_direction: goalDirection(goalRow.type),
      days_in_month: reference.days_in_month,
      elapsed_days: reference.elapsed_days,
      remaining_days: reference.remaining_days,
      transaction_count: transactionCount,
      warnings: uniqueWarnings,
      projection_mode: projectionMode,
      recurring_projected_value: recurringProjectedValue,
      projected_value: projectedValue,
      projected_percentage: projectedPercentage,
      projected_remaining: projectedRemaining,
      projected_excess: projectedExcess,
      recurring_templates_considered: recurringTemplatesConsidered,
      projection_warnings: projectionWarnings,
    };
    const projectionText =
      projectionMode === "recurring_templates"
        ? `Projeção recorrente separada: recurring_projected_value=${recurringProjectedValue}; ` +
          `projected_value=${projectedValue}; projected_percentage=${projectedPercentage ?? "null"}; ` +
          `projected_remaining=${projectedRemaining}; projected_excess=${projectedExcess}; ` +
          `recurring_templates_considered=${recurringTemplatesConsidered}; ` +
          `projection_warnings=${JSON.stringify(projectionWarnings)}. ` +
          "Não existe vínculo entre templates e lançamentos reais; a projeção pode contar um compromisso já lançado manualmente. "
        : "Projeção recorrente não solicitada. ";
    return {
      content: [
        {
          type: "text",
          text:
            `Meta mensal: type=${goalRow.type}; category_reference=${goalRow.category ?? "null"}; ` +
            `reference_month=${input.reference_month ?? reference.requested_period.start_date.slice(0, 7)}; ` +
            `requested_period=${JSON.stringify(reference.requested_period)}; ` +
            `effective_period=${JSON.stringify(reference.effective_period)}. ` +
            `Valor realizado=${actualMetrics.actual_value}; alvo=${actualMetrics.target_value}; ` +
            `percentual=${actualMetrics.actual_percentage ?? "null"}; restante=${actualMetrics.actual_remaining}; ` +
            `excesso=${actualMetrics.actual_excess}; direção=${goalDirection(goalRow.type)}; ` +
            `transaction_count=${transactionCount}; dias decorridos=${reference.elapsed_days}; ` +
            `dias restantes=${reference.remaining_days}. ${projectionText}` +
            `warnings=${JSON.stringify(uniqueWarnings)}. Estas são metas ou limites mensais, ` +
            "não contas de investimento, contribuições acumuladas ou metas de poupança com prazo.",
        },
      ],
      structuredContent: result,
    };
  },
});
