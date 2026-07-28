import { isValidIsoDate } from "./dates";
import {
  addIsoDays,
  inclusiveDays,
  isoWeekStart,
  roundFinancial,
} from "./phase-1.1b-core";

export const RECURRING_DATA_WARNINGS = [
  "MISSING_START_DATE_USING_CREATED_AT",
  "INVALID_START_DATE",
  "INVALID_END_DATE",
  "END_DATE_BEFORE_START_DATE",
  "INVALID_DAY_OF_MONTH",
  "NON_POSITIVE_AMOUNT",
  "DAY_NOT_PRESENT_IN_MONTH",
] as const;

export type RecurringDataWarning = (typeof RECURRING_DATA_WARNINGS)[number];
export type RecurringTransactionType = "expense" | "income";
export type RecurringGranularity = "day" | "week" | "month";

export interface RecurringRow {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  day_of_month: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  category_id?: string | null;
  income_category_id?: string | null;
  category_name: string | null;
  shared_group_id: string | null;
  created_at: string;
  updated_at: string;
  payment_method?: "pix" | "credit" | "debit" | "cash";
  card_id?: string | null;
  card_name?: string | null;
}

export interface RecurringCommonItem {
  id: string;
  transaction_type: RecurringTransactionType;
  description: string;
  amount: number;
  day_of_month: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  category_id: string | null;
  category_name: string | null;
  shared_group_id: string | null;
  is_shared: boolean;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
  data_warnings: RecurringDataWarning[];
}

export interface RecurringExpenseItem extends RecurringCommonItem {
  transaction_type: "expense";
  payment_method: "pix" | "credit" | "debit" | "cash";
  card_id: string | null;
  card_name: string | null;
}

export interface RecurringIncomeItem extends RecurringCommonItem {
  transaction_type: "income";
}

export type RecurringItem = RecurringExpenseItem | RecurringIncomeItem;

export interface RecurringOccurrence {
  date: string;
  transaction_type: RecurringTransactionType;
  amount: number;
  recurring_transaction_id: string;
  description: string;
  category_name: string | null;
  source: "recurring_template";
  shared_group_id: string | null;
  is_owner: boolean;
  data_warnings: RecurringDataWarning[];
}

export interface RecurringSeriesPoint {
  period: string;
  projected_income: number;
  projected_expenses: number;
  projected_balance: number;
  occurrence_count: number;
}

export function recurringDataWarnings(
  row: RecurringRow,
): RecurringDataWarning[] {
  const warnings: RecurringDataWarning[] = [];
  const fallbackStart = row.created_at.slice(0, 10);
  if (row.start_date === null) {
    warnings.push("MISSING_START_DATE_USING_CREATED_AT");
    if (!isValidIsoDate(fallbackStart)) warnings.push("INVALID_START_DATE");
  } else if (!isValidIsoDate(row.start_date)) {
    warnings.push("INVALID_START_DATE");
  }
  if (row.end_date !== null && !isValidIsoDate(row.end_date)) {
    warnings.push("INVALID_END_DATE");
  }
  const effectiveStart = row.start_date ?? fallbackStart;
  if (
    isValidIsoDate(effectiveStart) &&
    row.end_date !== null &&
    isValidIsoDate(row.end_date) &&
    row.end_date < effectiveStart
  ) {
    warnings.push("END_DATE_BEFORE_START_DATE");
  }
  if (
    !Number.isInteger(row.day_of_month) ||
    row.day_of_month < 1 ||
    row.day_of_month > 31
  ) {
    warnings.push("INVALID_DAY_OF_MONTH");
  }
  if (!Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0) {
    warnings.push("NON_POSITIVE_AMOUNT");
  }
  return warnings;
}

export function recurringItem(
  row: RecurringRow,
  transactionType: RecurringTransactionType,
  userId: string,
): RecurringItem {
  const common: RecurringCommonItem = {
    id: row.id,
    transaction_type: transactionType,
    description: row.description,
    amount: Number(row.amount),
    day_of_month: row.day_of_month,
    start_date: row.start_date,
    end_date: row.end_date,
    is_active: row.is_active,
    category_id:
      transactionType === "expense"
        ? (row.category_id ?? null)
        : (row.income_category_id ?? null),
    category_name: row.category_name,
    shared_group_id: row.shared_group_id,
    is_shared: row.shared_group_id !== null,
    is_owner: row.user_id === userId,
    created_at: row.created_at,
    updated_at: row.updated_at,
    data_warnings: recurringDataWarnings(row),
  };
  if (transactionType === "income") return common as RecurringIncomeItem;
  return {
    ...common,
    transaction_type: "expense",
    payment_method: row.payment_method!,
    card_id: row.card_id ?? null,
    card_name: row.card_name ?? null,
  };
}

export function compareRecurringItems(
  left: RecurringItem,
  right: RecurringItem,
): number {
  if (left.day_of_month !== right.day_of_month) {
    return left.day_of_month - right.day_of_month;
  }
  if (left.transaction_type !== right.transaction_type) {
    return left.transaction_type === "expense" ? -1 : 1;
  }
  return left.id.localeCompare(right.id);
}

export function recurringCursorSortValue(item: RecurringItem): string {
  return `${String(item.day_of_month).padStart(2, "0")}|${item.transaction_type}`;
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function monthKey(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}`;
}

function occurrencePeriod(
  date: string,
  granularity: RecurringGranularity,
): string {
  if (granularity === "day") return date;
  if (granularity === "week") return isoWeekStart(date);
  return date.slice(0, 7);
}

function seriesPeriods(
  startDate: string,
  endDate: string,
  granularity: RecurringGranularity,
): string[] {
  if (granularity === "day") {
    return Array.from({ length: inclusiveDays(startDate, endDate) }, (_, index) =>
      addIsoDays(startDate, index));
  }
  if (granularity === "week") {
    const periods: string[] = [];
    let current = isoWeekStart(startDate);
    while (current <= endDate) {
      periods.push(current);
      current = addIsoDays(current, 7);
    }
    return periods;
  }
  const [startYear, startMonth] = startDate.split("-").map(Number);
  const [endYear, endMonth] = endDate.split("-").map(Number);
  const periods: string[] = [];
  let year = startYear;
  let month = startMonth - 1;
  while (year < endYear || (year === endYear && month <= endMonth - 1)) {
    periods.push(monthKey(year, month));
    month += 1;
    if (month > 11) {
      year += 1;
      month = 0;
    }
  }
  return periods;
}

export function projectRecurringTemplates(
  templates: RecurringItem[],
  startDate: string,
  endDate: string,
  granularity: RecurringGranularity,
  occurrenceCap: number = 1_000,
):
  | {
      ok: true;
      occurrences: RecurringOccurrence[];
      series: RecurringSeriesPoint[];
      projected_income: number;
      projected_expenses: number;
      projected_balance: number;
      warnings: RecurringDataWarning[];
    }
  | { ok: false; code: "RESULT_SET_TOO_LARGE" } {
  const occurrences: RecurringOccurrence[] = [];
  const warnings = new Set<RecurringDataWarning>();
  const [firstYear, firstMonth] = startDate.split("-").map(Number);
  const [lastYear, lastMonth] = endDate.split("-").map(Number);

  for (const template of templates) {
    for (const warning of template.data_warnings) warnings.add(warning);
    if (!template.is_active) continue;
    if (
      template.data_warnings.includes("INVALID_START_DATE") ||
      template.data_warnings.includes("INVALID_END_DATE") ||
      template.data_warnings.includes("END_DATE_BEFORE_START_DATE") ||
      template.data_warnings.includes("INVALID_DAY_OF_MONTH")
    ) {
      continue;
    }
    const effectiveStart = template.start_date ?? template.created_at.slice(0, 10);
    let year = firstYear;
    let month = firstMonth - 1;
    while (year < lastYear || (year === lastYear && month <= lastMonth - 1)) {
      if (template.day_of_month > daysInUtcMonth(year, month)) {
        warnings.add("DAY_NOT_PRESENT_IN_MONTH");
      } else {
        const date =
          `${monthKey(year, month)}-${String(template.day_of_month).padStart(2, "0")}`;
        if (
          date >= startDate &&
          date <= endDate &&
          date >= effectiveStart &&
          (template.end_date === null || date <= template.end_date)
        ) {
          occurrences.push({
            date,
            transaction_type: template.transaction_type,
            amount: template.amount,
            recurring_transaction_id: template.id,
            description: template.description,
            category_name: template.category_name,
            source: "recurring_template",
            shared_group_id: template.shared_group_id,
            is_owner: template.is_owner,
            data_warnings: template.data_warnings,
          });
          if (occurrences.length > occurrenceCap) {
            return { ok: false, code: "RESULT_SET_TOO_LARGE" };
          }
        }
      }
      month += 1;
      if (month > 11) {
        year += 1;
        month = 0;
      }
    }
  }

  occurrences.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      (left.transaction_type === right.transaction_type
        ? left.recurring_transaction_id.localeCompare(right.recurring_transaction_id)
        : left.transaction_type === "expense"
          ? -1
          : 1),
  );
  const points = new Map(
    seriesPeriods(startDate, endDate, granularity).map((period) => [
      period,
      {
        period,
        projected_income: 0,
        projected_expenses: 0,
        projected_balance: 0,
        occurrence_count: 0,
      },
    ]),
  );
  for (const occurrence of occurrences) {
    const point = points.get(occurrencePeriod(occurrence.date, granularity))!;
    point.occurrence_count += 1;
    if (!occurrence.data_warnings.includes("NON_POSITIVE_AMOUNT")) {
      if (occurrence.transaction_type === "income") {
        point.projected_income += occurrence.amount;
      } else {
        point.projected_expenses += occurrence.amount;
      }
    }
  }
  const series = [...points.values()].map((point) => ({
    ...point,
    projected_income: roundFinancial(point.projected_income),
    projected_expenses: roundFinancial(point.projected_expenses),
    projected_balance: roundFinancial(
      point.projected_income - point.projected_expenses,
    ),
  }));
  const projectedIncome = roundFinancial(
    series.reduce((total, point) => total + point.projected_income, 0),
  );
  const projectedExpenses = roundFinancial(
    series.reduce((total, point) => total + point.projected_expenses, 0),
  );
  return {
    ok: true,
    occurrences,
    series,
    projected_income: projectedIncome,
    projected_expenses: projectedExpenses,
    projected_balance: roundFinancial(projectedIncome - projectedExpenses),
    warnings: [...warnings],
  };
}
