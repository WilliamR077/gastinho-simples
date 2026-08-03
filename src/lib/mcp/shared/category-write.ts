import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { preserveSqlDate, timestampToSaoPauloCivilDate } from "./cashflow";
import { todayIso } from "./dates";
import { mcpError } from "./errors";
import {
  expenseCategoryGoalReference,
  expenseGoalReferenceDependsOnName,
  expenseGoalReferenceMatchesCategory,
} from "./goal-write";
import { supabaseForUser } from "./supabase-client";
import { expectedUpdatedAtSchema } from "./transaction-update";

export type CategoryKind = "expense" | "income";

export const EXPENSE_CATEGORY_ICONS = [
  "🍔", "🚗", "🎮", "⚕️", "📚", "🏠", "👕", "🔧", "📦", "🐕",
  "🐱", "✈️", "🎬", "🎵", "💪", "💊", "🛒", "☕", "🍕", "🎁",
  "💰", "📱", "💻", "🎨", "⚽", "🏋️", "🚌", "🏥", "🎓", "🏪",
  "🍺", "🎭", "📺", "🎪", "🏖️", "💇", "🍽️", "🥗", "🍳", "🧃",
  "⛽", "🚕", "🚍", "🏍️", "🧾", "💡", "💧", "📡", "🏫", "👶",
  "🐾", "💍", "🛍️", "🏗️", "🔑", "🧹", "🧴", "💄", "🎂", "🎄",
  "🏸", "🎾", "🎒", "💉", "🦷", "👓", "🧥", "👟", "🍱", "🚲",
] as const;
export const INCOME_CATEGORY_ICONS = [
  "💰", "💻", "📈", "🛒", "🎁", "🎀", "🔄", "🏠", "📦", "💵",
  "💳", "🏦", "📊", "🎯", "💼", "🤝", "📱", "🎓", "🏢", "🚗",
  "✈️", "🏥", "⚽", "🎨", "🎵", "📚", "🔧", "🍔", "☕", "🎮",
  "🐕", "👕", "💊", "🏋️", "🏖️", "💇", "🍽️", "🥗", "🍳", "🧃",
  "⛽", "🚕", "🚍", "🏍️", "🧾", "💡", "💧", "📡", "🏫", "👶",
  "🐾", "💍", "🛍️", "🏗️", "🔑", "🧹", "🧴", "💄", "🎂", "🎄",
  "🏸", "🎾", "🎒", "💉", "🦷", "👓", "🧥", "👟", "🍱", "🚲",
] as const;

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      ![...value].some((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint <= 31 || codePoint === 127;
      }),
  );
const iconSchema = (kind: CategoryKind) =>
  kind === "expense"
    ? z.enum(EXPENSE_CATEGORY_ICONS)
    : z.enum(INCOME_CATEGORY_ICONS);

const categoryBaseViewSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    icon: z.string(),
    color: z.string().nullable(),
    is_default: z.boolean(),
    is_active: z.boolean(),
    display_order: z.number().int(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();
export const expenseCategoryViewSchema = categoryBaseViewSchema
  .extend({
    goal_reference: z.string().uuid(),
  })
  .strict();
export const incomeCategoryViewSchema = categoryBaseViewSchema;
export const categoryViewSchema = z.union([
  expenseCategoryViewSchema,
  incomeCategoryViewSchema,
]);
export type CategoryView = z.infer<typeof categoryViewSchema>;

interface CategoryRow {
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
}

const expenseReferenceSchema = z
  .object({
    historical_expense_count: z.number().int().nonnegative(),
    future_expense_count: z.number().int().nonnegative(),
    installment_expense_count: z.number().int().nonnegative(),
    active_recurring_expense_count: z.number().int().nonnegative(),
    inactive_recurring_expense_count: z.number().int().nonnegative(),
    active_goal_count: z.number().int().nonnegative(),
    total_reference_count: z.number().int().nonnegative(),
  })
  .strict();
const incomeReferenceSchema = z
  .object({
    historical_income_count: z.number().int().nonnegative(),
    future_income_count: z.number().int().nonnegative(),
    active_recurring_income_count: z.number().int().nonnegative(),
    inactive_recurring_income_count: z.number().int().nonnegative(),
    active_goal_count: z.number().int().nonnegative(),
    total_reference_count: z.number().int().nonnegative(),
  })
  .strict();
export const categoryReferenceSchema = z.union([
  expenseReferenceSchema,
  incomeReferenceSchema,
]);
export type CategoryReferenceSummary = z.infer<
  typeof categoryReferenceSchema
>;

export const CATEGORY_WRITE_WARNINGS = [
  "CATEGORY_CREATED",
  "CATEGORY_UPDATED",
  "CATEGORY_DEACTIVATED",
  "CATEGORY_REACTIVATED",
  "CATEGORY_NAME_CHANGED",
  "CATEGORY_NAME_NORMALIZED",
  "HISTORICAL_CATEGORY_REFERENCES_PRESERVED",
  "ACTIVE_RECURRING_TEMPLATES_REFERENCE_CATEGORY",
  "ACTIVE_GOALS_REFERENCE_CATEGORY",
  "NO_EFFECTIVE_CHANGES",
] as const;
export type CategoryWriteWarning =
  (typeof CATEGORY_WRITE_WARNINGS)[number];
export const categoryWriteWarningSchema = z.enum(CATEGORY_WRITE_WARNINGS);

const COLUMNS =
  "id,user_id,name,icon,color,is_default,is_active,display_order,created_at,updated_at";
const CHANGE_FIELDS = ["name", "icon", "is_active"] as const;

function config(kind: CategoryKind) {
  return kind === "expense"
    ? {
        table: "user_categories",
        defaultColor: "#6366f1",
        transactionTable: "expenses",
        recurringTable: "recurring_expenses",
        categoryColumn: "category_id",
        dateColumn: "expense_date",
      }
    : {
        table: "user_income_categories",
        defaultColor: "#10b981",
        transactionTable: "incomes",
        recurringTable: "recurring_incomes",
        categoryColumn: "income_category_id",
        dateColumn: "income_date",
      };
}

function categoryView(
  row: CategoryRow,
  userId: string,
  kind: CategoryKind,
): CategoryView | null {
  if (row.user_id !== userId || row.updated_at === null) return null;
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
  const view =
    kind === "expense"
      ? {
          ...base,
          goal_reference: expenseCategoryGoalReference(row.id),
        }
      : base;
  const schema =
    kind === "expense" ? expenseCategoryViewSchema : incomeCategoryViewSchema;
  return schema.safeParse(view).success ? view : null;
}

function isProtected(category: CategoryView): boolean {
  return category.name.trim().toLocaleLowerCase("pt-BR") === "outros";
}

async function references(
  supabase: ReturnType<typeof supabaseForUser>,
  kind: CategoryKind,
  category: CategoryView,
  userId: string,
): Promise<{
  summary: CategoryReferenceSummary;
  has_name_dependent_expense_goal: boolean;
} | null> {
  const cfg = config(kind);
  const transactions = await supabase
    .from(cfg.transactionTable)
    .select(
      kind === "expense"
        ? `id,${cfg.dateColumn},installment_group_id,installment_number,total_installments`
        : `id,${cfg.dateColumn}`,
    )
    .eq("user_id", userId)
    .eq(cfg.categoryColumn, category.id);
  const recurring = await supabase
    .from(cfg.recurringTable)
    .select("id,is_active")
    .eq("user_id", userId)
    .eq(cfg.categoryColumn, category.id);
  const goalResult = await supabase
    .from("budget_goals")
    .select("id,category")
    .eq("user_id", userId)
    .eq("type", kind === "expense" ? "category" : "income_category");
  if (transactions.error || recurring.error || goalResult.error) return null;
  const transactionRows = transactions.data ?? [];
  const recurringRows = recurring.data ?? [];
  const goalRows = (goalResult.data ?? []).filter((goal) =>
    kind === "expense"
      ? expenseGoalReferenceMatchesCategory(goal.category, category)
      : goal.category === category.id,
  );
  const hasNameDependentExpenseGoal =
    kind === "expense" &&
    goalRows.some((goal) =>
      expenseGoalReferenceDependsOnName(goal.category, category),
    );
  const today = todayIso();
  const dates = transactionRows.map((row) =>
    kind === "expense"
      ? preserveSqlDate(row[cfg.dateColumn])
      : timestampToSaoPauloCivilDate(String(row[cfg.dateColumn])),
  );
  if (dates.some((date) => date === null)) return null;
  const historical = dates.filter((date) => date! <= today).length;
  const future = dates.length - historical;
  const activeRecurring = recurringRows.filter((row) => row.is_active).length;
  if (kind === "expense") {
    const installments = transactionRows.filter(
      (row) =>
        row.installment_group_id !== null ||
        (row.installment_number ?? 0) > 1 ||
        (row.total_installments ?? 0) > 1,
    ).length;
    return {
      summary: {
        historical_expense_count: historical,
        future_expense_count: future,
        installment_expense_count: installments,
        active_recurring_expense_count: activeRecurring,
        inactive_recurring_expense_count:
          recurringRows.length - activeRecurring,
        active_goal_count: goalRows.length,
        total_reference_count:
          transactionRows.length + recurringRows.length + goalRows.length,
      },
      has_name_dependent_expense_goal: hasNameDependentExpenseGoal,
    };
  }
  return {
    summary: {
      historical_income_count: historical,
      future_income_count: future,
      active_recurring_income_count: activeRecurring,
      inactive_recurring_income_count: recurringRows.length - activeRecurring,
      active_goal_count: goalRows.length,
      total_reference_count:
        transactionRows.length + recurringRows.length + goalRows.length,
    },
    has_name_dependent_expense_goal: false,
  };
}

function categoryFacts(kind: CategoryKind, category: CategoryView): string {
  return (
    `tipo=${kind}; id=${category.id}; ` +
    (`goal_reference` in category
      ? `goal_reference=${category.goal_reference}; `
      : "") +
    `nome=${JSON.stringify(category.name)}; ` +
    `ícone=${category.icon}; cor=${category.color ?? "null"}; ` +
    `status=${category.is_active ? "ativa" : "inativa"}; ` +
    `ordem=${category.display_order}; padrão=${category.is_default}`
  );
}

function createContent(
  kind: CategoryKind,
  category: CategoryView,
  warnings: CategoryWriteWarning[],
): string {
  return (
    `Categoria de ${kind === "expense" ? "despesa" : "receita"} criada somente no Gastinho: ` +
    `${categoryFacts(kind, category)}; warnings=${JSON.stringify(warnings)}. ` +
    "Nenhuma despesa, receita, recorrência, parcela ou meta foi criada ou alterada; a categoria não representa orçamento, saldo ou conta bancária."
  );
}

function updateContent(
  kind: CategoryKind,
  result: {
    applied: boolean;
    changed_fields: string[];
    before: CategoryView;
    after: CategoryView;
    updated_at_before: string;
    updated_at_after: string;
    reference_summary: CategoryReferenceSummary;
    warnings: CategoryWriteWarning[];
  },
): string {
  const changes = result.changed_fields.map(
    (field) =>
      `${field}: ${JSON.stringify(result.before[field as keyof CategoryView])} -> ` +
      `${JSON.stringify(result.after[field as keyof CategoryView])}`,
  );
  return (
    `Categoria de ${kind === "expense" ? "despesa" : "receita"} ${result.after.id} ` +
    `${result.applied ? "atualizada" : "não alterada"}. Antes: ${categoryFacts(kind, result.before)}. ` +
    `Depois: ${categoryFacts(kind, result.after)}. Alterações=${changes.length ? changes.join("; ") : "nenhuma"}; ` +
    `updated_at=${result.updated_at_before} -> ${result.updated_at_after}; ` +
    `referências preservadas=${JSON.stringify(result.reference_summary)}; warnings=${JSON.stringify(result.warnings)}. ` +
    "Nenhuma transação, recorrência, parcela ou meta foi alterada. Desativar não elimina o histórico."
  );
}

export function createCategoryTool(kind: CategoryKind) {
  const cfg = config(kind);
  const outputCategorySchema =
    kind === "expense" ? expenseCategoryViewSchema : incomeCategoryViewSchema;
  const inputProperties = {
    name: nameSchema,
    icon: iconSchema(kind).optional(),
  };
  const validator = z.object(inputProperties).strict();
  return defineTool({
    name: `create_${kind}_category`,
    title: `Criar categoria de ${kind === "expense" ? "despesa" : "receita"}`,
    description:
      `Cria uma categoria pessoal de ${kind === "expense" ? "despesa" : "receita"} usando os mesmos campos e defaults do gerenciador do aplicativo.`,
    inputSchema: inputProperties,
    outputSchema: {
      resource_type: z.literal("category"),
      category_kind: z.literal(kind),
      id: z.string().uuid(),
      created: z.literal(true),
      category: outputCategorySchema,
      warnings: z.array(categoryWriteWarningSchema),
      data_complete: z.literal(true),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
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
      if (kind === "expense") {
        const duplicate = await supabase
          .from(cfg.table)
          .select("id")
          .eq("user_id", userId)
          .eq("name", input.name)
          .maybeSingle();
        if (duplicate.error) return mcpError("INTERNAL_ERROR");
        if (duplicate.data) return mcpError("CATEGORY_NAME_CONFLICT");
      }
      const orderResult = await supabase
        .from(cfg.table)
        .select("display_order")
        .eq("user_id", userId);
      if (orderResult.error) return mcpError("INTERNAL_ERROR");
      const displayOrder = (orderResult.data ?? []).reduce(
        (maximum, row) => Math.max(maximum, Number(row.display_order ?? -1)),
        -1,
      ) + 1;
      const insertResult = await supabase
        .from(cfg.table)
        .insert({
          user_id: userId,
          name: input.name,
          icon: input.icon ?? "📦",
          color: cfg.defaultColor,
          is_default: false,
          is_active: true,
          display_order: displayOrder,
        })
        .select(COLUMNS)
        .single();
      if (insertResult.error) {
        return mcpError(
          insertResult.error.code === "23505"
            ? "CATEGORY_NAME_CONFLICT"
            : "WRITE_FAILED",
        );
      }
      if (!insertResult.data) return mcpError("WRITE_FAILED");
      const category = categoryView(
        insertResult.data as CategoryRow,
        userId,
        kind,
      );
      if (!category) return mcpError("INVALID_DATA");
      const warnings: CategoryWriteWarning[] = ["CATEGORY_CREATED"];
      if (
        typeof rawInput === "object" &&
        rawInput !== null &&
        "name" in rawInput &&
        rawInput.name !== input.name
      ) {
        warnings.push("CATEGORY_NAME_NORMALIZED");
      }
      const result = {
        resource_type: "category" as const,
        category_kind: kind,
        id: category.id,
        created: true as const,
        category,
        warnings,
        data_complete: true as const,
      };
      return {
        content: [{ type: "text" as const, text: createContent(kind, category, warnings) }],
        structuredContent: result,
      };
    },
  });
}

export function updateCategoryTool(kind: CategoryKind) {
  const cfg = config(kind);
  const outputCategorySchema =
    kind === "expense" ? expenseCategoryViewSchema : incomeCategoryViewSchema;
  const changesSchema = z
    .object({
      name: nameSchema.optional(),
      icon: iconSchema(kind).optional(),
      is_active: z.boolean().optional(),
    })
    .strict()
    .refine((changes) => Object.keys(changes).length > 0);
  const inputProperties = {
    category_id: z.string().uuid(),
    expected_updated_at: expectedUpdatedAtSchema,
    changes: changesSchema,
  };
  const validator = z.object(inputProperties).strict();
  return defineTool({
    name: `update_${kind}_category`,
    title: `Editar categoria de ${kind === "expense" ? "despesa" : "receita"}`,
    description:
      `Edita nome, ícone ou visibilidade de uma categoria pessoal de ${kind === "expense" ? "despesa" : "receita"} com concorrência otimista.`,
    inputSchema: inputProperties,
    outputSchema: {
      resource_type: z.literal("category"),
      category_kind: z.literal(kind),
      id: z.string().uuid(),
      applied: z.boolean(),
      changed_fields: z.array(z.enum(CHANGE_FIELDS)),
      before: outputCategorySchema,
      after: outputCategorySchema,
      updated_at_before: z.string(),
      updated_at_after: z.string(),
      reference_summary: categoryReferenceSchema,
      warnings: z.array(categoryWriteWarningSchema),
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
      if (!parsed.success) {
        return mcpError(
          parsed.error.issues.some((issue) => issue.path[0] === "changes")
            ? "INVALID_PATCH"
            : "INVALID_INPUT",
        );
      }
      const input = parsed.data;
      const supabase = supabaseForUser(ctx);
      const currentResult = await supabase
        .from(cfg.table)
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
          "A categoria mudou desde a leitura. Releia-a com list_categories antes de tentar novamente.",
        );
      }
      const before = categoryView(current, userId, kind);
      if (!before) return mcpError("INVALID_DATA");
      if (isProtected(before)) return mcpError("CATEGORY_NOT_EDITABLE");
      const referenceInspection = await references(
        supabase,
        kind,
        before,
        userId,
      );
      if (!referenceInspection) return mcpError("INTERNAL_ERROR");
      const summary = referenceInspection.summary;
      const finalValues = {
        name: input.changes.name ?? before.name,
        icon: input.changes.icon ?? before.icon,
        is_active: input.changes.is_active ?? before.is_active,
      };
      if (finalValues.name !== before.name && kind === "expense") {
        const duplicate = await supabase
          .from(cfg.table)
          .select("id")
          .eq("user_id", userId)
          .eq("name", finalValues.name);
        if (duplicate.error) return mcpError("INTERNAL_ERROR");
        if ((duplicate.data ?? []).some((row) => row.id !== before.id)) {
          return mcpError("CATEGORY_NAME_CONFLICT");
        }
        if (referenceInspection.has_name_dependent_expense_goal) {
          return mcpError(
            "BUSINESS_RULE_VIOLATION",
            "A categoria possui meta legada vinculada a uma chave derivada do nome atual. Exclua ou atualize essa meta antes de renomear a categoria.",
          );
        }
      }
      const patch: Record<string, unknown> = {};
      const changedFields: Array<(typeof CHANGE_FIELDS)[number]> = [];
      for (const field of CHANGE_FIELDS) {
        if (finalValues[field] !== before[field]) {
          patch[field] = finalValues[field];
          changedFields.push(field);
        }
      }
      if (changedFields.length === 0) {
        const result = {
          resource_type: "category" as const,
          category_kind: kind,
          id: before.id,
          applied: false,
          changed_fields: changedFields,
          before,
          after: before,
          updated_at_before: before.updated_at,
          updated_at_after: before.updated_at,
          reference_summary: summary,
          warnings: ["NO_EFFECTIVE_CHANGES"] as CategoryWriteWarning[],
          data_complete: true as const,
        };
        return {
          content: [{ type: "text" as const, text: updateContent(kind, result) }],
          structuredContent: result,
        };
      }
      const updateResult = await supabase
        .from(cfg.table)
        .update(patch)
        .eq("id", input.category_id)
        .eq("user_id", userId)
        .eq("updated_at", input.expected_updated_at)
        .select(COLUMNS)
        .maybeSingle();
      if (updateResult.error) {
        return mcpError(
          updateResult.error.code === "23505"
            ? "CATEGORY_NAME_CONFLICT"
            : "WRITE_FAILED",
        );
      }
      if (!updateResult.data) {
        const existence = await supabase
          .from(cfg.table)
          .select("id,updated_at")
          .eq("id", input.category_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (existence.error) return mcpError("INTERNAL_ERROR");
        return mcpError(
          existence.data ? "CONCURRENT_MODIFICATION" : "RESOURCE_NOT_FOUND",
        );
      }
      const after = categoryView(
        updateResult.data as CategoryRow,
        userId,
        kind,
      );
      if (!after) return mcpError("INVALID_DATA");
      const warnings: CategoryWriteWarning[] = ["CATEGORY_UPDATED"];
      if (before.name !== after.name) warnings.push("CATEGORY_NAME_CHANGED");
      if (before.is_active && !after.is_active) {
        warnings.push("CATEGORY_DEACTIVATED");
      }
      if (!before.is_active && after.is_active) {
        warnings.push("CATEGORY_REACTIVATED");
      }
      if (
        ("historical_expense_count" in summary &&
          summary.historical_expense_count > 0) ||
        ("historical_income_count" in summary &&
          summary.historical_income_count > 0)
      ) {
        warnings.push("HISTORICAL_CATEGORY_REFERENCES_PRESERVED");
      }
      if (
        ("active_recurring_expense_count" in summary &&
          summary.active_recurring_expense_count > 0) ||
        ("active_recurring_income_count" in summary &&
          summary.active_recurring_income_count > 0)
      ) {
        warnings.push("ACTIVE_RECURRING_TEMPLATES_REFERENCE_CATEGORY");
      }
      if (summary.active_goal_count > 0) {
        warnings.push("ACTIVE_GOALS_REFERENCE_CATEGORY");
      }
      const result = {
        resource_type: "category" as const,
        category_kind: kind,
        id: after.id,
        applied: true,
        changed_fields: changedFields,
        before,
        after,
        updated_at_before: before.updated_at,
        updated_at_after: after.updated_at,
        reference_summary: summary,
        warnings,
        data_complete: true as const,
      };
      return {
        content: [{ type: "text" as const, text: updateContent(kind, result) }],
        structuredContent: result,
      };
    },
  });
}
