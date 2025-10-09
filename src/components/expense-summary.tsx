import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, Smartphone, TrendingUp } from "lucide-react"
import { Expense } from "@/types/expense"
import { RecurringExpense } from "@/types/recurring-expense"

interface ExpenseSummaryProps {
  expenses: Expense[]
  recurringExpenses?: RecurringExpense[]
}

export function ExpenseSummary({ expenses, recurringExpenses = [] }: ExpenseSummaryProps) {
  const totals = expenses.reduce(
    (acc, expense) => {
      acc[expense.payment_method] += expense.amount
      acc.total += expense.amount
      return acc
    },
    { pix: 0, debit: 0, credit: 0, total: 0 }
  )

  // Add active recurring expenses to totals
  const activeRecurringExpenses = recurringExpenses.filter(e => e.is_active)
  activeRecurringExpenses.forEach(expense => {
    totals[expense.payment_method] += expense.amount
    totals.total += expense.amount
  })

  const formatCurrency = (value: number) => 
    `R$ ${value.toFixed(2).replace('.', ',')}`

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-gradient-success border-border/50 shadow-elegant">
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

      <Card className="bg-gradient-primary border-border/50 shadow-elegant">
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

      <Card className="bg-gradient-card border-warning/50 shadow-elegant">
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