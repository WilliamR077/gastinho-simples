import { addMonths, format } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

export interface CreditCardConfig {
  opening_day: number;
  closing_day: number;
  due_day?: number;
  days_before_due?: number;
}

export interface BillingDates {
  closingDate: Date;
  dueDate: Date;
  billingMonth: string;
}

/**
 * Calcula as próximas datas de fechamento e vencimento para um cartão.
 * Se due_day + days_before_due existirem, usa novo modelo.
 * Senão, fallback para closing_day.
 */
export function getNextBillingDates(
  config: CreditCardConfig,
  referenceDate: Date
): BillingDates {
  const { due_day, days_before_due, closing_day } = config;
  const now = referenceDate;
  const year = now.getFullYear();
  const month = now.getMonth();

  if (due_day && days_before_due) {
    // Novo modelo: vencimento - dias = fechamento
    const computeForMonth = (y: number, m: number) => {
      const dueDate = new Date(y, m, Math.min(due_day, daysInMonth(y, m)));
      const closingDate = new Date(dueDate);
      closingDate.setDate(closingDate.getDate() - days_before_due);
      return { closingDate, dueDate };
    };

    // Try current month
    let { closingDate, dueDate } = computeForMonth(year, month);
    
    // If closing already passed, advance to next month
    if (now > closingDate) {
      const next = month + 1;
      const ny = next > 11 ? year + 1 : year;
      const nm = next > 11 ? 0 : next;
      ({ closingDate, dueDate } = computeForMonth(ny, nm));
    }

    const billingMonth = format(closingDate, "yyyy-MM");
    return { closingDate, dueDate, billingMonth };
  }

  // Fallback: closing_day based
  const closingDayVal = closing_day || 15;
  let closingDate = new Date(year, month, Math.min(closingDayVal, daysInMonth(year, month)));
  
  if (now > closingDate) {
    const next = month + 1;
    const ny = next > 11 ? year + 1 : year;
    const nm = next > 11 ? 0 : next;
    closingDate = new Date(ny, nm, Math.min(closingDayVal, daysInMonth(ny, nm)));
  }

  const dueDate = new Date(closingDate);
  dueDate.setDate(dueDate.getDate() + 10);

  const billingMonth = format(closingDate, "yyyy-MM");
  return { closingDate, dueDate, billingMonth };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calcula o período de faturamento (mês da fatura) baseado na data do gasto
 * e na configuração do cartão de crédito.
 */
export function calculateBillingPeriod(
  expenseDate: Date,
  config: CreditCardConfig
): string {
  const { due_day, days_before_due, opening_day, closing_day } = config;

  // Novo modelo: due_day + days_before_due
  if (due_day && days_before_due) {
    const year = expenseDate.getFullYear();
    const month = expenseDate.getMonth();

    const computeClosingForMonth = (y: number, m: number): Date => {
      const dim = daysInMonth(y, m);
      const dd = new Date(y, m, Math.min(due_day, dim));
      dd.setDate(dd.getDate() - days_before_due);
      return dd;
    };

    // Check current month closing
    let closingDate = computeClosingForMonth(year, month);
    
    if (expenseDate <= closingDate) {
      // Belongs to this month's billing
      return format(closingDate, "yyyy-MM");
    } else {
      // After closing → next month's billing
      const next = month + 1;
      const ny = next > 11 ? year + 1 : year;
      const nm = next > 11 ? 0 : next;
      closingDate = computeClosingForMonth(ny, nm);
      return format(closingDate, "yyyy-MM");
    }
  }

  // Fallback: old model with opening_day / closing_day
  const currentDay = expenseDate.getDate();
  const currentMonth = expenseDate.getMonth();
  const currentYear = expenseDate.getFullYear();

  if (opening_day > closing_day) {
    if (currentDay >= opening_day) {
      const nextMonth = addMonths(new Date(currentYear, currentMonth, 1), 1);
      return format(nextMonth, "yyyy-MM");
    } else {
      return format(new Date(currentYear, currentMonth, 1), "yyyy-MM");
    }
  } else {
    if (currentDay >= opening_day && currentDay <= closing_day) {
      return format(new Date(currentYear, currentMonth, 1), "yyyy-MM");
    } else if (currentDay < opening_day) {
      const previousMonth = addMonths(new Date(currentYear, currentMonth, 1), -1);
      return format(previousMonth, "yyyy-MM");
    } else {
      const nextMonth = addMonths(new Date(currentYear, currentMonth, 1), 1);
      return format(nextMonth, "yyyy-MM");
    }
  }
}

/**
 * Gera uma lista de períodos de faturamento disponíveis
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
    
    let config = fallbackConfig;
    if (expense.card_id && cardsConfig?.has(expense.card_id)) {
      config = cardsConfig.get(expense.card_id)!;
    }
    
    const expensePeriod = calculateBillingPeriod(expenseDate, config);
    return expensePeriod === billingPeriod;
  });
}
