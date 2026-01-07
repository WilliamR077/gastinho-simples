import { useMemo } from "react";
import { Card as CardType } from "@/types/card";
import { Expense, PaymentMethod, ExpenseCategory, categoryLabels } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { Income, RecurringIncome, incomeCategoryLabels } from "@/types/income";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, TrendingUp, TrendingDown, PieChartIcon, Crown, Lock, CreditCard, Users, CalendarClock, DollarSign, ArrowUpDown } from "lucide-react";
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
  pix: "#10b981",
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

  // Helper para obter info da categoria
  const getCategoryInfo = (categoryId: string | null | undefined, categoryEnum: ExpenseCategory | null | undefined) => {
    // Primeiro tentar pelo category_id
    if (categoryId && categories.length > 0) {
      const found = categories.find(c => c.id === categoryId);
      if (found) {
        return { id: found.id, name: found.name, icon: found.icon };
      }
    }
    
    // Fallback para o enum antigo
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
      
      // Parse start_date - se não existir, usa created_at
      const startDateRe = re.start_date 
        ? parseISO(re.start_date) 
        : parseLocalDate(re.created_at);
      
      // Parse end_date - se não existir, está ativa até agora
      const endDateRe = re.end_date ? parseISO(re.end_date) : null;
      
      // A despesa precisa ter começado antes ou durante o período selecionado
      const startedBeforeOrDuring = startDateRe <= endDate;
      
      // A despesa não pode ter terminado antes do início do período
      const notEndedBeforePeriod = !endDateRe || endDateRe >= startDate;
      
      return startedBeforeOrDuring && notEndedBeforePeriod;
    });
  }, [recurringExpenses, startDate, endDate]);

  // Calcular número de meses no período para despesas recorrentes
  const monthsInPeriod = useMemo(() => {
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    return months.length;
  }, [startDate, endDate]);

  // Filtrar entradas para o período selecionado
  const filteredIncomes = useMemo(() => {
    return incomes.filter(i => {
      const incomeDate = parseLocalDate(i.income_date);
      return incomeDate >= startDate && incomeDate <= endDate;
    });
  }, [incomes, startDate, endDate]);

  // Filtrar entradas recorrentes por start_date e end_date
  const filteredRecurringIncomes = useMemo(() => {
    return recurringIncomes.filter(ri => {
      if (!ri.is_active && !ri.end_date) return false;
      
      const startDateRi = ri.start_date 
        ? parseISO(ri.start_date) 
        : parseLocalDate(ri.created_at);
      
      const endDateRi = ri.end_date ? parseISO(ri.end_date) : null;
      
      const startedBeforeOrDuring = startDateRi <= endDate;
      const notEndedBeforePeriod = !endDateRi || endDateRi >= startDate;
      
      return startedBeforeOrDuring && notEndedBeforePeriod;
    });
  }, [recurringIncomes, startDate, endDate]);

  // Total geral do período (despesas + recorrentes * meses)
  const totalPeriod = useMemo(() => {
    const expensesTotal = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const recurringTotal = filteredRecurringExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    
    // Para períodos > 1 mês, multiplicar despesas recorrentes pelo número de meses
    const recurringPeriodTotal = periodType === "month" 
      ? recurringTotal 
      : recurringTotal * monthsInPeriod;
    
    return expensesTotal + recurringPeriodTotal;
  }, [filteredExpenses, filteredRecurringExpenses, monthsInPeriod, periodType]);

  // Total de entradas do período
  const totalIncomes = useMemo(() => {
    const incomesTotal = filteredIncomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const recurringTotal = filteredRecurringIncomes.reduce((sum, i) => sum + Number(i.amount), 0);
    
    const recurringPeriodTotal = periodType === "month" 
      ? recurringTotal 
      : recurringTotal * monthsInPeriod;
    
    return incomesTotal + recurringPeriodTotal;
  }, [filteredIncomes, filteredRecurringIncomes, monthsInPeriod, periodType]);

  // Saldo do período
  const balance = useMemo(() => {
    return totalIncomes - totalPeriod;
  }, [totalIncomes, totalPeriod]);

  // Dados para gráfico de fluxo de caixa (entradas vs saídas por período)
  const cashFlowData = useMemo(() => {
    if (periodType === "month") {
      // Para mês: mostrar por DIA
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      
      return days.map(day => {
        const dayExpenses = filteredExpenses.filter(expense => {
          const expenseDate = parseLocalDate(expense.expense_date);
          return isSameDay(expenseDate, day);
        });
        
        const dayIncomes = filteredIncomes.filter(income => {
          const incomeDate = parseLocalDate(income.income_date);
          return isSameDay(incomeDate, day);
        });
        
        const expenses = dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        const incomes = dayIncomes.reduce((sum, i) => sum + Number(i.amount), 0);
        
        return {
          label: format(day, "dd"),
          entradas: Number(incomes.toFixed(2)),
          saidas: Number(expenses.toFixed(2)),
          saldo: Number((incomes - expenses).toFixed(2))
        };
      });
    } else {
      // Para ano/trimestre/personalizado: mostrar por MÊS
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      
      return months.map(month => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);

        const monthExpenses = filteredExpenses.filter(expense => {
          const expenseDate = parseLocalDate(expense.expense_date);
          return expenseDate >= monthStart && expenseDate <= monthEnd;
        });

        const monthIncomes = filteredIncomes.filter(income => {
          const incomeDate = parseLocalDate(income.income_date);
          return incomeDate >= monthStart && incomeDate <= monthEnd;
        });

        let totalExpenses = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
        let totalIncomesMonth = monthIncomes.reduce((sum, income) => sum + Number(income.amount), 0);
        
        // Adicionar despesas recorrentes que estavam ativas naquele mês
        filteredRecurringExpenses.forEach(recurring => {
          const startDateRe = recurring.start_date 
            ? parseISO(recurring.start_date) 
            : parseLocalDate(recurring.created_at);
          const endDateRe = recurring.end_date ? parseISO(recurring.end_date) : null;
          
          const wasActiveInMonth = startDateRe <= monthEnd && (!endDateRe || endDateRe >= monthStart);
          
          if (wasActiveInMonth) {
            totalExpenses += Number(recurring.amount);
          }
        });

        // Adicionar entradas recorrentes que estavam ativas naquele mês
        filteredRecurringIncomes.forEach(recurring => {
          const startDateRi = recurring.start_date 
            ? parseISO(recurring.start_date) 
            : parseLocalDate(recurring.created_at);
          const endDateRi = recurring.end_date ? parseISO(recurring.end_date) : null;
          
          const wasActiveInMonth = startDateRi <= monthEnd && (!endDateRi || endDateRi >= monthStart);
          
          if (wasActiveInMonth) {
            totalIncomesMonth += Number(recurring.amount);
          }
        });

        return {
          label: format(month, "MMM/yy", { locale: ptBR }),
          entradas: Number(totalIncomesMonth.toFixed(2)),
          saidas: Number(totalExpenses.toFixed(2)),
          saldo: Number((totalIncomesMonth - totalExpenses).toFixed(2))
        };
      });
    }
  }, [filteredExpenses, filteredIncomes, filteredRecurringExpenses, filteredRecurringIncomes, startDate, endDate, periodType]);

  // Dados para gráfico de pizza - Por forma de pagamento
  const paymentMethodData = useMemo(() => {
    const totals: Record<PaymentMethod, number> = {
      credit: 0,
      debit: 0,
      pix: 0
    };

    filteredExpenses.forEach(expense => {
      totals[expense.payment_method] += Number(expense.amount);
    });

    // Multiplicar recorrentes pelos meses no período
    const recurringMultiplier = periodType === "month" ? 1 : monthsInPeriod;
    filteredRecurringExpenses.forEach(recurring => {
      totals[recurring.payment_method] += Number(recurring.amount) * recurringMultiplier;
    });

    const total = Object.values(totals).reduce((sum, v) => sum + v, 0);

    return Object.entries(totals)
      .filter(([_, value]) => value > 0)
      .map(([method, value]) => ({
        name: paymentMethodLabels[method as PaymentMethod],
        value: Number(value.toFixed(2)),
        percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0"
      }));
  }, [filteredExpenses, filteredRecurringExpenses, monthsInPeriod, periodType]);

  // Dados para gráfico de pizza - Por categoria (usando category_id)
  const categoryData = useMemo(() => {
    const totals: Record<string, { name: string; icon: string; value: number }> = {};

    filteredExpenses.forEach(expense => {
      const catInfo = getCategoryInfo(expense.category_id, expense.category);
      if (!totals[catInfo.id]) {
        totals[catInfo.id] = { name: catInfo.name, icon: catInfo.icon, value: 0 };
      }
      totals[catInfo.id].value += Number(expense.amount);
    });

    const recurringMultiplier = periodType === "month" ? 1 : monthsInPeriod;
    filteredRecurringExpenses.forEach(recurring => {
      const catInfo = getCategoryInfo(recurring.category_id, recurring.category);
      if (!totals[catInfo.id]) {
        totals[catInfo.id] = { name: catInfo.name, icon: catInfo.icon, value: 0 };
      }
      totals[catInfo.id].value += Number(recurring.amount) * recurringMultiplier;
    });

    const total = Object.values(totals).reduce((sum, item) => sum + item.value, 0);

    return Object.values(totals)
      .filter(item => item.value > 0)
      .map(item => ({
        name: `${item.icon} ${item.name}`,
        value: Number(item.value.toFixed(2)),
        percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0"
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses, filteredRecurringExpenses, monthsInPeriod, periodType, categories]);

  // Dados para gráfico de pizza - Por cartão
  const cardData = useMemo(() => {
    const totals: Record<string, { name: string; color: string; value: number }> = {};
    
    // Adicionar "Sem cartão" para despesas sem card_id
    totals['no-card'] = { name: 'Sem cartão', color: '#9ca3af', value: 0 };

    filteredExpenses.forEach(expense => {
      if (expense.card_id) {
        const card = cards.find(c => c.id === expense.card_id);
        if (card) {
          if (!totals[card.id]) {
            totals[card.id] = { name: card.name, color: card.color, value: 0 };
          }
          totals[card.id].value += Number(expense.amount);
        }
      } else {
        totals['no-card'].value += Number(expense.amount);
      }
    });

    const recurringMultiplier = periodType === "month" ? 1 : monthsInPeriod;
    filteredRecurringExpenses.forEach(recurring => {
      if (recurring.card_id) {
        const card = cards.find(c => c.id === recurring.card_id);
        if (card) {
          if (!totals[card.id]) {
            totals[card.id] = { name: card.name, color: card.color, value: 0 };
          }
          totals[card.id].value += Number(recurring.amount) * recurringMultiplier;
        }
      } else {
        totals['no-card'].value += Number(recurring.amount) * recurringMultiplier;
      }
    });

    const total = Object.values(totals).reduce((sum, item) => sum + item.value, 0);

    return Object.values(totals)
      .filter(item => item.value > 0)
      .map(item => ({
        ...item,
        value: Number(item.value.toFixed(2)),
        percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0"
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses, filteredRecurringExpenses, cards, monthsInPeriod, periodType]);

  // Dados para gráfico de pizza - Por membro do grupo
  const memberData = useMemo(() => {
    if (!isGroupContext || !groupMembers.length) return [];
    
    const totals: Record<string, { name: string; email: string; value: number }> = {};
    
    filteredExpenses.forEach(expense => {
      const member = groupMembers.find(m => m.user_id === expense.user_id);
      const email = member?.user_email || 'Desconhecido';
      const name = email.split('@')[0];
      
      if (!totals[expense.user_id]) {
        totals[expense.user_id] = { name, email, value: 0 };
      }
      totals[expense.user_id].value += Number(expense.amount);
    });

    const total = Object.values(totals).reduce((sum, item) => sum + item.value, 0);

    return Object.values(totals)
      .filter(item => item.value > 0)
      .map(item => ({
        ...item,
        value: Number(item.value.toFixed(2)),
        percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0"
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses, groupMembers, isGroupContext]);

  // Dados para gráfico de evolução - ADAPTADO ao tipo de período
  const evolutionData = useMemo(() => {
    if (periodType === "month") {
      // Para mês: mostrar gastos por DIA
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      
      return days.map(day => {
        const dayExpenses = filteredExpenses.filter(expense => {
          const expenseDate = parseLocalDate(expense.expense_date);
          return isSameDay(expenseDate, day);
        });
        
        const total = dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        
        return {
          label: format(day, "dd"),
          total: Number(total.toFixed(2)),
          count: dayExpenses.length
        };
      });
    } else if (periodType === "year" || periodType === "quarter" || periodType === "custom" || periodType === "all") {
      // Para ano/trimestre/personalizado/all: mostrar gastos por MÊS
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      
      return months.map(month => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);

        const monthExpenses = filteredExpenses.filter(expense => {
          const expenseDate = parseLocalDate(expense.expense_date);
          return expenseDate >= monthStart && expenseDate <= monthEnd;
        });

        let total = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
        
        // Adicionar despesas recorrentes que estavam ativas naquele mês
        filteredRecurringExpenses.forEach(recurring => {
          const startDateRe = recurring.start_date 
            ? parseISO(recurring.start_date) 
            : parseLocalDate(recurring.created_at);
          const endDateRe = recurring.end_date ? parseISO(recurring.end_date) : null;
          
          // Verificar se a despesa estava ativa naquele mês específico
          const wasActiveInMonth = startDateRe <= monthEnd && (!endDateRe || endDateRe >= monthStart);
          
          if (wasActiveInMonth) {
            total += Number(recurring.amount);
          }
        });

        return {
          label: format(month, "MMM/yy", { locale: ptBR }),
          total: Number(total.toFixed(2)),
          count: monthExpenses.length
        };
      });
    }
    
    return [];
  }, [filteredExpenses, filteredRecurringExpenses, startDate, endDate, periodType]);

  // Label dinâmico para o gráfico de evolução
  const evolutionChartTitle = useMemo(() => {
    switch (periodType) {
      case "month":
        return periodLabel ? `Evolução dos Gastos - ${periodLabel}` : "Evolução dos Gastos por Dia";
      case "year":
        return `Evolução dos Gastos - ${periodLabel}`;
      case "quarter":
        return `Evolução dos Gastos - ${periodLabel}`;
      case "custom":
        return `Evolução dos Gastos - ${periodLabel}`;
      case "all":
        return "Evolução dos Gastos - Todo o Histórico";
      default:
        return "Evolução dos Gastos";
    }
  }, [periodType, periodLabel]);

  const evolutionSubtitle = useMemo(() => {
    switch (periodType) {
      case "month":
        return "Gastos por dia";
      case "year":
        return "Gastos por mês";
      case "quarter":
        return "Gastos por mês";
      case "custom":
        return "Gastos por mês";
      case "all":
        return "Gastos por mês";
      default:
        return "";
    }
  }, [periodType]);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percentage }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (Number(percentage) < 5) return null;

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-semibold"
      >
        {`${percentage}%`}
      </text>
    );
  };

  const tooltipStyle = {
    contentStyle: { 
      backgroundColor: 'hsl(var(--card))', 
      border: '1px solid hsl(var(--border))',
      color: 'hsl(var(--foreground))'
    },
    labelStyle: { color: 'hsl(var(--foreground))' },
    itemStyle: { color: 'hsl(var(--foreground))' }
  };

  return (
    <div className="space-y-4">
      {/* Card de Resumo do Período - Fluxo de Caixa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Entradas */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/20">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-xs text-muted-foreground font-medium">Entradas</span>
          </div>
          <div className="text-2xl font-bold text-green-500">
            R$ {totalIncomes.toFixed(2).replace(".", ",")}
          </div>
          <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
            <span>{filteredIncomes.length} entradas</span>
            <span>+</span>
            <span>{filteredRecurringIncomes.length} fixas</span>
          </div>
        </div>

        {/* Saídas */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-red-500/10 to-red-500/5 border border-red-500/20">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-xs text-muted-foreground font-medium">Saídas</span>
          </div>
          <div className="text-2xl font-bold text-red-500">
            R$ {totalPeriod.toFixed(2).replace(".", ",")}
          </div>
          <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
            <span>{filteredExpenses.length} despesas</span>
            <span>+</span>
            <span>{filteredRecurringExpenses.length} fixas</span>
          </div>
        </div>

        {/* Saldo */}
        <div className={`p-4 rounded-lg border ${balance >= 0 ? 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20' : 'bg-gradient-to-r from-orange-500/10 to-orange-500/5 border-orange-500/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className={`h-4 w-4 ${balance >= 0 ? 'text-primary' : 'text-orange-500'}`} />
            <span className="text-xs text-muted-foreground font-medium">Saldo</span>
          </div>
          <div className={`text-2xl font-bold ${balance >= 0 ? 'text-primary' : 'text-orange-500'}`}>
            R$ {balance.toFixed(2).replace(".", ",")}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {periodLabel || "Período selecionado"}
          </div>
        </div>
      </div>

      <Accordion type="multiple" className="space-y-4" defaultValue={["cashflow"]}>
        {/* 0. Fluxo de Caixa - Entradas vs Saídas */}
        <AccordionItem value="cashflow" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <ArrowUpDown className="w-5 h-5 text-primary" />
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Fluxo de Caixa</span>
                  {!hasAdvancedReports && <Crown className="h-4 w-4 text-primary" />}
                </div>
                <span className="text-xs text-muted-foreground">Entradas vs Saídas por {periodType === "month" ? "dia" : "mês"}</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {hasAdvancedReports ? (
              cashFlowData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={cashFlowData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="label" 
                      stroke="hsl(var(--foreground))"
                      style={{ fontSize: '10px' }}
                      interval={periodType === "month" ? 2 : 0}
                    />
                    <YAxis 
                      stroke="hsl(var(--foreground))"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => `R$ ${value.toFixed(0)}`}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        `R$ ${value.toFixed(2)}`,
                        name === 'entradas' ? 'Entradas' : name === 'saidas' ? 'Saídas' : 'Saldo'
                      ]}
                      labelFormatter={(label) => periodType === "month" ? `Dia ${label}` : label}
                      {...tooltipStyle}
                    />
                    <Legend 
                      formatter={(value) => value === 'entradas' ? 'Entradas' : value === 'saidas' ? 'Saídas' : 'Saldo'}
                    />
                    <Bar dataKey="entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Nenhum dado registrado no período
                </div>
              )
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center gap-4 text-center px-4">
                <Lock className="h-12 w-12 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-semibold mb-1">Recurso Premium</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Compare suas entradas e saídas ao longo do tempo
                  </p>
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => navigate("/subscription")}
                    className="gap-2"
                  >
                    <Crown className="h-4 w-4" />
                    Fazer Upgrade
                  </Button>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 1. Evolução dos Gastos - ADAPTADO AO PERÍODO */}
        <AccordionItem value="evolution" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{evolutionChartTitle}</span>
                  {!hasAdvancedReports && <Crown className="h-4 w-4 text-primary" />}
                </div>
                <span className="text-xs text-muted-foreground">{evolutionSubtitle}</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {hasAdvancedReports ? (
              evolutionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="label" 
                      stroke="hsl(var(--foreground))"
                      style={{ fontSize: '10px' }}
                      interval={periodType === "month" ? 2 : 0}
                    />
                    <YAxis 
                      stroke="hsl(var(--foreground))"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => `R$ ${value.toFixed(0)}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                      labelFormatter={(label) => periodType === "month" ? `Dia ${label}` : label}
                      {...tooltipStyle}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', r: periodType === "month" ? 2 : 5 }}
                      activeDot={{ r: 8 }}
                      name="Total Gasto"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Nenhum gasto registrado no período
                </div>
              )
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center gap-4 text-center px-4">
                <Lock className="h-12 w-12 text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-semibold mb-1">Recurso Premium</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Acompanhe a evolução dos seus gastos
                  </p>
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => navigate("/subscription")}
                    className="gap-2"
                  >
                    <Crown className="h-4 w-4" />
                    Fazer Upgrade
                  </Button>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 2. Gastos por Cartão */}
        {cards.length > 0 && (
          <AccordionItem value="cards" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-orange-500" />
                <div className="text-left">
                  <span className="font-semibold">Gastos por Cartão</span>
                  <span className="text-xs text-muted-foreground block">
                    {cardData.length} cartões utilizados
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              {cardData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={cardData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomLabel}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {cardData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                      {...tooltipStyle}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Nenhum gasto com cartão no período
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* 3. Gastos por Forma de Pagamento */}
        <AccordionItem value="payment-method" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <PieChartIcon className="w-5 h-5 text-blue-500" />
              <div className="text-left">
                <span className="font-semibold">Gastos por Forma de Pagamento</span>
                <span className="text-xs text-muted-foreground block">
                  R$ {totalPeriod.toFixed(2)} no período
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {paymentMethodData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentMethodData.map((entry, index) => {
                      const method = entry.name.toLowerCase() as 'crédito' | 'débito' | 'pix';
                      const colorKey = method === 'crédito' ? 'credit' : method === 'débito' ? 'debit' : 'pix';
                      return <Cell key={`cell-${index}`} fill={COLORS[colorKey]} />;
                    })}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                    {...tooltipStyle}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Nenhum gasto registrado no período
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 4. Gastos por Categoria */}
        <AccordionItem value="category" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-green-500" />
              <div className="text-left">
                <span className="font-semibold">Gastos por Categoria</span>
                <span className="text-xs text-muted-foreground block">
                  {categoryData.length} categorias
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                    {...tooltipStyle}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Nenhum gasto registrado no período
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* 5. Gastos por Membro do Grupo (apenas quando em contexto de grupo) */}
        {isGroupContext && groupMembers.length > 0 && (
          <AccordionItem value="members" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-500" />
                <div className="text-left">
                  <span className="font-semibold">Gastos por Membro</span>
                  <span className="text-xs text-muted-foreground block">
                    {groupMembers.length} membros no grupo
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              {memberData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={memberData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderCustomLabel}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {memberData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={MEMBER_COLORS[index % MEMBER_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number, name: string, props: any) => [
                          `R$ ${value.toFixed(2)}`,
                          props.payload.email
                        ]}
                        {...tooltipStyle}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Lista detalhada dos membros */}
                  <div className="mt-4 space-y-2">
                    {memberData.map((member, index) => (
                      <div key={member.email} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: MEMBER_COLORS[index % MEMBER_COLORS.length] }}
                          />
                          <span className="text-sm font-medium">{member.name}</span>
                          <span className="text-xs text-muted-foreground">({member.email})</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold">R$ {member.value.toFixed(2)}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">{member.percentage}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Nenhum gasto registrado pelos membros no período
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* 6. Despesas Fixas/Recorrentes - FILTRADAS PELO PERÍODO */}
        <AccordionItem value="recurring" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <CalendarClock className="w-5 h-5 text-teal-500" />
              <div className="text-left">
                <span className="font-semibold">Despesas Fixas</span>
                <span className="text-xs text-muted-foreground block">
                  {filteredRecurringExpenses.length} despesas no período
                </span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {filteredRecurringExpenses.length > 0 ? (
              <div className="space-y-3">
                {/* Total mensal */}
                <div className="p-3 rounded-lg bg-muted mb-4">
                  <div className="text-sm text-muted-foreground">
                    {periodType === "month" 
                      ? "Total Mensal em Despesas Fixas"
                      : `Total em Despesas Fixas (${monthsInPeriod} ${monthsInPeriod === 1 ? 'mês' : 'meses'})`
                    }
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    R$ {(filteredRecurringExpenses.reduce((sum, e) => sum + Number(e.amount), 0) * (periodType === "month" ? 1 : monthsInPeriod)).toFixed(2)}
                  </div>
                </div>

                {/* Lista de despesas recorrentes */}
                {filteredRecurringExpenses
                  .sort((a, b) => Number(b.amount) - Number(a.amount))
                  .map((expense) => {
                    const card = cards.find(c => c.id === expense.card_id);
                    return (
                      <div key={expense.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                        <div className="flex-1">
                          <div className="font-medium">{expense.description}</div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {categoryLabels[expense.category]}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Dia {expense.day_of_month}
                            </span>
                            {card && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <div 
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: card.color }}
                                />
                                {card.name}
                              </span>
                            )}
                            {expense.start_date && (
                              <span className="text-xs text-muted-foreground">
                                Início: {format(parseISO(expense.start_date), "dd/MM/yyyy")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">R$ {Number(expense.amount).toFixed(2)}</div>
                          <Badge 
                            variant="secondary" 
                            className="text-xs"
                          >
                            {paymentMethodLabels[expense.payment_method]}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Nenhuma despesa fixa ativa no período selecionado
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}