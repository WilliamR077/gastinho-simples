import { Database } from "@/integrations/supabase/types";

export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];