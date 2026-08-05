import { Expense, PaymentMethod, ExpenseCategory, categoryLabels } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { Card } from "@/types/card";
import { Income, RecurringIncome } from "@/types/income";
import { UserCategory } from "@/types/user-category";
import { PeriodType } from "@/components/period-selector";
import {
  format, startOfMonth, endOfMonth, eachMonthOfInterval, eachDayOfInterval,
  isSameDay, subMonths, subYears, subQuarters, differenceInDays
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { PAYMENT_METHOD_LIST, paymentMethodLabel, usesCard } from "@/lib/payment-methods";
import { getMemberDisplayName } from "@/utils/member-display";
import {
  buildRecurringProjections,
  calculatePercentageDelta,
  calculateRealizedSavingsRate,
  classifyReportPeriod,
  filterRowsByCivilPeriod,
  parseReportCivilDate,
  reportCivilDateKey,
  RecurringProjection,
  ReportPeriodRelation,
  sumRealizedAmounts,
} from "@/utils/report-business-rules";
import {
  resolveReportCategory,
  ResolvedReportCategory,
} from "@/utils/report-category-resolver";

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
  type: 'expense' | 'installment-group';
  // Campos opcionais para grupos de parcelas (em períodos > mês)
  installmentsInPeriod?: number;
  totalInstallments?: number;
  dateRange?: { start: string; end: string };
}

export type ResolvedRecurringExpenseProjection = RecurringProjection<RecurringExpense> & {
  category: ResolvedReportCategory;
};

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
  recurringExpenseProjections: ResolvedRecurringExpenseProjection[];
  recurringIncomeProjections: RecurringProjection<RecurringIncome>[];
  periodRelation: ReportPeriodRelation;
  monthsInPeriod: number;
  totalPeriod: number;
  totalIncomes: number;
  balance: number;
  projectedExpenses: number;
  projectedIncomes: number;
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

  // Mapa canônico compartilhado pela interface e pelo exportador PDF.
  const getCategoryDisplay = (
    categoryName: string | null | undefined,
    categoryIcon: string | null | undefined,
    categoryId: string | null | undefined,
    categoryEnum: ExpenseCategory | null | undefined
  ): { key: string; name: string; icon: string } => {
    return resolveReportCategory({
      categoryId,
      categoryName,
      categoryIcon,
      legacyLabel: categoryEnum ? (categoryLabels[categoryEnum] || categoryEnum) : null,
    }, categories);
  };

  // Realizado usa a data da movimentação persistida. Templates não entram aqui.
  const filteredExpenses = filterRowsByCivilPeriod(expenses, e => e.expense_date, startDate, endDate);
  const filteredIncomes = filterRowsByCivilPeriod(incomes, i => i.income_date, startDate, endDate);

  // Não existe no schema um vínculo template -> movimentação. Nenhum template é
  // deduzido por descrição, valor, categoria, dia ou forma de pagamento.
  const recurringExpenseProjections: ResolvedRecurringExpenseProjection[] = buildRecurringProjections(
    recurringExpenses,
    startDate,
    endDate,
  ).map((projection) => ({
    ...projection,
    category: getCategoryDisplay(
      projection.template.category_name,
      projection.template.category_icon,
      projection.template.category_id,
      projection.template.category,
    ),
  }));
  const recurringIncomeProjections = buildRecurringProjections(recurringIncomes, startDate, endDate);
  const filteredRecurringExpenses = recurringExpenseProjections.map(item => item.template);
  const filteredRecurringIncomes = recurringIncomeProjections.map(item => item.template);
  const periodRelation = classifyReportPeriod(startDate, endDate);

  const monthsInPeriod = eachMonthOfInterval({ start: startDate, end: endDate }).length;

  const totalPeriod = sumRealizedAmounts(filteredExpenses);
  const totalIncomes = sumRealizedAmounts(filteredIncomes);
  const balance = totalIncomes - totalPeriod;
  const projectedExpenses = Number(recurringExpenseProjections.reduce((sum, item) => sum + item.projectedTotal, 0).toFixed(2));
  const projectedIncomes = Number(recurringIncomeProjections.reduce((sum, item) => sum + item.projectedTotal, 0).toFixed(2));

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

  // A comparação usa a mesma base realizada do período atual.
  const computeTotalsForPeriod = (
    pStart: Date,
    pEnd: Date,
    _pType: PeriodType
  ): { totalExpenses: number; totalIncomes: number } => {
    const expFiltered = filterRowsByCivilPeriod(expenses, e => e.expense_date, pStart, pEnd);
    const incFiltered = filterRowsByCivilPeriod(incomes, i => i.income_date, pStart, pEnd);

    return {
      totalExpenses: sumRealizedAmounts(expFiltered),
      totalIncomes: sumRealizedAmounts(incFiltered),
    };
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
  const expenseDelta = calculatePercentageDelta(totalPeriod, previousTotalExpenses);
  const incomeDelta = calculatePercentageDelta(totalIncomes, previousTotalIncomes);
  const balanceDelta = previousBalance !== 0 ? ((balance - previousBalance) / Math.abs(previousBalance)) * 100 : null;
  const savingsRate = calculateRealizedSavingsRate(totalIncomes, totalPeriod);

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
    const dateKey = reportCivilDateKey(e.expense_date);
    if (!dayTotals[dateKey]) dayTotals[dateKey] = { date: dateKey, total: 0 };
    dayTotals[dateKey].total += Number(e.amount);
  });
  const daySorted = Object.values(dayTotals).sort((a, b) => b.total - a.total);
  const mostExpensiveDay = daySorted.length > 0
    ? { date: format(parseReportCivilDate(daySorted[0].date), "dd/MM"), value: daySorted[0].total }
    : null;

  // Category data
  const categoryDataMap: Record<string, { name: string; icon: string; value: number }> = {};
  filteredExpenses.forEach(e => {
    const c = getCategoryDisplay(e.category_name, e.category_icon, e.category_id, e.category);
    if (!categoryDataMap[c.key]) categoryDataMap[c.key] = { name: c.name, icon: c.icon, value: 0 };
    categoryDataMap[c.key].value += Number(e.amount);
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
      if (!mTotals[e.user_id]) mTotals[e.user_id] = { name: getMemberDisplayName(member ?? { user_email: email }), email, value: 0 };
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

  // Fluxo realizado: somente linhas persistidas de expenses/incomes.
  const cashFlowDataRaw: CashFlowDataItem[] = periodType === "month"
    ? eachDayOfInterval({ start: startDate, end: endDate }).map(day => {
        const dayExp = filteredExpenses.filter(e => isSameDay(parseReportCivilDate(e.expense_date), day));
        const dayInc = filteredIncomes.filter(i => isSameDay(parseReportCivilDate(i.income_date), day));
        const entradas = dayInc.reduce((s, i) => s + Number(i.amount), 0);
        const saidas = dayExp.reduce((s, e) => s + Number(e.amount), 0);
        return {
          label: format(day, "dd"),
          entradas: Number(entradas.toFixed(2)),
          saidas: Number(saidas.toFixed(2)),
        };
      })
    : eachMonthOfInterval({ start: startDate, end: endDate }).map(month => {
        const ms = startOfMonth(month), me = endOfMonth(month);
        const mExp = filterRowsByCivilPeriod(filteredExpenses, e => e.expense_date, ms, me);
        const mInc = filterRowsByCivilPeriod(filteredIncomes, i => i.income_date, ms, me);
        const totalE = mExp.reduce((s, e) => s + Number(e.amount), 0);
        const totalI = mInc.reduce((s, i) => s + Number(i.amount), 0);
        return { label: format(month, "MMM/yy", { locale: ptBR }), entradas: Number(totalI.toFixed(2)), saidas: Number(totalE.toFixed(2)) };
      });

  // Evolução realizada: templates recorrentes ficam fora da série.
  const evolutionDataRaw: EvolutionDataItem[] = periodType === "month"
    ? eachDayOfInterval({ start: startDate, end: endDate }).map(day => {
        const dayExp = filteredExpenses.filter(e => isSameDay(parseReportCivilDate(e.expense_date), day));
        const total = dayExp.reduce((s, e) => s + Number(e.amount), 0);
        return { label: format(day, "dd"), total: Number(total.toFixed(2)) };
      })
    : eachMonthOfInterval({ start: startDate, end: endDate }).map(month => {
        const ms = startOfMonth(month), me = endOfMonth(month);
        const mExp = filterRowsByCivilPeriod(filteredExpenses, e => e.expense_date, ms, me);
        const total = mExp.reduce((s, e) => s + Number(e.amount), 0);
        return { label: format(month, "MMM/yy", { locale: ptBR }), total: Number(total.toFixed(2)) };
      });

  const days = differenceInDays(endDate, startDate) + 1;
  const dailyAverage = days > 0 ? totalPeriod / days : 0;

  // Top expenses — agrupa parcelas em visões > mês para evitar poluição do ranking
  const stripInstallmentSuffix = (s: string) => s.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
  let topExpenseItems: TopExpenseItem[] = [];

  if (periodType === "month") {
    // Visão mensal: cada parcela conta individualmente (impacto real do mês)
    topExpenseItems = filteredExpenses.map(e => ({
      description: e.description,
      amount: Number(e.amount),
      date: reportCivilDateKey(e.expense_date),
      type: 'expense' as const,
    }));
  } else {
    // Visões maiores: agrupa parcelas do mesmo installment_group_id
    const standalone: TopExpenseItem[] = [];
    const groupsMap: Record<string, {
      description: string;
      amount: number;
      count: number;
      totalInstallments: number;
      minDate: string;
      maxDate: string;
      sampleDate: string;
    }> = {};

    filteredExpenses.forEach(e => {
      if (!e.installment_group_id) {
        standalone.push({
          description: e.description,
          amount: Number(e.amount),
          date: reportCivilDateKey(e.expense_date),
          type: 'expense' as const,
        });
        return;
      }
      const gid = e.installment_group_id;
      if (!groupsMap[gid]) {
        groupsMap[gid] = {
          description: stripInstallmentSuffix(e.description),
          amount: 0,
          count: 0,
          totalInstallments: e.total_installments || 0,
          minDate: reportCivilDateKey(e.expense_date),
          maxDate: reportCivilDateKey(e.expense_date),
          sampleDate: reportCivilDateKey(e.expense_date),
        };
      }
      const g = groupsMap[gid];
      g.amount += Number(e.amount);
      g.count += 1;
      if (e.total_installments && e.total_installments > g.totalInstallments) {
        g.totalInstallments = e.total_installments;
      }
      const expenseDateKey = reportCivilDateKey(e.expense_date);
      if (expenseDateKey < g.minDate) g.minDate = expenseDateKey;
      if (expenseDateKey > g.maxDate) g.maxDate = expenseDateKey;
    });

    Object.values(groupsMap).forEach(g => {
      if (g.count <= 1) {
        // Apenas 1 parcela no período → trata como avulsa (mantém descrição original com "x/y")
        const original = filteredExpenses.find(e => reportCivilDateKey(e.expense_date) === g.sampleDate && stripInstallmentSuffix(e.description) === g.description);
        standalone.push({
          description: original?.description || g.description,
          amount: g.amount,
          date: g.sampleDate,
          type: 'expense' as const,
        });
      } else {
        standalone.push({
          description: `${g.description} (${g.count} parcelas)`,
          amount: g.amount,
          date: g.minDate,
          type: 'installment-group' as const,
          installmentsInPeriod: g.count,
          totalInstallments: g.totalInstallments || g.count,
          dateRange: { start: g.minDate, end: g.maxDate },
        });
      }
    });

    topExpenseItems = standalone;
  }

  const topExpenses: TopExpenseItem[] = topExpenseItems
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return {
    filteredExpenses,
    filteredRecurringExpenses,
    filteredIncomes,
    filteredRecurringIncomes,
    recurringExpenseProjections,
    recurringIncomeProjections,
    periodRelation,
    monthsInPeriod,
    totalPeriod,
    totalIncomes,
    balance,
    projectedExpenses,
    projectedIncomes,
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
