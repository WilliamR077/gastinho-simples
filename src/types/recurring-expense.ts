import { Database } from "@/integrations/supabase/types";

export type RecurringExpense = Database["public"]["Tables"]["recurring_expenses"]["Row"];
export type RecurringExpenseInsert = Database["public"]["Tables"]["recurring_expenses"]["Insert"];

export interface RecurringExpenseFormData {
  description: string;
  amount: number;
  paymentMethod: Database["public"]["Enums"]["payment_method"];
  dayOfMonth: number;
}
