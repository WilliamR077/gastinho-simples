import { useMemo, useState } from "react";
import { Card as CardType } from "@/types/card";
import { Expense, PaymentMethod, ExpenseCategory, categoryLabels } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { Income, RecurringIncome, incomeCategoryLabels } from "@/types/income";
import { ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend, ReferenceLine, PieChart, Pie, Cell } from "recharts";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, eachDayOfInterval, isSameDay, parseISO, subMonths, subYears, subQuarters, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Crown, Lock, CreditCard, Users, CalendarClock, DollarSign, ArrowUpDown, Sparkles, Target, Trophy, Wallet, BarChart3 } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { parseLocalDate } from "@/lib/utils";
import { PeriodType } from "./period-selector";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useCategories } from "@/hooks/use-categories";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";

interface GroupMember {
  user_id: string;
  user_email: string;
  role: string;
}

interface ReportsAccordionProps {
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  cards: CardType[];
  incomes: Income[];
  recurringIncomes: RecurringIncome[];
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
  periodLabel: string;
  isGroupContext: boolean;
  groupMembers: GroupMember[];
}

const COLORS = {
  credit: "#ef4444",
  debit: "#3b82f6", 
  pix: "#14b8a6",
};

const CATEGORY_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", 
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899"
];

const MEMBER_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"
];

const paymentMethodLabels: Record<PaymentMethod, string> = {
  credit: "Crédito",
  debit: "Débito",
  pix: "PIX"
};

export function ReportsAccordion({ 
  expenses, 
  recurringExpenses,
  cards,
  incomes,
  recurringIncomes,
  startDate,
  endDate,
  periodType,
  periodLabel,
  isGroupContext,
  groupMembers
}: ReportsAccordionProps) {
  const { hasAdvancedReports } = useSubscription();
  const navigate = useNavigate();
  const { categories } = useCategories();
  const [cashFlowMode, setCashFlowMode] = useState<"daily" | "cumulative">("daily");

  // Helper para obter info da categoria
  const getCategoryInfo = (categoryId: string | null | undefined, categoryEnum: ExpenseCategory | null | undefined) => {
    if (categoryId && categories.length > 0) {
      const found = categories.find(c => c.id === categoryId);
      if (found) return { id: found.id, name: found.name, icon: found.icon };
    }
    if (categoryEnum) {
      const label = categoryLabels[categoryEnum] || categoryEnum;
      return { id: categoryEnum, name: label, icon: '📦' };
    }
    return { id: 'outros', name: 'Outros', icon: '📦' };
  };
  
  // Filtrar despesas para o período selecionado
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const expenseDate = parseLocalDate(e.expense_date);
      return expenseDate >= startDate && expenseDate <= endDate;
    });
  }, [expenses, startDate, endDate]);

  // Filtrar despesas recorrentes por start_date e end_date
  const filteredRecurringExpenses = useMemo(() => {
    return recurringExpenses.filter(re => {
      if (!re.is_active && !re.end_date) return false;
      const startDateRe = re.start_date ? parseISO(re.start_date) : parseLocalDate(re.created_at);
      const endDateRe = re.end_date ? parseISO(re.end_date) : null;
      const startedBeforeOrDuring = startDateRe <= endDate;
      const notEndedBeforePeriod = !endDateRe || endDateRe >= startDate;
      return startedBeforeOrDuring && notEndedBeforePeriod;
    });
  }, [recurringExpenses, startDate, endDate]);

  const monthsInPeriod = useMemo(() => {
    return eachMonthOfInterval({ start: startDate, end: endDate }).length;
  }, [startDate, endDate]);

  const filteredIncomes = useMemo(() => {
    return incomes.filter(i => {
      const incomeDate = parseLocalDate(i.income_date);
      return incomeDate >= startDate && incomeDate <= endDate;
    });
  }, [incomes, startDate, endDate]);

  const filteredRecurringIncomes = useMemo(() => {
    return recurringIncomes.filter(ri => {
      if (!ri.is_active && !ri.end_date) return false;
      const startDateRi = ri.start_date ? parseISO(ri.start_date) : parseLocalDate(ri.created_at);
      const endDateRi = ri.end_date ? parseISO(ri.end_date) : null;
      return startDateRi <= endDate && (!endDateRi || endDateRi >= startDate);
    });
  }, [recurringIncomes, startDate, endDate]);

  const totalPeriod = useMemo(() => {
    const expensesTotal = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const recurringTotal = filteredRecurringExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const recurringPeriodTotal = periodType === "month" ? recurringTotal : recurringTotal * monthsInPeriod;
    return expensesTotal + recurringPeriodTotal;
  }, [filteredExpenses, filteredRecurringExpenses, monthsInPeriod, periodType]);

  const totalIncomes = useMemo(() => {
    const incomesTotal = filteredIncomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const recurringTotal = filteredRecurringIncomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const recurringPeriodTotal = periodType === "month" ? recurringTotal : recurringTotal * monthsInPeriod;
    return incomesTotal + recurringPeriodTotal;
  }, [filteredIncomes, filteredRecurringIncomes, monthsInPeriod, periodType]);

  const balance = useMemo(() => totalIncomes - totalPeriod, [totalIncomes, totalPeriod]);

  // === BLOCO 1: Período anterior para comparação ===
  const previousPeriodDates = useMemo(() => {
    if (periodType === "month") {
      const prevStart = subMonths(startDate, 1);
      return { start: startOfMonth(prevStart), end: endOfMonth(prevStart) };
    } else if (periodType === "year") {
      const prevStart = subYears(startDate, 1);
      return { start: new Date(prevStart.getFullYear(), 0, 1), end: new Date(prevStart.getFullYear(), 11, 31) };
    } else if (periodType === "quarter") {
      const prevStart = subQuarters(startDate, 1);
      return { start: startOfMonth(prevStart), end: endOfMonth(subMonths(startDate, 1)) };
    }
    return null;
  }, [startDate, endDate, periodType]);

  const previousExpenses = useMemo(() => {
    if (!previousPeriodDates) return [];
    return expenses.filter(e => {
      const d = parseLocalDate(e.expense_date);
      return d >= previousPeriodDates.start && d <= previousPeriodDates.end;
    });
  }, [expenses, previousPeriodDates]);

  const previousIncomes = useMemo(() => {
    if (!previousPeriodDates) return [];
    return incomes.filter(i => {
      const d = parseLocalDate(i.income_date);
      return d >= previousPeriodDates.start && d <= previousPeriodDates.end;
    });
  }, [incomes, previousPeriodDates]);

  const previousTotalExpenses = useMemo(() => {
    return previousExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }, [previousExpenses]);

  const previousTotalIncomes = useMemo(() => {
    return previousIncomes.reduce((sum, i) => sum + Number(i.amount), 0);
  }, [previousIncomes]);

  const previousBalance = previousTotalIncomes - previousTotalExpenses;

  // Deltas
  const expenseDelta = previousTotalExpenses > 0 ? ((totalPeriod - previousTotalExpenses) / previousTotalExpenses) * 100 : null;
  const incomeDelta = previousTotalIncomes > 0 ? ((totalIncomes - previousTotalIncomes) / previousTotalIncomes) * 100 : null;
  const balanceDelta = previousBalance !== 0 ? ((balance - previousBalance) / Math.abs(previousBalance)) * 100 : null;

  // Savings rate
  const savingsRate = totalIncomes > 0 ? (balance / totalIncomes) * 100 : 0;

  // === INSIGHTS ===
  const topCategory = useMemo(() => {
    const totals: Record<string, { name: string; value: number }> = {};
    filteredExpenses.forEach(e => {
      const catInfo = getCategoryInfo(e.category_id, e.category);
      if (!totals[catInfo.id]) totals[catInfo.id] = { name: catInfo.name, value: 0 };
      totals[catInfo.id].value += Number(e.amount);
    });
    const sorted = Object.values(totals).sort((a, b) => b.value - a.value);
    if (sorted.length === 0) return null;
    const total = sorted.reduce((s, i) => s + i.value, 0);
    return { name: sorted[0].name, pct: total > 0 ? ((sorted[0].value / total) * 100).toFixed(0) : "0" };
  }, [filteredExpenses, categories]);

  const mostExpensiveDay = useMemo(() => {
    const dayTotals: Record<string, { date: string; total: number }> = {};
    filteredExpenses.forEach(e => {
      const key = e.expense_date;
      if (!dayTotals[key]) dayTotals[key] = { date: key, total: 0 };
      dayTotals[key].total += Number(e.amount);
    });
    const sorted = Object.values(dayTotals).sort((a, b) => b.total - a.total);
    if (sorted.length === 0) return null;
    return { date: format(parseLocalDate(sorted[0].date), "dd/MM"), value: sorted[0].total };
  }, [filteredExpenses]);

  // === DADOS DOS GRÁFICOS ===
  const cashFlowData = useMemo(() => {
    const rawData = periodType === "month"
      ? eachDayOfInterval({ start: startDate, end: endDate }).map(day => {
          const dayExp = filteredExpenses.filter(e => isSameDay(parseLocalDate(e.expense_date), day));
          const dayInc = filteredIncomes.filter(i => isSameDay(parseLocalDate(i.income_date), day));
          return {
            label: format(day, "dd"),
            entradas: Number(dayInc.reduce((s, i) => s + Number(i.amount), 0).toFixed(2)),
            saidas: Number(dayExp.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)),
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

    if (cashFlowMode === "cumulative") {
      let cumIn = 0, cumOut = 0;
      return rawData.map(d => {
        cumIn += d.entradas;
        cumOut += d.saidas;
        return { ...d, entradas: Number(cumIn.toFixed(2)), saidas: Number(cumOut.toFixed(2)) };
      });
    }
    return rawData;
  }, [filteredExpenses, filteredIncomes, filteredRecurringExpenses, filteredRecurringIncomes, startDate, endDate, periodType, cashFlowMode]);

  // Dados de evolução de gastos
  const evolutionData = useMemo(() => {
    if (periodType === "month") {
      return eachDayOfInterval({ start: startDate, end: endDate }).map(day => {
        const dayExp = filteredExpenses.filter(e => isSameDay(parseLocalDate(e.expense_date), day));
        return { label: format(day, "dd"), total: Number(dayExp.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)) };
      });
    }
    return eachMonthOfInterval({ start: startDate, end: endDate }).map(month => {
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
  }, [filteredExpenses, filteredRecurringExpenses, startDate, endDate, periodType]);

  const dailyAverage = useMemo(() => {
    const days = differenceInDays(endDate, startDate) + 1;
    return days > 0 ? totalPeriod / days : 0;
  }, [totalPeriod, startDate, endDate]);

  // Dados por categoria
  const categoryData = useMemo(() => {
    const totals: Record<string, { name: string; icon: string; value: number }> = {};
    filteredExpenses.forEach(e => {
      const c = getCategoryInfo(e.category_id, e.category);
      if (!totals[c.id]) totals[c.id] = { name: c.name, icon: c.icon, value: 0 };
      totals[c.id].value += Number(e.amount);
    });
    const rm = periodType === "month" ? 1 : monthsInPeriod;
    filteredRecurringExpenses.forEach(r => {
      const c = getCategoryInfo(r.category_id, r.category);
      if (!totals[c.id]) totals[c.id] = { name: c.name, icon: c.icon, value: 0 };
      totals[c.id].value += Number(r.amount) * rm;
    });
    const total = Object.values(totals).reduce((s, i) => s + i.value, 0);
    const sorted = Object.values(totals).filter(i => i.value > 0).map(i => ({
      ...i, value: Number(i.value.toFixed(2)),
      percentage: total > 0 ? ((i.value / total) * 100) : 0,
    })).sort((a, b) => b.value - a.value);
    // Top 5 + Others
    if (sorted.length > 5) {
      const top5 = sorted.slice(0, 5);
      const others = sorted.slice(5);
      const othersTotal = others.reduce((s, i) => s + i.value, 0);
      const othersPct = total > 0 ? (othersTotal / total) * 100 : 0;
      return [...top5, { name: "Outros", icon: "📦", value: Number(othersTotal.toFixed(2)), percentage: othersPct }];
    }
    return sorted;
  }, [filteredExpenses, filteredRecurringExpenses, monthsInPeriod, periodType, categories]);

  // Dados por forma de pagamento
  const paymentMethodData = useMemo(() => {
    const totals: Record<PaymentMethod, number> = { credit: 0, debit: 0, pix: 0 };
    filteredExpenses.forEach(e => { totals[e.payment_method] += Number(e.amount); });
    const rm = periodType === "month" ? 1 : monthsInPeriod;
    filteredRecurringExpenses.forEach(r => { totals[r.payment_method] += Number(r.amount) * rm; });
    const total = Object.values(totals).reduce((s, v) => s + v, 0);
    return Object.entries(totals).filter(([, v]) => v > 0).map(([method, value]) => ({
      name: paymentMethodLabels[method as PaymentMethod],
      method: method as PaymentMethod,
      value: Number(value.toFixed(2)),
      percentage: total > 0 ? (value / total) * 100 : 0,
    })).sort((a, b) => b.value - a.value);
  }, [filteredExpenses, filteredRecurringExpenses, monthsInPeriod, periodType]);

  // Dados por cartão (manter donut)
  const cardData = useMemo(() => {
    const totals: Record<string, { name: string; color: string; value: number }> = {};
    totals['no-card'] = { name: 'Sem cartão', color: '#9ca3af', value: 0 };
    filteredExpenses.forEach(e => {
      if (e.card_id) {
        const card = cards.find(c => c.id === e.card_id);
        if (card) {
          if (!totals[card.id]) totals[card.id] = { name: card.name, color: card.color, value: 0 };
          totals[card.id].value += Number(e.amount);
        }
      } else { totals['no-card'].value += Number(e.amount); }
    });
    const rm = periodType === "month" ? 1 : monthsInPeriod;
    filteredRecurringExpenses.forEach(r => {
      if (r.card_id) {
        const card = cards.find(c => c.id === r.card_id);
        if (card) {
          if (!totals[card.id]) totals[card.id] = { name: card.name, color: card.color, value: 0 };
          totals[card.id].value += Number(r.amount) * rm;
        }
      } else { totals['no-card'].value += Number(r.amount) * rm; }
    });
    const total = Object.values(totals).reduce((s, i) => s + i.value, 0);
    return Object.values(totals).filter(i => i.value > 0).map(i => ({
      ...i, value: Number(i.value.toFixed(2)),
      percentage: total > 0 ? ((i.value / total) * 100).toFixed(1) : "0",
    })).sort((a, b) => b.value - a.value);
  }, [filteredExpenses, filteredRecurringExpenses, cards, monthsInPeriod, periodType]);

  // Dados por membro
  const memberData = useMemo(() => {
    if (!isGroupContext || !groupMembers.length) return [];
    const totals: Record<string, { name: string; email: string; value: number }> = {};
    filteredExpenses.forEach(e => {
      const member = groupMembers.find(m => m.user_id === e.user_id);
      const email = member?.user_email || 'Desconhecido';
      if (!totals[e.user_id]) totals[e.user_id] = { name: email.split('@')[0], email, value: 0 };
      totals[e.user_id].value += Number(e.amount);
    });
    const total = Object.values(totals).reduce((s, i) => s + i.value, 0);
    return Object.values(totals).filter(i => i.value > 0).map(i => ({
      ...i, value: Number(i.value.toFixed(2)),
      percentage: total > 0 ? ((i.value / total) * 100).toFixed(1) : "0",
    })).sort((a, b) => b.value - a.value);
  }, [filteredExpenses, groupMembers, isGroupContext]);

  // Top 10 maiores gastos
  const topExpenses = useMemo(() => {
    const all = [
      ...filteredExpenses.map(e => ({ description: e.description, amount: Number(e.amount), date: e.expense_date, type: 'expense' as const })),
      ...filteredRecurringExpenses.map(r => ({ description: r.description, amount: Number(r.amount), date: `Dia ${r.day_of_month}`, type: 'recurring' as const })),
    ];
    return all.sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [filteredExpenses, filteredRecurringExpenses]);

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const formatDelta = (delta: number | null) => {
    if (delta === null) return null;
    const sign = delta >= 0 ? "↑" : "↓";
    return `${sign} ${Math.abs(delta).toFixed(0)}%`;
  };

  const tooltipStyle = {
    contentStyle: { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' },
    labelStyle: { color: 'hsl(var(--foreground))' },
    itemStyle: { color: 'hsl(var(--foreground))' }
  };

  const getSavingsInterpretation = (rate: number) => {
    if (rate < 0) return { text: "Você gastou mais do que ganhou", color: "text-red-500" };
    if (rate < 10) return { text: "Tente reservar mais", color: "text-orange-500" };
    if (rate < 20) return { text: "Bom ritmo!", color: "text-blue-500" };
    return { text: "Excelente! 🎉", color: "text-green-500" };
  };

  const renderPremiumLock = (description: string) => (
    <div className="h-[200px] flex flex-col items-center justify-center gap-4 text-center px-4">
      <Lock className="h-12 w-12 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-semibold mb-1">Recurso Premium</p>
        <p className="text-xs text-muted-foreground mb-3">{description}</p>
        <Button variant="default" size="sm" onClick={() => navigate("/subscription")} className="gap-2">
          <Crown className="h-4 w-4" />
          Fazer Upgrade
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* === BLOCO 1A: Resumo Inteligente === */}
      {totalPeriod > 0 && (
        <div className="p-4 rounded-lg bg-card border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-semibold">Resumo Inteligente</span>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Você gastou <span className="font-semibold text-red-500">{formatCurrency(totalPeriod)}</span>
              {expenseDelta !== null && (
                <span className={expenseDelta >= 0 ? "text-red-500" : "text-green-500"}>
                  {" "}({formatDelta(expenseDelta)} vs anterior)
                </span>
              )}
            </p>
            {topCategory && (
              <p>
                Maior categoria: <span className="font-semibold text-foreground">{topCategory.name}</span> ({topCategory.pct}%)
              </p>
            )}
            {mostExpensiveDay && (
              <p>
                Dia mais caro: <span className="font-semibold text-foreground">{mostExpensiveDay.date}</span> ({formatCurrency(mostExpensiveDay.value)})
              </p>
            )}
          </div>
        </div>
      )}

      {/* === BLOCO 1B: Resumo do Período (1 card, 3 colunas) === */}
      <div className="p-4 rounded-lg bg-card border border-border">
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* Entradas */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-xs text-muted-foreground">Entradas</span>
            </div>
            <div className="text-lg font-bold text-green-500">{formatCurrency(totalIncomes)}</div>
            <div className="text-[10px] text-muted-foreground">{filteredIncomes.length}+{filteredRecurringIncomes.length} fixas</div>
          </div>

          {/* Separator + Saídas */}
          <div className="space-y-1 border-x border-border">
            <div className="flex items-center justify-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500" />
              <span className="text-xs text-muted-foreground">Saídas</span>
            </div>
            <div className="text-lg font-bold text-red-500">{formatCurrency(totalPeriod)}</div>
            <div className="text-[10px] text-muted-foreground">{filteredExpenses.length}+{filteredRecurringExpenses.length} fixas</div>
          </div>

          {/* Saldo */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <DollarSign className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-muted-foreground">Saldo</span>
            </div>
            <div className={`text-lg font-bold ${balance >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>
              {formatCurrency(balance)}
            </div>
            <div className="text-[10px] text-muted-foreground">{periodLabel || "Período"}</div>
          </div>
        </div>

        {/* Economia + Comparação */}
        <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-xs text-muted-foreground">
          {totalIncomes > 0 && (
            <p>
              Economia: <span className={`font-semibold ${savingsRate >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                {savingsRate.toFixed(0)}% da renda
              </span>
            </p>
          )}
          {previousPeriodDates && (incomeDelta !== null || expenseDelta !== null) && (
            <p className="flex flex-wrap gap-x-3">
              {incomeDelta !== null && (
                <span>Entradas <span className={incomeDelta >= 0 ? 'text-green-500' : 'text-red-500'}>{formatDelta(incomeDelta)}</span></span>
              )}
              {expenseDelta !== null && (
                <span>Saídas <span className={expenseDelta <= 0 ? 'text-green-500' : 'text-red-500'}>{formatDelta(expenseDelta)}</span></span>
              )}
              {balanceDelta !== null && (
                <span>Saldo <span className={balanceDelta >= 0 ? 'text-blue-500' : 'text-orange-500'}>{formatDelta(balanceDelta)}</span></span>
              )}
            </p>
          )}
        </div>
      </div>

      <Accordion type="multiple" className="space-y-3" defaultValue={["category", "payment-method"]}>
        {/* === BLOCO 2A: Gastos por Categoria — Barras Horizontais === */}
        <AccordionItem value="category" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-orange-500" />
              <div className="text-left">
                <span className="font-semibold">Gastos por Categoria</span>
                <span className="text-xs text-muted-foreground block">{categoryData.length} categorias</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {categoryData.length > 0 ? (
              <div className="space-y-3">
                {categoryData.map((cat, i) => {
                  const maxValue = categoryData[0]?.value || 1;
                  const barWidth = (cat.value / maxValue) * 100;
                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 truncate">
                          <span>{cat.icon}</span>
                          <span className="truncate">{cat.name}</span>
                        </span>
                        <span className="font-semibold whitespace-nowrap ml-2">
                          {formatCurrency(cat.value)} <span className="text-muted-foreground font-normal text-xs">({cat.percentage.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">Nenhum gasto no período</div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* === BLOCO 2B: Gastos por Forma de Pagamento — Barras Horizontais === */}
        <AccordionItem value="payment-method" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-blue-500" />
              <div className="text-left">
                <span className="font-semibold">Forma de Pagamento</span>
                <span className="text-xs text-muted-foreground block">{formatCurrency(totalPeriod)} no período</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {paymentMethodData.length > 0 ? (
              <div className="space-y-3">
                {paymentMethodData.map((pm) => {
                  const maxValue = paymentMethodData[0]?.value || 1;
                  const barWidth = (pm.value / maxValue) * 100;
                  return (
                    <div key={pm.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{pm.name}</span>
                        <span className="font-semibold whitespace-nowrap">
                          {formatCurrency(pm.value)} <span className="text-muted-foreground font-normal text-xs">({pm.percentage.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%`, backgroundColor: COLORS[pm.method] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">Nenhum gasto no período</div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* === BLOCO 2C: Gastos por Cartão — Donut melhorado === */}
        {cards.length > 0 && cardData.length > 0 && (
          <AccordionItem value="cards" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-orange-500" />
                <div className="text-left">
                  <span className="font-semibold">Gastos por Cartão</span>
                  <span className="text-xs text-muted-foreground block">{cardData.length} cartões</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={cardData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                      {cardData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-2 mt-2">
                  {cardData.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="font-semibold whitespace-nowrap">{formatCurrency(c.value)} <span className="text-xs text-muted-foreground font-normal">({c.percentage}%)</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* === BLOCO 3A: Fluxo de Caixa === */}
        <AccordionItem value="cashflow" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <ArrowUpDown className="w-5 h-5 text-blue-500" />
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Fluxo de Caixa</span>
                  {!hasAdvancedReports && <Crown className="h-4 w-4 text-yellow-500" />}
                </div>
                <span className="text-xs text-muted-foreground">Entradas vs Saídas</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {hasAdvancedReports ? (
              <>
                <div className="flex justify-end mb-3">
                  <ToggleGroup type="single" value={cashFlowMode} onValueChange={(v) => v && setCashFlowMode(v as "daily" | "cumulative")} size="sm" className="bg-muted rounded-lg p-0.5">
                    <ToggleGroupItem value="daily" className="text-xs px-3 data-[state=on]:bg-background rounded-md">Por dia</ToggleGroupItem>
                    <ToggleGroupItem value="cumulative" className="text-xs px-3 data-[state=on]:bg-background rounded-md">Acumulado</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                {cashFlowData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={cashFlowData}>
                      <CartesianGrid strokeDasharray="6 6" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" style={{ fontSize: '10px' }} interval={periodType === "month" ? 2 : 0} />
                      <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: '10px' }} tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                      <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name === 'entradas' ? 'Entradas' : 'Saídas']} labelFormatter={(l) => periodType === "month" ? `Dia ${l}` : l} {...tooltipStyle} />
                      <Legend formatter={(v) => v === 'entradas' ? 'Entradas' : 'Saídas'} />
                      <Bar dataKey="entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="saidas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Nenhum dado no período</div>
                )}
              </>
            ) : renderPremiumLock("Compare entradas e saídas ao longo do tempo")}
          </AccordionContent>
        </AccordionItem>

        {/* === BLOCO 2D: Evolução dos Gastos (cor vermelha + média) === */}
        <AccordionItem value="evolution" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-red-500" />
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Evolução dos Gastos</span>
                  {!hasAdvancedReports && <Crown className="h-4 w-4 text-yellow-500" />}
                </div>
                <span className="text-xs text-muted-foreground">Gastos por {periodType === "month" ? "dia" : "mês"}</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {hasAdvancedReports ? (
              evolutionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="6 6" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" style={{ fontSize: '10px' }} interval={periodType === "month" ? 2 : 0} />
                    <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: '10px' }} tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), 'Total']} labelFormatter={(l) => periodType === "month" ? `Dia ${l}` : l} {...tooltipStyle} />
                    <ReferenceLine y={dailyAverage} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: `Média: ${formatCurrency(dailyAverage)}`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }} />
                    <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2.5} dot={{ fill: '#ef4444', r: periodType === "month" ? 2 : 4 }} activeDot={{ r: 6 }} name="Gastos" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Nenhum gasto no período</div>
              )
            ) : renderPremiumLock("Acompanhe a evolução dos seus gastos")}
          </AccordionContent>
        </AccordionItem>

        {/* === BLOCO 4B: Maiores Gastos (Top 10) === */}
        <AccordionItem value="top-expenses" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <div className="text-left">
                <span className="font-semibold">Maiores Gastos</span>
                <span className="text-xs text-muted-foreground block">Top 10 do período</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {topExpenses.length > 0 ? (
              <div className="space-y-2">
                {topExpenses.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.type === 'recurring' ? e.date : format(parseLocalDate(e.date), "dd/MM/yyyy")}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-red-500 whitespace-nowrap">{formatCurrency(e.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">Nenhum gasto no período</div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* === BLOCO 4A: Comparação com período anterior === */}
        {previousPeriodDates && (previousTotalExpenses > 0 || previousTotalIncomes > 0) && (
          <AccordionItem value="comparison" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-blue-500" />
                <div className="text-left">
                  <span className="font-semibold">Comparação</span>
                  <span className="text-xs text-muted-foreground block">vs período anterior</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                {[
                  { label: "Entradas", current: totalIncomes, previous: previousTotalIncomes, delta: incomeDelta, goodUp: true },
                  { label: "Saídas", current: totalPeriod, previous: previousTotalExpenses, delta: expenseDelta, goodUp: false },
                  { label: "Saldo", current: balance, previous: previousBalance, delta: balanceDelta, goodUp: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-semibold">{formatCurrency(item.current)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Anterior: {formatCurrency(item.previous)}</p>
                      {item.delta !== null && (
                        <p className={`text-sm font-semibold ${
                          item.goodUp 
                            ? (item.delta >= 0 ? 'text-green-500' : 'text-red-500')
                            : (item.delta <= 0 ? 'text-green-500' : 'text-red-500')
                        }`}>
                          {formatDelta(item.delta)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* === BLOCO 4C: Taxa de Economia === */}
        {totalIncomes > 0 && (
          <AccordionItem value="savings-rate" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-blue-500" />
                <div className="text-left">
                  <span className="font-semibold">Taxa de Economia</span>
                  <span className="text-xs text-muted-foreground block">Savings rate do período</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="text-center space-y-3">
                <div className={`text-4xl font-bold ${getSavingsInterpretation(savingsRate).color}`}>
                  {savingsRate.toFixed(0)}%
                </div>
                <Progress value={Math.min(Math.max(savingsRate, 0), 100)} className="h-2" />
                <p className={`text-sm font-medium ${getSavingsInterpretation(savingsRate).color}`}>
                  {getSavingsInterpretation(savingsRate).text}
                </p>
                <p className="text-xs text-muted-foreground">
                  Você economizou {formatCurrency(Math.max(balance, 0))} de {formatCurrency(totalIncomes)} em entradas
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* === Gastos por Membro (grupo) === */}
        {isGroupContext && memberData.length > 0 && (
          <AccordionItem value="members" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-500" />
                <div className="text-left">
                  <span className="font-semibold">Gastos por Membro</span>
                  <span className="text-xs text-muted-foreground block">{groupMembers.length} membros</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-2">
                {memberData.map((member, index) => (
                  <div key={member.email} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MEMBER_COLORS[index % MEMBER_COLORS.length] }} />
                      <span className="text-sm font-medium">{member.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold">{formatCurrency(member.value)}</span>
                      <Badge variant="secondary" className="ml-2 text-xs">{member.percentage}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* === BLOCO 5: Despesas Fixas/Recorrentes === */}
        <AccordionItem value="recurring" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <CalendarClock className="w-5 h-5 text-teal-500" />
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Despesas Fixas</span>
                  <Button variant="link" size="sm" className="text-xs text-muted-foreground p-0 h-auto" onClick={(e) => { e.stopPropagation(); navigate("/"); }}>
                    Gerenciar
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground block">{filteredRecurringExpenses.length} despesas ativas</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {filteredRecurringExpenses.length > 0 ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-xs text-muted-foreground">
                    {periodType === "month" ? "Total Mensal" : `Total (${monthsInPeriod} ${monthsInPeriod === 1 ? 'mês' : 'meses'})`}
                  </div>
                  <div className="text-xl font-bold text-red-500">
                    {formatCurrency(filteredRecurringExpenses.reduce((s, e) => s + Number(e.amount), 0) * (periodType === "month" ? 1 : monthsInPeriod))}
                  </div>
                </div>
                {filteredRecurringExpenses.sort((a, b) => Number(b.amount) - Number(a.amount)).map((expense) => {
                  const card = cards.find(c => c.id === expense.card_id);
                  const today = new Date().getDate();
                  const daysUntil = expense.day_of_month >= today ? expense.day_of_month - today : (30 - today) + expense.day_of_month;
                  const isPaid = expense.day_of_month < today;
                  return (
                    <div key={expense.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{expense.description}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant={isPaid ? "secondary" : "outline"} className="text-[10px]">
                            {isPaid ? "Paga" : "Pendente"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {isPaid ? `Dia ${expense.day_of_month}` : `Vence em ${daysUntil}d`}
                          </span>
                          {card && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} />
                              {card.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm text-red-500">{formatCurrency(Number(expense.amount))}</div>
                        <Badge variant="secondary" className="text-[10px]">{paymentMethodLabels[expense.payment_method]}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">Nenhuma despesa fixa ativa</div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
