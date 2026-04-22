import { Card } from "@/types/card";
import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import {
  calculateCardLimitBreakdown,
  type CardExpenseRecord,
} from "@/utils/card-limit-calculator";
import { calculateCreditCardSpend } from "@/utils/credit-card-spend";

export type CardLimitStatus = "ok" | "attention" | "warning" | "danger";

export interface CardLimitSummary {
  cardId: string;
  cardName: string;
  cardColor: string;
  limit: number;
  currentSpend: number;
  futureInstallments: number;
  committedLimit: number;
  available: number;
  exceeded: number;
  percentage: number;
  hasLimit: boolean;
  status: CardLimitStatus;
}

interface BuildCardLimitSummaryMapParams {
  cards: Card[];
  currentExpenses: Expense[];
  recurringExpenses: RecurringExpense[];
  installmentExpenses: Expense[] | CardExpenseRecord[];
  startDate: Date;
  endDate: Date;
}

const isCreditCard = (card: Card) => card.card_type === "credit" || card.card_type === "both";

export const getCardLimitStatus = (percentage: number, exceeded: number): CardLimitStatus => {
  if (exceeded > 0 || percentage >= 95) return "danger";
  if (percentage >= 85) return "warning";
  if (percentage >= 70) return "attention";
  return "ok";
};

export const getCardLimitBarClass = (status: CardLimitStatus) => {
  switch (status) {
    case "danger":
      return "bg-red-500";
    case "warning":
      return "bg-orange-500";
    case "attention":
      return "bg-yellow-500";
    default:
      return "bg-emerald-500";
  }
};

export const getCardLimitTextClass = (status: CardLimitStatus) => {
  switch (status) {
    case "danger":
      return "text-red-600 dark:text-red-400";
    case "warning":
      return "text-orange-600 dark:text-orange-400";
    case "attention":
      return "text-yellow-600 dark:text-yellow-400";
    default:
      return "text-emerald-600 dark:text-emerald-400";
  }
};

const toCardExpenseRecords = (expenses: Expense[] | CardExpenseRecord[]): CardExpenseRecord[] => {
  return expenses
    .filter((expense) => {
      if (!expense.card_id) return false;
      // Apenas crédito ocupa limite — outros métodos (debit/pix/cash) são naturalmente ignorados
      if ("payment_method" in expense && expense.payment_method !== "credit") return false;
      return true;
    })
    .map((expense) => ({
      amount: Number(expense.amount),
      expense_date: expense.expense_date,
      card_id: expense.card_id as string,
      installment_group_id: expense.installment_group_id,
      installment_number: expense.installment_number,
      total_installments: expense.total_installments,
    }));
};

export function buildCardLimitSummaryMap({
  cards,
  currentExpenses,
  recurringExpenses,
  installmentExpenses,
  startDate,
  endDate,
}: BuildCardLimitSummaryMapParams): Map<string, CardLimitSummary> {
  const summaries = new Map<string, CardLimitSummary>();
  const creditSpend = calculateCreditCardSpend(currentExpenses, recurringExpenses, startDate, endDate);
  const installmentRecords = toCardExpenseRecords(installmentExpenses);

  cards.forEach((card) => {
    const limit = Number(card.card_limit);
    if (!isCreditCard(card) || !limit || limit <= 0) return;

    const breakdown = calculateCardLimitBreakdown(
      creditSpend.byCardId[card.id]?.total || 0,
      installmentRecords,
      card.id,
      {
        opening_day: card.opening_day || 1,
        closing_day: card.closing_day || 15,
        due_day: card.due_day ?? undefined,
        days_before_due: card.days_before_due ?? undefined,
      },
      limit
    );
    const status = getCardLimitStatus(breakdown.percentage, breakdown.exceeded);

    summaries.set(card.id, {
      cardId: card.id,
      cardName: card.name,
      cardColor: card.color || "#FFA500",
      limit,
      hasLimit: true,
      status,
      ...breakdown,
    });
  });

  return summaries;
}
