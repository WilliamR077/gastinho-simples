import { z } from "zod";

const common = {
  id: z.string().uuid(),
  description: z.string(),
  amount: z.number(),
  date: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  category_name: z.string().nullable(),
  category_icon: z.string().nullable(),
  installment_number: z.number().int().nullable(),
  total_installments: z.number().int().nullable(),
  installment_group_id: z.string().uuid().nullable(),
  is_installment: z.boolean(),
  shared_group_id: z.string().uuid().nullable(),
  is_shared: z.boolean(),
  is_owner: z.boolean(),
};

export const expenseListItemSchema = z
  .object({
    ...common,
    expense_date: z.string(),
    category_id: z.string().uuid().nullable(),
    payment_method: z.enum(["pix", "credit", "debit", "cash"]),
    card_id: z.string().uuid().nullable(),
    card_name: z.string().nullable(),
  })
  .strict();

export const incomeListItemSchema = z
  .object({
    ...common,
    income_date: z.string(),
    income_category_id: z.string().uuid().nullable(),
  })
  .strict();
