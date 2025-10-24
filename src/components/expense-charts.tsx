import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Expense, PaymentMethod, ExpenseCategory, categoryLabels } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from "recharts";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { filterExpensesByBillingPeriod } from "@/utils/billing-period";
import { BarChart3, TrendingUp, PieChartIcon } from "lucide-react";

interface ExpenseChartsProps {
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  billingPeriod?: string;
  startDate?: Date;
  endDate?: Date;
  creditCardConfig?: {
    opening_day: number;
    closing_day: number;
  };
  paymentMethod?: PaymentMethod;
  category?: ExpenseCategory;
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

const paymentMethodLabels: Record<PaymentMethod, string> = {
  credit: "Crédito",
  debit: "Débito",
  pix: "PIX"
};

export function ExpenseCharts({ 
  expenses, 
  recurringExpenses,
  billingPeriod,
  startDate,
  endDate,
  creditCardConfig,
  paymentMethod,
  category
}: ExpenseChartsProps) {
  
  // Filtrar despesas para o período selecionado
  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses];

    if (billingPeriod && creditCardConfig) {
      filtered = filterExpensesByBillingPeriod(filtered, billingPeriod, creditCardConfig) as Expense[];
    } else {
      if (startDate) {
        filtered = filtered.filter(e => new Date(e.expense_date) >= startDate);
      }
      if (endDate) {
        filtered = filtered.filter(e => new Date(e.expense_date) <= endDate);
      }
    }

    // Aplicar filtros adicionais
    if (paymentMethod) {
      filtered = filtered.filter(e => e.payment_method === paymentMethod);
    }

    if (category) {
      filtered = filtered.filter(e => e.category === category);
    }

    return filtered;
  }, [expenses, billingPeriod, startDate, endDate, creditCardConfig, paymentMethod, category]);

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

    return Object.entries(totals)
      .filter(([_, value]) => value > 0)
      .map(([method, value]) => ({
        name: paymentMethodLabels[method as PaymentMethod],
        value: Number(value.toFixed(2)),
        percentage: 0 // Será calculado depois
      }));
  }, [filteredExpenses]);

  // Calcular percentuais
  const paymentMethodDataWithPercentage = useMemo(() => {
    const total = paymentMethodData.reduce((sum, item) => sum + item.value, 0);
    return paymentMethodData.map(item => ({
      ...item,
      percentage: total > 0 ? ((item.value / total) * 100).toFixed(1) : 0
    }));
  }, [paymentMethodData]);

  // Dados para gráfico de pizza - Por categoria
  const categoryData = useMemo(() => {
    const totals: Partial<Record<ExpenseCategory, number>> = {};

    filteredExpenses.forEach(expense => {
      const category = expense.category || 'outros';
      totals[category] = (totals[category] || 0) + Number(expense.amount);
    });

    const total = Object.values(totals).reduce((sum, value) => sum + value, 0);

    return Object.entries(totals)
      .filter(([_, value]) => value > 0)
      .map(([category, value]) => ({
        name: categoryLabels[category as ExpenseCategory],
        value: Number(value.toFixed(2)),
        percentage: total > 0 ? ((value / total) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // Dados para gráfico de linha - Gastos ao longo dos meses
  const monthlyData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date()
    });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const monthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.expense_date);
        return expenseDate >= monthStart && expenseDate <= monthEnd;
      });

      const total = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

      return {
        month: format(month, "MMM/yy", { locale: ptBR }),
        total: Number(total.toFixed(2)),
        count: monthExpenses.length
      };
    });
  }, [expenses]);

  // Dados para comparação mês a mês
  const monthComparison = useMemo(() => {
    if (monthlyData.length < 2) return null;

    const currentMonth = monthlyData[monthlyData.length - 1];
    const previousMonth = monthlyData[monthlyData.length - 2];
    
    const difference = currentMonth.total - previousMonth.total;
    const percentageChange = previousMonth.total > 0 
      ? ((difference / previousMonth.total) * 100).toFixed(1)
      : "0";

    return {
      current: currentMonth,
      previous: previousMonth,
      difference,
      percentageChange,
      isIncrease: difference > 0
    };
  }, [monthlyData]);

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Gráfico de Pizza - Formas de Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="w-5 h-5" />
            Gastos por Forma de Pagamento
          </CardTitle>
          <CardDescription>
            Distribuição dos gastos por método de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paymentMethodDataWithPercentage.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={paymentMethodDataWithPercentage}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentMethodDataWithPercentage.map((entry, index) => {
                    const method = entry.name.toLowerCase() as 'crédito' | 'débito' | 'pix';
                    const colorKey = method === 'crédito' ? 'credit' : method === 'débito' ? 'debit' : 'pix';
                    return <Cell key={`cell-${index}`} fill={COLORS[colorKey]} />;
                  })}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `R$ ${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Nenhum gasto registrado no período
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Pizza - Categorias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Gastos por Categoria
          </CardTitle>
          <CardDescription>
            Distribuição dos gastos por categoria
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Nenhum gasto registrado no período
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Linha - Evolução Mensal */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Evolução dos Gastos (Últimos 6 Meses)
          </CardTitle>
          <CardDescription>
            Acompanhe a evolução dos seus gastos ao longo do tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          {monthlyData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="month" 
                    stroke="hsl(var(--foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--foreground))"
                    style={{ fontSize: '12px' }}
                    tickFormatter={(value) => `R$ ${value.toFixed(0)}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Total']}
                    labelFormatter={(label) => `Mês: ${label}`}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', r: 5 }}
                    activeDot={{ r: 8 }}
                    name="Total Gasto"
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Comparação Mês a Mês */}
              {monthComparison && (
                <div className="mt-6 p-4 rounded-lg bg-muted">
                  <h4 className="font-semibold mb-3">Comparação Mês a Mês</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-3 rounded-md bg-background">
                      <div className="text-sm text-muted-foreground mb-1">Mês Anterior</div>
                      <div className="text-xl font-bold">R$ {monthComparison.previous.total.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{monthComparison.previous.count} gastos</div>
                    </div>
                    <div className="p-3 rounded-md bg-background">
                      <div className="text-sm text-muted-foreground mb-1">Mês Atual</div>
                      <div className="text-xl font-bold">R$ {monthComparison.current.total.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{monthComparison.current.count} gastos</div>
                    </div>
                    <div className={`p-3 rounded-md ${monthComparison.isIncrease ? 'bg-red-50 dark:bg-red-950/20' : 'bg-green-50 dark:bg-green-950/20'}`}>
                      <div className="text-sm text-muted-foreground mb-1">Variação</div>
                      <div className={`text-xl font-bold ${monthComparison.isIncrease ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {monthComparison.isIncrease ? '+' : ''} R$ {monthComparison.difference.toFixed(2)}
                      </div>
                      <div className={`text-xs font-semibold ${monthComparison.isIncrease ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {monthComparison.isIncrease ? '↑' : '↓'} {Math.abs(Number(monthComparison.percentageChange))}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Nenhum gasto registrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}