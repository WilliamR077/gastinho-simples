import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, Smartphone, TrendingUp, Target, Check, AlertTriangle, AlertCircle } from "lucide-react"
import { Expense, PaymentMethod, categoryLabels } from "@/types/expense"
import { RecurringExpense } from "@/types/recurring-expense"
import { calculateBillingPeriod } from "@/utils/billing-period"
import { Card as CardType } from "@/types/card"
import { BudgetGoal } from "@/types/budget-goal"
import { Progress } from "@/components/ui/progress"
import { useMemo } from "react"

interface ExpenseSummaryProps {
  expenses: Expense[]
  recurringExpenses?: RecurringExpense[]
  billingPeriod?: string
  startDate?: Date
  endDate?: Date
  creditCardConfig?: { opening_day: number; closing_day: number }
  onPaymentMethodClick?: (method: PaymentMethod) => void
  activePaymentMethod?: PaymentMethod
  budgetGoals?: BudgetGoal[]
}

export function ExpenseSummary({ 
  expenses,
  recurringExpenses = [],
  billingPeriod,
  startDate,
  endDate,
  creditCardConfig,
  onPaymentMethodClick,
  activePaymentMethod,
  budgetGoals = []
}: ExpenseSummaryProps) {
  const totals = expenses.reduce(
    (acc, expense) => {
      acc[expense.payment_method] += expense.amount
      acc.total += expense.amount
      return acc
    },
    { pix: 0, debit: 0, credit: 0, total: 0 }
  )

  // Filter and add active recurring expenses that apply to the current period
  const activeRecurringExpenses = recurringExpenses.filter(expense => {
    if (!expense.is_active) return false

    // If there's a billing period filter (for credit cards)
    if (billingPeriod && creditCardConfig) {
      const [year, month] = billingPeriod.split('-').map(Number)
      const { opening_day, closing_day } = creditCardConfig
      
      // Calculate the date range for this billing period
      let periodStart: Date
      let periodEnd: Date
      
      if (closing_day >= opening_day) {
        periodStart = new Date(year, month - 1, opening_day)
        periodEnd = new Date(year, month - 1, closing_day)
      } else {
        periodStart = new Date(year, month - 1, opening_day)
        periodEnd = new Date(year, month, closing_day)
      }
      
      // Check if the recurring expense day falls within this period
      const expenseDay = expense.day_of_month
      const startDay = periodStart.getDate()
      const endDay = periodEnd.getDate()
      
      if (closing_day >= opening_day) {
        return expenseDay >= startDay && expenseDay <= endDay
      } else {
        return expenseDay >= startDay || expenseDay <= endDay
      }
    }
    
    // If there are date filters
    if (startDate && endDate) {
      const currentYear = startDate.getFullYear()
      const currentMonth = startDate.getMonth()
      
      // Create a date for this recurring expense in the current filtered month
      const recurringDate = new Date(currentYear, currentMonth, expense.day_of_month)
      
      // Check if this date falls within the filter range
      return recurringDate >= startDate && recurringDate <= endDate
    }
    
    // If no filters, include all active recurring expenses
    return true
  })

  activeRecurringExpenses.forEach(expense => {
    totals[expense.payment_method] += expense.amount
    totals.total += expense.amount
  })

  // Calcular totais por cartão para crédito
  const creditCardTotals = expenses
    .filter(e => e.payment_method === 'credit')
    .reduce((acc, expense) => {
      const cardName = expense.card?.name || 'Sem cartão';
      const cardColor = expense.card?.color || '#FFA500';
      if (!acc[cardName]) {
        acc[cardName] = { total: 0, color: cardColor };
      }
      acc[cardName].total += expense.amount;
      return acc;
    }, {} as Record<string, { total: number; color: string }>);

  // Adicionar despesas fixas ativas de crédito aos totais por cartão
  activeRecurringExpenses
    .filter(e => e.payment_method === 'credit')
    .forEach(expense => {
      const cardName = expense.card?.name || 'Sem cartão';
      const cardColor = expense.card?.color || '#FFA500';
      if (!creditCardTotals[cardName]) {
        creditCardTotals[cardName] = { total: 0, color: cardColor };
      }
      creditCardTotals[cardName].total += expense.amount;
    });

  // Calcular totais por cartão para débito
  const debitCardTotals = expenses
    .filter(e => e.payment_method === 'debit')
    .reduce((acc, expense) => {
      const cardName = expense.card?.name || 'Sem cartão';
      const cardColor = expense.card?.color || '#3B82F6';
      if (!acc[cardName]) {
        acc[cardName] = { total: 0, color: cardColor };
      }
      acc[cardName].total += expense.amount;
      return acc;
    }, {} as Record<string, { total: number; color: string }>);

  // Adicionar despesas fixas ativas de débito aos totais por cartão
  activeRecurringExpenses
    .filter(e => e.payment_method === 'debit')
    .forEach(expense => {
      const cardName = expense.card?.name || 'Sem cartão';
      const cardColor = expense.card?.color || '#3B82F6';
      if (!debitCardTotals[cardName]) {
        debitCardTotals[cardName] = { total: 0, color: cardColor };
      }
      debitCardTotals[cardName].total += expense.amount;
    });

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const formatCurrency = (value: number) => 
    `R$ ${value.toFixed(2).replace('.', ',')}`

  const monthlyExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const expenseDate = new Date(expense.expense_date);
      return (
        expenseDate.getMonth() === currentMonth &&
        expenseDate.getFullYear() === currentYear
      );
    });
  }, [expenses, currentMonth, currentYear]);

  const recurringActive = useMemo(() => {
    return recurringExpenses.filter((re) => re.is_active);
  }, [recurringExpenses]);

  const budgetProgress = useMemo(() => {
    return budgetGoals.map((goal) => {
      let totalSpent = 0;

      if (goal.type === "monthly_total") {
        totalSpent = monthlyExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
        totalSpent += recurringActive.reduce((sum, re) => sum + Number(re.amount), 0);
      } else if (goal.type === "category" && goal.category) {
        totalSpent = monthlyExpenses
          .filter((exp) => exp.category === goal.category)
          .reduce((sum, exp) => sum + Number(exp.amount), 0);
        totalSpent += recurringActive
          .filter((re) => re.category === goal.category)
          .reduce((sum, re) => sum + Number(re.amount), 0);
      }

      const limit = Number(goal.limit_amount);
      const percentage = (totalSpent / limit) * 100;
      const remaining = limit - totalSpent;

      return { goal, totalSpent, limit, percentage, remaining };
    });
  }, [budgetGoals, monthlyExpenses, recurringActive]);

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100) return <AlertTriangle className="h-3 w-3 text-destructive" />;
    if (percentage >= 85) return <AlertCircle className="h-3 w-3 text-orange-500" />;
    if (percentage >= 70) return <AlertCircle className="h-3 w-3 text-yellow-500" />;
    return <Check className="h-3 w-3 text-success" />;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card 
        className={`bg-gradient-success border-border/50 shadow-elegant cursor-pointer hover:shadow-glow transition-all ${
          activePaymentMethod === 'pix' ? 'ring-2 ring-success ring-offset-2 ring-offset-background' : ''
        }`}
        onClick={() => onPaymentMethodClick?.('pix')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-success-foreground">PIX</CardTitle>
          <Smartphone className="h-4 w-4 text-success-foreground/80" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-success-foreground">
            {formatCurrency(totals.pix)}
          </div>
          <p className="text-xs text-success-foreground/80">
            {expenses.filter(e => e.payment_method === 'pix').length + 
             activeRecurringExpenses.filter(e => e.payment_method === 'pix').length} transações
          </p>
        </CardContent>
      </Card>

      <Card 
        className={`bg-gradient-primary border-border/50 shadow-elegant cursor-pointer hover:shadow-glow transition-all ${
          activePaymentMethod === 'debit' ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
        }`}
        onClick={() => onPaymentMethodClick?.('debit')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-primary-foreground">Débito</CardTitle>
          <CreditCard className="h-4 w-4 text-primary-foreground/80" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary-foreground">
            {formatCurrency(totals.debit)}
          </div>
          <p className="text-xs text-primary-foreground/80">
            {expenses.filter(e => e.payment_method === 'debit').length + 
             activeRecurringExpenses.filter(e => e.payment_method === 'debit').length} transações
          </p>
          {Object.keys(debitCardTotals).length > 0 && (
            <div className="mt-2 space-y-1 pt-2 border-t border-primary-foreground/20">
              {Object.entries(debitCardTotals).map(([cardName, data]) => (
                <div key={cardName} className="flex items-center gap-2 text-xs">
                  <div 
                    style={{ backgroundColor: data.color }} 
                    className="w-2 h-2 rounded-full"
                  />
                  <span className="text-primary-foreground/80">
                    {cardName}: {formatCurrency(data.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card 
        className={`bg-gradient-card border-warning/50 shadow-elegant cursor-pointer hover:shadow-glow transition-all ${
          activePaymentMethod === 'credit' ? 'ring-2 ring-warning ring-offset-2 ring-offset-background' : ''
        }`}
        onClick={() => onPaymentMethodClick?.('credit')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Crédito</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-warning">
            {formatCurrency(totals.credit)}
          </div>
          <p className="text-xs text-muted-foreground">
            {expenses.filter(e => e.payment_method === 'credit').length + 
             activeRecurringExpenses.filter(e => e.payment_method === 'credit').length} transações
          </p>
          {Object.keys(creditCardTotals).length > 0 && (
            <div className="mt-2 space-y-1 pt-2 border-t border-border">
              {Object.entries(creditCardTotals).map(([cardName, data]) => (
                <div key={cardName} className="flex items-center gap-2 text-xs">
                  <div 
                    style={{ backgroundColor: data.color }} 
                    className="w-2 h-2 rounded-full"
                  />
                  <span className="text-muted-foreground">
                    {cardName}: {formatCurrency(data.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border/50 shadow-elegant">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Total</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            {formatCurrency(totals.total)}
          </div>
          <p className="text-xs text-muted-foreground">
            {expenses.length} despesa{expenses.length !== 1 ? 's' : ''}
          </p>
          {activeRecurringExpenses.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {activeRecurringExpenses.length} despesa{activeRecurringExpenses.length !== 1 ? 's' : ''} fixa{activeRecurringExpenses.length !== 1 ? 's' : ''}
            </p>
          )}

          {budgetProgress.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border space-y-2">
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <Target className="h-3 w-3" />
                <span>Metas do Mês</span>
              </div>
              {budgetProgress.slice(0, 3).map(({ goal, percentage, remaining }) => {
                const progressValue = Math.min(percentage, 100);
                return (
                  <div key={goal.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(percentage)}
                        <span className="text-muted-foreground">
                          {goal.type === "category" && goal.category
                            ? categoryLabels[goal.category]
                            : "Total"}
                        </span>
                      </div>
                      <span className={`font-medium ${percentage >= 100 ? 'text-destructive' : percentage >= 85 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                    <Progress 
                      value={progressValue} 
                      className={`h-1 ${
                        percentage >= 100 ? '[&>div]:bg-destructive' : 
                        percentage >= 85 ? '[&>div]:bg-orange-500' : 
                        percentage >= 70 ? '[&>div]:bg-yellow-500' : 
                        '[&>div]:bg-success'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}