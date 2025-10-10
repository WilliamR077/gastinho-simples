import { Database } from "@/integrations/supabase/types";

export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type ExpenseCategory = Database["public"]["Enums"]["expense_category"];

export interface ExpenseFormData {
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  expenseDate: Date;
  installments?: number;
  category: ExpenseCategory;
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