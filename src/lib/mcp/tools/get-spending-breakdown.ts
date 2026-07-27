import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { spendingBreakdown, type ExpenseBreakdownBy } from "../shared/analytics";
import { breakdownContent } from "../shared/content";
import { currentMonthRange, ISO_DATE_RE, resolveDateRange } from "../shared/dates";
import { mcpError } from "../shared/errors";
import {
  effectiveDateRange,
  getCursorSecret,
  INTERNAL_RESULT_CAP,
  validateBoundedDateRange,
  type McpTimeScope,
} from "../shared/phase-1.1b-core";
import type { McpScope } from "../shared/scope";
import { supabaseForUser } from "../shared/supabase-client";
import { fetchAllExpenses, type ExpenseQueryFilters } from "../shared/transaction-query";

const largestTransactionSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  amount: z.number(),
  date: z.string(),
});

export default defineTool({
  name: "get_spending_breakdown",
  title: "Detalhamento de gastos",
  description:
    "Agrupa despesas por categoria, forma de pagamento, cartão, dia, semana ou mês. Padrão: mês corrente, categoria, scope=personal e time_scope=occurred. Intervalo máximo de 366 dias.",
  inputSchema: {
    start_date: z.string().regex(ISO_DATE_RE).optional(),
    end_date: z.string().regex(ISO_DATE_RE).optional(),
    group_by: z.enum(["category", "payment_method", "card", "day", "week", "month"]).optional(),
    scope: z.enum(["personal", "shared", "all_accessible"]).optional(),
    time_scope: z.enum(["occurred", "future", "all"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  outputSchema: {
    period: z.object({ start_date: z.string(), end_date: z.string() }),
    requested_period: z.object({ start_date: z.string(), end_date: z.string() }),
    effective_period: z
      .object({
        start_date: z.string(),
        end_date: z.string(),
        days: z.number().int().positive(),
      })
      .nullable(),
    coverage_warning: z.string().nullable(),
    total: z.number(),
    transaction_count: z.number().int().nonnegative(),
    groups: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        total: z.number(),
        percentage: z.number(),
        transaction_count: z.number().int().nonnegative(),
        average: z.number(),
        largest_transaction: largestTransactionSchema,
      }),
    ),
    group_by: z.enum(["category", "payment_method", "card", "day", "week", "month"]),
    scope: z.enum(["personal", "shared", "all_accessible"]),
    time_scope: z.enum(["occurred", "future", "all"]),
    complete: z.boolean(),
    data_complete: z.boolean(),
    total_group_count: z.number().int().nonnegative(),
    returned_group_count: z.number().int().nonnegative(),
    groups_truncated: z.boolean(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated() || !ctx.getUserId()) return mcpError("UNAUTHENTICATED");
    const defaults = currentMonthRange();
    const range = resolveDateRange(input.start_date, input.end_date);
    if (range.ok === false) return mcpError(range.code);
    const start = input.start_date ?? defaults.from;
    const end = input.end_date ?? defaults.to;
    const bounded = validateBoundedDateRange(start, end);
    if (bounded.ok === false) return mcpError(bounded.code);

    const groupBy: ExpenseBreakdownBy = input.group_by ?? "category";
    const scope: McpScope = input.scope ?? "personal";
    const timeScope: McpTimeScope = input.time_scope ?? "occurred";
    const coverage = effectiveDateRange(start, end, timeScope);
    const cursorSecret = getCursorSecret();
    if (!cursorSecret) return mcpError("INTERNAL_ERROR");
    let expenseItems: Awaited<ReturnType<typeof fetchAllExpenses>>["items"] = [];
    if (coverage.effective_period) {
      const filters: ExpenseQueryFilters = {
        start_date: coverage.effective_period.start_date,
        end_date: coverage.effective_period.end_date,
        scope,
        time_scope: "all",
        sort_by: "date",
        sort_order: "asc",
      };
      const expenses = await fetchAllExpenses(
        supabaseForUser(ctx),
        ctx.getUserId()!,
        filters,
        INTERNAL_RESULT_CAP,
        cursorSecret,
      );
      if (expenses.error) return mcpError("INTERNAL_ERROR");
      if (expenses.too_large) return mcpError("RESULT_SET_TOO_LARGE");
      expenseItems = expenses.items;
    }

    const breakdown = spendingBreakdown(expenseItems, groupBy, input.limit ?? 20);
    const result = {
      period: { start_date: start, end_date: end },
      requested_period: coverage.requested_period,
      effective_period: coverage.effective_period,
      coverage_warning: coverage.coverage_warning,
      total: breakdown.total,
      transaction_count: expenseItems.length,
      groups: breakdown.groups,
      group_by: groupBy,
      scope,
      time_scope: timeScope,
      complete: true,
      data_complete: true,
      total_group_count: breakdown.total_group_count,
      returned_group_count: breakdown.returned_group_count,
      groups_truncated: breakdown.groups_truncated,
    };
    return {
      content: [
        {
          type: "text",
          text: breakdownContent(result.groups, {
            requestedPeriod: result.requested_period,
            effectivePeriod: result.effective_period,
            total: result.total,
            transactionCount: result.transaction_count,
            groupBy,
            scope,
            timeScope,
            dataComplete: result.data_complete,
            returnedGroupCount: result.returned_group_count,
            totalGroupCount: result.total_group_count,
            groupsTruncated: result.groups_truncated,
            coverageWarning: coverage.coverage_warning,
          }),
        },
      ],
      structuredContent: result,
    };
  },
});
