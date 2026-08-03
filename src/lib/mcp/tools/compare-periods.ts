import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  financialMetrics,
  metricChanges,
  spendingBreakdown,
  type ExpenseBreakdownBy,
} from "../shared/analytics";
import { comparisonContent } from "../shared/content";
import { ISO_DATE_RE } from "../shared/dates";
import { mcpError } from "../shared/errors";
import {
  effectiveDateRange,
  getCursorSecret,
  inclusiveDays,
  INTERNAL_RESULT_CAP,
  percentageChange,
  roundFinancial,
  validateBoundedDateRange,
  type McpTimeScope,
} from "../shared/phase-1.1b-core";
import type { McpScope } from "../shared/scope";
import { supabaseForUser } from "../shared/supabase-client";
import {
  fetchAllExpenses,
  fetchAllIncomes,
  type ExpenseQueryFilters,
  type IncomeQueryFilters,
} from "../shared/transaction-query";

const metricsSchema = z.object({
  income: z.number(),
  expenses: z.number(),
  balance: z.number(),
  savings_rate: z.number().nullable(),
  expense_count: z.number().int().nonnegative(),
  income_count: z.number().int().nonnegative(),
});

const requestedPeriodSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
});

const effectivePeriodSchema = z
  .object({
    start_date: z.string(),
    end_date: z.string(),
    days: z.number().int().positive(),
  })
  .nullable();

export default defineTool({
  name: "compare_periods",
  title: "Comparar períodos",
  description:
    "Compara fatos financeiros de dois intervalos de até 366 dias. Retorna números e variações de A para B, sem diagnóstico ou recomendação.",
  inputSchema: {
    period_a_start: z.string().regex(ISO_DATE_RE),
    period_a_end: z.string().regex(ISO_DATE_RE),
    period_b_start: z.string().regex(ISO_DATE_RE),
    period_b_end: z.string().regex(ISO_DATE_RE),
    scope: z.enum(["personal", "shared", "all_accessible"]).optional(),
    time_scope: z.enum(["occurred", "future", "all"]).optional(),
    breakdown_by: z.enum(["category", "payment_method", "card", "none"]).optional(),
  },
  outputSchema: {
    period_a: z.object({
      start_date: z.string(),
      end_date: z.string(),
      days: z.number().int().nonnegative(),
      requested_days: z.number().int().positive(),
      effective_days: z.number().int().nonnegative(),
      requested_period: requestedPeriodSchema,
      effective_period: effectivePeriodSchema,
      coverage_warning: z.string().nullable(),
      metrics: metricsSchema,
    }),
    period_b: z.object({
      start_date: z.string(),
      end_date: z.string(),
      days: z.number().int().nonnegative(),
      requested_days: z.number().int().positive(),
      effective_days: z.number().int().nonnegative(),
      requested_period: requestedPeriodSchema,
      effective_period: effectivePeriodSchema,
      coverage_warning: z.string().nullable(),
      metrics: metricsSchema,
    }),
    absolute_changes: z.object({
      income: z.number(),
      expenses: z.number(),
      balance: z.number(),
      savings_rate: z.number().nullable(),
      expense_count: z.number().int(),
      income_count: z.number().int(),
    }),
    percentage_changes: z.object({
      income: z.number().nullable(),
      expenses: z.number().nullable(),
      balance: z.number().nullable(),
      savings_rate: z.number().nullable(),
      expense_count: z.number().nullable(),
      income_count: z.number().nullable(),
    }),
    breakdown_changes: z
      .array(
        z.object({
          key: z.string(),
          label: z.string(),
          period_a_total: z.number(),
          period_b_total: z.number(),
          absolute_change: z.number(),
          percentage_change: z.number().nullable(),
        }),
      )
      .nullable(),
    scope: z.enum(["personal", "shared", "all_accessible"]),
    time_scope: z.enum(["occurred", "future", "all"]),
    coverage_warning: z.array(z.string()),
    data_sufficiency_warnings: z.array(z.string()),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated() || !ctx.getUserId()) return mcpError("UNAUTHENTICATED");
    const rangeA = validateBoundedDateRange(input.period_a_start, input.period_a_end);
    if (rangeA.ok === false) return mcpError(rangeA.code);
    const rangeB = validateBoundedDateRange(input.period_b_start, input.period_b_end);
    if (rangeB.ok === false) return mcpError(rangeB.code);

    const scope: McpScope = input.scope ?? "personal";
    const timeScope: McpTimeScope = input.time_scope ?? "occurred";
    const breakdownBy = input.breakdown_by ?? "none";
    const userId = ctx.getUserId()!;
    const supabase = supabaseForUser(ctx);
    const cursorSecret = getCursorSecret();
    if (!cursorSecret) return mcpError("INTERNAL_ERROR");
    const coverageA = effectiveDateRange(
      input.period_a_start,
      input.period_a_end,
      timeScope,
    );
    const coverageB = effectiveDateRange(
      input.period_b_start,
      input.period_b_end,
      timeScope,
    );
    const expenseFilters = (
      start: string,
      end: string,
    ): ExpenseQueryFilters => ({
      start_date: start,
      end_date: end,
      scope,
      time_scope: "all",
      sort_by: "date",
      sort_order: "asc",
    });
    const incomeFilters = (
      start: string,
      end: string,
    ): IncomeQueryFilters => ({
      start_date: start,
      end_date: end,
      scope,
      time_scope: "all",
      sort_by: "date",
      sort_order: "asc",
    });

    const emptyExpenses = { items: [], error: false, too_large: false };
    const emptyIncomes = { items: [], error: false, too_large: false };
    const [expensesA, incomesA, expensesB, incomesB] = await Promise.all([
      coverageA.effective_period
        ? fetchAllExpenses(
        supabase,
        userId,
        expenseFilters(
          coverageA.effective_period.start_date,
          coverageA.effective_period.end_date,
        ),
        INTERNAL_RESULT_CAP,
        cursorSecret,
      )
        : Promise.resolve(emptyExpenses),
      coverageA.effective_period
        ? fetchAllIncomes(
        supabase,
        userId,
        incomeFilters(
          coverageA.effective_period.start_date,
          coverageA.effective_period.end_date,
        ),
        INTERNAL_RESULT_CAP,
        cursorSecret,
      )
        : Promise.resolve(emptyIncomes),
      coverageB.effective_period
        ? fetchAllExpenses(
        supabase,
        userId,
        expenseFilters(
          coverageB.effective_period.start_date,
          coverageB.effective_period.end_date,
        ),
        INTERNAL_RESULT_CAP,
        cursorSecret,
      )
        : Promise.resolve(emptyExpenses),
      coverageB.effective_period
        ? fetchAllIncomes(
        supabase,
        userId,
        incomeFilters(
          coverageB.effective_period.start_date,
          coverageB.effective_period.end_date,
        ),
        INTERNAL_RESULT_CAP,
        cursorSecret,
      )
        : Promise.resolve(emptyIncomes),
    ]);
    if (expensesA.error || incomesA.error || expensesB.error || incomesB.error) {
      return mcpError("INTERNAL_ERROR");
    }
    if (
      expensesA.too_large ||
      incomesA.too_large ||
      expensesB.too_large ||
      incomesB.too_large
    ) {
      return mcpError("RESULT_SET_TOO_LARGE");
    }

    const metricsA = financialMetrics(expensesA.items, incomesA.items);
    const metricsB = financialMetrics(expensesB.items, incomesB.items);
    const changes = metricChanges(metricsA, metricsB);
    const warnings: string[] = [];
    const coverageWarnings = [coverageA.coverage_warning, coverageB.coverage_warning].filter(
      (warning): warning is string => warning !== null,
    );
    warnings.push(...coverageWarnings);
    if (rangeA.days !== rangeB.days) {
      warnings.push(
        `Os períodos têm durações diferentes (${rangeA.days} dias em A e ${rangeB.days} dias em B).`,
      );
    }
    const effectiveDaysA = coverageA.effective_period?.days ?? 0;
    const effectiveDaysB = coverageB.effective_period?.days ?? 0;
    if (effectiveDaysA !== effectiveDaysB) {
      warnings.push(
        `As coberturas efetivas têm durações diferentes (${effectiveDaysA} dias em A e ${effectiveDaysB} dias em B).`,
      );
    }
    if (metricsA.income <= 0 || metricsB.income <= 0) {
      warnings.push("Savings rate indisponível em período com receita total zero ou negativa.");
    }
    if (Object.values(changes.percentage).some((value) => value === null)) {
      warnings.push("Variações percentuais com base zero foram retornadas como null.");
    }

    let breakdownChanges: Array<{
      key: string;
      label: string;
      period_a_total: number;
      period_b_total: number;
      absolute_change: number;
      percentage_change: number | null;
    }> | null = null;
    if (breakdownBy !== "none") {
      const breakdownA = spendingBreakdown(
        expensesA.items,
        breakdownBy as ExpenseBreakdownBy,
        INTERNAL_RESULT_CAP,
      );
      const breakdownB = spendingBreakdown(
        expensesB.items,
        breakdownBy as ExpenseBreakdownBy,
        INTERNAL_RESULT_CAP,
      );
      const groupsA = new Map(breakdownA.groups.map((group) => [group.key, group]));
      const groupsB = new Map(breakdownB.groups.map((group) => [group.key, group]));
      const keys = new Set([...groupsA.keys(), ...groupsB.keys()]);
      breakdownChanges = [...keys]
        .map((key) => {
          const groupA = groupsA.get(key);
          const groupB = groupsB.get(key);
          const totalA = groupA?.total ?? 0;
          const totalB = groupB?.total ?? 0;
          return {
            key,
            label: groupB?.label ?? groupA?.label ?? key,
            period_a_total: totalA,
            period_b_total: totalB,
            absolute_change: roundFinancial(totalB - totalA),
            percentage_change: percentageChange(totalA, totalB),
          };
        })
        .sort(
          (left, right) =>
            Math.abs(right.absolute_change) - Math.abs(left.absolute_change) ||
            left.key.localeCompare(right.key),
        );
    }

    const result = {
      period_a: {
        start_date: input.period_a_start,
        end_date: input.period_a_end,
        days: effectiveDaysA,
        requested_days: inclusiveDays(input.period_a_start, input.period_a_end),
        effective_days: effectiveDaysA,
        requested_period: coverageA.requested_period,
        effective_period: coverageA.effective_period,
        coverage_warning: coverageA.coverage_warning,
        metrics: metricsA,
      },
      period_b: {
        start_date: input.period_b_start,
        end_date: input.period_b_end,
        days: effectiveDaysB,
        requested_days: inclusiveDays(input.period_b_start, input.period_b_end),
        effective_days: effectiveDaysB,
        requested_period: coverageB.requested_period,
        effective_period: coverageB.effective_period,
        coverage_warning: coverageB.coverage_warning,
        metrics: metricsB,
      },
      absolute_changes: changes.absolute,
      percentage_changes: changes.percentage,
      breakdown_changes: breakdownChanges,
      scope,
      time_scope: timeScope,
      coverage_warning: coverageWarnings,
      data_sufficiency_warnings: warnings,
    };
    return {
      content: [
        {
          type: "text",
          text: comparisonContent({
            periodA: result.period_a,
            periodB: result.period_b,
            absoluteChanges: result.absolute_changes as unknown as Record<string, number>,
            percentageChanges: result.percentage_changes,
            breakdownChanges: result.breakdown_changes,
            scope,
            timeScope,
            coverageWarnings: result.coverage_warning,
            dataSufficiencyWarnings: result.data_sufficiency_warnings,
          }),
        },
      ],
      structuredContent: result,
    };
  },
});
