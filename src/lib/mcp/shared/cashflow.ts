import { ISO_DATE_RE, isValidIsoDate, todayIso } from "./dates";
import { addIsoDays, isoWeekStart, roundFinancial } from "./phase-1.1b-core";

export const CASHFLOW_WARNINGS = [
  "PERIOD_TRUNCATED_TO_TODAY",
  "FUTURE_PERIOD_NO_REALIZED_DATA",
  "RESULT_SET_TOO_LARGE",
  "NEGATIVE_EXPENSE_VALUE",
  "NEGATIVE_INCOME_VALUE",
  "INVALID_TRANSACTION_DATE",
  "PARTIAL_FIRST_PERIOD",
  "PARTIAL_LAST_PERIOD",
] as const;

export type CashflowWarning = (typeof CASHFLOW_WARNINGS)[number];
export type CashflowGranularity = "day" | "week" | "month";

export interface CashflowTransaction {
  transaction_type: "expense" | "income";
  amount: number;
  date: string;
}

export interface CashflowPoint {
  period_start: string;
  period_end: string;
  label: string;
  realized_income: number;
  realized_expenses: number;
  realized_balance: number;
  cumulative_balance: number;
  income_count: number;
  expense_count: number;
  transaction_count: number;
}

interface PeriodBoundary {
  start: string;
  end: string;
  label: string;
}

function monthEnd(date: string): string {
  const [year, month] = date.slice(0, 7).split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${date.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

function weekEnd(date: string): string {
  return addIsoDays(isoWeekStart(date), 6);
}

export function saoPauloCivilDate(value: string): string | null {
  if (isValidIsoDate(value)) return value;
  if (ISO_DATE_RE.test(value)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? todayIso(parsed) : null;
}

export function zonedMidnightUtc(
  date: string,
  timeZone = "America/Sao_Paulo",
): string {
  const target = Date.parse(`${date}T00:00:00Z`);
  let candidate = target;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(candidate));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const represented = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );
    candidate += target - represented;
  }
  return new Date(candidate).toISOString();
}

export function cashflowPeriods(
  startDate: string,
  endDate: string,
  granularity: CashflowGranularity,
): PeriodBoundary[] {
  const periods: PeriodBoundary[] = [];
  let current = startDate;
  while (current <= endDate) {
    let naturalEnd = current;
    if (granularity === "week") naturalEnd = weekEnd(current);
    if (granularity === "month") naturalEnd = monthEnd(current);
    const end = naturalEnd < endDate ? naturalEnd : endDate;
    periods.push({
      start: current,
      end,
      label:
        granularity === "day"
          ? current
          : granularity === "month"
            ? current.slice(0, 7)
            : `${current} a ${end}`,
    });
    current = addIsoDays(end, 1);
  }
  return periods;
}

export function partialPeriodWarnings(
  startDate: string,
  endDate: string,
  granularity: CashflowGranularity,
): CashflowWarning[] {
  if (granularity === "day") return [];
  const warnings: CashflowWarning[] = [];
  const naturalStart =
    granularity === "week" ? isoWeekStart(startDate) : `${startDate.slice(0, 7)}-01`;
  const naturalEnd =
    granularity === "week" ? weekEnd(endDate) : monthEnd(endDate);
  if (startDate !== naturalStart) warnings.push("PARTIAL_FIRST_PERIOD");
  if (endDate !== naturalEnd) warnings.push("PARTIAL_LAST_PERIOD");
  return warnings;
}

export function calculateCashflowSeries(
  transactions: CashflowTransaction[],
  options: {
    start_date: string;
    end_date: string;
    granularity: CashflowGranularity;
    include_empty_periods: boolean;
  },
): {
  series: CashflowPoint[];
  total_income: number;
  total_expenses: number;
  total_balance: number;
  income_count: number;
  expense_count: number;
  transaction_count: number;
  opening_cumulative_balance: 0;
  closing_cumulative_balance: number;
} {
  const periods = cashflowPeriods(
    options.start_date,
    options.end_date,
    options.granularity,
  );
  let cumulative = 0;
  const completeSeries = periods.map<CashflowPoint>((period) => {
    const current = transactions.filter(
      (transaction) =>
        transaction.date >= period.start && transaction.date <= period.end,
    );
    const incomes = current.filter(
      (transaction) => transaction.transaction_type === "income",
    );
    const expenses = current.filter(
      (transaction) => transaction.transaction_type === "expense",
    );
    const realizedIncome = roundFinancial(
      incomes.reduce((sum, transaction) => sum + transaction.amount, 0),
    );
    const realizedExpenses = roundFinancial(
      expenses.reduce((sum, transaction) => sum + transaction.amount, 0),
    );
    const realizedBalance = roundFinancial(realizedIncome - realizedExpenses);
    cumulative = roundFinancial(cumulative + realizedBalance);
    return {
      period_start: period.start,
      period_end: period.end,
      label: period.label,
      realized_income: realizedIncome,
      realized_expenses: realizedExpenses,
      realized_balance: realizedBalance,
      cumulative_balance: cumulative,
      income_count: incomes.length,
      expense_count: expenses.length,
      transaction_count: current.length,
    };
  });
  const totalIncome = roundFinancial(
    transactions
      .filter((transaction) => transaction.transaction_type === "income")
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  );
  const totalExpenses = roundFinancial(
    transactions
      .filter((transaction) => transaction.transaction_type === "expense")
      .reduce((sum, transaction) => sum + transaction.amount, 0),
  );
  const incomeCount = transactions.filter(
    (transaction) => transaction.transaction_type === "income",
  ).length;
  const expenseCount = transactions.length - incomeCount;
  const totalBalance = roundFinancial(totalIncome - totalExpenses);
  return {
    series: options.include_empty_periods
      ? completeSeries
      : completeSeries.filter((point) => point.transaction_count > 0),
    total_income: totalIncome,
    total_expenses: totalExpenses,
    total_balance: totalBalance,
    income_count: incomeCount,
    expense_count: expenseCount,
    transaction_count: transactions.length,
    opening_cumulative_balance: 0,
    closing_cumulative_balance: totalBalance,
  };
}
