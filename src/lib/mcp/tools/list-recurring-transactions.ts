import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpError } from "../shared/errors";
import {
  CURSOR_VERSION,
  escapeIlikePattern,
  filtersFingerprint,
  getCursorSecret,
} from "../shared/phase-1.1b-core";
import {
  compareRecurringItems,
  RECURRING_DATA_WARNINGS,
  recurringCursorSortValue,
  recurringItem,
  type RecurringItem,
  type RecurringRow,
  type RecurringTransactionType,
} from "../shared/recurring";
import {
  decodeResourceCursor,
  encodeResourceCursor,
  type ResourceCursorPayload,
} from "../shared/resource-cursor";
import type { McpScope } from "../shared/scope";
import { supabaseForUser, type McpQueryLike } from "../shared/supabase-client";

const CURSOR_CONTEXT = "list_recurring_transactions";
const CURSOR_SORT = "day_of_month|transaction_type|id";
const warningSchema = z.enum(RECURRING_DATA_WARNINGS);

const commonShape = {
  id: z.string().uuid(),
  transaction_type: z.enum(["expense", "income"]),
  description: z.string(),
  amount: z.number(),
  day_of_month: z.number().int(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  is_active: z.boolean(),
  category_id: z.string().uuid().nullable(),
  category_name: z.string().nullable(),
  shared_group_id: z.string().uuid().nullable(),
  is_shared: z.boolean(),
  is_owner: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  data_warnings: z.array(warningSchema),
};
const recurringItemSchema = z.discriminatedUnion("transaction_type", [
  z.object({
    ...commonShape,
    transaction_type: z.literal("expense"),
    payment_method: z.enum(["pix", "credit", "debit", "cash"]),
    card_id: z.string().uuid().nullable(),
    card_name: z.string().nullable(),
  }).strict(),
  z.object({
    ...commonShape,
    transaction_type: z.literal("income"),
  }).strict(),
]);

function applyCursor<T extends {
  or(expression: string): T;
  gte(column: string, value: number): T;
  gt(column: string, value: number): T;
}>(
  query: T,
  transactionType: RecurringTransactionType,
  cursor: ResourceCursorPayload,
): T {
  const [dayText, cursorType] = cursor.sort_value.split("|");
  const day = Number(dayText);
  if (cursorType === transactionType) {
    return query.or(
      `day_of_month.gt.${day},and(day_of_month.eq.${day},id.gt.${cursor.id})`,
    );
  }
  return cursorType === "expense" && transactionType === "income"
    ? query.gte("day_of_month", day)
    : query.gt("day_of_month", day);
}

export default defineTool({
  name: "list_recurring_transactions",
  title: "Listar templates recorrentes",
  description:
    "Lista templates mensais de despesas e receitas recorrentes acessíveis à conta autenticada. Não representa lançamentos financeiros já realizados.",
  inputSchema: {
    transaction_type: z.enum(["expense", "income", "all"]).optional(),
    scope: z.enum(["personal", "shared", "all_accessible"]).optional(),
    group_id: z.string().uuid().optional(),
    status: z.enum(["active", "inactive", "all"]).optional(),
    query: z.string().trim().min(1).max(100).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).max(1000).optional(),
  },
  outputSchema: {
    items: z.array(recurringItemSchema),
    count: z.number().int().nonnegative(),
    has_more: z.boolean(),
    next_cursor: z.string().nullable(),
    cursor_version: z.literal(3),
    applied_filters: z.object({
      transaction_type: z.enum(["expense", "income", "all"]),
      scope: z.enum(["personal", "shared", "all_accessible"]),
      group_id: z.string().uuid().nullable(),
      status: z.enum(["active", "inactive", "all"]),
      query: z.string().nullable(),
      limit: z.number().int().min(1).max(100),
    }).strict(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const userId = ctx.getUserId();
    if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
    const transactionType = input.transaction_type ?? "all";
    const scope: McpScope = input.scope ?? "personal";
    const status = input.status ?? "active";
    const limit = input.limit ?? 20;
    const cursorSecret = getCursorSecret();
    if (!cursorSecret) return mcpError("INTERNAL_ERROR");
    const appliedFilters = {
      transaction_type: transactionType,
      scope,
      group_id: input.group_id ?? null,
      status,
      query: input.query ?? null,
      limit,
    };
    const fingerprint = await filtersFingerprint(
      CURSOR_CONTEXT,
      appliedFilters,
    );
    const cursor = await decodeResourceCursor(
      input.cursor,
      {
        context: CURSOR_CONTEXT,
        sort_by: CURSOR_SORT,
        sort_order: "asc",
        filters_fingerprint: fingerprint,
      },
      cursorSecret,
    );
    if (input.cursor && !cursor) return mcpError("INVALID_CURSOR");

    const supabase = supabaseForUser(ctx);
    const pageSize = limit + 1;
    const configure = <
      T extends {
        eq(column: string, value: string | boolean): T;
        not(column: string, operator: string, value: null): T;
        or(expression: string): T;
        gte(column: string, value: number): T;
        gt(column: string, value: number): T;
      },
    >(
      query: T,
      rowType: RecurringTransactionType,
    ): T => {
      let configured = query;
      if (scope === "personal") configured = configured.eq("user_id", userId);
      if (scope === "shared") {
        configured = configured.not("shared_group_id", "is", null);
      }
      if (input.group_id) {
        configured = configured.eq("shared_group_id", input.group_id);
      }
      if (status !== "all") {
        configured = configured.eq("is_active", status === "active");
      }
      if (input.query) {
        const pattern = `%${escapeIlikePattern(input.query)}%`;
        configured = configured.or(
          rowType === "expense"
            ? `description.ilike.${pattern},category_name.ilike.${pattern},card_name.ilike.${pattern}`
            : `description.ilike.${pattern},category_name.ilike.${pattern}`,
        );
      }
      if (cursor) configured = applyCursor(configured, rowType, cursor);
      return configured;
    };

    const expensePromise =
      transactionType === "income"
        ? Promise.resolve({ data: [], error: null })
        : configure(
            supabase
              .from("recurring_expenses")
              .select(
                "id,user_id,description,amount,day_of_month,start_date,end_date,is_active,category_id,category_name,shared_group_id,created_at,updated_at,payment_method,card_id,card_name",
              ) as unknown as McpQueryLike,
            "expense",
          )
            .order("day_of_month", { ascending: true })
            .order("id", { ascending: true })
            .limit(pageSize);
    const incomePromise =
      transactionType === "expense"
        ? Promise.resolve({ data: [], error: null })
        : configure(
            supabase
              .from("recurring_incomes")
              .select(
                "id,user_id,description,amount,day_of_month,start_date,end_date,is_active,income_category_id,category_name,shared_group_id,created_at,updated_at",
              ) as unknown as McpQueryLike,
            "income",
          )
            .order("day_of_month", { ascending: true })
            .order("id", { ascending: true })
            .limit(pageSize);
    const [expenseResult, incomeResult] = await Promise.all([
      expensePromise,
      incomePromise,
    ]);
    if (expenseResult.error || incomeResult.error) return mcpError("INTERNAL_ERROR");

    const combined: RecurringItem[] = [
      ...((expenseResult.data ?? []) as RecurringRow[]).map((row) =>
        recurringItem(row, "expense", userId)),
      ...((incomeResult.data ?? []) as RecurringRow[]).map((row) =>
        recurringItem(row, "income", userId)),
    ].sort(compareRecurringItems);
    const hasMore = combined.length > limit;
    const items = combined.slice(0, limit);
    const last = items.at(-1);
    const nextCursor =
      hasMore && last
        ? await encodeResourceCursor(
            {
              context: CURSOR_CONTEXT,
              sort_by: CURSOR_SORT,
              sort_order: "asc",
              sort_value: recurringCursorSortValue(last),
              id: last.id,
              filters_fingerprint: fingerprint,
            },
            cursorSecret,
          )
        : null;
    const result = {
      items,
      count: items.length,
      has_more: hasMore,
      next_cursor: nextCursor,
      cursor_version: CURSOR_VERSION,
      applied_filters: appliedFilters,
    };
    return {
      content: [
        {
          type: "text",
          text:
            "Estes itens são templates mensais e não lançamentos financeiros já realizados. " +
            `Filtros=${JSON.stringify(appliedFilters)}; count=${items.length}; has_more=${hasMore}; ` +
            `cursor_version=${CURSOR_VERSION}; next_cursor=${nextCursor ?? "null"}. ` +
            `Templates (máximo 10)=${JSON.stringify(items.slice(0, 10))}; ` +
            `templates omitidos do content=${Math.max(0, items.length - 10)}.`,
        },
      ],
      structuredContent: result,
    };
  },
});
