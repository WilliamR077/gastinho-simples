import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../shared/supabase-client";
import { mcpError } from "../shared/errors";
import { ISO_DATE_RE, resolveDateRange } from "../shared/dates";
import {
  effectiveDateRange,
  getCursorSecret,
  INTERNAL_RESULT_CAP,
  percentageChange,
  previousPeriod,
  roundFinancial,
  savingsRate,
  validateBoundedDateRange,
  type McpTimeScope,
} from "../shared/phase-1.1b-core";
import type { McpScope } from "../shared/scope";
import {
  fetchAllExpenses,
  fetchAllIncomes,
  type ExpenseQueryFilters,
  type IncomeQueryFilters,
} from "../shared/transaction-query";

interface PeriodMetrics {
  start_date: string;
  end_date: string;
  total_income: number;
  total_expenses: number;
  balance: number;
  savings_rate: number | null;
  expense_count: number;
  income_count: number;
}

function baseFilters(
  start: string,
  end: string,
  scope: McpScope,
  timeScope: McpTimeScope,
): ExpenseQueryFilters & IncomeQueryFilters {
  return {
    start_date: start,
    end_date: end,
    scope,
    time_scope: timeScope,
    sort_by: "date",
    sort_order: "asc",
  };
}

async function periodMetrics(
  supabase: ReturnType<typeof supabaseForUser>,
  userId: string,
  start: string,
  end: string,
  scope: McpScope,
  timeScope: McpTimeScope,
  cursorSecret: string,
): Promise<{ metrics?: PeriodMetrics; error?: "INTERNAL_ERROR" | "RESULT_SET_TOO_LARGE" }> {
  const filters = baseFilters(start, end, scope, timeScope);
  const [expenses, incomes] = await Promise.all([
    fetchAllExpenses(supabase, userId, filters, INTERNAL_RESULT_CAP, cursorSecret),
    fetchAllIncomes(supabase, userId, filters, INTERNAL_RESULT_CAP, cursorSecret),
  ]);
  if (expenses.error || incomes.error) return { error: "INTERNAL_ERROR" };
  if (expenses.too_large || incomes.too_large) return { error: "RESULT_SET_TOO_LARGE" };

  const totalExpenses = roundFinancial(
    expenses.items.reduce((sum, item) => sum + item.amount, 0),
  );
  const totalIncome = roundFinancial(
    incomes.items.reduce((sum, item) => sum + item.amount, 0),
  );
  const balance = roundFinancial(totalIncome - totalExpenses);
  return {
    metrics: {
      start_date: start,
      end_date: end,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      balance,
      savings_rate: savingsRate(totalIncome, totalExpenses),
      expense_count: expenses.items.length,
      income_count: incomes.items.length,
    },
  };
}

function emptyPeriodMetrics(start: string, end: string): PeriodMetrics {
  return {
    start_date: start,
    end_date: end,
    total_income: 0,
    total_expenses: 0,
    balance: 0,
    savings_rate: null,
    expense_count: 0,
    income_count: 0,
  };
}

export default defineTool({
  name: "get_summary",
  title: "Resumo financeiro",
  description:
    "Retorna totais, saldo, taxa de poupança e contagens para um intervalo. Sem datas usa o mês corrente; scope=personal e time_scope=all preservam o comportamento anterior. Pode comparar com período anterior de mesma duração.",
  inputSchema: {
    start_date: z.string().regex(ISO_DATE_RE).optional(),
    end_date: z.string().regex(ISO_DATE_RE).optional(),
    scope: z.enum(["personal", "shared", "all_accessible"]).optional(),
    include_previous_period: z.boolean().optional(),
    include_counts: z.boolean().optional(),
    time_scope: z.enum(["occurred", "future", "all"]).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated() || !ctx.getUserId()) return mcpError("UNAUTHENTICATED");
    const range = resolveDateRange(input.start_date, input.end_date);
    if (range.ok === false) return mcpError(range.code);
    const bounded = validateBoundedDateRange(range.from, range.to);
    if (bounded.ok === false) return mcpError(bounded.code);
    const scope: McpScope = input.scope ?? "personal";
    const timeScope: McpTimeScope = input.time_scope ?? "all";
    const includeCounts = input.include_counts ?? true;
    const supabase = supabaseForUser(ctx);
    const cursorSecret = getCursorSecret();
    if (!cursorSecret) return mcpError("INTERNAL_ERROR");
    const coverage = effectiveDateRange(range.from, range.to, timeScope);

    let metrics = emptyPeriodMetrics(range.from, range.to);
    if (coverage.effective_period) {
      const current = await periodMetrics(
        supabase,
        ctx.getUserId()!,
        coverage.effective_period.start_date,
        coverage.effective_period.end_date,
        scope,
        "all",
        cursorSecret,
      );
      if (current.error) return mcpError(current.error);
      metrics = current.metrics!;
    }
    const warnings: string[] = [];
    if (coverage.coverage_warning) warnings.push(coverage.coverage_warning);
    if (metrics.total_income <= 0) {
      warnings.push("savings_rate indisponível porque total_income é zero ou negativo.");
    }

    let previous: PeriodMetrics | null = null;
    let changes: {
      absolute: { total_income: number; total_expenses: number; balance: number };
      percentage: {
        total_income: number | null;
        total_expenses: number | null;
        balance: number | null;
      };
    } | null = null;

    if (input.include_previous_period && coverage.effective_period) {
      const previousDates = previousPeriod(
        coverage.effective_period.start_date,
        coverage.effective_period.end_date,
      );
      const previousResult = await periodMetrics(
        supabase,
        ctx.getUserId()!,
        previousDates.start,
        previousDates.end,
        scope,
        "all",
        cursorSecret,
      );
      if (previousResult.error) return mcpError(previousResult.error);
      previous = previousResult.metrics!;
      changes = {
        absolute: {
          total_income: roundFinancial(metrics.total_income - previous.total_income),
          total_expenses: roundFinancial(metrics.total_expenses - previous.total_expenses),
          balance: roundFinancial(metrics.balance - previous.balance),
        },
        percentage: {
          total_income: percentageChange(previous.total_income, metrics.total_income),
          total_expenses: percentageChange(previous.total_expenses, metrics.total_expenses),
          balance: percentageChange(previous.balance, metrics.balance),
        },
      };
      if (
        changes.percentage.total_income === null ||
        changes.percentage.total_expenses === null ||
        changes.percentage.balance === null
      ) {
        warnings.push("Uma ou mais diferenças percentuais não foram calculadas porque a base anterior era zero.");
      }
      if (coverage.coverage_warning) {
        warnings.push(
          "A comparação anterior usa os dias imediatamente anteriores com a mesma duração da cobertura efetiva.",
        );
      }
    } else if (input.include_previous_period) {
      warnings.push(
        "O período efetivo está vazio; não foi possível calcular um período anterior comparável.",
      );
    }

    const result = {
      start_date: range.from,
      end_date: range.to,
      period: { from: range.from, to: range.to },
      requested_period: coverage.requested_period,
      effective_period: coverage.effective_period,
      coverage_warning: coverage.coverage_warning,
      scope,
      time_scope: timeScope,
      total_income: metrics.total_income,
      total_incomes: metrics.total_income,
      total_expenses: metrics.total_expenses,
      balance: metrics.balance,
      savings_rate: metrics.savings_rate,
      expense_count: includeCounts ? metrics.expense_count : null,
      income_count: includeCounts ? metrics.income_count : null,
      previous_period: previous,
      changes,
      warnings,
    };
    return {
      content: [
        {
          type: "text",
          text:
            `Resumo solicitado de ${result.start_date} a ${result.end_date} (scope=${scope}, time_scope=${timeScope}): ` +
            `receitas=${result.total_income}, despesas=${result.total_expenses}, saldo=${result.balance}, ` +
            `savings_rate=${result.savings_rate ?? "indisponível"}, ` +
            `expense_count=${result.expense_count ?? "não solicitado"}, income_count=${result.income_count ?? "não solicitado"}. ` +
            `${previous ? `Período anterior: ${JSON.stringify(previous)}. Mudanças: ${JSON.stringify(changes)}.` : ""} ` +
            `Período efetivo: ${result.effective_period ? `${result.effective_period.start_date} a ${result.effective_period.end_date}` : "vazio"}. ` +
            `${warnings.length ? `Avisos: ${warnings.join(" ")}` : ""}`,
        },
      ],
      structuredContent: result,
    };
  },
});
