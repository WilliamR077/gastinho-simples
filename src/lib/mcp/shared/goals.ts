import { currentMonthRange, todayIso } from "./dates";
import { inclusiveDays, roundFinancial } from "./phase-1.1b-core";

export const GOAL_TYPES = [
  "monthly_total",
  "category",
  "income_monthly_total",
  "income_category",
  "balance_target",
] as const;

export const GOAL_WARNINGS = [
  "INVALID_GOAL_CONFIGURATION",
  "CATEGORY_NOT_FOUND",
  "NON_POSITIVE_TARGET",
  "FUTURE_MONTH_NO_ACTUAL_DATA",
] as const;

export const PROJECTION_WARNINGS = [
  "POTENTIAL_RECURRING_OVERLAP",
  "MISSING_START_DATE_USING_CREATED_AT",
  "INVALID_START_DATE",
  "INVALID_END_DATE",
  "END_DATE_BEFORE_START_DATE",
  "INVALID_DAY_OF_MONTH",
  "NON_POSITIVE_AMOUNT",
  "DAY_NOT_PRESENT_IN_MONTH",
] as const;

export type GoalType = (typeof GOAL_TYPES)[number];
export type GoalWarning = (typeof GOAL_WARNINGS)[number];
export type GoalDirection = "maximum" | "minimum";

export interface GoalRow {
  id: string;
  user_id: string;
  type: GoalType;
  category: string | null;
  limit_amount: number;
  shared_group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalItem {
  id: string;
  type: GoalType;
  category_reference: string | null;
  limit_amount: number;
  shared_group_id: string | null;
  is_shared: boolean;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
  data_warnings: GoalWarning[];
}

export interface GoalReferencePeriod {
  requested_period: { start_date: string; end_date: string };
  effective_period: { start_date: string; end_date: string } | null;
  days_in_month: number;
  elapsed_days: number;
  remaining_days: number;
  is_future: boolean;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  alimentacao: "alimentação",
  transporte: "transporte",
  lazer: "lazer",
  saude: "saúde",
  educacao: "educação",
  moradia: "moradia",
  vestuario: "vestuário",
  servicos: "serviços",
  outros: "outros",
};
const INCOME_CATEGORY_LABELS: Record<string, string> = {
  salario: "salário",
  freelance: "freelance",
  investimentos: "investimentos",
  vendas: "vendas",
  bonus: "bônus",
  presente: "presente",
  reembolso: "reembolso",
  aluguel: "aluguel",
  outros: "outros",
};

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("pt-BR");
}

export function goalDataWarnings(row: GoalRow): GoalWarning[] {
  const warnings: GoalWarning[] = [];
  const categoryType = row.type === "category" || row.type === "income_category";
  if ((categoryType && !row.category) || (!categoryType && row.category !== null)) {
    warnings.push("INVALID_GOAL_CONFIGURATION");
  }
  if (!Number.isFinite(Number(row.limit_amount)) || Number(row.limit_amount) <= 0) {
    warnings.push("INVALID_GOAL_CONFIGURATION", "NON_POSITIVE_TARGET");
  }
  return [...new Set(warnings)];
}

export function goalItem(row: GoalRow, userId: string): GoalItem {
  return {
    id: row.id,
    type: row.type,
    category_reference: row.category,
    limit_amount: Number(row.limit_amount),
    shared_group_id: row.shared_group_id,
    is_shared: row.shared_group_id !== null,
    is_owner: row.user_id === userId,
    created_at: row.created_at,
    updated_at: row.updated_at,
    data_warnings: goalDataWarnings(row),
  };
}

export function compareGoals(left: GoalItem, right: GoalItem): number {
  return (
    GOAL_TYPES.indexOf(left.type) - GOAL_TYPES.indexOf(right.type) ||
    (left.category_reference ?? "").localeCompare(
      right.category_reference ?? "",
      "pt-BR",
    ) ||
    left.id.localeCompare(right.id)
  );
}

export function goalCursorSortValue(goal: GoalItem): string {
  return JSON.stringify([goal.type, goal.category_reference]);
}

export function resolveGoalReferencePeriod(
  referenceMonth: string | undefined,
  now: Date = new Date(),
): GoalReferencePeriod {
  const current = currentMonthRange(now);
  const month = referenceMonth ?? current.from.slice(0, 7);
  const [year, numericMonth] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, numericMonth, 0)).getUTCDate();
  const requested = {
    start_date: `${month}-01`,
    end_date: `${month}-${String(days).padStart(2, "0")}`,
  };
  const today = todayIso(now);
  if (requested.start_date > today) {
    return {
      requested_period: requested,
      effective_period: null,
      days_in_month: days,
      elapsed_days: 0,
      remaining_days: days,
      is_future: true,
    };
  }
  const effectiveEnd =
    requested.end_date < today ? requested.end_date : today;
  const elapsed = inclusiveDays(requested.start_date, effectiveEnd);
  return {
    requested_period: requested,
    effective_period: {
      start_date: requested.start_date,
      end_date: effectiveEnd,
    },
    days_in_month: days,
    elapsed_days: elapsed,
    remaining_days: days - elapsed,
    is_future: false,
  };
}

export function goalDirection(type: GoalType): GoalDirection {
  return type === "monthly_total" || type === "category"
    ? "maximum"
    : "minimum";
}

export function expenseMatchesGoalCategory(
  row: {
    category: string | null;
    category_id: string | null;
    category_name: string | null;
  },
  reference: string,
): boolean {
  if (UUID_RE.test(reference)) return row.category_id?.toLowerCase() === reference.toLowerCase();
  const expected = normalized(EXPENSE_CATEGORY_LABELS[reference] ?? reference);
  return (
    normalized(row.category) === normalized(reference) ||
    normalized(row.category_name) === expected ||
    normalized(row.category_name) === normalized(reference)
  );
}

export function incomeMatchesGoalCategory(
  row: {
    category: string | null;
    income_category_id: string | null;
    category_name: string | null;
  },
  reference: string,
): boolean {
  if (UUID_RE.test(reference)) {
    return row.income_category_id?.toLowerCase() === reference.toLowerCase();
  }
  const expected = normalized(INCOME_CATEGORY_LABELS[reference] ?? reference);
  return (
    normalized(row.category) === normalized(reference) ||
    normalized(row.category_name) === expected ||
    normalized(row.category_name) === normalized(reference)
  );
}

export function goalMetrics(actualValue: number, targetValue: number): {
  actual_value: number;
  target_value: number;
  actual_percentage: number | null;
  actual_remaining: number;
  actual_excess: number;
} {
  const actual = roundFinancial(actualValue);
  const target = roundFinancial(targetValue);
  return {
    actual_value: actual,
    target_value: target,
    actual_percentage:
      target > 0 ? roundFinancial((actual / target) * 100) : null,
    actual_remaining: roundFinancial(Math.max(target - actual, 0)),
    actual_excess: roundFinancial(Math.max(actual - target, 0)),
  };
}
