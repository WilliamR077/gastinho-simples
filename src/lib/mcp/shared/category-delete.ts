import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { preserveSqlDate, timestampToSaoPauloCivilDate } from "./cashflow";
import {
  type CategoryKind,
  expenseCategoryViewSchema,
  incomeCategoryViewSchema,
} from "./category-write";
import { todayIso } from "./dates";
import { type McpErrorCode, mcpError } from "./errors";
import {
  expenseCategoryGoalReference,
  expenseGoalReferenceDependsOnName,
  expenseGoalReferenceMatchesCategory,
} from "./goal-write";
import { supabaseForUser } from "./supabase-client";
import { expectedUpdatedAtSchema } from "./transaction-update";

type InstallmentRefRow = {
  installment_group_id?: string | null;
  installment_number?: number | null;
  total_installments?: number | null;
};


const COLUMNS =
  "id,user_id,name,icon,color,is_default,is_active,display_order,created_at,updated_at";

type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string | null;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export const expenseCategoryDeleteReferenceSchema = z
  .object({
    historical_expense_count: z.number().int().nonnegative(),
    future_expense_count: z.number().int().nonnegative(),
    installment_expense_count: z.number().int().nonnegative(),
    active_recurring_expense_count: z.number().int().nonnegative(),
    inactive_recurring_expense_count: z.number().int().nonnegative(),
    uuid_goal_count: z.number().int().nonnegative(),
    legacy_goal_count: z.number().int().nonnegative(),
    total_goal_count: z.number().int().nonnegative(),
    total_expense_reference_count: z.number().int().nonnegative(),
    total_recurring_reference_count: z.number().int().nonnegative(),
    total_reference_count: z.number().int().nonnegative(),
  })
  .strict();

export const incomeCategoryDeleteReferenceSchema = z
  .object({
    historical_income_count: z.number().int().nonnegative(),
    future_income_count: z.number().int().nonnegative(),
    active_recurring_income_count: z.number().int().nonnegative(),
    inactive_recurring_income_count: z.number().int().nonnegative(),
    goal_count: z.number().int().nonnegative(),
    total_income_reference_count: z.number().int().nonnegative(),
    total_recurring_reference_count: z.number().int().nonnegative(),
    total_reference_count: z.number().int().nonnegative(),
  })
  .strict();

type ExpenseSummary = z.infer<typeof expenseCategoryDeleteReferenceSchema>;
type IncomeSummary = z.infer<typeof incomeCategoryDeleteReferenceSchema>;
type ReferenceSummary = ExpenseSummary | IncomeSummary;

const warningSchema = z.enum([
  "PERMANENT_DELETION",
  "CATEGORY_DELETED",
  "EXPENSE_CATEGORY_DELETED",
  "INCOME_CATEGORY_DELETED",
  "FINANCIAL_DATA_UNAFFECTED",
]);

function view(row: CategoryRow, kind: CategoryKind) {
  const base = {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    is_default: row.is_default,
    is_active: row.is_active,
    display_order: row.display_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  return kind === "expense"
    ? { ...base, goal_reference: expenseCategoryGoalReference(row.id) }
    : base;
}

function protectedFallback(row: CategoryRow): boolean {
  return (
    row.name.trim().toLocaleLowerCase("pt-BR") === "outros" ||
    (row.is_default && row.display_order === 8)
  );
}

async function inspectReferences(
  supabase: ReturnType<typeof supabaseForUser>,
  kind: CategoryKind,
  row: CategoryRow,
  userId: string,
): Promise<ReferenceSummary | null> {
  const transactionTable = kind === "expense" ? "expenses" : "incomes";
  const recurringTable =
    kind === "expense" ? "recurring_expenses" : "recurring_incomes";
  const categoryColumn =
    kind === "expense" ? "category_id" : "income_category_id";
  const dateColumn = kind === "expense" ? "expense_date" : "income_date";
  const transactions = await supabase
    .from(transactionTable)
    .select(
      kind === "expense"
        ? `id,${dateColumn},installment_group_id,installment_number,total_installments`
        : `id,${dateColumn}`,
    )
    .eq("user_id", userId)
    .eq(categoryColumn, row.id);
  const recurring = await supabase
    .from(recurringTable)
    .select("id,is_active")
    .eq("user_id", userId)
    .eq(categoryColumn, row.id);
  const goals = await supabase
    .from("budget_goals")
    .select("id,category")
    .eq("user_id", userId)
    .eq("type", kind === "expense" ? "category" : "income_category");
  if (transactions.error || recurring.error || goals.error) return null;

  const transactionRows = transactions.data ?? [];
  const recurringRows = recurring.data ?? [];
  const dates = transactionRows.map((item) =>
    kind === "expense"
      ? preserveSqlDate(item[dateColumn])
      : timestampToSaoPauloCivilDate(String(item[dateColumn])),
  );
  if (dates.some((date) => date === null)) return null;
  const today = todayIso();
  const historical = dates.filter((date) => date! <= today).length;
  const future = dates.length - historical;
  const activeRecurring = recurringRows.filter((item) => item.is_active).length;

  if (kind === "expense") {
    const matchingGoals = (goals.data ?? []).filter((goal) =>
      expenseGoalReferenceMatchesCategory(goal.category, row),
    );
    const uuidGoals = matchingGoals.filter(
      (goal) =>
        typeof goal.category === "string" &&
        goal.category.toLowerCase() === row.id.toLowerCase(),
    ).length;
    const legacyGoals = matchingGoals.filter((goal) =>
      expenseGoalReferenceDependsOnName(goal.category, row),
    ).length;
    const installmentCount = (transactionRows as InstallmentRefRow[]).filter(
      (item) =>
        item.installment_group_id !== null ||
        (item.installment_number ?? 0) > 1 ||
        (item.total_installments ?? 0) > 1,
    ).length;
    return {
      historical_expense_count: historical,
      future_expense_count: future,
      installment_expense_count: installmentCount,
      active_recurring_expense_count: activeRecurring,
      inactive_recurring_expense_count:
        recurringRows.length - activeRecurring,
      uuid_goal_count: uuidGoals,
      legacy_goal_count: legacyGoals,
      total_goal_count: matchingGoals.length,
      total_expense_reference_count: transactionRows.length,
      total_recurring_reference_count: recurringRows.length,
      total_reference_count:
        transactionRows.length + recurringRows.length + matchingGoals.length,
    };
  }

  const goalCount = (goals.data ?? []).filter(
    (goal) =>
      typeof goal.category === "string" &&
      goal.category.toLowerCase() === row.id.toLowerCase(),
  ).length;
  return {
    historical_income_count: historical,
    future_income_count: future,
    active_recurring_income_count: activeRecurring,
    inactive_recurring_income_count: recurringRows.length - activeRecurring,
    goal_count: goalCount,
    total_income_reference_count: transactionRows.length,
    total_recurring_reference_count: recurringRows.length,
    total_reference_count:
      transactionRows.length + recurringRows.length + goalCount,
  };
}

function blocked(
  code: McpErrorCode,
  message: string,
  summary?: ReferenceSummary,
) {
  const error = mcpError(code, message);
  return summary
    ? {
        ...error,
        content: [{
          type: "text" as const,
          text: `${message} Contagens=${JSON.stringify(summary)}. Nada foi alterado.`,
        }],
        structuredContent: {
          ...error.structuredContent,
          reference_summary: summary,
        },
      }
    : error;
}

export function deleteCategoryTool(kind: CategoryKind) {
  const table =
    kind === "expense" ? "user_categories" : "user_income_categories";
  const outputCategorySchema =
    kind === "expense" ? expenseCategoryViewSchema : incomeCategoryViewSchema;
  const referenceSchema =
    kind === "expense"
      ? expenseCategoryDeleteReferenceSchema
      : incomeCategoryDeleteReferenceSchema;
  const inputProperties = {
    category_id: z.string().uuid(),
    expected_updated_at: expectedUpdatedAtSchema,
    confirm_delete: z.boolean(),
  };
  const validator = z.object(inputProperties).strict();
  return defineTool({
    name: `delete_${kind}_category`,
    title: `Excluir categoria de ${kind === "expense" ? "despesa" : "receita"}`,
    description:
      "Exclui permanentemente somente uma categoria pessoal inativa, não protegida e sem qualquer referência.",
    inputSchema: inputProperties,
    outputSchema: {
      resource_type: z.literal("category"),
      category_kind: z.literal(kind),
      id: z.string().uuid(),
      deleted: z.literal(true),
      deletion_mode: z.literal("permanent"),
      deleted_category: outputCategorySchema,
      reference_summary: referenceSchema,
      operation_completed_at: z.string(),
      warnings: z.array(warningSchema),
      data_complete: z.literal(true),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    handler: async (rawInput, ctx) => {
      const userId = ctx.getUserId();
      if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
      const parsed = validator.safeParse(rawInput);
      if (!parsed.success) return mcpError("INVALID_INPUT");
      const input = parsed.data;
      const supabase = supabaseForUser(ctx);
      const currentResult = await supabase
        .from(table)
        .select(COLUMNS)
        .eq("id", input.category_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (currentResult.error) return mcpError("INTERNAL_ERROR");
      if (!currentResult.data) return mcpError("RESOURCE_NOT_FOUND");
      const current = currentResult.data as CategoryRow;
      if (current.updated_at !== input.expected_updated_at) {
        return mcpError(
          "CONCURRENT_MODIFICATION",
          "A categoria mudou desde a leitura. Releia-a com list_categories e include_inactive=true.",
        );
      }
      if (!input.confirm_delete) {
        return mcpError(
          "CONFIRMATION_REQUIRED",
          "Nada foi removido. A exclusão é permanente e não possui restauração pelo MCP. Nenhuma transação, recorrência ou meta será removida. Repita com confirm_delete=true.",
        );
      }
      if (protectedFallback(current)) {
        return mcpError(
          "CATEGORY_NOT_DELETABLE",
          "A categoria fallback protegida não pode ser excluída.",
        );
      }
      if (current.is_active) {
        return mcpError(
          "CATEGORY_MUST_BE_INACTIVE",
          `A categoria precisa ser desativada antes com update_${kind}_category. Nada foi alterado.`,
        );
      }
      const summary = await inspectReferences(supabase, kind, current, userId);
      if (!summary) return mcpError("INTERNAL_ERROR");
      if (summary.total_reference_count > 0) {
        return blocked(
          "CATEGORY_HAS_REFERENCES",
          "A categoria possui referências e deve permanecer inativa para preservar o histórico.",
          summary,
        );
      }

      const deleteResult = await supabase
        .from(table)
        .delete()
        .eq("id", input.category_id)
        .eq("user_id", userId)
        .eq("updated_at", input.expected_updated_at)
        .eq("is_active", false)
        .select(COLUMNS)
        .maybeSingle();
      if (deleteResult.error) {
        return blocked(
          deleteResult.error.code === "23503"
            ? "CATEGORY_HAS_REFERENCES"
            : "WRITE_FAILED",
          deleteResult.error.code === "23503"
            ? "Uma referência foi criada durante a operação; a categoria não foi excluída."
            : "Não foi possível concluir a exclusão da categoria.",
          deleteResult.error.code === "23503" ? summary : undefined,
        );
      }
      if (!deleteResult.data) {
        const existence = await supabase
          .from(table)
          .select("id,updated_at,is_active")
          .eq("id", input.category_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (existence.error) return mcpError("INTERNAL_ERROR");
        if (!existence.data) return mcpError("RESOURCE_NOT_FOUND");
        return mcpError(
          "CONCURRENT_MODIFICATION",
          "A categoria mudou ou foi reativada durante a exclusão. Releia-a com list_categories e include_inactive=true.",
        );
      }
      const deletedCategory = view(deleteResult.data as CategoryRow, kind);
      const operationCompletedAt = new Date().toISOString();
      const warnings = [
        "PERMANENT_DELETION",
        "CATEGORY_DELETED",
        kind === "expense"
          ? "EXPENSE_CATEGORY_DELETED"
          : "INCOME_CATEGORY_DELETED",
        "FINANCIAL_DATA_UNAFFECTED",
      ] as const;
      const result = {
        resource_type: "category" as const,
        category_kind: kind,
        id: deletedCategory.id,
        deleted: true as const,
        deletion_mode: "permanent" as const,
        deleted_category: deletedCategory,
        reference_summary: summary,
        operation_completed_at: operationCompletedAt,
        warnings: [...warnings],
        data_complete: true as const,
      };
      return {
        content: [{
          type: "text" as const,
          text:
            `Categoria de ${kind === "expense" ? "despesa" : "receita"} excluída permanentemente: ` +
            `id=${deletedCategory.id}; nome=${JSON.stringify(deletedCategory.name)}; status anterior=inativa; ` +
            `operação=${operationCompletedAt}; referências=${JSON.stringify(summary)}; warnings=${JSON.stringify(warnings)}. ` +
            "Nenhuma transação, recorrência ou meta foi removida ou alterada. Não há restauração pelo MCP.",
        }],
        structuredContent: result,
      };
    },
  });
}
