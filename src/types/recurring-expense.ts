import { Database } from "@/integrations/supabase/types";

export type RecurringExpense = Database["public"]["Tables"]["recurring_expenses"]["Row"];
export type RecurringExpenseInsert = Database["public"]["Tables"]["recurring_expenses"]["Insert"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type ExpenseCategory = Database["public"]["Enums"]["expense_category"];

export interface RecurringExpenseFormData {
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  dayOfMonth: number;
  category: ExpenseCategory;
}
