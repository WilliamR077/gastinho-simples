import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, Smartphone, TrendingUp } from "lucide-react"
import { Expense, PaymentMethod } from "@/types/expense"
import { RecurringExpense } from "@/types/recurring-expense"
import { calculateBillingPeriod } from "@/utils/billing-period"
import { Card as CardType } from "@/types/card"

interface ExpenseSummaryProps {
  expenses: Expense[]
  recurringExpenses?: RecurringExpense[]
  billingPeriod?: string
  startDate?: Date
  endDate?: Date
  creditCardConfig?: { opening_day: number; closing_day: number }
  onPaymentMethodClick?: (method: PaymentMethod) => void
  activePaymentMethod?: PaymentMethod
}

export function ExpenseSummary({ 
  expenses,
  recurringExpenses = [],
  billingPeriod,
  startDate,
  endDate,
  creditCardConfig,
  onPaymentMethodClick,
  activePaymentMethod
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

  const formatCurrency = (value: number) => 
    `R$ ${value.toFixed(2).replace('.', ',')}`

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
        </CardContent>
      </Card>
    </div>
  )
}