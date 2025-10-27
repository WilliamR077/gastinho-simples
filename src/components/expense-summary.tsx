import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, Smartphone, TrendingUp } from "lucide-react"
import { Expense, PaymentMethod } from "@/types/expense"
import { RecurringExpense } from "@/types/recurring-expense"
import { calculateBillingPeriod } from "@/utils/billing-period"

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
            {expenses.filter(e => e.payment_method === 'pix').length} transações
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
            {expenses.filter(e => e.payment_method === 'debit').length} transações
          </p>
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
            {expenses.filter(e => e.payment_method === 'credit').length} transações
          </p>
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
            {expenses.length} transações total
          </p>
        </CardContent>
      </Card>
    </div>
  )
}