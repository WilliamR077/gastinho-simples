import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  CATEGORY_USAGE_WARNINGS,
  calculateCategoryUsage,
  type CategoryCatalogRow,
  type CategoryTransactionRow,
} from "../shared/category-usage";
import { mcpError } from "../shared/errors";
import { validateBoundedDateRange } from "../shared/phase-1.1b-core";
import { supabaseForUser } from "../shared/supabase-client";

const TRANSACTION_CAP = 10_000;
const warningSchema = z.enum(CATEGORY_USAGE_WARNINGS);
const monthlyPointSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  total: z.number(),
  transaction_count: z.number().int().nonnegative(),
}).strict();
const categorySchema = z.object({
  category_id: z.string().uuid(),
  name: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  is_active: z.boolean(),
  is_default: z.boolean(),
  transaction_count: z.number().int().nonnegative(),
  total: z.number(),
  percentage: z.number(),
  first_used_at: z.string().nullable(),
  last_used_at: z.string().nullable(),
  monthly_average: z.number(),
  monthly_series: z.array(monthlyPointSchema),
}).strict();

interface ExpenseUsageRow {
  id: string;
  amount: number;
  expense_date: string;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
}

interface IncomeUsageRow {
  id: string;
  amount: number;
  income_date: string;
  income_category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
}

export default defineTool({
  name: "get_category_usage",
  title: "Consultar uso pessoal de categorias",
  description:
    "Apresenta fatos históricos sobre o uso das categorias pessoais de despesas ou receitas da conta autenticada. Não inclui categorias compartilhadas nem transações de outros proprietários.",
  inputSchema: {
    kind: z.enum(["expense", "income"]),
    start_date: z.string(),
    end_date: z.string(),
    include_inactive: z.boolean().optional(),
    include_unused: z.boolean().optional(),
    trend_granularity: z.literal("month").optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  outputSchema: {
    kind: z.enum(["expense", "income"]),
    requested_period: z.object({
      start_date: z.string(),
      end_date: z.string(),
    }).strict(),
    categories: z.array(categorySchema),
    uncategorized: z.object({
      transaction_count: z.number().int().nonnegative(),
      total: z.number(),
      percentage: z.number(),
    }).strict(),
    total_amount: z.number(),
    total_transaction_count: z.number().int().nonnegative(),
    categories_truncated: z.boolean(),
    total_category_count: z.number().int().nonnegative(),
    returned_category_count: z.number().int().nonnegative(),
    data_complete: z.boolean(),
    warnings: z.array(warningSchema),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const userId = ctx.getUserId();
    if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
    const range = validateBoundedDateRange(input.start_date, input.end_date);
    if (!range.ok) return mcpError(range.code);
    const includeInactive = input.include_inactive ?? true;
    const includeUnused = input.include_unused ?? true;
    const limit = input.limit ?? 50;
    const supabase = supabaseForUser(ctx);
    const categoryTable =
      input.kind === "expense" ? "user_categories" : "user_income_categories";
    const { data: categoryData, error: categoryError } = await supabase
      .from(categoryTable)
      .select("id,name,icon,color,is_active,is_default")
      .eq("user_id", userId);
    if (categoryError) return mcpError("INTERNAL_ERROR");

    const fetchTransactions = async (): Promise<
      | { ok: true; rows: CategoryTransactionRow[] }
      | { ok: false; tooLarge: boolean }
    > => {
      const rows: CategoryTransactionRow[] = [];
      let offset = 0;
      while (offset <= TRANSACTION_CAP) {
        const end = Math.min(offset + 999, TRANSACTION_CAP);
        const dateColumn =
          input.kind === "expense" ? "expense_date" : "income_date";
        const categoryColumn =
          input.kind === "expense" ? "category_id" : "income_category_id";
        const columns =
          `id,amount,${dateColumn},${categoryColumn},category_name,category_icon`;
        const { data, error } = await supabase
          .from(input.kind === "expense" ? "expenses" : "incomes")
          .select(columns)
          .eq("user_id", userId)
          .gte(dateColumn, input.start_date)
          .lte(dateColumn, input.end_date)
          .order("id", { ascending: true })
          .range(offset, end);
        if (error) return { ok: false, tooLarge: false };
        const page = data ?? [];
        for (const raw of page) {
          if (input.kind === "expense") {
            const row = raw as ExpenseUsageRow;
            rows.push({
              id: row.id,
              amount: Number(row.amount),
              date: row.expense_date,
              category_id: row.category_id,
              category_name: row.category_name,
              category_icon: row.category_icon,
            });
          } else {
            const row = raw as IncomeUsageRow;
            rows.push({
              id: row.id,
              amount: Number(row.amount),
              date: row.income_date,
              category_id: row.income_category_id,
              category_name: row.category_name,
              category_icon: row.category_icon,
            });
          }
        }
        if (rows.length > TRANSACTION_CAP) {
          return { ok: false, tooLarge: true };
        }
        if (page.length < end - offset + 1) return { ok: true, rows };
        offset = end + 1;
      }
      return { ok: false, tooLarge: true };
    };

    const transactionResult = await fetchTransactions();
    if (!transactionResult.ok) {
      return mcpError(
        transactionResult.tooLarge ? "RESULT_SET_TOO_LARGE" : "INTERNAL_ERROR",
      );
    }
    const usage = calculateCategoryUsage(
      (categoryData ?? []) as CategoryCatalogRow[],
      transactionResult.rows,
      {
        start_date: input.start_date,
        end_date: input.end_date,
        include_inactive: includeInactive,
        include_unused: includeUnused,
        limit,
      },
    );
    const result = {
      kind: input.kind,
      requested_period: {
        start_date: input.start_date,
        end_date: input.end_date,
      },
      ...usage,
      data_complete: true,
    };
    const contentCategories = usage.categories.slice(0, 10).map((category) => ({
      ...category,
      monthly_series: category.monthly_series.slice(0, 12),
      monthly_series_omitted: Math.max(0, category.monthly_series.length - 12),
    }));
    return {
      content: [
        {
          type: "text",
          text:
            `Uso histórico de categorias pessoais de ${input.kind === "expense" ? "despesas" : "receitas"} ` +
            `no período ${input.start_date} a ${input.end_date}. ` +
            `Total=${usage.total_amount}; transações=${usage.total_transaction_count}; ` +
            `categorias retornadas=${usage.returned_category_count}/${usage.total_category_count}; ` +
            `categories_truncated=${usage.categories_truncated}; data_complete=true. ` +
            `Categorias (máximo 10; série mensal limitada a 12 pontos no texto)=` +
            `${JSON.stringify(contentCategories)}. ` +
            `Sem classificação=${JSON.stringify(usage.uncategorized)}. ` +
            `warnings=${JSON.stringify(usage.warnings)}. ` +
            "Categorias são pessoais; transações de outros proprietários não entram. " +
            "Os valores são fatos históricos, não recomendações ou julgamentos sobre gastos.",
        },
      ],
      structuredContent: result,
    };
  },
});
