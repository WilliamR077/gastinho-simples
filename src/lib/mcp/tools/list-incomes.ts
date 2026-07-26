import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../shared/supabase-client";
import { mcpError } from "../shared/errors";
import { ISO_DATE_RE, validateOpenDateRange } from "../shared/dates";
import {
  CURSOR_VERSION,
  decodeCursor,
  filtersFingerprint,
  getCursorSecret,
  validateAmountRange,
  type McpSortBy,
  type McpSortOrder,
  type McpTimeScope,
} from "../shared/phase-1.1b-core";
import type { McpScope } from "../shared/scope";
import { queryIncomesPage, type IncomeQueryFilters } from "../shared/transaction-query";

const CURSOR_CONTEXT = "list_incomes";

export default defineTool({
  name: "list_incomes",
  title: "Listar receitas",
  description:
    "Lista receitas com filtros e cursor estável. O padrão preserva scope=personal e time_scope=all. Para receitas já ocorridas use occurred; para lançamentos futuros use future.",
  inputSchema: {
    start_date: z.string().regex(ISO_DATE_RE).optional(),
    end_date: z.string().regex(ISO_DATE_RE).optional(),
    query: z.string().trim().min(1).max(100).optional(),
    income_category_id: z.string().uuid().optional(),
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
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated() || !ctx.getUserId()) return mcpError("UNAUTHENTICATED");
    const range = validateOpenDateRange(input.start_date, input.end_date);
    if (range.ok === false) return mcpError(range.code);
    if (!validateAmountRange(input.min_amount, input.max_amount)) {
      return mcpError("INVALID_AMOUNT_RANGE");
    }

    const scope: McpScope = input.scope ?? "personal";
    const timeScope: McpTimeScope = input.time_scope ?? "all";
    const sortBy: McpSortBy = input.sort_by ?? "date";
    const sortOrder: McpSortOrder = input.sort_order ?? "desc";
    const limit = input.limit ?? 50;
    const cursorSecret = getCursorSecret();
    if (!cursorSecret) return mcpError("INTERNAL_ERROR");
    const fingerprint = await filtersFingerprint(CURSOR_CONTEXT, {
      transaction_type: "income",
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      query: input.query ?? null,
      category_id: null,
      income_category_id: input.income_category_id ?? null,
      payment_method: null,
      card_id: null,
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
        filters_fingerprint: fingerprint,
      },
      cursorSecret,
    );
    if (input.cursor && !cursor) return mcpError("INVALID_CURSOR");

    const filters: IncomeQueryFilters = {
      start_date: input.start_date,
      end_date: input.end_date,
      query: input.query,
      income_category_id: input.income_category_id,
      group_id: input.group_id,
      min_amount: input.min_amount,
      max_amount: input.max_amount,
      scope,
      time_scope: timeScope,
      sort_by: sortBy,
      sort_order: sortOrder,
    };
    const page = await queryIncomesPage(
      supabaseForUser(ctx),
      ctx.getUserId()!,
      filters,
      limit,
      cursor,
      CURSOR_CONTEXT,
      fingerprint,
      cursorSecret,
    );
    if (page.error) return mcpError("INTERNAL_ERROR");

    const result = {
      items: page.items,
      incomes: page.items,
      count: page.items.length,
      limit,
      next_cursor: page.next_cursor,
      cursor_version: CURSOR_VERSION,
      applied_filters: {
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        query: input.query ?? null,
        income_category_id: input.income_category_id ?? null,
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
          text: `Foram encontradas ${result.count} receitas (scope=${scope}, time_scope=${timeScope}). Itens: ${JSON.stringify(page.items)}`,
        },
      ],
      structuredContent: result,
    };
  },
});
