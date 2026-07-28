import { z } from "zod";
import { ISO_DATE_RE, isValidIsoDate } from "./dates";
import { preserveSqlDate } from "./cashflow";

export const PAYMENT_METHODS = ["pix", "credit", "debit", "cash"] as const;
export type UpdatePaymentMethod = (typeof PAYMENT_METHODS)[number];

export const UPDATE_WARNINGS = [
  "NO_EFFECTIVE_CHANGES",
  "ONLY_ONE_INSTALLMENT_UPDATED",
  "SHARED_RECORD_UPDATED",
  "CATEGORY_SNAPSHOT_UPDATED",
  "CARD_REFERENCE_UPDATED",
] as const;
export type UpdateWarning = (typeof UPDATE_WARNINGS)[number];

export const civilDateSchema = z
  .string()
  .regex(ISO_DATE_RE)
  .refine(isValidIsoDate, "Data civil inválida.");

export const expectedUpdatedAtSchema = z.string().datetime({ offset: true });
export const amountSchema = z.number().finite().positive();
export const descriptionSchema = z.string().trim().min(1).max(200);

export const expenseChangesSchema = z
  .object({
    description: descriptionSchema.optional(),
    amount: amountSchema.optional(),
    expense_date: civilDateSchema.optional(),
    category_id: z.string().uuid().nullable().optional(),
    payment_method: z.enum(PAYMENT_METHODS).optional(),
    card_id: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: "Informe pelo menos uma alteração.",
  });

export const incomeChangesSchema = z
  .object({
    description: descriptionSchema.optional(),
    amount: amountSchema.optional(),
    income_date: civilDateSchema.optional(),
    income_category_id: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: "Informe pelo menos uma alteração.",
  });

export interface ExpenseUpdateRow {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  expense_date: string;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  payment_method: UpdatePaymentMethod;
  card_id: string | null;
  card_name: string | null;
  card_color: string | null;
  shared_group_id: string | null;
  is_shared: boolean;
  installment_group_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
  created_at: string;
  updated_at: string;
}

export interface IncomeUpdateRow {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  income_date: string;
  income_category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  shared_group_id: string | null;
  installment_group_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
  created_at: string;
  updated_at: string;
}

export const expenseViewSchema = z
  .object({
    id: z.string().uuid(),
    description: z.string(),
    amount: z.number(),
    expense_date: z.string(),
    category_id: z.string().uuid().nullable(),
    category_name: z.string().nullable(),
    category_icon: z.string().nullable(),
    payment_method: z.enum(PAYMENT_METHODS),
    card_id: z.string().uuid().nullable(),
    card_name: z.string().nullable(),
    card_color: z.string().nullable(),
    is_shared: z.boolean(),
    shared_group_id: z.string().uuid().nullable(),
    installment_group_id: z.string().uuid().nullable(),
    installment_number: z.number().int().nullable(),
    total_installments: z.number().int().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export const incomeViewSchema = z
  .object({
    id: z.string().uuid(),
    description: z.string(),
    amount: z.number(),
    income_date: z.string(),
    income_category_id: z.string().uuid().nullable(),
    category_name: z.string().nullable(),
    category_icon: z.string().nullable(),
    is_shared: z.boolean(),
    shared_group_id: z.string().uuid().nullable(),
    installment_group_id: z.string().uuid().nullable(),
    installment_number: z.number().int().nullable(),
    total_installments: z.number().int().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export const updateWarningSchema = z.enum(UPDATE_WARNINGS);

export function expenseView(row: ExpenseUpdateRow) {
  const expenseDate = preserveSqlDate(row.expense_date);
  if (!expenseDate) return null;
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    expense_date: expenseDate,
    category_id: row.category_id,
    category_name: row.category_name,
    category_icon: row.category_icon,
    payment_method: row.payment_method,
    card_id: row.card_id,
    card_name: row.card_name,
    card_color: row.card_color,
    is_shared: row.shared_group_id !== null || row.is_shared === true,
    shared_group_id: row.shared_group_id,
    installment_group_id: row.installment_group_id,
    installment_number: row.installment_number,
    total_installments: row.total_installments,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function incomeView(row: IncomeUpdateRow) {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    income_date: row.income_date,
    income_category_id: row.income_category_id,
    category_name: row.category_name,
    category_icon: row.category_icon,
    is_shared: row.shared_group_id !== null,
    shared_group_id: row.shared_group_id,
    installment_group_id: row.installment_group_id,
    installment_number: row.installment_number,
    total_installments: row.total_installments,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function isInstallment(row: {
  installment_group_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
}): boolean {
  return (
    row.installment_group_id !== null ||
    (row.installment_number ?? 0) > 1 ||
    (row.total_installments ?? 0) > 1
  );
}

export function usesCard(paymentMethod: UpdatePaymentMethod): boolean {
  return paymentMethod === "credit" || paymentMethod === "debit";
}

export function cardSupports(
  cardType: string,
  paymentMethod: UpdatePaymentMethod,
): boolean {
  return (
    cardType === "both" ||
    (paymentMethod === "credit" && cardType === "credit") ||
    (paymentMethod === "debit" && cardType === "debit")
  );
}

export function updateContent(result: {
  resource_type: "expense" | "income";
  id: string;
  applied: boolean;
  changed_fields: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  updated_at_before: string;
  updated_at_after: string;
  warnings: UpdateWarning[];
}): string {
  const label = result.resource_type === "expense" ? "Despesa" : "Receita";
  const changes = result.changed_fields.length
    ? result.changed_fields
        .map(
          (field) =>
            `${field}: ${JSON.stringify(result.before[field] ?? null)} -> ${JSON.stringify(result.after[field] ?? null)}`,
        )
        .join("; ")
    : "nenhuma mudança efetiva";
  return (
    `${label} ${result.id}; applied=${result.applied}. Alterações: ${changes}. ` +
    `updated_at: ${result.updated_at_before} -> ${result.updated_at_after}. ` +
    `warnings=${JSON.stringify(result.warnings)}. ` +
    `Estado anterior seguro=${JSON.stringify(result.before)}. ` +
    `Estado final confirmado pelo banco=${JSON.stringify(result.after)}.`
  );
}
