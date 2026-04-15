import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";

/**
 * Source of truth compartilhada para calcular o gasto atual de crédito por cartão.
 * 
 * Usada tanto pela home (ExpenseSummary) quanto pelo card-manager.
 * 
 * Lógica:
 * - Filtra expenses por payment_method === 'credit', agrupa por card name, soma amount
 * - Filtra recurringExpenses ativas de crédito cujo day_of_month cai no período
 * - Retorna Record<cardName, { total, color }>
 * 
 * IMPORTANTE: expenses e recurringExpenses já devem vir filtrados pelo mês calendário
 * (a função NÃO aplica filtro de data nas expenses — isso é responsabilidade do caller).
 * Para recurringExpenses, a função filtra por is_active, payment_method e day_of_month no período.
 */
export function calculateCreditCardSpend(
  expenses: Expense[],
  recurringExpenses: RecurringExpense[],
  startDate: Date,
  endDate: Date
): Record<string, { total: number; color: string }> {
  const creditCardTotals: Record<string, { total: number; color: string }> = {};

  // 1. Despesas avulsas de crédito (já filtradas pelo mês calendário pelo caller)
  expenses
    .filter((e) => e.payment_method === 'credit')
    .forEach((expense) => {
      const cardName = expense.card?.name || expense.card_name || 'Sem cartão';
      const cardColor = expense.card?.color || expense.card_color || '#FFA500';
      if (!creditCardTotals[cardName]) {
        creditCardTotals[cardName] = { total: 0, color: cardColor };
      }
      creditCardTotals[cardName].total += Number(expense.amount);
    });

  // 2. Despesas fixas ativas de crédito cujo day_of_month cai no período
  recurringExpenses
    .filter((e) => e.is_active && e.payment_method === 'credit')
    .filter((e) => {
      const day = e.day_of_month;
      const startDay = startDate.getDate();
      const endDay = endDate.getDate();
      // Período simples dentro do mesmo mês
      return day >= startDay && day <= endDay;
    })
    .forEach((expense) => {
      const cardName = expense.card?.name || expense.card_name || 'Sem cartão';
      const cardColor = expense.card?.color || expense.card_color || '#FFA500';
      if (!creditCardTotals[cardName]) {
        creditCardTotals[cardName] = { total: 0, color: cardColor };
      }
      creditCardTotals[cardName].total += Number(expense.amount);
    });

  return creditCardTotals;
}

/**
 * Calcula o gasto atual de crédito para um cartão específico (por card_id),
 * usado pelo card-manager onde precisamos mapear por ID e não por nome.
 */
export function calculateCreditCardSpendById(
  expenses: Expense[],
  recurringExpenses: RecurringExpense[],
  cardId: string,
  referenceDate: Date = new Date()
): number {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // último dia do mês

  // Despesas avulsas de crédito deste cartão no mês calendário
  let total = 0;

  expenses
    .filter((e) => e.payment_method === 'credit' && e.card_id === cardId)
    .filter((e) => {
      // Filtro por mês calendário usando parseLocalDate seria ideal,
      // mas como expenses já vem com expense_date como string YYYY-MM-DD,
      // podemos comparar diretamente
      const [y, m] = e.expense_date.split('-').map(Number);
      return y === year && m === month + 1;
    })
    .forEach((e) => {
      total += Number(e.amount);
    });

  // Despesas fixas ativas de crédito deste cartão
  recurringExpenses
    .filter((e) => e.is_active && e.payment_method === 'credit')
    .filter((e) => e.card_id === cardId || e.card?.id === cardId)
    .filter((e) => {
      const day = e.day_of_month;
      return day >= 1 && day <= endDate.getDate();
    })
    .forEach((e) => {
      total += Number(e.amount);
    });

  return total;
}
