import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  pix: { label: "PIX", icon: Smartphone, color: "bg-success text-success-foreground" },
  debit: { label: "Débito", icon: CreditCard, color: "bg-info text-info-foreground" },
  credit: { label: "Crédito", icon: CreditCard, color: "bg-warning text-warning-foreground" }
}

export function RecurringExpenseList({ expenses, onDeleteExpense, onToggleActive, onEditRecurringExpense, onSendToCalculator }: RecurringExpenseListProps) {
  const { categories } = useCategories()
  const { isHidden } = useValuesVisibility()

  const formatCurrency = (value: number) => 
    isHidden ? "R$ ***,**" : `R$ ${value.toFixed(2).replace('.', ',')}`

  // Helper para obter ícone e nome da categoria
  const getCategoryDisplay = (expense: RecurringExpense) => {
    // Primeiro verifica campos desnormalizados (para despesas de grupo)
    if (expense.category_name) {
      return { 
        icon: expense.category_icon || '📦', 
        label: expense.category_name 
      };
    }
    
    // Tenta buscar pela category_id (nova forma)
    if (expense.category_id) {
      const userCategory = categories.find(c => c.id === expense.category_id);
      if (userCategory) {
        return { icon: userCategory.icon, label: userCategory.name };
      }
    }
    
    // Fallback para categoria antiga (enum)
    const categoryKey = expense.category as ExpenseCategory;
    return {
      icon: categoryIcons[categoryKey] || "📦",
      label: categoryLabels[categoryKey] || "Outros"
    };
  };

  if (expenses.length === 0) {
    return (
      <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
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
    <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-primary">Despesas Fixas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {expenses.map((expense) => {
            const config = paymentMethodConfig[expense.payment_method]
            const Icon = config.icon
            const categoryDisplay = getCategoryDisplay(expense)
            
            // Buscar cor do cartão ou usar cor padrão
            const cardColor = expense.card?.color || (
              expense.payment_method === 'credit' 
                ? '#FFA500' // Laranja para crédito sem cartão
                : expense.payment_method === 'debit'
                ? '#3B82F6' // Azul para débito sem cartão
                : '#10B981' // Verde para PIX
            );
            
            return (
              <div
                key={expense.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-all duration-300 hover:shadow-card ${
                  !expense.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
                  <div className="p-2 rounded-full shrink-0" style={{ backgroundColor: cardColor }}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{categoryDisplay.icon}</span>
                      <p className="font-medium text-foreground truncate">{expense.description}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                      <span>{categoryDisplay.label}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>Cobrança: Dia {expense.day_of_month}</span>
                      <span className="hidden sm:inline">•</span>
                      <Badge 
                        variant="outline" 
                        className="text-xs w-fit max-w-[150px] sm:max-w-none truncate"
                        style={{ 
                          backgroundColor: cardColor, 
                          color: 'white',
                          borderColor: cardColor 
                        }}
                      >
                        {config.label}
                        {expense.card?.name 
                          ? ` - ${expense.card.name}` 
                          : expense.card_name 
                            ? ` - ${expense.card_name}` 
                            : ''}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  <p className="font-bold text-base sm:text-lg text-primary whitespace-nowrap">
                    {formatCurrency(expense.amount)}
                  </p>
                  <div className="flex items-center gap-1">
                    {onSendToCalculator && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 min-h-[44px] min-w-[44px] text-muted-foreground hover:text-primary touch-manipulation"
                        onClick={() => onSendToCalculator(expense.amount)}
                        aria-label="Enviar para calculadora"
                      >
                        <Calculator className="h-5 w-5" />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 min-h-[44px] min-w-[44px] touch-manipulation"
                          aria-label="Mais opções"
                        >
                          <MoreVertical className="h-5 w-5" />
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
