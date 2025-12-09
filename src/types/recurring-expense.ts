import { Database } from "@/integrations/supabase/types";
import { SharedGroup } from "./shared-group";

export type RecurringExpense = Database["public"]["Tables"]["recurring_expenses"]["Row"] & {
  card?: {
    id: string;
    name: string;
    color: string;
    card_type: string;
  };
  shared_group?: Pick<SharedGroup, 'id' | 'name' | 'color'>;
  // Campos adicionais da migração (estarão disponíveis após types serem atualizados)
  start_date?: string | null;
  end_date?: string | null;
};
export type RecurringExpenseInsert = Database["public"]["Tables"]["recurring_expenses"]["Insert"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type ExpenseCategory = Database["public"]["Enums"]["expense_category"];

export interface RecurringExpenseFormData {
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  dayOfMonth: number;
  category: ExpenseCategory;
  cardId?: string;
  sharedGroupId?: string | null;
}
