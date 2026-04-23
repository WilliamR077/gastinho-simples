import { Banknote, CreditCard, Smartphone, type LucideIcon } from "lucide-react";
import type { PaymentMethod } from "@/types/expense";

/**
 * FONTE ÚNICA DA VERDADE para metadados de métodos de pagamento.
 *
 * Toda label, ícone, cor de chart e regra de domínio (exige cartão? permite parcelas?
 * entra em billing?) deve vir DAQUI. Não duplicar maps locais (methodLabels/Colors/Icons)
 * em componentes — sempre consumir os helpers exportados abaixo.
 *
 * Cores foram preservadas das definições originais em expense-charts.tsx
 * (paleta primária dos charts da home). O PDF/Settings mantêm sua própria paleta
 * de cores visuais e usam apenas os labels/regras desta fonte.
 *
 * "cash" é o único método novo; cor lime (#84cc16) escolhida para não conflitar
 * com verde-entradas (emerald), cyan-PIX, amber-crédito ou purple-débito.
 */

export interface PaymentMethodMeta {
  value: PaymentMethod;
  label: string;
  icon: LucideIcon;
  color: string;
  requiresCard: boolean;
  allowsInstallments: boolean;
  affectsCardBilling: boolean;
  importAliases: string[];
  displayOrder: number;
}

export const PAYMENT_METHODS: Record<PaymentMethod, PaymentMethodMeta> = {
  credit: {
    value: "credit",
    label: "Crédito",
    icon: CreditCard,
    color: "#ef4444", // preservado de expense-charts.tsx
    requiresCard: true,
    allowsInstallments: true,
    affectsCardBilling: true,
    importAliases: [
      "credito", "crédito", "credit",
      "cartao credito", "cartão crédito",
      "cartao de credito", "cartão de crédito",
      "cc",
    ],
    displayOrder: 1,
  },
  debit: {
    value: "debit",
    label: "Débito",
    icon: CreditCard,
    color: "#3b82f6", // preservado de expense-charts.tsx
    requiresCard: true,
    allowsInstallments: false,
    affectsCardBilling: false,
    importAliases: [
      "debito", "débito", "debit",
      "cartao debito", "cartão débito",
      "cartao de debito", "cartão de débito",
      "cd",
    ],
    displayOrder: 2,
  },
  pix: {
    value: "pix",
    label: "PIX",
    icon: Smartphone,
    color: "#10b981", // preservado de expense-charts.tsx
    requiresCard: false,
    allowsInstallments: false,
    affectsCardBilling: false,
    importAliases: [
      "pix",
      "transferencia", "transferência",
      "ted", "doc", "boleto",
    ],
    displayOrder: 3,
  },
  cash: {
    value: "cash",
    label: "Dinheiro",
    icon: Banknote,
    color: "#84cc16", // lime-500 (NOVO — único valor adicionado)
    requiresCard: false,
    allowsInstallments: false,
    affectsCardBilling: false,
    importAliases: [
      "dinheiro", "cash", "espécie", "especie", "money", "papel",
    ],
    displayOrder: 4,
  },
};

/**
 * Lista ordenada por `displayOrder`. SEMPRE usar esta lista em selects,
 * filtros e iterações de UI — NUNCA `Object.values(PAYMENT_METHODS)` direto,
 * porque a ordem de iteração de objetos não é garantida em todos os contextos.
 */
export const PAYMENT_METHOD_LIST: PaymentMethodMeta[] =
  (Object.values(PAYMENT_METHODS) as PaymentMethodMeta[])
    .sort((a, b) => a.displayOrder - b.displayOrder);

// ============ Helpers de display ============

export const paymentMethodLabel = (m: PaymentMethod): string =>
  PAYMENT_METHODS[m]?.label ?? String(m);

export const paymentMethodIcon = (m: PaymentMethod): LucideIcon =>
  PAYMENT_METHODS[m]?.icon ?? Banknote;

export const paymentMethodColor = (m: PaymentMethod): string =>
  PAYMENT_METHODS[m]?.color ?? "#6b7280";

// ============ Helpers de regra de negócio ============

export const requiresCard = (m: PaymentMethod | undefined | null | ""): boolean =>
  m ? (PAYMENT_METHODS[m as PaymentMethod]?.requiresCard ?? false) : false;

export const allowsInstallments = (m: PaymentMethod | undefined | null | ""): boolean =>
  m ? (PAYMENT_METHODS[m as PaymentMethod]?.allowsInstallments ?? false) : false;

export const affectsCardBilling = (m: PaymentMethod | undefined | null | ""): boolean =>
  m ? (PAYMENT_METHODS[m as PaymentMethod]?.affectsCardBilling ?? false) : false;

/**
 * Indica se o método de pagamento usa um cartão físico (crédito ou débito).
 * Diferente de `affectsCardBilling` (só crédito) — débito também usa cartão,
 * mas não gera fatura. Use no relatório "Gastos por Cartão" para excluir
 * PIX e Dinheiro do agrupamento.
 */
export const usesCard = (m: PaymentMethod | undefined | null | ""): boolean =>
  m === "credit" || m === "debit";

// ============ Parser de importação (sem fallback silencioso) ============

export interface AliasParseResult {
  method: PaymentMethod | null;
  matchedAlias: string | null;
}

const normalizeAlias = (s: string): string =>
  s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Tenta mapear uma string da planilha para um PaymentMethod.
 * Retorna { method: null } quando o alias é desconhecido — caller DEVE tratar
 * isto como erro explícito, NUNCA fazer fallback silencioso para "pix".
 */
export function parsePaymentMethodAlias(raw: string): AliasParseResult {
  const norm = normalizeAlias(raw);
  if (!norm) return { method: null, matchedAlias: null };

  for (const meta of PAYMENT_METHOD_LIST) {
    for (const alias of meta.importAliases) {
      if (normalizeAlias(alias) === norm) {
        return { method: meta.value, matchedAlias: alias };
      }
    }
  }
  return { method: null, matchedAlias: null };
}

// ============ Regra de limpeza de campos dependentes ============

export interface CardDependentFields {
  cardId?: string | null;
  installments?: number | null;
}

/**
 * Ao trocar o método de pagamento de uma despesa, limpa automaticamente
 * os campos que não fazem mais sentido:
 * - se o novo método não exige cartão → cardId vira null
 * - se o novo método não permite parcelas → installments volta a 1
 *
 * Use no onChange do Select de método em todos os forms (criação E edição,
 * avulsa E recorrente) para garantir consistência.
 */
export function clearCardDependentFieldsIfNeeded(
  newMethod: PaymentMethod,
  current: CardDependentFields
): CardDependentFields {
  const next: CardDependentFields = { ...current };
  if (!requiresCard(newMethod)) next.cardId = null;
  if (!allowsInstallments(newMethod)) next.installments = 1;
  return next;
}
