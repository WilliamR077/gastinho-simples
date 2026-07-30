import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ISO_DATE_RE, validateOpenDateRange } from "../shared/dates";
import { transactionContent } from "../shared/content";
import { mcpError } from "../shared/errors";
import {
  compareUnifiedTransactions,
  CURSOR_VERSION,
  cursorForRow,
  decodeCursor,
  filtersFingerprint,
  getCursorSecret,
  hasInvalidExpenseOnlyFilters,
  validateAmountRange,
  type McpSortBy,
  type McpSortOrder,
  type McpTimeScope,
} from "../shared/phase-1.1b-core";
import type { McpScope } from "../shared/scope";
import { supabaseForUser } from "../shared/supabase-client";
import {
  queryExpensesPage,
  queryIncomesPage,
  type ExpenseQueryFilters,
  type IncomeQueryFilters,
  type PaymentMethod,
} from "../shared/transaction-query";

const CURSOR_CONTEXT = "search_transactions";

const transactionItemSchema = z.object({
  id: z.string().uuid(),
  transaction_type: z.enum(["expense", "income"]),
  description: z.string(),
  amount: z.number(),
  date: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  category_id: z.string().uuid().nullable(),
  category_name: z.string().nullable(),
  category_icon: z.string().nullable(),
  payment_method: z.enum(["pix", "credit", "debit", "cash"]).nullable(),
  card_id: z.string().uuid().nullable(),
  card_name: z.string().nullable(),
  installment_group_id: z.string().uuid().nullable(),
  installment_number: z.number().int().nullable(),
  total_installments: z.number().int().nullable(),
  is_installment: z.boolean(),
  shared_group_id: z.string().uuid().nullable(),
  is_shared: z.boolean(),
  is_owner: z.boolean(),
});

export default defineTool({
  name: "search_transactions",
  title: "Pesquisar transações",
  description:
    "Pesquisa despesas e receitas em uma resposta unificada. Por padrão busca transações já ocorridas, pessoais, ordenadas por data decrescente. card_id e payment_method exigem transaction_type=expense. Use future para lançamentos futuros e all somente quando solicitado.",
  inputSchema: {
    query: z.string().trim().min(1).max(100).optional(),
    transaction_type: z.enum(["expense", "income", "all"]).optional(),
    start_date: z.string().regex(ISO_DATE_RE).optional(),
    end_date: z.string().regex(ISO_DATE_RE).optional(),
    category_id: z.string().uuid().optional(),
    payment_method: z
      .enum(["pix", "credit", "debit", "cash"])
      .optional()
      .describe("Filtro exclusivo de despesas; use transaction_type=expense."),
    card_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filtro exclusivo de despesas; use transaction_type=expense."),
    group_id: z.string().uuid().optional(),
    min_amount: z.number().nonnegative().optional(),
    max_amount: z.number().nonnegative().optional(),
    scope: z.enum(["personal", "shared", "all_accessible"]).optional(),
    time_scope: z.enum(["occurred", "future", "all"]).optional(),
    sort_by: z.enum(["date", "created_at", "amount"]).optional(),
    sort_order: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).max(1000).optional(),
  },
  outputSchema: {
    items: z.array(transactionItemSchema),
    count: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    has_more: z.boolean(),
    cursor_version: z.literal(3),
    next_cursor: z.string().nullable(),
    applied_filters: z.object({
      query: z.string().nullable(),
      transaction_type: z.enum(["expense", "income", "all"]),
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
      category_id: z.string().nullable(),
      payment_method: z.string().nullable(),
      card_id: z.string().nullable(),
      group_id: z.string().nullable(),
      min_amount: z.number().nullable(),
      max_amount: z.number().nullable(),
      sort_by: z.enum(["date", "created_at", "amount"]),
      sort_order: z.enum(["asc", "desc"]),
    }),
    scope: z.enum(["personal", "shared", "all_accessible"]),
    time_scope: z.enum(["occurred", "future", "all"]),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated() || !ctx.getUserId()) return mcpError("UNAUTHENTICATED");
    const range = validateOpenDateRange(input.start_date, input.end_date);
    if (range.ok === false) return mcpError(range.code);
    if (!validateAmountRange(input.min_amount, input.max_amount)) {
      return mcpError("INVALID_AMOUNT_RANGE");
    }

    const transactionType = input.transaction_type ?? "all";
    if (
      hasInvalidExpenseOnlyFilters(
        transactionType,
        input.card_id,
        input.payment_method,
      )
    ) {
      return mcpError("INVALID_FILTER_COMBINATION");
    }

    const scope: McpScope = input.scope ?? "personal";
    const timeScope: McpTimeScope = input.time_scope ?? "occurred";
    const sortBy: McpSortBy = input.sort_by ?? "date";
    const sortOrder: McpSortOrder = input.sort_order ?? "desc";
    const limit = input.limit ?? 20;
    const cursorSecret = getCursorSecret();
    if (!cursorSecret) return mcpError("INTERNAL_ERROR");
    const fingerprint = await filtersFingerprint(CURSOR_CONTEXT, {
      query_transaction_type: transactionType,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      query: input.query ?? null,
      category_id: input.category_id ?? null,
      income_category_id: input.category_id ?? null,
      payment_method: input.payment_method ?? null,
      card_id: input.card_id ?? null,
      group_id: input.group_id ?? null,
      min_amount: input.min_amount ?? null,
      max_amount: input.max_amount ?? null,
      scope,
      time_scope: timeScope,
      sort_by: sortBy,
      sort_order: sortOrder,
    });
    const cursor = await decodeCursor(
      input.cursor,
      {
        context: CURSOR_CONTEXT,
        sort_by: sortBy,
        sort_order: sortOrder,
        query_transaction_type: transactionType,
        filters_fingerprint: fingerprint,
      },
      cursorSecret,
    );
    if (input.cursor && !cursor) return mcpError("INVALID_CURSOR");

    const common = {
      start_date: input.start_date,
      end_date: input.end_date,
      query: input.query,
      group_id: input.group_id,
      min_amount: input.min_amount,
      max_amount: input.max_amount,
      scope,
      time_scope: timeScope,
      sort_by: sortBy,
      sort_order: sortOrder,
    };
    const expenseFilters: ExpenseQueryFilters = {
      ...common,
      category_id: input.category_id,
      payment_method: input.payment_method as PaymentMethod | undefined,
      card_id: input.card_id,
    };
    const incomeFilters: IncomeQueryFilters = {
      ...common,
      income_category_id: input.category_id,
    };
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;

    const [expensePage, incomePage] = await Promise.all([
      transactionType === "income"
        ? Promise.resolve({ items: [], next_cursor: null, error: false })
        : queryExpensesPage(
            supabase,
            userId,
            expenseFilters,
            limit + 1,
            cursor,
            CURSOR_CONTEXT,
            fingerprint,
            cursorSecret,
            transactionType,
          ),
      transactionType === "expense"
        ? Promise.resolve({ items: [], next_cursor: null, error: false })
        : queryIncomesPage(
            supabase,
            userId,
            incomeFilters,
            limit + 1,
            cursor,
            CURSOR_CONTEXT,
            fingerprint,
            cursorSecret,
            transactionType,
          ),
    ]);
    if (expensePage.error || incomePage.error) return mcpError("INTERNAL_ERROR");

    const combined = [
      ...expensePage.items.map((item) => ({
        ...item,
        transaction_type: "expense" as const,
        category_id: item.category_id,
      })),
      ...incomePage.items.map((item) => ({
        ...item,
        transaction_type: "income" as const,
        category_id: item.income_category_id,
        payment_method: null,
        card_id: null,
        card_name: null,
      })),
    ].sort((left, right) =>
      compareUnifiedTransactions(left, right, sortBy, sortOrder),
    );

    const hasMore =
      combined.length > limit ||
      expensePage.next_cursor !== null ||
      incomePage.next_cursor !== null;
    const items = combined.slice(0, limit).map((item) => ({
      id: item.id,
      transaction_type: item.transaction_type,
      description: item.description,
      amount: item.amount,
      date: item.date,
      created_at: item.created_at,
      updated_at: item.updated_at,
      category_id: item.category_id,
      category_name: item.category_name,
      category_icon: item.category_icon,
      payment_method: item.transaction_type === "expense" ? item.payment_method : null,
      card_id: item.transaction_type === "expense" ? item.card_id : null,
      card_name: item.transaction_type === "expense" ? item.card_name : null,
      installment_group_id: item.installment_group_id,
      installment_number: item.installment_number,
      total_installments: item.total_installments,
      is_installment: item.is_installment,
      shared_group_id: item.shared_group_id,
      is_shared: item.is_shared,
      is_owner: item.is_owner,
    }));
    const nextCursor =
      hasMore && items.length > 0
        ? await cursorForRow(
            items[items.length - 1],
            CURSOR_CONTEXT,
            sortBy,
            sortOrder,
            fingerprint,
            cursorSecret,
            transactionType,
            items[items.length - 1].transaction_type,
          )
        : null;
    const result = {
      items,
      count: items.length,
      limit,
      has_more: hasMore,
      cursor_version: CURSOR_VERSION,
      next_cursor: nextCursor,
      applied_filters: {
        query: input.query ?? null,
        transaction_type: transactionType,
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        category_id: input.category_id ?? null,
        payment_method: input.payment_method ?? null,
        card_id: input.card_id ?? null,
        group_id: input.group_id ?? null,
        min_amount: input.min_amount ?? null,
        max_amount: input.max_amount ?? null,
        sort_by: sortBy,
        sort_order: sortOrder,
      },
      scope,
      time_scope: timeScope,
    };
    return {
      content: [
        {
          type: "text",
          text: transactionContent(
            items,
            scope,
            timeScope,
            transactionType,
            hasMore,
            nextCursor,
            limit,
            CURSOR_VERSION,
            result.applied_filters,
          ),
        },
      ],
      structuredContent: result,
    };
  },
});
