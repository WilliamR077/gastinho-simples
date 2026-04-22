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

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Para a fatura do mês M (ex: março = month 2), calcula:
 * - dueDate = mês M+1, dia due_day (clamped)
 * - closingDate = dueDate - days_before_due (subtração real de dias)
 */
export function getClosingDateForBillingMonth(
  year: number,
  month: number,
  dueDay: number,
  daysBefore: number
): { closingDate: Date; dueDate: Date } {
  const nextMonth = month + 1;
  const ny = nextMonth > 11 ? year + 1 : year;
  const nm = nextMonth > 11 ? 0 : nextMonth;
  const dueDate = new Date(ny, nm, Math.min(dueDay, daysInMonth(ny, nm)));
  const closingDate = new Date(dueDate);
  closingDate.setDate(closingDate.getDate() - daysBefore);
  return { closingDate, dueDate };
}

/**
 * Calcula as próximas datas de fechamento e vencimento para um cartão.
 */
export function getNextBillingDates(
  config: CreditCardConfig,
  referenceDate: Date
): BillingDates {
  const { due_day, days_before_due, closing_day } = config;
  const now = referenceDate;

  if (due_day && days_before_due) {
    // Tentar fatura do mês atual
    let year = now.getFullYear();
    let month = now.getMonth();

    let { closingDate, dueDate } = getClosingDateForBillingMonth(year, month, due_day, days_before_due);

    // Se o fechamento já passou, avançar para próximo mês
    if (now > closingDate) {
      month += 1;
      if (month > 11) { year += 1; month = 0; }
      ({ closingDate, dueDate } = getClosingDateForBillingMonth(year, month, due_day, days_before_due));
    }

    const billingMonth = format(new Date(year, month, 1), "yyyy-MM");
    return { closingDate, dueDate, billingMonth };
  }

  // Fallback: closing_day based
  const year = now.getFullYear();
  const month = now.getMonth();
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

/**
 * Calcula o mês de fatura (yyyy-MM) para uma despesa de crédito.
 *
 * Modelo: fatura M tem vencimento no mês M+1, dia due_day.
 * Fechamento = vencimento - days_before_due.
 * Período da fatura M = (fechamento de M-1) + 1 dia  até  fechamento de M (inclusive).
 */
export function calculateBillingPeriod(
  expenseDate: Date,
  config: CreditCardConfig
): string {
  const { due_day, days_before_due, opening_day, closing_day } = config;

  if (due_day && days_before_due) {
    // Tentar fatura do mês da despesa
    const year = expenseDate.getFullYear();
    const month = expenseDate.getMonth();

    const current = getClosingDateForBillingMonth(year, month, due_day, days_before_due);

    // Fatura do mês anterior
    const prevMonth = month - 1;
    const py = prevMonth < 0 ? year - 1 : year;
    const pm = prevMonth < 0 ? 11 : prevMonth;
    const prev = getClosingDateForBillingMonth(py, pm, due_day, days_before_due);

    // Normalizar para comparação apenas por data (sem hora)
    const expDay = new Date(expenseDate.getFullYear(), expenseDate.getMonth(), expenseDate.getDate());
    const prevClosingDay = new Date(prev.closingDate.getFullYear(), prev.closingDate.getMonth(), prev.closingDate.getDate());
    const curClosingDay = new Date(current.closingDate.getFullYear(), current.closingDate.getMonth(), current.closingDate.getDate());

    if (expDay > prevClosingDay && expDay <= curClosingDay) {
      // Pertence à fatura do mês atual
      return format(new Date(year, month, 1), "yyyy-MM");
    } else if (expDay > curClosingDay) {
      // Pertence à fatura do mês seguinte
      const nm = month + 1 > 11 ? 0 : month + 1;
      const ny = month + 1 > 11 ? year + 1 : year;
      return format(new Date(ny, nm, 1), "yyyy-MM");
    } else {
      // Pertence à fatura do mês anterior
      return format(new Date(py, pm, 1), "yyyy-MM");
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
    // Apenas crédito gera fatura — outros métodos (debit/pix/cash) são naturalmente ignorados
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
    // Apenas crédito tem fatura — outros métodos (debit/pix/cash) são naturalmente excluídos
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
