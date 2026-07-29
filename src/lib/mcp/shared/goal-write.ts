import { z } from "zod";
import {
  GOAL_TYPES,
  goalDataWarnings,
  goalDirection,
  type GoalRow,
  type GoalType,
} from "./goals";
import { expectedUpdatedAtSchema } from "./transaction-update";

export const EXPENSE_GOAL_CATEGORIES = [
  "alimentacao",
  "transporte",
  "lazer",
  "saude",
  "educacao",
  "moradia",
  "vestuario",
  "servicos",
  "outros",
] as const;

export const EXPENSE_GOAL_CATEGORY_NAMES: Record<
  (typeof EXPENSE_GOAL_CATEGORIES)[number],
  string
> = {
  alimentacao: "Alimentação",
  transporte: "Transporte",
  lazer: "Lazer",
  saude: "Saúde",
  educacao: "Educação",
  moradia: "Moradia",
  vestuario: "Vestuário",
  servicos: "Serviços",
  outros: "Outros",
};

export const GOAL_WRITE_WARNINGS = [
  "MONTHLY_GOAL_ONLY",
  "NO_EFFECTIVE_CHANGES",
  "SHARED_GOAL_CREATED",
  "SHARED_GOAL_UPDATED",
  "SHARED_GOAL_DELETED",
  "GOAL_TYPE_CHANGED",
  "CATEGORY_REFERENCE_UPDATED",
  "CATEGORY_REFERENCE_STORED_AS_TEXT",
  "PERMANENT_DELETION",
  "GOAL_DELETED",
  "GOAL_ALERTS_DELETED",
] as const;
export type GoalWriteWarning = (typeof GOAL_WRITE_WARNINGS)[number];

export const goalWriteWarningSchema = z.enum(GOAL_WRITE_WARNINGS);
export const goalTypeSchema = z.enum(GOAL_TYPES);
export const goalAmountSchema = z.number().finite().positive();
export const goalCategorySchema = z.string().trim().min(1).max(200);
export { expectedUpdatedAtSchema };

export const goalChangesSchema = z
  .object({
    type: goalTypeSchema.optional(),
    category: goalCategorySchema.nullable().optional(),
    limit_amount: goalAmountSchema.optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: "Informe pelo menos uma alteração.",
  });

export const goalViewSchema = z
  .object({
    id: z.string().uuid(),
    type: goalTypeSchema,
    category_reference: z.string().nullable(),
    limit_amount: z.number().finite().positive(),
    target_direction: z.enum(["maximum", "minimum"]),
    shared_group_id: z.string().uuid().nullable(),
    is_shared: z.boolean(),
    is_owner: z.literal(true),
    created_at: z.string(),
    updated_at: z.string(),
    data_warnings: z.array(
      z.enum([
        "INVALID_GOAL_CONFIGURATION",
        "CATEGORY_NOT_FOUND",
        "NON_POSITIVE_TARGET",
        "FUTURE_MONTH_NO_ACTUAL_DATA",
      ]),
    ),
  })
  .strict();

export type GoalWriteView = z.infer<typeof goalViewSchema>;

export function goalWriteView(row: GoalRow, userId: string): GoalWriteView | null {
  if (row.user_id !== userId) return null;
  const view = {
    id: row.id,
    type: row.type,
    category_reference: row.category,
    limit_amount: Number(row.limit_amount),
    target_direction: goalDirection(row.type),
    shared_group_id: row.shared_group_id,
    is_shared: row.shared_group_id !== null,
    is_owner: true as const,
    created_at: row.created_at,
    updated_at: row.updated_at,
    data_warnings: goalDataWarnings(row),
  };
  return goalViewSchema.safeParse(view).success ? view : null;
}

export function goalNeedsCategory(type: GoalType): boolean {
  return type === "category" || type === "income_category";
}

export function goalCategoryKind(
  type: GoalType,
): "expense" | "income" | null {
  if (type === "category") return "expense";
  if (type === "income_category") return "income";
  return null;
}

export function validGoalConfiguration(
  type: GoalType,
  category: string | null,
): boolean {
  return goalNeedsCategory(type) ? category !== null : category === null;
}

function describeGoal(goal: GoalWriteView): string {
  return (
    `id=${goal.id}; tipo=${goal.type}; categoria=${JSON.stringify(goal.category_reference)}; ` +
    `valor=${goal.limit_amount}; direção=${goal.target_direction}; ` +
    `escopo=${goal.is_shared ? "compartilhado" : "pessoal"}`
  );
}

export function createGoalContent(result: {
  goal: GoalWriteView;
  warnings: GoalWriteWarning[];
}): string {
  return (
    `Foi criada a meta ou limite mensal: ${describeGoal(result.goal)}; ` +
    `created_at=${result.goal.created_at}; updated_at=${result.goal.updated_at}; ` +
    `warnings=${JSON.stringify(result.warnings)}. ` +
    "Nenhuma despesa, receita ou template recorrente foi criado ou alterado. " +
    "Este registro é apenas uma meta mensal calculada sobre transações; não é conta de investimento nem poupança acumulada."
  );
}

export function updateGoalContent(result: {
  applied: boolean;
  changed_fields: string[];
  before: GoalWriteView;
  after: GoalWriteView;
  updated_at_before: string;
  updated_at_after: string;
  warnings: GoalWriteWarning[];
}): string {
  const changes = result.changed_fields.map(
    (field) =>
      `${field}: ${JSON.stringify(result.before[field as keyof GoalWriteView])} -> ` +
      `${JSON.stringify(result.after[field as keyof GoalWriteView])}`,
  );
  const preserved = [
    "id",
    "shared_group_id",
    "is_shared",
    "created_at",
  ].filter((field) => !result.changed_fields.includes(field));
  return (
    `Meta mensal ${result.after.id} ${result.applied ? "atualizada" : "não alterada"}. ` +
    `Antes: ${describeGoal(result.before)}. Depois: ${describeGoal(result.after)}. ` +
    `Alterações=${changes.length ? changes.join("; ") : "nenhuma"}; ` +
    `campos importantes preservados=${preserved.join(",")}; ` +
    `updated_at=${result.updated_at_before} -> ${result.updated_at_after}; ` +
    `warnings=${JSON.stringify(result.warnings)}. ` +
    "Nenhuma despesa, receita ou template recorrente foi alterado. " +
    "O registro continua sendo uma meta mensal; não é conta de investimento nem poupança acumulada."
  );
}

export function deleteGoalConfirmationContent(
  goal: GoalWriteView,
  alertCount: number,
): string {
  return (
    `Confirmação obrigatória para excluir permanentemente a meta mensal: ${describeGoal(goal)}. ` +
    `${alertCount} alerta(s) vinculado(s) acessível(is) à conta foram identificado(s); ` +
    "alertas filhos existentes serão removidos automaticamente pelo banco. " +
    "Nenhuma transação, categoria ou grupo será excluído ou alterado; o histórico financeiro permanecerá intacto. " +
    "A meta deixará de aparecer em listagens e cálculos futuros e não há restauração nesta fase. " +
    "Repita a chamada com confirm_delete=true para confirmar explicitamente."
  );
}

export function deleteGoalContent(result: {
  deleted_goal: GoalWriteView;
  operation_completed_at: string;
  warnings: GoalWriteWarning[];
  deletedAlertCount: number;
}): string {
  return (
    `A meta mensal foi excluída permanentemente: ${describeGoal(result.deleted_goal)}; ` +
    `operação concluída em ${result.operation_completed_at}; ` +
    `alertas acessíveis identificados antes da exclusão e removidos por ON DELETE CASCADE=${result.deletedAlertCount}; ` +
    `warnings=${JSON.stringify(result.warnings)}. ` +
    "Nenhuma despesa, receita, template recorrente, categoria ou grupo foi excluído ou alterado; " +
    "o histórico financeiro permanece intacto. A meta não aparecerá em listagens e cálculos futuros."
  );
}
