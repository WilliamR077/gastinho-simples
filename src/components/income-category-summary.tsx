import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { TrendingUp, ChevronDown } from "lucide-react"
import { Income, RecurringIncome, incomeCategoryLabels, incomeCategoryIcons, IncomeCategory } from "@/types/income"
import { useValuesVisibility } from "@/hooks/use-values-visibility"
import { parseLocalDate } from "@/lib/utils"

interface IncomeCategorySummaryProps {
  incomes: Income[]
  recurringIncomes?: RecurringIncome[]
  startDate?: Date
  endDate?: Date
  onCategoryClick?: (category: string) => void
  activeCategory?: string
}

export function IncomeCategorySummary({
  incomes,
  recurringIncomes = [],
  startDate,
  endDate,
  onCategoryClick,
  activeCategory,
}: IncomeCategorySummaryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { isHidden } = useValuesVisibility()

  const categoryTotals: Record<string, { total: number; name: string; icon: string }> = {}

  // Filter incomes by date range
  const filteredIncomes = incomes.filter(income => {
    if (!startDate || !endDate) return true
    const date = parseLocalDate(income.income_date)
    return date >= startDate && date <= endDate
  })

  filteredIncomes.forEach(income => {
    const cat = income.category as IncomeCategory
    const label = incomeCategoryLabels[cat] || cat
    const icon = incomeCategoryIcons[cat] || "📦"
    if (!categoryTotals[cat]) {
      categoryTotals[cat] = { total: 0, name: label, icon }
    }
    categoryTotals[cat].total += Number(income.amount)
  })

  // Add active recurring incomes
  recurringIncomes.forEach(income => {
    if (!income.is_active) return
    const cat = income.category as IncomeCategory
    const label = incomeCategoryLabels[cat] || cat
    const icon = incomeCategoryIcons[cat] || "📦"
    if (!categoryTotals[cat]) {
      categoryTotals[cat] = { total: 0, name: label, icon }
    }
    categoryTotals[cat].total += Number(income.amount)
  })

  const sortedCategories = Object.entries(categoryTotals)
    .filter(([_, data]) => data.total > 0)
    .sort(([, a], [, b]) => b.total - a.total)

  const totalAmount = sortedCategories.reduce((sum, [_, data]) => sum + data.total, 0)

  const formatCurrency = (value: number) => {
    if (isHidden) return "R$ ***,**"
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  if (sortedCategories.length === 0) {
    return (
      <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-green-600 dark:text-green-400 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Entradas por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Nenhuma entrada registrada neste período
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
            <CardTitle className="text-green-600 dark:text-green-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Entradas por Categoria
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
              {sortedCategories.map(([categoryKey, data]) => {
                const percentage = totalAmount > 0 ? (data.total / totalAmount) * 100 : 0

                return (
                  <div
                    key={categoryKey}
                    className={`space-y-2 rounded-lg p-2 cursor-pointer hover:bg-muted/50 transition-colors ${activeCategory === categoryKey ? 'bg-muted ring-2 ring-green-500 ring-offset-2 ring-offset-background' : ''}`}
                    onClick={() => onCategoryClick?.(categoryKey)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{data.icon}</span>
                        <span className="font-medium text-foreground">{data.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600 dark:text-green-400">{formatCurrency(data.total)}</p>
                        <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-green-500 h-full transition-all duration-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">Total</span>
                  <span className="font-bold text-lg text-green-600 dark:text-green-400">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
