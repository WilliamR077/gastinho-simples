import type { SupabaseClient } from "@supabase/supabase-js";
import type { McpScope } from "./scope";
import {
  decodeCursor,
  deduplicateById,
  cursorFilterExpression,
  cursorForRow,
  escapeIlikePattern,
  filtersFingerprint,
  todayIso,
  unifiedCursorEqualValueMode,
  type CursorPayload,
  type McpSortBy,
  type McpSortOrder,
  type McpQueryTransactionType,
  type McpTimeScope,
  type McpTransactionType,
  type SortableTransaction,
} from "./phase-1.1b-core";

export type PaymentMethod = "pix" | "credit" | "debit" | "cash";

export interface CommonQueryFilters {
  start_date?: string;
  end_date?: string;
  query?: string;
  group_id?: string;
  min_amount?: number;
  max_amount?: number;
  scope: McpScope;
  time_scope: McpTimeScope;
  sort_by: McpSortBy;
  sort_order: McpSortOrder;
}

export interface ExpenseQueryFilters extends CommonQueryFilters {
  category_id?: string;
  payment_method?: PaymentMethod;
  card_id?: string;
}

export interface IncomeQueryFilters extends CommonQueryFilters {
  income_category_id?: string;
}

export interface ExpenseRow {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  expense_date: string;
  created_at: string;
  updated_at: string;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  payment_method: PaymentMethod;
  card_id: string | null;
  card_name: string | null;
  installment_number: number | null;
  total_installments: number | null;
  shared_group_id: string | null;
}

export interface IncomeRow {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  income_date: string;
  created_at: string;
  updated_at: string;
  income_category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  installment_number: number | null;
  total_installments: number | null;
  shared_group_id: string | null;
}

export interface ExpenseItem extends SortableTransaction {
  expense_date: string;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  payment_method: PaymentMethod;
  card_id: string | null;
  card_name: string | null;
  installment_number: number | null;
  total_installments: number | null;
  shared_group_id: string | null;
  is_shared: boolean;
  is_owner: boolean;
  description: string;
  updated_at: string;
}

export interface IncomeItem extends SortableTransaction {
  income_date: string;
  income_category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  installment_number: number | null;
  total_installments: number | null;
  shared_group_id: string | null;
  is_shared: boolean;
  is_owner: boolean;
  description: string;
  updated_at: string;
}

export interface QueryPage<T> {
  items: T[];
  next_cursor: string | null;
  error: boolean;
}

export interface CompleteQuery<T> {
  items: T[];
  error: boolean;
  too_large: boolean;
}

function cursorFilterForTransactionType<
  T extends {
    or(expression: string): T;
    gt(column: string, value: string | number): T;
    lt(column: string, value: string | number): T;
  },
>(
  query: T,
  column: string,
  cursor: CursorPayload,
  rowType: McpTransactionType,
): T {
  const equalValueMode = unifiedCursorEqualValueMode(cursor.last_item_type, rowType);
  if (equalValueMode === "same_type") {
    return query.or(cursorFilterExpression(column, cursor));
  }
  const operator = cursor.sort_order === "asc" ? "gt" : "lt";
  if (equalValueMode === "include_all_equal") {
    return query.or(
      `${column}.${operator}.${cursor.sort_value},${column}.eq.${cursor.sort_value}`,
    );
  }
  return cursor.sort_order === "asc"
    ? query.gt(column, cursor.sort_value)
    : query.lt(column, cursor.sort_value);
}

const EXPENSE_COLUMNS =
  "id, user_id, description, amount, expense_date, created_at, updated_at, category_id, category_name, category_icon, payment_method, card_id, card_name, installment_number, total_installments, shared_group_id";
const INCOME_COLUMNS =
  "id, user_id, description, amount, income_date, created_at, updated_at, income_category_id, category_name, category_icon, installment_number, total_installments, shared_group_id";

function sortColumn(sortBy: McpSortBy, dateColumn: string): string {
  if (sortBy === "created_at") return "created_at";
  if (sortBy === "amount") return "amount";
  return dateColumn;
}

export function expenseItem(row: ExpenseRow, userId: string): ExpenseItem {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    date: row.expense_date,
    expense_date: row.expense_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    category_id: row.category_id,
    category_name: row.category_name,
    category_icon: row.category_icon,
    payment_method: row.payment_method,
    card_id: row.card_id,
    card_name: row.card_name,
    installment_number: row.installment_number,
    total_installments: row.total_installments,
    shared_group_id: row.shared_group_id,
    is_shared: row.shared_group_id !== null,
    is_owner: row.user_id === userId,
  };
}

export function incomeItem(row: IncomeRow, userId: string): IncomeItem {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    date: row.income_date,
    income_date: row.income_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    income_category_id: row.income_category_id,
    category_name: row.category_name,
    category_icon: row.category_icon,
    installment_number: row.installment_number,
    total_installments: row.total_installments,
    shared_group_id: row.shared_group_id,
    is_shared: row.shared_group_id !== null,
    is_owner: row.user_id === userId,
  };
}

export async function queryExpensesPage(
  supabase: SupabaseClient,
  userId: string,
  filters: ExpenseQueryFilters,
  limit: number,
  cursor: CursorPayload | null,
  cursorContext: string,
  cursorFingerprint: string,
  cursorSecret: string,
  queryTransactionType: McpQueryTransactionType = "expense",
): Promise<QueryPage<ExpenseItem>> {
  const column = sortColumn(filters.sort_by, "expense_date");
  const ascending = filters.sort_order === "asc";
  let query = supabase
    .from("expenses")
    .select(EXPENSE_COLUMNS)
    .order(column, { ascending })
    .order("id", { ascending })
    .limit(limit + 1);

  if (filters.scope === "personal") query = query.eq("user_id", userId);
  if (filters.scope === "shared") query = query.not("shared_group_id", "is", null);
  if (filters.start_date) query = query.gte("expense_date", filters.start_date);
  if (filters.end_date) query = query.lte("expense_date", filters.end_date);
  if (filters.time_scope === "occurred") query = query.lte("expense_date", todayIso());
  if (filters.time_scope === "future") query = query.gt("expense_date", todayIso());
  if (filters.category_id) query = query.eq("category_id", filters.category_id);
  if (filters.payment_method) query = query.eq("payment_method", filters.payment_method);
  if (filters.card_id) query = query.eq("card_id", filters.card_id);
  if (filters.group_id) query = query.eq("shared_group_id", filters.group_id);
  if (filters.min_amount !== undefined) query = query.gte("amount", filters.min_amount);
  if (filters.max_amount !== undefined) query = query.lte("amount", filters.max_amount);
  if (filters.query) {
    const pattern = `%${escapeIlikePattern(filters.query)}%`;
    query = query.or(
      `description.ilike.${pattern},category_name.ilike.${pattern},card_name.ilike.${pattern}`,
    );
  }
  if (cursor) {
    query = cursorFilterForTransactionType(query, column, cursor, "expense");
  }

  const { data, error } = await query;
  if (error) return { items: [], next_cursor: null, error: true };
  const rows = (data ?? []) as ExpenseRow[];
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => expenseItem(row, userId));
  const nextCursor =
    hasMore && items.length > 0
      ? await cursorForRow(
          items[items.length - 1],
          cursorContext,
          filters.sort_by,
          filters.sort_order,
          cursorFingerprint,
          cursorSecret,
          queryTransactionType,
          "expense",
        )
      : null;
  return {
    items,
    next_cursor: nextCursor,
    error: false,
  };
}

export async function queryIncomesPage(
  supabase: SupabaseClient,
  userId: string,
  filters: IncomeQueryFilters,
  limit: number,
  cursor: CursorPayload | null,
  cursorContext: string,
  cursorFingerprint: string,
  cursorSecret: string,
  queryTransactionType: McpQueryTransactionType = "income",
): Promise<QueryPage<IncomeItem>> {
  const column = sortColumn(filters.sort_by, "income_date");
  const ascending = filters.sort_order === "asc";
  let query = supabase
    .from("incomes")
    .select(INCOME_COLUMNS)
    .order(column, { ascending })
    .order("id", { ascending })
    .limit(limit + 1);

  if (filters.scope === "personal") query = query.eq("user_id", userId);
  if (filters.scope === "shared") query = query.not("shared_group_id", "is", null);
  if (filters.start_date) query = query.gte("income_date", filters.start_date);
  if (filters.end_date) query = query.lte("income_date", filters.end_date);
  if (filters.time_scope === "occurred") query = query.lte("income_date", todayIso());
  if (filters.time_scope === "future") query = query.gt("income_date", todayIso());
  if (filters.income_category_id) {
    query = query.eq("income_category_id", filters.income_category_id);
  }
  if (filters.group_id) query = query.eq("shared_group_id", filters.group_id);
  if (filters.min_amount !== undefined) query = query.gte("amount", filters.min_amount);
  if (filters.max_amount !== undefined) query = query.lte("amount", filters.max_amount);
  if (filters.query) {
    const pattern = `%${escapeIlikePattern(filters.query)}%`;
    query = query.or(`description.ilike.${pattern},category_name.ilike.${pattern}`);
  }
  if (cursor) {
    query = cursorFilterForTransactionType(query, column, cursor, "income");
  }

  const { data, error } = await query;
  if (error) return { items: [], next_cursor: null, error: true };
  const rows = (data ?? []) as IncomeRow[];
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => incomeItem(row, userId));
  const nextCursor =
    hasMore && items.length > 0
      ? await cursorForRow(
          items[items.length - 1],
          cursorContext,
          filters.sort_by,
          filters.sort_order,
          cursorFingerprint,
          cursorSecret,
          queryTransactionType,
          "income",
        )
      : null;
  return {
    items,
    next_cursor: nextCursor,
    error: false,
  };
}

export async function fetchAllExpenses(
  supabase: SupabaseClient,
  userId: string,
  filters: ExpenseQueryFilters,
  hardCap: number,
  cursorSecret: string,
): Promise<CompleteQuery<ExpenseItem>> {
  const context = "internal_expense_scan";
  const fingerprint = await filtersFingerprint(context, {
    query_transaction_type: "expense",
    ...filters,
  });
  const items: ExpenseItem[] = [];
  let cursor: CursorPayload | null = null;
  while (items.length < hardCap) {
    // 500 mantém o pedido limit+1 abaixo do max_rows padrão (1000) do PostgREST.
    const pageSize = Math.min(500, hardCap - items.length);
    const page = await queryExpensesPage(
      supabase,
      userId,
      filters,
      pageSize,
      cursor,
      context,
      fingerprint,
      cursorSecret,
    );
    if (page.error) return { items: [], error: true, too_large: false };
    items.push(...page.items);
    if (!page.next_cursor) {
      return { items: deduplicateById(items), error: false, too_large: false };
    }
    cursor = await decodeCursor(
      page.next_cursor,
      {
        context,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
        query_transaction_type: "expense",
        filters_fingerprint: fingerprint,
      },
      cursorSecret,
    );
    if (!cursor) return { items: [], error: true, too_large: false };
  }
  return { items: [], error: false, too_large: true };
}

export async function fetchAllIncomes(
  supabase: SupabaseClient,
  userId: string,
  filters: IncomeQueryFilters,
  hardCap: number,
  cursorSecret: string,
): Promise<CompleteQuery<IncomeItem>> {
  const context = "internal_income_scan";
  const fingerprint = await filtersFingerprint(context, {
    query_transaction_type: "income",
    ...filters,
  });
  const items: IncomeItem[] = [];
  let cursor: CursorPayload | null = null;
  while (items.length < hardCap) {
    const pageSize = Math.min(500, hardCap - items.length);
    const page = await queryIncomesPage(
      supabase,
      userId,
      filters,
      pageSize,
      cursor,
      context,
      fingerprint,
      cursorSecret,
    );
    if (page.error) return { items: [], error: true, too_large: false };
    items.push(...page.items);
    if (!page.next_cursor) {
      return { items: deduplicateById(items), error: false, too_large: false };
    }
    cursor = await decodeCursor(
      page.next_cursor,
      {
        context,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
        query_transaction_type: "income",
        filters_fingerprint: fingerprint,
      },
      cursorSecret,
    );
    if (!cursor) return { items: [], error: true, too_large: false };
  }
  return { items: [], error: false, too_large: true };
}
