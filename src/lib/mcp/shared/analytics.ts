import {
  isoWeekStart,
  percentageChange,
  roundFinancial,
  savingsRate,
} from "./phase-1.1b-core";
import type { ExpenseItem, IncomeItem } from "./transaction-query";

export type ExpenseBreakdownBy =
  | "category"
  | "payment_method"
  | "card"
  | "day"
  | "week"
  | "month";

export interface FinancialMetrics {
  income: number;
  expenses: number;
  balance: number;
  savings_rate: number | null;
  expense_count: number;
  income_count: number;
}

export interface BreakdownGroup {
  key: string;
  label: string;
  total: number;
  percentage: number;
  transaction_count: number;
  average: number;
  largest_transaction: {
    id: string;
    description: string;
    amount: number;
    date: string;
  };
}

function groupIdentity(
  item: ExpenseItem,
  groupBy: ExpenseBreakdownBy,
): { key: string; label: string } {
  if (groupBy === "category") {
    return {
      key: item.category_id ?? "unknown",
      label: item.category_name ?? "Sem categoria",
    };
  }
  if (groupBy === "payment_method") {
    return { key: item.payment_method, label: item.payment_method };
  }
  if (groupBy === "card") {
    return {
      key: item.card_id ?? "unknown",
      label: item.card_name ?? "Sem cartão",
    };
  }
  if (groupBy === "day") return { key: item.date, label: item.date };
  if (groupBy === "week") {
    const start = isoWeekStart(item.date);
    return { key: start, label: `Semana de ${start}` };
  }
  const month = item.date.slice(0, 7);
  return { key: month, label: month };
}

export function financialMetrics(
  expenses: ExpenseItem[],
  incomes: IncomeItem[],
): FinancialMetrics {
  const totalExpenses = roundFinancial(
    expenses.reduce((sum, item) => sum + item.amount, 0),
  );
  const totalIncome = roundFinancial(
    incomes.reduce((sum, item) => sum + item.amount, 0),
  );
  return {
    income: totalIncome,
    expenses: totalExpenses,
    balance: roundFinancial(totalIncome - totalExpenses),
    savings_rate: savingsRate(totalIncome, totalExpenses),
    expense_count: expenses.length,
    income_count: incomes.length,
  };
}

export function spendingBreakdown(
  expenses: ExpenseItem[],
  groupBy: ExpenseBreakdownBy,
  limit: number,
): {
  total: number;
  groups: BreakdownGroup[];
  total_group_count: number;
  returned_group_count: number;
  groups_truncated: boolean;
} {
  const total = roundFinancial(expenses.reduce((sum, item) => sum + item.amount, 0));
  const grouped = new Map<
    string,
    {
      label: string;
      total: number;
      count: number;
      largest: ExpenseItem;
    }
  >();
  for (const item of expenses) {
    const identity = groupIdentity(item, groupBy);
    const current = grouped.get(identity.key);
    if (!current) {
      grouped.set(identity.key, {
        label: identity.label,
        total: item.amount,
        count: 1,
        largest: item,
      });
      continue;
    }
    current.total += item.amount;
    current.count += 1;
    if (item.amount > current.largest.amount) current.largest = item;
  }

  const allGroups = [...grouped.entries()]
    .map(([key, group]) => ({
      key,
      label: group.label,
      total: roundFinancial(group.total),
      percentage: total > 0 ? (group.total / total) * 100 : 0,
      transaction_count: group.count,
      average: roundFinancial(group.total / group.count),
      largest_transaction: {
        id: group.largest.id,
        description: group.largest.description,
        amount: group.largest.amount,
        date: group.largest.date,
      },
    }))
    .sort((left, right) => right.total - left.total || left.key.localeCompare(right.key));
  const groups = allGroups.slice(0, limit);
  return {
    total,
    groups,
    total_group_count: allGroups.length,
    returned_group_count: groups.length,
    groups_truncated: allGroups.length > groups.length,
  };
}

export function metricChanges(
  from: FinancialMetrics,
  to: FinancialMetrics,
): {
  absolute: FinancialMetrics;
  percentage: Record<keyof FinancialMetrics, number | null>;
} {
  return {
    absolute: {
      income: roundFinancial(to.income - from.income),
      expenses: roundFinancial(to.expenses - from.expenses),
      balance: roundFinancial(to.balance - from.balance),
      savings_rate:
        from.savings_rate === null || to.savings_rate === null
          ? null
          : to.savings_rate - from.savings_rate,
      expense_count: to.expense_count - from.expense_count,
      income_count: to.income_count - from.income_count,
    },
    percentage: {
      income: percentageChange(from.income, to.income),
      expenses: percentageChange(from.expenses, to.expenses),
      balance: percentageChange(from.balance, to.balance),
      savings_rate:
        from.savings_rate === null || to.savings_rate === null
          ? null
          : percentageChange(from.savings_rate, to.savings_rate),
      expense_count: percentageChange(from.expense_count, to.expense_count),
      income_count: percentageChange(from.income_count, to.income_count),
    },
  };
}
