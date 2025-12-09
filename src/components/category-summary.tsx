import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { TrendingUp, ChevronDown } from "lucide-react"
import { Expense } from "@/types/expense"
import { RecurringExpense } from "@/types/recurring-expense"
import { isWithinInterval } from "date-fns"
import { useCategories } from "@/hooks/use-categories"
import { UserCategory } from "@/types/user-category"

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
  onCategoryClick?: (categoryId: string) => void
  activeCategory?: string
}

export function CategorySummary({
  expenses,
  recurringExpenses = [],
  startDate,
  endDate,
  billingPeriod,
  creditCardConfig,
  onCategoryClick,
  activeCategory
}: CategorySummaryProps) {

  const [isOpen, setIsOpen] = useState(false)
  const { categories } = useCategories()

  // Helper para obter categoria por ID ou fallback
  const getCategoryInfo = (categoryId: string | null, categoryEnum: string): { id: string; name: string; icon: string } => {
    if (categoryId) {
      const userCategory = categories.find(c => c.id === categoryId);
      if (userCategory) {
        return { id: userCategory.id, name: userCategory.name, icon: userCategory.icon };
      }
    }
    // Fallback para categoria antiga
    const fallbackCategory = categories.find(c => c.name.toLowerCase() === categoryEnum.replace('ao', 'ão').toLowerCase() || 
      c.name.toLowerCase() === categoryEnum.toLowerCase());
    if (fallbackCategory) {
      return { id: fallbackCategory.id, name: fallbackCategory.name, icon: fallbackCategory.icon };
    }
    return { id: categoryEnum, name: categoryEnum, icon: "📦" };
  };

  // Calculate totals by category from regular expenses
  const categoryTotals: Record<string, { total: number; name: string; icon: string }> = {};

  expenses.forEach(expense => {
    const catInfo = getCategoryInfo(expense.category_id, expense.category);
    if (!categoryTotals[catInfo.id]) {
      categoryTotals[catInfo.id] = { total: 0, name: catInfo.name, icon: catInfo.icon };
    }
    categoryTotals[catInfo.id].total += Number(expense.amount);
  });

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
        const catInfo = getCategoryInfo(expense.category_id, expense.category);
        if (!categoryTotals[catInfo.id]) {
          categoryTotals[catInfo.id] = { total: 0, name: catInfo.name, icon: catInfo.icon };
        }
        categoryTotals[catInfo.id].total += Number(expense.amount);
      }
    })
  }

  // Sort categories by total (descending) and filter out categories with 0
  const sortedCategories = Object.entries(categoryTotals)
    .filter(([_, data]) => data.total > 0)
    .sort(([, a], [, b]) => b.total - a.total)

  const totalAmount = sortedCategories.reduce((sum, [_, data]) => sum + data.total, 0)

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
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-primary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Gastos por Categoria
              </div>
              <ChevronDown
                className={`h-5 w-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="space-y-4">
              {sortedCategories.map(([categoryId, data]) => {
                const percentage = totalAmount > 0 ? (data.total / totalAmount) * 100 : 0

                return (
                  <div
                    key={categoryId}
                    className={`space-y-2 cursor-pointer hover:bg-muted/50 transition-colors rounded-lg p-2 ${activeCategory === categoryId ? 'bg-muted ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                      }`}
                    onClick={() => onCategoryClick?.(categoryId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{data.icon}</span>
                        <span className="font-medium text-foreground">
                          {data.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{formatCurrency(data.total)}</p>
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
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
