import { roundFinancial } from "./phase-1.1b-core";

export const CATEGORY_USAGE_WARNINGS = [
  "DUPLICATE_CATEGORY_NAME",
  "STALE_CATEGORY_SNAPSHOT",
  "CATEGORY_REFERENCE_NOT_ACCESSIBLE",
  "RESULT_SET_TOO_LARGE",
] as const;

export type CategoryUsageWarning = (typeof CATEGORY_USAGE_WARNINGS)[number];

export interface CategoryCatalogRow {
  id: string;
  name: string;
  icon: string;
  color: string | null;
  is_active: boolean | null;
  is_default: boolean | null;
}

export interface CategoryTransactionRow {
  id: string;
  amount: number;
  date: string;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
}

export interface MonthlyUsagePoint {
  month: string;
  total: number;
  transaction_count: number;
}

export interface CategoryUsageItem {
  category_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  is_default: boolean;
  transaction_count: number;
  total: number;
  percentage: number;
  first_used_at: string | null;
  last_used_at: string | null;
  monthly_average: number;
  monthly_series: MonthlyUsagePoint[];
}

interface MutableCategoryUsage {
  category_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  is_default: boolean;
  dates: string[];
  total: number;
  monthly: Map<string, { total: number; count: number }>;
}

function nextMonth(month: string): string {
  const [year, numericMonth] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, numericMonth, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function civilMonths(startDate: string, endDate: string): string[] {
  const result: string[] = [];
  const last = endDate.slice(0, 7);
  let current = startDate.slice(0, 7);
  while (current <= last) {
    result.push(current);
    current = nextMonth(current);
  }
  return result;
}

function emptyUsage(
  category: CategoryCatalogRow,
): MutableCategoryUsage {
  return {
    category_id: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
    is_active: category.is_active !== false,
    is_default: category.is_default === true,
    dates: [],
    total: 0,
    monthly: new Map(),
  };
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function calculateCategoryUsage(
  catalog: CategoryCatalogRow[],
  transactions: CategoryTransactionRow[],
  options: {
    start_date: string;
    end_date: string;
    include_inactive: boolean;
    include_unused: boolean;
    limit: number;
  },
): {
  categories: CategoryUsageItem[];
  uncategorized: { transaction_count: number; total: number; percentage: number };
  total_amount: number;
  total_transaction_count: number;
  categories_truncated: boolean;
  total_category_count: number;
  returned_category_count: number;
  warnings: CategoryUsageWarning[];
} {
  const months = civilMonths(options.start_date, options.end_date);
  const warnings = new Set<CategoryUsageWarning>();
  const usages = new Map(
    catalog.map((category) => [category.id, emptyUsage(category)]),
  );
  const categoryById = new Map(catalog.map((category) => [category.id, category]));
  const idsByName = new Map<string, Set<string>>();
  for (const category of catalog) {
    const key = normalizedName(category.name);
    const ids = idsByName.get(key) ?? new Set<string>();
    ids.add(category.id);
    idsByName.set(key, ids);
  }
  if ([...idsByName.values()].some((ids) => ids.size > 1)) {
    warnings.add("DUPLICATE_CATEGORY_NAME");
  }

  let uncategorizedCount = 0;
  let uncategorizedTotal = 0;
  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    if (transaction.category_id === null) {
      uncategorizedCount += 1;
      uncategorizedTotal += amount;
      continue;
    }
    const catalogCategory = categoryById.get(transaction.category_id);
    let usage = usages.get(transaction.category_id);
    if (!usage) {
      warnings.add("CATEGORY_REFERENCE_NOT_ACCESSIBLE");
      warnings.add("STALE_CATEGORY_SNAPSHOT");
      usage = {
        category_id: transaction.category_id,
        name: transaction.category_name ?? "Categoria inacessível",
        icon: transaction.category_icon,
        color: null,
        is_active: false,
        is_default: false,
        dates: [],
        total: 0,
        monthly: new Map(),
      };
      usages.set(transaction.category_id, usage);
    } else if (
      catalogCategory &&
      ((transaction.category_name !== null &&
        transaction.category_name !== catalogCategory.name) ||
        (transaction.category_icon !== null &&
          transaction.category_icon !== catalogCategory.icon))
    ) {
      warnings.add("STALE_CATEGORY_SNAPSHOT");
    }
    usage.total += amount;
    usage.dates.push(transaction.date);
    const month = transaction.date.slice(0, 7);
    const point = usage.monthly.get(month) ?? { total: 0, count: 0 };
    point.total += amount;
    point.count += 1;
    usage.monthly.set(month, point);
  }

  const totalAmount = roundFinancial(
    transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0),
  );
  const allCategories = [...usages.values()]
    .filter((usage) => options.include_inactive || usage.is_active)
    .filter((usage) => options.include_unused || usage.dates.length > 0)
    .map<CategoryUsageItem>((usage) => {
      const total = roundFinancial(usage.total);
      const dates = [...usage.dates].sort();
      return {
        category_id: usage.category_id,
        name: usage.name,
        icon: usage.icon,
        color: usage.color,
        is_active: usage.is_active,
        is_default: usage.is_default,
        transaction_count: dates.length,
        total,
        percentage:
          totalAmount > 0 ? roundFinancial((total / totalAmount) * 100) : 0,
        first_used_at: dates.at(0) ?? null,
        last_used_at: dates.at(-1) ?? null,
        monthly_average: roundFinancial(total / months.length),
        monthly_series: months.map((month) => {
          const point = usage.monthly.get(month);
          return {
            month,
            total: roundFinancial(point?.total ?? 0),
            transaction_count: point?.count ?? 0,
          };
        }),
      };
    })
    .sort(
      (left, right) =>
        right.total - left.total ||
        left.name.localeCompare(right.name, "pt-BR") ||
        left.category_id.localeCompare(right.category_id),
    );
  const categories = allCategories.slice(0, options.limit);
  return {
    categories,
    uncategorized: {
      transaction_count: uncategorizedCount,
      total: roundFinancial(uncategorizedTotal),
      percentage:
        totalAmount > 0
          ? roundFinancial((uncategorizedTotal / totalAmount) * 100)
          : 0,
    },
    total_amount: totalAmount,
    total_transaction_count: transactions.length,
    categories_truncated: allCategories.length > categories.length,
    total_category_count: allCategories.length,
    returned_category_count: categories.length,
    warnings: [...warnings],
  };
}
