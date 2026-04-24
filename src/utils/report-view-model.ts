import { Expense, PaymentMethod, ExpenseCategory, categoryLabels } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { Card } from "@/types/card";
import { Income, RecurringIncome } from "@/types/income";
import { UserCategory } from "@/types/user-category";
import { PeriodType } from "@/components/period-selector";
import { parseLocalDate } from "@/lib/utils";
import {
  format, startOfMonth, endOfMonth, eachMonthOfInterval, eachDayOfInterval,
  isSameDay, parseISO, subMonths, subYears, subQuarters, differenceInDays
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateBillingPeriod, CreditCardConfig } from "@/utils/billing-period";
import { PAYMENT_METHOD_LIST, paymentMethodLabel, usesCard } from "@/lib/payment-methods";

export interface CategoryDataItem {
  name: string;
  icon: string;
  value: number;
  percentage: number;
}

export interface PaymentMethodDataItem {
  name: string;
  method: PaymentMethod;
  value: number;
  percentage: number;
}

export interface CardDataItem {
  name: string;
  color: string;
  value: number;
  percentage: string;
}

export interface MemberDataItem {
  name: string;
  email: string;
  value: number;
  percentage: string;
}

export interface CashFlowDataItem {
  label: string;
  entradas: number;
  saidas: number;
}

export interface EvolutionDataItem {
  label: string;
  total: number;
}

export interface TopExpenseItem {
  description: string;
  amount: number;
  date: string;
  type: 'expense' | 'recurring';
  dayOfMonth: number | undefined;
}

interface GroupMember {
  user_id: string;
  user_email: string;
  role: string;
}

export interface ReportViewModel {
  filteredExpenses: Expense[];
  filteredRecurringExpenses: RecurringExpense[];
  filteredIncomes: Income[];
  filteredRecurringIncomes: RecurringIncome[];
  monthsInPeriod: number;
  totalPeriod: number;
  totalIncomes: number;
  balance: number;
  previousPeriodDates: { start: Date; end: Date } | null;
  previousTotalExpenses: number;
  previousTotalIncomes: number;
  previousBalance: number;
  expenseDelta: number | null;
  incomeDelta: number | null;
  balanceDelta: number | null;
  savingsRate: number;
  topCategory: { name: string; pct: string } | null;
  mostExpensiveDay: { date: string; value: number } | null;
  categoryData: CategoryDataItem[];
  paymentMethodData: PaymentMethodDataItem[];
  cardData: CardDataItem[];
  uniqueCardCount: number;
  memberData: MemberDataItem[];
  cashFlowDataRaw: CashFlowDataItem[];
  evolutionDataRaw: EvolutionDataItem[];
  dailyAverage: number;
  topExpenses: TopExpenseItem[];
}

export interface BuildReportViewModelParams {
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  incomes: Income[];
  recurringIncomes: RecurringIncome[];
  cards: Card[];
  categories: UserCategory[];
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
  isGroupContext: boolean;
  groupMembers: GroupMember[];
}

export function buildReportViewModel(params: BuildReportViewModelParams): ReportViewModel {
  const {
    expenses, recurringExpenses, incomes, recurringIncomes,
    cards, categories, startDate, endDate, periodType,
    isGroupContext, groupMembers
  } = params;

  // Helper: prioriza dados denormalizados (cross-user em grupos)
  const getCategoryDisplay = (
    categoryName: string | null | undefined,
    categoryIcon: string | null | undefined,
    categoryId: string | null | undefined,
    categoryEnum: ExpenseCategory | null | undefined
  ): { key: string; name: string; icon: string } => {
    if (categoryName) return { key: categoryName, name: categoryName, icon: categoryIcon || '📦' };
    if (categoryId && categories.length > 0) {
      const found = categories.find(c => c.id === categoryId);
      if (found) return { key: found.name, name: found.name, icon: found.icon };
    }
    if (categoryEnum) {
      const label = categoryLabels[categoryEnum] || categoryEnum;
      return { key: label, name: label, icon: '📦' };
    }
    return { key: 'Outros', name: 'Outros', icon: '📦' };
  };

  // Build cards config map for billing period calculation
  const cardsConfigMap = new Map<string, CreditCardConfig>();
  cards.forEach(card => {
    cardsConfigMap.set(card.id, {
      opening_day: card.opening_day || 1,
      closing_day: card.closing_day || 15,
      due_day: (card as any).due_day,
      days_before_due: (card as any).days_before_due,
    });
  });

  const periodStr = format(startDate, "yyyy-MM");

  // Filter expenses by period — credit uses billing period (competência)
  const filteredExpenses = expenses.filter(e => {
    const d = parseLocalDate(e.expense_date);
    
    if (e.payment_method === "credit" && e.card_id && cardsConfigMap.has(e.card_id)) {
      const config = cardsConfigMap.get(e.card_id)!;
      const billingPeriod = calculateBillingPeriod(d, config);
      // For monthly view, match billing period to selected month
      if (periodType === "month") {
        return billingPeriod === periodStr;
      }
      // For other periods, check if billing period falls within range
      const [bYear, bMonth] = billingPeriod.split("-").map(Number);
      const billingDate = new Date(bYear, bMonth - 1, 1);
      return billingDate >= startOfMonth(startDate) && billingDate <= endOfMonth(endDate);
    }
    
    return d >= startDate && d <= endDate;
  });

  const filteredRecurringExpenses = recurringExpenses.filter(re => {
    if (!re.is_active && !re.end_date) return false;
    const sd = re.start_date ? parseISO(re.start_date) : parseLocalDate(re.created_at);
    const ed = re.end_date ? parseISO(re.end_date) : null;
    return sd <= endDate && (!ed || ed >= startDate);
  });

  const filteredIncomes = incomes.filter(i => {
    const d = parseLocalDate(i.income_date);
    return d >= startDate && d <= endDate;
  });

  const filteredRecurringIncomes = recurringIncomes.filter(ri => {
    if (!ri.is_active && !ri.end_date) return false;
    const sd = ri.start_date ? parseISO(ri.start_date) : parseLocalDate(ri.created_at);
    const ed = ri.end_date ? parseISO(ri.end_date) : null;
    return sd <= endDate && (!ed || ed >= startDate);
  });

  const monthsInPeriod = eachMonthOfInterval({ start: startDate, end: endDate }).length;
  const rm = periodType === "month" ? 1 : monthsInPeriod;

  // Totals
  const totalPeriod = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0)
    + filteredRecurringExpenses.reduce((s, e) => s + Number(e.amount), 0) * rm;

  const totalIncomes = filteredIncomes.reduce((s, i) => s + Number(i.amount), 0)
    + filteredRecurringIncomes.reduce((s, i) => s + Number(i.amount), 0) * rm;

  const balance = totalIncomes - totalPeriod;

  // Previous period — abrange month, quarter, year e custom (all = sem comparação)
  let previousPeriodDates: { start: Date; end: Date } | null = null;
  if (periodType === "month") {
    const ps = subMonths(startDate, 1);
    previousPeriodDates = { start: startOfMonth(ps), end: endOfMonth(ps) };
  } else if (periodType === "year") {
    const ps = subYears(startDate, 1);
    previousPeriodDates = { start: new Date(ps.getFullYear(), 0, 1), end: new Date(ps.getFullYear(), 11, 31) };
  } else if (periodType === "quarter") {
    const ps = subQuarters(startDate, 1);
    const pe = subQuarters(endDate, 1);
    previousPeriodDates = { start: startOfMonth(ps), end: endOfMonth(pe) };
  } else if (periodType === "custom") {
    const durationDays = differenceInDays(endDate, startDate);
    const prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - durationDays);
    prevStart.setHours(0, 0, 0, 0);
    previousPeriodDates = { start: prevStart, end: prevEnd };
  }

  // Helper interno: replica EXATAMENTE a lógica usada para o período atual,
  // incluindo competência de crédito e recorrentes — assim o "anterior" não diverge.
  const computeTotalsForPeriod = (
    pStart: Date,
    pEnd: Date,
    pType: PeriodType
  ): { totalExpenses: number; totalIncomes: number } => {
    const pStr = format(pStart, "yyyy-MM");
    const monthsCount = eachMonthOfInterval({ start: pStart, end: pEnd }).length;
    const rmLocal = pType === "month" ? 1 : monthsCount;

    const expFiltered = expenses.filter(e => {
      const d = parseLocalDate(e.expense_date);
      if (e.payment_method === "credit" && e.card_id && cardsConfigMap.has(e.card_id)) {
        const config = cardsConfigMap.get(e.card_id)!;
        const billingPeriod = calculateBillingPeriod(d, config);
        if (pType === "month") return billingPeriod === pStr;
        const [bYear, bMonth] = billingPeriod.split("-").map(Number);
        const billingDate = new Date(bYear, bMonth - 1, 1);
        return billingDate >= startOfMonth(pStart) && billingDate <= endOfMonth(pEnd);
      }
      return d >= pStart && d <= pEnd;
    });

    const recExpFiltered = recurringExpenses.filter(re => {
      if (!re.is_active && !re.end_date) return false;
      const sd = re.start_date ? parseISO(re.start_date) : parseLocalDate(re.created_at);
      const ed = re.end_date ? parseISO(re.end_date) : null;
      return sd <= pEnd && (!ed || ed >= pStart);
    });

    const incFiltered = incomes.filter(i => {
      const d = parseLocalDate(i.income_date);
      return d >= pStart && d <= pEnd;
    });

    const recIncFiltered = recurringIncomes.filter(ri => {
      if (!ri.is_active && !ri.end_date) return false;
      const sd = ri.start_date ? parseISO(ri.start_date) : parseLocalDate(ri.created_at);
      const ed = ri.end_date ? parseISO(ri.end_date) : null;
      return sd <= pEnd && (!ed || ed >= pStart);
    });

    const totalExpenses = expFiltered.reduce((s, e) => s + Number(e.amount), 0)
      + recExpFiltered.reduce((s, e) => s + Number(e.amount), 0) * rmLocal;
    const totalIncomesLocal = incFiltered.reduce((s, i) => s + Number(i.amount), 0)
      + recIncFiltered.reduce((s, i) => s + Number(i.amount), 0) * rmLocal;

    return { totalExpenses, totalIncomes: totalIncomesLocal };
  };

  let previousTotalExpenses = 0;
  let previousTotalIncomes = 0;
  if (previousPeriodDates) {
    const prevTotals = computeTotalsForPeriod(previousPeriodDates.start, previousPeriodDates.end, periodType);
    previousTotalExpenses = prevTotals.totalExpenses;
    previousTotalIncomes = prevTotals.totalIncomes;
  }
  const previousBalance = previousTotalIncomes - previousTotalExpenses;

  // Delta apenas é null quando o valor anterior é exatamente 0 (sem base real)
  const expenseDelta = previousTotalExpenses > 0 ? ((totalPeriod - previousTotalExpenses) / previousTotalExpenses) * 100 : null;
  const incomeDelta = previousTotalIncomes > 0 ? ((totalIncomes - previousTotalIncomes) / previousTotalIncomes) * 100 : null;
  const balanceDelta = previousBalance !== 0 ? ((balance - previousBalance) / Math.abs(previousBalance)) * 100 : null;
  const savingsRate = totalIncomes > 0 ? (balance / totalIncomes) * 100 : 0;

  // Top category
  const catTotals: Record<string, { name: string; value: number }> = {};
  filteredExpenses.forEach(e => {
    const c = getCategoryDisplay(e.category_name, e.category_icon, e.category_id, e.category);
    if (!catTotals[c.key]) catTotals[c.key] = { name: c.name, value: 0 };
    catTotals[c.key].value += Number(e.amount);
  });
  const catSorted = Object.values(catTotals).sort((a, b) => b.value - a.value);
  const catTotal = catSorted.reduce((s, i) => s + i.value, 0);
  const topCategory = catSorted.length > 0
    ? { name: catSorted[0].name, pct: catTotal > 0 ? ((catSorted[0].value / catTotal) * 100).toFixed(0) : "0" }
    : null;

  // Most expensive day
  const dayTotals: Record<string, { date: string; total: number }> = {};
  filteredExpenses.forEach(e => {
    if (!dayTotals[e.expense_date]) dayTotals[e.expense_date] = { date: e.expense_date, total: 0 };
    dayTotals[e.expense_date].total += Number(e.amount);
  });
  const daySorted = Object.values(dayTotals).sort((a, b) => b.total - a.total);
  const mostExpensiveDay = daySorted.length > 0
    ? { date: format(parseLocalDate(daySorted[0].date), "dd/MM"), value: daySorted[0].total }
    : null;

  // Category data
  const categoryDataMap: Record<string, { name: string; icon: string; value: number }> = {};
  filteredExpenses.forEach(e => {
    const c = getCategoryDisplay(e.category_name, e.category_icon, e.category_id, e.category);
    if (!categoryDataMap[c.key]) categoryDataMap[c.key] = { name: c.name, icon: c.icon, value: 0 };
    categoryDataMap[c.key].value += Number(e.amount);
  });
  filteredRecurringExpenses.forEach(r => {
    const c = getCategoryDisplay(r.category_name, r.category_icon, r.category_id, r.category);
    if (!categoryDataMap[c.key]) categoryDataMap[c.key] = { name: c.name, icon: c.icon, value: 0 };
    categoryDataMap[c.key].value += Number(r.amount) * rm;
  });
  const catDataTotal = Object.values(categoryDataMap).reduce((s, i) => s + i.value, 0);
  // Mostra todas as categorias reais (sem agrupar em "Outros") — espelha o card da Início
  const categoryData: CategoryDataItem[] = Object.values(categoryDataMap)
    .filter(i => i.value > 0)
    .map(i => ({
      ...i,
      value: Number(i.value.toFixed(2)),
      percentage: catDataTotal > 0 ? (i.value / catDataTotal) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // Payment method data — acumulador derivado de PAYMENT_METHOD_LIST (inclui cash).
  const pmTotals = PAYMENT_METHOD_LIST.reduce((acc, m) => {
    acc[m.value] = 0;
    return acc;
  }, {} as Record<PaymentMethod, number>);
  filteredExpenses.forEach(e => { pmTotals[e.payment_method] = (pmTotals[e.payment_method] ?? 0) + Number(e.amount); });
  filteredRecurringExpenses.forEach(r => { pmTotals[r.payment_method] = (pmTotals[r.payment_method] ?? 0) + Number(r.amount) * rm; });
  const pmTotal = Object.values(pmTotals).reduce((s, v) => s + v, 0);
  const paymentMethodData: PaymentMethodDataItem[] = PAYMENT_METHOD_LIST
    .map((m) => ({
      name: paymentMethodLabel(m.value),
      method: m.value,
      value: Number((pmTotals[m.value] ?? 0).toFixed(2)),
      percentage: pmTotal > 0 ? ((pmTotals[m.value] ?? 0) / pmTotal) * 100 : 0,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  // Card data — apenas despesas em cartão (crédito/débito). PIX/Dinheiro são
  // excluídos. Quando um mesmo cartão tem gastos em crédito E débito, divide
  // em duas fatias rotuladas; caso contrário, mantém o nome simples.
  // Helper local: escurece uma cor hex misturando com preto na proporção dada.
  const darkenHex = (hex: string, ratio = 0.3): string => {
    const h = hex.replace("#", "");
    if (h.length !== 6) return hex;
    const r = Math.round(parseInt(h.slice(0, 2), 16) * (1 - ratio));
    const g = Math.round(parseInt(h.slice(2, 4), 16) * (1 - ratio));
    const b = Math.round(parseInt(h.slice(4, 6), 16) * (1 - ratio));
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
  };

  // Agrupa por chave composta `${card_id}::${payment_method}`
  type CardBucket = { cardId: string; method: PaymentMethod; name: string; color: string; value: number };
  const cardBuckets: Record<string, CardBucket> = {};

  const accumulateCardExpense = (
    cardId: string | null | undefined,
    method: PaymentMethod,
    amount: number
  ) => {
    if (!usesCard(method)) return; // exclui PIX/Dinheiro
    if (!cardId) {
      console.warn("[report] despesa em cartão sem card_id — ignorada", { method, amount });
      return;
    }
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    const key = `${cardId}::${method}`;
    if (!cardBuckets[key]) {
      cardBuckets[key] = { cardId, method, name: card.name, color: card.color, value: 0 };
    }
    cardBuckets[key].value += amount;
  };

  filteredExpenses.forEach(e => accumulateCardExpense(e.card_id, e.payment_method, Number(e.amount)));
  filteredRecurringExpenses.forEach(r => accumulateCardExpense(r.card_id, r.payment_method, Number(r.amount) * rm));

  // Conta tipos distintos por cartão para decidir sufixo
  const methodsPerCard: Record<string, Set<PaymentMethod>> = {};
  Object.values(cardBuckets).forEach(b => {
    if (!methodsPerCard[b.cardId]) methodsPerCard[b.cardId] = new Set();
    methodsPerCard[b.cardId].add(b.method);
  });

  const cardDataTotal = Object.values(cardBuckets).reduce((s, i) => s + i.value, 0);
  const cardData: CardDataItem[] = Object.values(cardBuckets)
    .filter(b => b.value > 0)
    .map(b => {
      const hasBoth = (methodsPerCard[b.cardId]?.size ?? 0) > 1;
      const suffix = hasBoth ? (b.method === "credit" ? " - Crédito" : " - Débito") : "";
      const finalColor = hasBoth && b.method === "debit" ? darkenHex(b.color, 0.3) : b.color;
      return {
        name: `${b.name}${suffix}`,
        color: finalColor,
        value: Number(b.value.toFixed(2)),
        percentage: cardDataTotal > 0 ? ((b.value / cardDataTotal) * 100).toFixed(1) : "0",
      };
    })
    .sort((a, b) => b.value - a.value);

  const uniqueCardCount = Object.keys(methodsPerCard).length;

  // Member data
  let memberData: MemberDataItem[] = [];
  if (isGroupContext && groupMembers.length) {
    const mTotals: Record<string, { name: string; email: string; value: number }> = {};
    filteredExpenses.forEach(e => {
      const member = groupMembers.find(m => m.user_id === e.user_id);
      const email = member?.user_email || 'Desconhecido';
      if (!mTotals[e.user_id]) mTotals[e.user_id] = { name: email.split('@')[0], email, value: 0 };
      mTotals[e.user_id].value += Number(e.amount);
    });
    const mTotal = Object.values(mTotals).reduce((s, i) => s + i.value, 0);
    memberData = Object.values(mTotals)
      .filter(i => i.value > 0)
      .map(i => ({
        ...i,
        value: Number(i.value.toFixed(2)),
        percentage: mTotal > 0 ? ((i.value / mTotal) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.value - a.value);
  }

  // Helper: verifica se uma despesa/entrada fixa ocorre em um dado dia do mês visualizado
  const recurringHitsDay = (
    r: { day_of_month: number; start_date: string | null; end_date: string | null; created_at: string },
    day: Date
  ): boolean => {
    if (r.day_of_month !== day.getDate()) return false;
    const sd = r.start_date ? parseISO(r.start_date) : parseLocalDate(r.created_at);
    const ed = r.end_date ? parseISO(r.end_date) : null;
    return sd <= day && (!ed || ed >= day);
  };

  // Cash flow data (raw = daily/monthly without cumulative)
  const cashFlowDataRaw: CashFlowDataItem[] = periodType === "month"
    ? eachDayOfInterval({ start: startDate, end: endDate }).map(day => {
        const dayExp = filteredExpenses.filter(e => isSameDay(parseLocalDate(e.expense_date), day));
        const dayInc = filteredIncomes.filter(i => isSameDay(parseLocalDate(i.income_date), day));
        let entradas = dayInc.reduce((s, i) => s + Number(i.amount), 0);
        let saidas = dayExp.reduce((s, e) => s + Number(e.amount), 0);
        // Incluir entradas fixas no dia configurado
        filteredRecurringIncomes.forEach(r => {
          if (recurringHitsDay(r, day)) entradas += Number(r.amount);
        });
        // Incluir despesas fixas no dia configurado
        filteredRecurringExpenses.forEach(r => {
          if (recurringHitsDay(r, day)) saidas += Number(r.amount);
        });
        return {
          label: format(day, "dd"),
          entradas: Number(entradas.toFixed(2)),
          saidas: Number(saidas.toFixed(2)),
        };
      })
    : eachMonthOfInterval({ start: startDate, end: endDate }).map(month => {
        const ms = startOfMonth(month), me = endOfMonth(month);
        const mExp = filteredExpenses.filter(e => { const d = parseLocalDate(e.expense_date); return d >= ms && d <= me; });
        const mInc = filteredIncomes.filter(i => { const d = parseLocalDate(i.income_date); return d >= ms && d <= me; });
        let totalE = mExp.reduce((s, e) => s + Number(e.amount), 0);
        let totalI = mInc.reduce((s, i) => s + Number(i.amount), 0);
        filteredRecurringExpenses.forEach(r => {
          const sd = r.start_date ? parseISO(r.start_date) : parseLocalDate(r.created_at);
          const ed = r.end_date ? parseISO(r.end_date) : null;
          if (sd <= me && (!ed || ed >= ms)) totalE += Number(r.amount);
        });
        filteredRecurringIncomes.forEach(r => {
          const sd = r.start_date ? parseISO(r.start_date) : parseLocalDate(r.created_at);
          const ed = r.end_date ? parseISO(r.end_date) : null;
          if (sd <= me && (!ed || ed >= ms)) totalI += Number(r.amount);
        });
        return { label: format(month, "MMM/yy", { locale: ptBR }), entradas: Number(totalI.toFixed(2)), saidas: Number(totalE.toFixed(2)) };
      });

  // Evolution data (raw = daily)
  const evolutionDataRaw: EvolutionDataItem[] = periodType === "month"
    ? eachDayOfInterval({ start: startDate, end: endDate }).map(day => {
        const dayExp = filteredExpenses.filter(e => isSameDay(parseLocalDate(e.expense_date), day));
        let total = dayExp.reduce((s, e) => s + Number(e.amount), 0);
        filteredRecurringExpenses.forEach(r => {
          if (recurringHitsDay(r, day)) total += Number(r.amount);
        });
        return { label: format(day, "dd"), total: Number(total.toFixed(2)) };
      })
    : eachMonthOfInterval({ start: startDate, end: endDate }).map(month => {
        const ms = startOfMonth(month), me = endOfMonth(month);
        const mExp = filteredExpenses.filter(e => { const d = parseLocalDate(e.expense_date); return d >= ms && d <= me; });
        let total = mExp.reduce((s, e) => s + Number(e.amount), 0);
        filteredRecurringExpenses.forEach(r => {
          const sd = r.start_date ? parseISO(r.start_date) : parseLocalDate(r.created_at);
          const ed = r.end_date ? parseISO(r.end_date) : null;
          if (sd <= me && (!ed || ed >= ms)) total += Number(r.amount);
        });
        return { label: format(month, "MMM/yy", { locale: ptBR }), total: Number(total.toFixed(2)) };
      });

  const days = differenceInDays(endDate, startDate) + 1;
  const dailyAverage = days > 0 ? totalPeriod / days : 0;

  // Top expenses
  const topExpenses: TopExpenseItem[] = [
    ...filteredExpenses.map(e => ({ description: e.description, amount: Number(e.amount), date: e.expense_date, type: 'expense' as const, dayOfMonth: undefined as number | undefined })),
    ...filteredRecurringExpenses.map(r => ({ description: r.description, amount: Number(r.amount), date: '', type: 'recurring' as const, dayOfMonth: r.day_of_month })),
  ].sort((a, b) => b.amount - a.amount).slice(0, 10);

  return {
    filteredExpenses,
    filteredRecurringExpenses,
    filteredIncomes,
    filteredRecurringIncomes,
    monthsInPeriod,
    totalPeriod,
    totalIncomes,
    balance,
    previousPeriodDates,
    previousTotalExpenses,
    previousTotalIncomes,
    previousBalance,
    expenseDelta,
    incomeDelta,
    balanceDelta,
    savingsRate,
    topCategory,
    mostExpensiveDay,
    categoryData,
    paymentMethodData,
    cardData,
    uniqueCardCount,
    memberData,
    cashFlowDataRaw,
    evolutionDataRaw,
    dailyAverage,
    topExpenses,
  };
}

// Helper: apply cumulative mode to cash flow data
export function applyCumulativeMode(data: CashFlowDataItem[]): CashFlowDataItem[] {
  let cumIn = 0, cumOut = 0;
  return data.map(d => {
    cumIn += d.entradas;
    cumOut += d.saidas;
    return { ...d, entradas: Number(cumIn.toFixed(2)), saidas: Number(cumOut.toFixed(2)) };
  });
}

// Helper: apply weekly mode to evolution data
export function applyWeeklyMode(data: EvolutionDataItem[]): EvolutionDataItem[] {
  return data.reduce((acc, item, idx) => {
    const weekIdx = Math.floor(idx / 7);
    if (!acc[weekIdx]) acc[weekIdx] = { label: `Sem ${weekIdx + 1}`, total: 0 };
    acc[weekIdx].total = Number((acc[weekIdx].total + item.total).toFixed(2));
    return acc;
  }, [] as EvolutionDataItem[]);
}
