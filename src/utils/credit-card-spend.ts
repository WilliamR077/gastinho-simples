import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";

export interface CreditCardSpendTotal {
  total: number;
  color: string;
}

export interface CreditCardSpendByIdTotal extends CreditCardSpendTotal {
  name: string;
}

export interface CreditCardSpendResult {
  byName: Record<string, CreditCardSpendTotal>;
  byCardId: Record<string, CreditCardSpendByIdTotal>;
}

/**
 * Source of truth compartilhada para calcular o gasto atual de credito por cartao.
 *
 * O caller decide o escopo visivel (contexto, mes, filtros de tela) e passa as
 * expenses ja filtradas. A funcao agrega uma unica vez e retorna os mesmos
 * totais em dois formatos:
 * - byName: usado pela home para exibir "Banco do Brasil: R$ X"
 * - byCardId: usado pelo CardManager para casar com o limite do cartao
 */
export function calculateCreditCardSpend(
  expenses: Expense[],
  recurringExpenses: RecurringExpense[],
  startDate: Date,
  endDate: Date
): CreditCardSpendResult {
  const byName: Record<string, CreditCardSpendTotal> = {};
  const byCardId: Record<string, CreditCardSpendByIdTotal> = {};

  const addCardSpend = (
    cardId: string | null | undefined,
    cardName: string | null | undefined,
    cardColor: string | null | undefined,
    amount: number
  ) => {
    const name = cardName || "Sem cartão";
    const color = cardColor || "#FFA500";

    if (!byName[name]) {
      byName[name] = { total: 0, color };
    }
    byName[name].total += amount;

    if (!cardId) return;

    if (!byCardId[cardId]) {
      byCardId[cardId] = { total: 0, color, name };
    }
    byCardId[cardId].total += amount;
  };

  expenses
    .filter((e) => e.payment_method === "credit")
    .forEach((expense) => {
      addCardSpend(
        expense.card?.id || expense.card_id,
        expense.card?.name || expense.card_name,
        expense.card?.color || expense.card_color,
        Number(expense.amount)
      );
    });

  recurringExpenses
    .filter((e) => e.is_active && e.payment_method === "credit")
    .filter((e) => {
      const day = e.day_of_month;
      const startDay = startDate.getDate();
      const endDay = endDate.getDate();
      return day >= startDay && day <= endDay;
    })
    .forEach((expense) => {
      addCardSpend(
        expense.card?.id || expense.card_id,
        expense.card?.name || expense.card_name,
        expense.card?.color || expense.card_color,
        Number(expense.amount)
      );
    });

  return { byName, byCardId };
}
