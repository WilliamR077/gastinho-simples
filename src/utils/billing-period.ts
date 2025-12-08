import { startOfMonth, endOfMonth, addMonths, format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

interface CreditCardConfig {
  opening_day: number;
  closing_day: number;
}

/**
 * Calcula o período de faturamento (mês da fatura) baseado na data do gasto
 * e na configuração do cartão de crédito
 */
export function calculateBillingPeriod(
  expenseDate: Date,
  config: CreditCardConfig
): string {
  const { opening_day, closing_day } = config;
  
  // Data atual do gasto
  const currentDay = expenseDate.getDate();
  const currentMonth = expenseDate.getMonth();
  const currentYear = expenseDate.getFullYear();
  
  // Se o dia de abertura é maior que o dia de fechamento,
  // significa que a fatura cruza o mês (ex: abertura dia 2, fechamento dia 1 do mês seguinte)
  if (opening_day > closing_day) {
    // Se o gasto é entre o dia 1 e o dia de fechamento
    if (currentDay <= closing_day) {
      // Pertence à fatura do mês seguinte (pois o fechamento é no mês seguinte)
      const nextMonth = addMonths(new Date(currentYear, currentMonth, 1), 1);
      return format(nextMonth, "yyyy-MM");
    } else if (currentDay >= opening_day) {
      // Se o gasto é após o dia de abertura, pertence à fatura do mês atual
      return format(new Date(currentYear, currentMonth, 1), "yyyy-MM");
    } else {
      // Entre o fechamento e a abertura, pertence à fatura do mês atual
      return format(new Date(currentYear, currentMonth, 1), "yyyy-MM");
    }
  } else {
    // Fatura não cruza o mês (ex: abertura dia 1, fechamento dia 30)
    if (currentDay >= opening_day && currentDay <= closing_day) {
      // Pertence à fatura do mês atual
      return format(new Date(currentYear, currentMonth, 1), "yyyy-MM");
    } else if (currentDay < opening_day) {
      // Antes da abertura, pertence à fatura do mês anterior
      const previousMonth = addMonths(new Date(currentYear, currentMonth, 1), -1);
      return format(previousMonth, "yyyy-MM");
    } else {
      // Após o fechamento, pertence à fatura do próximo mês
      const nextMonth = addMonths(new Date(currentYear, currentMonth, 1), 1);
      return format(nextMonth, "yyyy-MM");
    }
  }
}

/**
 * Gera uma lista de períodos de faturamento disponíveis
 * baseado nas despesas existentes
 */
export function generateBillingPeriods(
  expenses: Array<{ expense_date: string; payment_method: string }>,
  config?: CreditCardConfig
): Array<{ value: string; label: string }> {
  if (!config) return [];
  
  const periods = new Set<string>();
  
  expenses
    .filter(expense => expense.payment_method === "credit")
    .forEach(expense => {
      const expenseDate = parseLocalDate(expense.expense_date);
      const period = calculateBillingPeriod(expenseDate, config);
      periods.add(period);
    });
  
  return Array.from(periods)
    .sort()
    .map(period => ({
      value: period,
      label: formatBillingPeriodLabel(period)
    }));
}

/**
 * Formata um período de faturamento para exibição
 */
export function formatBillingPeriodLabel(period: string): string {
  const [year, month] = period.split("-");
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

/**
 * Filtra despesas por período de faturamento
 */
export function filterExpensesByBillingPeriod(
  expenses: Array<{ expense_date: string; payment_method: string }>,
  billingPeriod: string,
  config: CreditCardConfig
): Array<{ expense_date: string; payment_method: string }> {
  return expenses.filter(expense => {
    if (expense.payment_method !== "credit") return false;
    
    const expenseDate = parseLocalDate(expense.expense_date);
    const expensePeriod = calculateBillingPeriod(expenseDate, config);
    
    return expensePeriod === billingPeriod;
  });
}