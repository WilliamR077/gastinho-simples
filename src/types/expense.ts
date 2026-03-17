import { Database } from "@/integrations/supabase/types";
import { Card } from "./card";
import { SharedGroup } from "./shared-group";
import { ExpenseSplit, SplitType, SplitParticipant } from "./expense-split";

export type Expense = Database["public"]["Tables"]["expenses"]["Row"] & {
  card?: Pick<Card, 'id' | 'name' | 'color' | 'card_type'>;
  shared_group?: Pick<SharedGroup, 'id' | 'name' | 'color'>;
  // Campos desnormalizados para exibição em grupos compartilhados
  category_name?: string | null;
  category_icon?: string | null;
  card_name?: string | null;
  card_color?: string | null;
  // Rateio
  is_shared?: boolean;
  paid_by?: string | null;
  split_type?: string | null;
  splits?: ExpenseSplit[];
};
export type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type ExpenseCategory = Database["public"]["Enums"]["expense_category"];

export interface ExpenseFormData {
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  expenseDate: Date;
  installments?: number;
  category?: ExpenseCategory;
  cardId?: string;
  sharedGroupId?: string | null;
  categoryId?: string;
}

export const categoryLabels: Record<ExpenseCategory, string> = {
  alimentacao: "Alimentação",
  transporte: "Transporte",
  lazer: "Lazer",
  saude: "Saúde",
  educacao: "Educação",
  moradia: "Moradia",
  vestuario: "Vestuário",
  servicos: "Serviços",
  outros: "Outros"
};

export const categoryIcons: Record<ExpenseCategory, string> = {
  alimentacao: "🍔",
  transporte: "🚗",
  lazer: "🎮",
  saude: "⚕️",
  educacao: "📚",
  moradia: "🏠",
  vestuario: "👕",
  servicos: "🔧",
  outros: "📦"
};