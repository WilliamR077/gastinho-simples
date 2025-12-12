import { addMonths, format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

export interface CreditCardConfig {
  opening_day: number;
  closing_day: number;
}

/**
 * Calcula o período de faturamento (mês da fatura) baseado na data do gasto
 * e na configuração do cartão de crédito.
 * 
 * Exemplo com fechamento dia 29 e abertura dia 30:
 * - Fatura de Dezembro: abre 30/Nov, fecha 29/Dez, paga em Jan
 * - Gasto dia 05/Dez → fatura de Dezembro (2024-12)
 * - Gasto dia 30/Dez → fatura de Janeiro (2025-01)
 */
export function calculateBillingPeriod(
  expenseDate: Date,
  config: CreditCardConfig
): string {
  const { opening_day, closing_day } = config;
  
  const currentDay = expenseDate.getDate();
  const currentMonth = expenseDate.getMonth();
  const currentYear = expenseDate.getFullYear();
  
  // Se opening_day > closing_day, a fatura cruza o mês
  // Ex: abre dia 30, fecha dia 29 do próximo mês
  if (opening_day > closing_day) {
    // Dias 1 até closing_day: pertencem à fatura do MÊS ATUAL
    // Dias opening_day até fim do mês: pertencem à fatura do MÊS SEGUINTE
    if (currentDay >= opening_day) {
      // Após o dia de abertura → fatura do próximo mês
      const nextMonth = addMonths(new Date(currentYear, currentMonth, 1), 1);
      return format(nextMonth, "yyyy-MM");
    } else {
      // Antes do dia de abertura → fatura do mês atual
      return format(new Date(currentYear, currentMonth, 1), "yyyy-MM");
    }
  } else {
    // Fatura não cruza o mês (ex: abre dia 1, fecha dia 30)
    if (currentDay >= opening_day && currentDay <= closing_day) {
      // Dentro do período → fatura do mês atual
      return format(new Date(currentYear, currentMonth, 1), "yyyy-MM");
    } else if (currentDay < opening_day) {
      // Antes da abertura → fatura do mês anterior
      const previousMonth = addMonths(new Date(currentYear, currentMonth, 1), -1);
      return format(previousMonth, "yyyy-MM");
    } else {
      // Após o fechamento → fatura do próximo mês
      const nextMonth = addMonths(new Date(currentYear, currentMonth, 1), 1);
      return format(nextMonth, "yyyy-MM");
    }
  }
}

/**
 * Gera uma lista de períodos de faturamento disponíveis
 * baseado nas despesas existentes.
 * 
 * Versão que usa config de cartões específicos quando disponível.
 */
export function generateBillingPeriods(
  expenses: Array<{ expense_date: string; payment_method: string; card_id?: string | null }>,
  fallbackConfig: CreditCardConfig,
  cardsConfig?: Map<string, CreditCardConfig>
): Array<{ value: string; label: string }> {
  const periods = new Set<string>();
  
  expenses
    .filter(expense => expense.payment_method === "credit")
    .forEach(expense => {
      const expenseDate = parseLocalDate(expense.expense_date);
      
      // Tentar usar a config do cartão específico
      let config = fallbackConfig;
      if (expense.card_id && cardsConfig?.has(expense.card_id)) {
        config = cardsConfig.get(expense.card_id)!;
      }
      
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
export function filterExpensesByBillingPeriod<T extends { expense_date: string; payment_method: string; card_id?: string | null }>(
  expenses: T[],
  billingPeriod: string,
  fallbackConfig: CreditCardConfig,
  cardsConfig?: Map<string, CreditCardConfig>
): T[] {
  return expenses.filter(expense => {
    if (expense.payment_method !== "credit") return false;
    
    const expenseDate = parseLocalDate(expense.expense_date);
    
    // Tentar usar a config do cartão específico
    let config = fallbackConfig;
    if (expense.card_id && cardsConfig?.has(expense.card_id)) {
      config = cardsConfig.get(expense.card_id)!;
    }
    
    const expensePeriod = calculateBillingPeriod(expenseDate, config);
    return expensePeriod === billingPeriod;
  });
}