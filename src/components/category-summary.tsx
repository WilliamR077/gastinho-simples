import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
import { Expense } from "@/types/expense"
import { RecurringExpense } from "@/types/recurring-expense"
import { categoryLabels, categoryIcons, ExpenseCategory } from "@/types/expense"
import { isWithinInterval, parseISO } from "date-fns"

interface CategorySummaryProps {
  expenses: Expense[]
  recurringExpenses?: RecurringExpense[]
  startDate?: Date
  endDate?: Date
  billingPeriod?: string
  creditCardConfig?: {
    opening_day: number
    closing_day: number
  }
}

export function CategorySummary({
  expenses,
  recurringExpenses = [],
  startDate,
  endDate,
  billingPeriod,
  creditCardConfig
}: CategorySummaryProps) {
  
  // Calculate totals by category from regular expenses
  const categoryTotals: Record<ExpenseCategory, number> = {
    alimentacao: 0,
    transporte: 0,
    lazer: 0,
    saude: 0,
    educacao: 0,
    moradia: 0,
    vestuario: 0,
    servicos: 0,
    outros: 0
  }

  expenses.forEach(expense => {
    categoryTotals[expense.category] += Number(expense.amount)
  })

  // Add recurring expenses if they're within the filter period
  if (recurringExpenses.length > 0) {
    recurringExpenses.forEach(expense => {
      if (!expense.is_active) return

      let shouldInclude = false

      if (billingPeriod && creditCardConfig) {
        // If we have billing period filter, only include if expense falls within it
        const [year, month] = billingPeriod.split('-').map(Number)
        const openingDay = creditCardConfig.opening_day
        const closingDay = creditCardConfig.closing_day

        let periodStart: Date
        let periodEnd: Date

        if (closingDay >= openingDay) {
          periodStart = new Date(year, month - 1, openingDay)
          periodEnd = new Date(year, month - 1, closingDay)
        } else {
          periodStart = new Date(year, month - 1, openingDay)
          periodEnd = new Date(year, month, closingDay)
        }

        const expenseDate = new Date(year, month - 1, expense.day_of_month)
        shouldInclude = isWithinInterval(expenseDate, { start: periodStart, end: periodEnd })
      } else if (startDate && endDate) {
        // If we have date range filter, check if day_of_month falls within the range
        const currentDate = new Date(startDate)
        while (currentDate <= endDate) {
          const expenseDate = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            expense.day_of_month
          )
          
          if (isWithinInterval(expenseDate, { start: startDate, end: endDate })) {
            shouldInclude = true
            break
          }
          currentDate.setMonth(currentDate.getMonth() + 1)
        }
      } else {
        // No filters, include all active recurring expenses
        shouldInclude = true
      }

      if (shouldInclude) {
        categoryTotals[expense.category] += Number(expense.amount)
      }
    })
  }

  // Sort categories by total (descending) and filter out categories with 0
  const sortedCategories = Object.entries(categoryTotals)
    .filter(([_, total]) => total > 0)
    .sort(([, a], [, b]) => b - a)

  const totalAmount = sortedCategories.reduce((sum, [_, total]) => sum + total, 0)

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    })
  }

  if (sortedCategories.length === 0) {
    return (
      <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-primary flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Gastos por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhuma despesa registrada neste período
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-primary flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Gastos por Categoria
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedCategories.map(([category, total]) => {
            const percentage = totalAmount > 0 ? (total / totalAmount) * 100 : 0
            const categoryKey = category as ExpenseCategory
            
            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{categoryIcons[categoryKey]}</span>
                    <span className="font-medium text-foreground">
                      {categoryLabels[categoryKey]}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{formatCurrency(total)}</p>
                    <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-primary h-full transition-all duration-500 rounded-full"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
          
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">Total</span>
              <span className="font-bold text-lg text-primary">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
