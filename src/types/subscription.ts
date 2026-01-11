import { Database } from "@/integrations/supabase/types";

export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type SubscriptionInsert = Database["public"]["Tables"]["subscriptions"]["Insert"];
export type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

export const SUBSCRIPTION_FEATURES = {
  free: {
    name: "Gratuito",
    price: "R$ 0",
    cards: 2,
    goals: 1,
    groups: 0, // Não pode criar grupos
    reports: false, // Apenas mês atual
    exportPdf: false,
    exportExcel: false,
    ads: true,
    importSpreadsheet: false,
    importLimit: 0,
  },
  no_ads: {
    name: "Sem Anúncios",
    price: "R$ 4,90/mês",
    cards: 2,
    goals: 1,
    groups: 0, // Não pode criar grupos
    reports: false,
    exportPdf: false,
    exportExcel: false,
    ads: false,
    importSpreadsheet: false,
    importLimit: 0,
  },
  premium: {
    name: "Premium",
    price: "R$ 14,90/mês",
    cards: Infinity,
    goals: Infinity,
    groups: 3, // Até 3 grupos
    reports: true, // Gráficos avançados
    exportPdf: true,
    exportExcel: true,
    ads: true, // Mantém anúncios
    importSpreadsheet: true,
    importLimit: 100,
  },
  premium_plus: {
    name: "Premium Plus",
    price: "R$ 17,90/mês",
    cards: Infinity,
    goals: Infinity,
    groups: 3, // Até 3 grupos
    reports: true,
    exportPdf: true,
    exportExcel: true,
    ads: false, // Sem anúncios
    importSpreadsheet: true,
    importLimit: 500,
  },
} as const;
