import {
  cashflowPeriods,
  type CashflowGranularity,
} from "./cashflow";
import { roundFinancial } from "./phase-1.1b-core";

export const CASHFLOW_PROJECTION_WARNINGS = [
  "POTENTIAL_RECURRING_OVERLAP",
  "PAST_PERIOD_NO_FUTURE_PROJECTION",
  "FUTURE_PERIOD_NO_REALIZED_DATA",
  "PARTIAL_FIRST_PERIOD",
  "PARTIAL_LAST_PERIOD",
  "INVALID_RECURRING_TEMPLATE",
  "RECURRING_DAY_NOT_AVAILABLE",
  "RECURRING_START_DATE_FALLBACK",
  "NEGATIVE_EXPENSE_VALUE",
  "NEGATIVE_INCOME_VALUE",
  "INVALID_TRANSACTION_DATE",
  "RESULT_SET_TOO_LARGE",
] as const;

export type CashflowProjectionWarning =
  (typeof CASHFLOW_PROJECTION_WARNINGS)[number];
export type ProjectionComponent =
  | "realized"
  | "future_materialized"
  | "recurring_projection";

export interface ProjectionEvent {
  component: ProjectionComponent;
  transaction_type: "expense" | "income";
  amount: number;
  date: string;
}

export interface ProjectionComponentTotals {
  income: number;
  expenses: number;
  balance: number;
  income_count: number;
  expense_count: number;
  transaction_count: number;
}

export interface CashflowProjectionPoint {
  period_start: string;
  period_end: string;
  label: string;
  realized_income: number;
  realized_expenses: number;
  realized_balance: number;
  future_materialized_income: number;
  future_materialized_expenses: number;
  future_materialized_balance: number;
  recurring_projected_income: number;
  recurring_projected_expenses: number;
  recurring_projected_balance: number;
  combined_income: number;
  combined_expenses: number;
  combined_balance: number;
  cumulative_combined_balance: number;
  realized_transaction_count: number;
  future_materialized_transaction_count: number;
  recurring_occurrence_count: number;
}

function componentTotals(
  events: ProjectionEvent[],
  component: ProjectionComponent,
): ProjectionComponentTotals {
  const selected = events.filter((event) => event.component === component);
  const incomeEvents = selected.filter(
    (event) => event.transaction_type === "income",
  );
  const expenseEvents = selected.filter(
    (event) => event.transaction_type === "expense",
  );
  const income = roundFinancial(
    incomeEvents.reduce((sum, event) => sum + event.amount, 0),
  );
  const expenses = roundFinancial(
    expenseEvents.reduce((sum, event) => sum + event.amount, 0),
  );
  return {
    income,
    expenses,
    balance: roundFinancial(income - expenses),
    income_count: incomeEvents.length,
    expense_count: expenseEvents.length,
    transaction_count: selected.length,
  };
}

export function calculateCashflowProjection(
  events: ProjectionEvent[],
  options: {
    start_date: string;
    end_date: string;
    granularity: CashflowGranularity;
    include_empty_periods: boolean;
  },
): {
  realized: ProjectionComponentTotals;
  future_materialized: ProjectionComponentTotals;
  recurring_projection: ProjectionComponentTotals;
  combined_income: number;
  combined_expenses: number;
  combined_balance: number;
  opening_cumulative_balance: 0;
  closing_cumulative_balance: number;
  series: CashflowProjectionPoint[];
} {
  const acceptedEvents = events.filter(
    (event) =>
      event.date >= options.start_date && event.date <= options.end_date,
  );
  const realized = componentTotals(acceptedEvents, "realized");
  const futureMaterialized = componentTotals(
    acceptedEvents,
    "future_materialized",
  );
  const recurringProjection = componentTotals(
    acceptedEvents,
    "recurring_projection",
  );
  const combinedIncome = roundFinancial(
    realized.income + futureMaterialized.income + recurringProjection.income,
  );
  const combinedExpenses = roundFinancial(
    realized.expenses +
      futureMaterialized.expenses +
      recurringProjection.expenses,
  );
  const combinedBalance = roundFinancial(combinedIncome - combinedExpenses);
  let cumulative = 0;
  const completeSeries = cashflowPeriods(
    options.start_date,
    options.end_date,
    options.granularity,
  ).map<CashflowProjectionPoint>((period) => {
    const current = acceptedEvents.filter(
      (event) => event.date >= period.start && event.date <= period.end,
    );
    const totals = (component: ProjectionComponent) =>
      componentTotals(current, component);
    const pointRealized = totals("realized");
    const pointFuture = totals("future_materialized");
    const pointRecurring = totals("recurring_projection");
    const pointIncome = roundFinancial(
      pointRealized.income + pointFuture.income + pointRecurring.income,
    );
    const pointExpenses = roundFinancial(
      pointRealized.expenses +
        pointFuture.expenses +
        pointRecurring.expenses,
    );
    const pointBalance = roundFinancial(pointIncome - pointExpenses);
    cumulative = roundFinancial(cumulative + pointBalance);
    return {
      period_start: period.start,
      period_end: period.end,
      label: period.label,
      realized_income: pointRealized.income,
      realized_expenses: pointRealized.expenses,
      realized_balance: pointRealized.balance,
      future_materialized_income: pointFuture.income,
      future_materialized_expenses: pointFuture.expenses,
      future_materialized_balance: pointFuture.balance,
      recurring_projected_income: pointRecurring.income,
      recurring_projected_expenses: pointRecurring.expenses,
      recurring_projected_balance: pointRecurring.balance,
      combined_income: pointIncome,
      combined_expenses: pointExpenses,
      combined_balance: pointBalance,
      cumulative_combined_balance: cumulative,
      realized_transaction_count: pointRealized.transaction_count,
      future_materialized_transaction_count: pointFuture.transaction_count,
      recurring_occurrence_count: pointRecurring.transaction_count,
    };
  });
  return {
    realized,
    future_materialized: futureMaterialized,
    recurring_projection: recurringProjection,
    combined_income: combinedIncome,
    combined_expenses: combinedExpenses,
    combined_balance: combinedBalance,
    opening_cumulative_balance: 0,
    closing_cumulative_balance: combinedBalance,
    series: options.include_empty_periods
      ? completeSeries
      : completeSeries.filter(
          (point) =>
            point.realized_transaction_count +
              point.future_materialized_transaction_count +
              point.recurring_occurrence_count >
            0,
        ),
  };
}

function summed(
  series: CashflowProjectionPoint[],
  field: keyof CashflowProjectionPoint,
): number {
  return roundFinancial(
    series.reduce((sum, point) => sum + Number(point[field]), 0),
  );
}

export function cashflowProjectionInvariantsHold(projection: {
  realized: ProjectionComponentTotals;
  future_materialized: ProjectionComponentTotals;
  recurring_projection: ProjectionComponentTotals;
  combined_income: number;
  combined_expenses: number;
  combined_balance: number;
  opening_cumulative_balance: 0;
  closing_cumulative_balance: number;
  series: CashflowProjectionPoint[];
}): boolean {
  const realized = projection.realized;
  const future = projection.future_materialized;
  const recurring = projection.recurring_projection;
  return (
    realized.income === summed(projection.series, "realized_income") &&
    realized.expenses === summed(projection.series, "realized_expenses") &&
    realized.balance === roundFinancial(realized.income - realized.expenses) &&
    realized.transaction_count ===
      summed(projection.series, "realized_transaction_count") &&
    future.income ===
      summed(projection.series, "future_materialized_income") &&
    future.expenses ===
      summed(projection.series, "future_materialized_expenses") &&
    future.balance === roundFinancial(future.income - future.expenses) &&
    future.transaction_count ===
      summed(projection.series, "future_materialized_transaction_count") &&
    recurring.income ===
      summed(projection.series, "recurring_projected_income") &&
    recurring.expenses ===
      summed(projection.series, "recurring_projected_expenses") &&
    recurring.balance ===
      roundFinancial(recurring.income - recurring.expenses) &&
    recurring.transaction_count ===
      summed(projection.series, "recurring_occurrence_count") &&
    projection.combined_income ===
      roundFinancial(realized.income + future.income + recurring.income) &&
    projection.combined_expenses ===
      roundFinancial(
        realized.expenses + future.expenses + recurring.expenses,
      ) &&
    projection.combined_balance ===
      roundFinancial(
        projection.combined_income - projection.combined_expenses,
      ) &&
    projection.opening_cumulative_balance === 0 &&
    projection.closing_cumulative_balance === projection.combined_balance &&
    projection.closing_cumulative_balance ===
      summed(projection.series, "combined_balance")
  );
}
