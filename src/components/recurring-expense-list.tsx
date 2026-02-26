import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { CreditCard, Smartphone, Trash2, Calendar, MoreVertical, Pencil, Calculator } from "lucide-react"
import { RecurringExpense } from "@/types/recurring-expense"
import { categoryLabels, categoryIcons, ExpenseCategory } from "@/types/expense"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useCategories } from "@/hooks/use-categories"
import { useValuesVisibility } from "@/hooks/use-values-visibility"

interface RecurringExpenseListProps {
  expenses: RecurringExpense[]
  onDeleteExpense: (id: string) => void
  onToggleActive: (id: string, isActive: boolean) => void
  onEditRecurringExpense: (expense: RecurringExpense) => void
  onSendToCalculator?: (value: number) => void
}

const paymentMethodConfig = {
  pix: { label: "PIX", icon: Smartphone },
  debit: { label: "Débito", icon: CreditCard },
  credit: { label: "Crédito", icon: CreditCard }
}

export function RecurringExpenseList({ expenses, onDeleteExpense, onToggleActive, onEditRecurringExpense, onSendToCalculator }: RecurringExpenseListProps) {
  const { categories } = useCategories()
  const { isHidden } = useValuesVisibility()

  const formatCurrency = (value: number) => 
    isHidden ? "R$ ***,**" : `R$ ${value.toFixed(2).replace('.', ',')}`

  const getCategoryDisplay = (expense: RecurringExpense) => {
    if (expense.category_name) {
      return { icon: expense.category_icon || '📦', label: expense.category_name };
    }
    if (expense.category_id) {
      const userCategory = categories.find(c => c.id === expense.category_id);
      if (userCategory) {
        return { icon: userCategory.icon, label: userCategory.name };
      }
    }
    const categoryKey = expense.category as ExpenseCategory;
    return {
      icon: categoryIcons[categoryKey] || "📦",
      label: categoryLabels[categoryKey] || "Outros"
    };
  };

  if (expenses.length === 0) {
    return (
      <Card className="bg-card border border-border/40 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Nenhuma despesa fixa registrada ainda.
            <br />
            Adicione suas mensalidades recorrentes!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card border border-border/40 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">Despesas Fixas</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/30">
          {expenses.map((expense) => {
            const config = paymentMethodConfig[expense.payment_method]
            const Icon = config.icon
            const categoryDisplay = getCategoryDisplay(expense)
            const cardName = expense.card?.name || expense.card_name;
            const methodLabel = cardName ? `${config.label} - ${cardName}` : config.label;
            
            return (
              <div
                key={expense.id}
                className={`py-3 px-4 hover:bg-muted/30 transition-colors ${
                  !expense.is_active ? 'opacity-60' : ''
                }`}
              >
                {/* Line 1: emoji + description ... value */}
                <div className="flex items-center gap-2">
                  <span className="text-lg shrink-0">{categoryDisplay.icon}</span>
                  <p className="font-medium text-foreground truncate flex-1 min-w-0">{expense.description}</p>
                  <p className="font-bold text-sm text-red-500 dark:text-red-400 whitespace-nowrap ml-2">
                    -{formatCurrency(expense.amount)}
                  </p>
                </div>

                {/* Line 2: category • day • method ... actions */}
                <div className="flex items-center justify-between mt-1 ml-7">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-1">
                    <span className="truncate">{categoryDisplay.label}</span>
                    <span>•</span>
                    <span className="whitespace-nowrap">Dia {expense.day_of_month}</span>
                    <span>•</span>
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{methodLabel}</span>
                  </div>
                  <div className="flex items-center shrink-0">
                    {onSendToCalculator && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 min-h-[36px] min-w-[36px] text-muted-foreground hover:text-primary touch-manipulation"
                        onClick={() => onSendToCalculator(expense.amount)}
                        aria-label="Enviar para calculadora"
                      >
                        <Calculator className="h-4 w-4" />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 min-h-[36px] min-w-[36px] touch-manipulation"
                          aria-label="Mais opções"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="top" className="bg-background z-50">
                        <DropdownMenuItem onClick={() => onEditRecurringExpense(expense)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <div className="flex items-center justify-between px-2 py-2 text-sm">
                          <span className="mr-2">Ativo</span>
                          <Switch
                            checked={expense.is_active}
                            onCheckedChange={(checked) => onToggleActive(expense.id, checked)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDeleteExpense(expense.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Apagar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
