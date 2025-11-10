import { Database } from "@/integrations/supabase/types";

export type Card = Database["public"]["Tables"]["cards"]["Row"];
export type CardInsert = Database["public"]["Tables"]["cards"]["Insert"];
export type CardType = "credit" | "debit";

export interface CardFormData {
  name: string;
  card_type: CardType;
  opening_day?: number;
  closing_day?: number;
  card_limit?: number;
  color?: string;
}

export const cardTypeLabels: Record<CardType, string> = {
  credit: "Crédito",
  debit: "Débito"
};
