import { z } from "zod";
import { preserveSqlDate } from "./cashflow";
import {
  amountSchema,
  cardSupports,
  civilDateSchema,
  descriptionSchema,
  expectedUpdatedAtSchema,
  PAYMENT_METHODS,
  usesCard,
  type UpdatePaymentMethod,
} from "./transaction-update";

export const RECURRING_WRITE_WARNINGS = [
  "NO_EFFECTIVE_CHANGES",
  "RECURRING_TEMPLATE_ONLY",
  "RECURRING_DAY_MAY_BE_SKIPPED",
  "RECURRING_START_DATE_FALLBACK",
  "CATEGORY_SNAPSHOT_UPDATED",
  "CARD_REFERENCE_UPDATED",
  "SHARED_TEMPLATE_CREATED",
  "SHARED_TEMPLATE_UPDATED",
] as const;
export type RecurringWriteWarning =
  (typeof RECURRING_WRITE_WARNINGS)[number];

export const recurringWarningSchema = z.enum(RECURRING_WRITE_WARNINGS);
export const recurringDaySchema = z.number().int().min(1).max(31);
export {
  amountSchema,
  civilDateSchema,
  descriptionSchema,
  expectedUpdatedAtSchema,
  PAYMENT_METHODS,
};

export const recurringExpenseChangesSchema = z
  .object({
    description: descriptionSchema.optional(),
    amount: amountSchema.optional(),
    day_of_month: recurringDaySchema.optional(),
    start_date: civilDateSchema.optional(),
    end_date: civilDateSchema.nullable().optional(),
    category_id: z.string().uuid().nullable().optional(),
    payment_method: z.enum(PAYMENT_METHODS).optional(),
    card_id: z.string().uuid().nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: "Informe pelo menos uma alteração.",
  });

export const recurringIncomeChangesSchema = z
  .object({
    description: descriptionSchema.optional(),
    amount: amountSchema.optional(),
    day_of_month: recurringDaySchema.optional(),
    start_date: civilDateSchema.optional(),
    end_date: civilDateSchema.nullable().optional(),
    income_category_id: z.string().uuid().nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: "Informe pelo menos uma alteração.",
  });

export interface RecurringExpenseWriteRow {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  day_of_month: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  payment_method: UpdatePaymentMethod;
  card_id: string | null;
  card_name: string | null;
  card_color: string | null;
  shared_group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringIncomeWriteRow {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  day_of_month: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  income_category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  shared_group_id: string | null;
  created_at: string;
  updated_at: string;
}

const recurringBaseViewShape = {
  id: z.string().uuid(),
  description: z.string(),
  amount: z.number(),
  day_of_month: recurringDaySchema,
  start_date: civilDateSchema.nullable(),
  end_date: civilDateSchema.nullable(),
  is_active: z.boolean(),
  category_name: z.string().nullable(),
  category_icon: z.string().nullable(),
  is_shared: z.boolean(),
  shared_group_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
};

export const recurringExpenseViewSchema = z
  .object({
    ...recurringBaseViewShape,
    category_id: z.string().uuid().nullable(),
    payment_method: z.enum(PAYMENT_METHODS),
    card_id: z.string().uuid().nullable(),
    card_name: z.string().nullable(),
    card_color: z.string().nullable(),
  })
  .strict();

export const recurringIncomeViewSchema = z
  .object({
    ...recurringBaseViewShape,
    income_category_id: z.string().uuid().nullable(),
  })
  .strict();

function datesForView(row: {
  start_date: string | null;
  end_date: string | null;
}) {
  const startDate =
    row.start_date === null ? null : preserveSqlDate(row.start_date);
  const endDate = row.end_date === null ? null : preserveSqlDate(row.end_date);
  if (
    (row.start_date !== null && startDate === null) ||
    (row.end_date !== null && endDate === null)
  ) {
    return null;
  }
  return { start_date: startDate, end_date: endDate };
}

export function recurringExpenseView(row: RecurringExpenseWriteRow) {
  const dates = datesForView(row);
  if (!dates) return null;
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    day_of_month: row.day_of_month,
    ...dates,
    is_active: row.is_active,
    category_id: row.category_id,
    category_name: row.category_name,
    category_icon: row.category_icon,
    payment_method: row.payment_method,
    card_id: row.card_id,
    card_name: row.card_name,
    card_color: row.card_color,
    is_shared: row.shared_group_id !== null,
    shared_group_id: row.shared_group_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function recurringIncomeView(row: RecurringIncomeWriteRow) {
  const dates = datesForView(row);
  if (!dates) return null;
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    day_of_month: row.day_of_month,
    ...dates,
    is_active: row.is_active,
    income_category_id: row.income_category_id,
    category_name: row.category_name,
    category_icon: row.category_icon,
    is_shared: row.shared_group_id !== null,
    shared_group_id: row.shared_group_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function validateRecurringRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): boolean {
  return !(startDate && endDate && endDate < startDate);
}

export function recurringWarnings(
  dayOfMonth: number,
  startDate: string | null,
): RecurringWriteWarning[] {
  const warnings: RecurringWriteWarning[] = ["RECURRING_TEMPLATE_ONLY"];
  if (dayOfMonth >= 29) warnings.push("RECURRING_DAY_MAY_BE_SKIPPED");
  if (startDate === null) warnings.push("RECURRING_START_DATE_FALLBACK");
  return warnings;
}

export function recurringContent(result: {
  resource_type: "recurring_expense" | "recurring_income";
  id: string;
  template?: Record<string, unknown>;
  applied?: boolean;
  changed_fields?: string[];
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  updated_at_before?: string;
  updated_at_after?: string;
  warnings: RecurringWriteWarning[];
}): string {
  const template = result.template ?? result.after ?? result.before ?? {};
  const label =
    result.resource_type === "recurring_expense"
      ? "template mensal de despesa"
      : "template mensal de receita";
  const state =
    result.applied === undefined
      ? "criado"
      : result.applied
        ? "atualizado"
        : "não alterado";
  const changed =
    result.changed_fields?.map(
      (field) =>
        `${field}: ${JSON.stringify(result.before?.[field] ?? null)} -> ${JSON.stringify(result.after?.[field] ?? null)}`,
    ) ?? [];
  const datePeriod = `${String(template.start_date ?? "fallback de created_at")} até ${String(template.end_date ?? "sem data final")}`;
  return (
    `Foi ${state} o ${label} ${result.id}: descrição=${JSON.stringify(template.description)}; ` +
    `valor=${String(template.amount)}; dia do mês=${String(template.day_of_month)}; ` +
    `validade=${datePeriod}; situação=${template.is_active ? "ativa" : "inativa"}; ` +
    `categoria=${JSON.stringify(template.category_name ?? null)}; ` +
    (result.resource_type === "recurring_expense"
      ? `forma de pagamento=${String(template.payment_method)}; cartão=${JSON.stringify(template.card_name ?? null)}; `
      : "") +
    `escopo=${template.is_shared ? "compartilhado" : "pessoal"}; ` +
    (changed.length ? `alterações=${changed.join("; ")}; ` : "") +
    (result.updated_at_before
      ? `updated_at=${result.updated_at_before} -> ${result.updated_at_after}; `
      : "") +
    `warnings=${JSON.stringify(result.warnings)}. ` +
    "Este registro é somente um template mensal. Nenhuma despesa ou receita real foi criada ou alterada. " +
    (result.warnings.includes("RECURRING_DAY_MAY_BE_SKIPPED")
      ? "Meses sem esse dia não produzirão ocorrência no forecast; o dia não será ajustado automaticamente. "
      : "") +
    (result.changed_fields?.includes("is_active")
      ? "A mudança de situação afeta apenas a participação futura do template nas projeções; não altera histórico. "
      : "")
  );
}

export { cardSupports, usesCard };
