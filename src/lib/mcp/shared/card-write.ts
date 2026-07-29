import { z } from "zod";
import { getClosingDateForBillingMonth } from "../../../utils/billing-period";
import { todayIso } from "./dates";
import { expectedUpdatedAtSchema } from "./transaction-update";

export const CARD_TYPES = ["credit", "debit", "both"] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const CARD_COLORS = [
  "#FFA500",
  "#9333EA",
  "#3B82F6",
  "#10B981",
  "#EF4444",
  "#F97316",
  "#EC4899",
  "#6366F1",
  "#06B6D4",
  "#84CC16",
  "#F59E0B",
  "#14B8A6",
  "#D946EF",
  "#64748B",
  "#0EA5E9",
  "#059669",
] as const;

export const CARD_WRITE_WARNINGS = [
  "CARD_CREATED",
  "CARD_UPDATED",
  "CARD_TYPE_CHANGED",
  "CARD_DEACTIVATED",
  "CARD_REACTIVATED",
  "CARD_WITHOUT_LIMIT",
  "BILLING_DAY_MAY_BE_ADJUSTED",
  "FUTURE_INSTALLMENTS_PRESERVED",
  "ACTIVE_RECURRING_TEMPLATES_REFERENCE_CARD",
  "HISTORICAL_CARD_REFERENCES_PRESERVED",
  "CARD_CREATED_INACTIVE",
  "NO_EFFECTIVE_CHANGES",
] as const;
export type CardWriteWarning = (typeof CARD_WRITE_WARNINGS)[number];

export const cardTypeSchema = z.enum(CARD_TYPES);
export const cardColorSchema = z.enum(CARD_COLORS);
export const cardNameSchema = z.string().trim().min(1).max(100);
export const cardLimitSchema = z.number().finite().positive();
export const billingDaySchema = z.number().int().min(1).max(31);
export const daysBeforeDueSchema = z.number().int().min(1).max(28);
export const cardWriteWarningSchema = z.enum(CARD_WRITE_WARNINGS);
export { expectedUpdatedAtSchema };

export const cardChangesSchema = z
  .object({
    name: cardNameSchema.optional(),
    card_type: cardTypeSchema.optional(),
    color: cardColorSchema.optional(),
    card_limit: cardLimitSchema.nullable().optional(),
    due_day: billingDaySchema.nullable().optional(),
    days_before_due: daysBeforeDueSchema.nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: "Informe pelo menos uma alteração.",
  });

export interface CardWriteRow {
  id: string;
  user_id: string;
  name: string;
  card_type: CardType;
  color: string;
  card_limit: number | null;
  opening_day: number | null;
  closing_day: number | null;
  due_day: number | null;
  days_before_due: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const cardViewSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    card_type: cardTypeSchema,
    color: cardColorSchema,
    card_limit: z.number().finite().positive().nullable(),
    opening_day: billingDaySchema.nullable(),
    closing_day: billingDaySchema.nullable(),
    due_day: billingDaySchema.nullable(),
    days_before_due: daysBeforeDueSchema.nullable(),
    is_active: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();
export type CardWriteView = z.infer<typeof cardViewSchema>;

export const referenceSummarySchema = z
  .object({
    historical_expense_count: z.number().int().nonnegative().nullable(),
    future_materialized_expense_count: z.number().int().nonnegative().nullable(),
    active_recurring_template_count: z.number().int().nonnegative().nullable(),
  })
  .strict();
export type CardReferenceSummary = z.infer<typeof referenceSummarySchema>;

export function cardWriteView(
  row: CardWriteRow,
  userId: string,
): CardWriteView | null {
  if (row.user_id !== userId) return null;
  const view = {
    id: row.id,
    name: row.name,
    card_type: row.card_type,
    color: row.color,
    card_limit: row.card_limit === null ? null : Number(row.card_limit),
    opening_day: row.opening_day,
    closing_day: row.closing_day,
    due_day: row.due_day,
    days_before_due: row.days_before_due,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  return cardViewSchema.safeParse(view).success ? view : null;
}

export function supportsCredit(type: CardType): boolean {
  return type === "credit" || type === "both";
}

export function deriveBillingDays(
  dueDay: number,
  daysBeforeDue: number,
  referenceDate = todayIso(),
): { opening_day: number; closing_day: number } {
  const [year, month] = referenceDate.slice(0, 7).split("-").map(Number);
  const { closingDate } = getClosingDateForBillingMonth(
    year,
    month - 1,
    dueDay,
    daysBeforeDue,
  );
  const closingDay = closingDate.getDate();
  return {
    closing_day: closingDay,
    opening_day: closingDay === 31 ? 1 : closingDay + 1,
  };
}

export function billingAdjustmentWarning(dueDay: number | null): boolean {
  return dueDay !== null && dueDay >= 29;
}

function describeCard(card: CardWriteView): string {
  const billing = supportsCredit(card.card_type)
    ? `vencimento=${card.due_day}; fecha ${card.days_before_due} dia(s) antes; ` +
      `opening_day=${card.opening_day}; closing_day=${card.closing_day}`
    : "sem configuração de cobrança";
  return (
    `id=${card.id}; nome=${JSON.stringify(card.name)}; tipo=${card.card_type}; ` +
    `cor=${card.color}; limite configurado=${card.card_limit ?? "não informado"}; ` +
    `${billing}; status=${card.is_active ? "ativo" : "inativo"}`
  );
}

const safetyText =
  "Nenhuma despesa, parcela ou template recorrente foi criado, removido ou alterado. " +
  "Nenhuma ação foi enviada ao banco emissor. O limite é apenas uma configuração cadastrada no Gastinho; " +
  "não representa saldo bancário nem limite disponível consultado no emissor.";

export function createCardContent(result: {
  card: CardWriteView;
  warnings: CardWriteWarning[];
}): string {
  return (
    `Cartão criado no Gastinho: ${describeCard(result.card)}; ` +
    `warnings=${JSON.stringify(result.warnings)}. ${safetyText}`
  );
}

export function updateCardContent(result: {
  applied: boolean;
  changed_fields: string[];
  before: CardWriteView;
  after: CardWriteView;
  updated_at_before: string;
  updated_at_after: string;
  reference_summary: CardReferenceSummary;
  warnings: CardWriteWarning[];
}): string {
  const changes = result.changed_fields.map(
    (field) =>
      `${field}: ${JSON.stringify(result.before[field as keyof CardWriteView])} -> ` +
      `${JSON.stringify(result.after[field as keyof CardWriteView])}`,
  );
  return (
    `Cartão ${result.after.id} ${result.applied ? "atualizado" : "não alterado"} no Gastinho. ` +
    `Antes: ${describeCard(result.before)}. Depois: ${describeCard(result.after)}. ` +
    `Alterações=${changes.length ? changes.join("; ") : "nenhuma"}; ` +
    `updated_at=${result.updated_at_before} -> ${result.updated_at_after}; ` +
    `referências preservadas=${JSON.stringify(result.reference_summary)}; ` +
    `warnings=${JSON.stringify(result.warnings)}. ${safetyText} ` +
    "Ativar ou desativar no Gastinho não ativa, bloqueia nem cancela o cartão no banco emissor."
  );
}
