import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { CreditCard, Smartphone, Trash2, Calendar } from "lucide-react"
import { RecurringExpense } from "@/types/recurring-expense"
import { categoryLabels, categoryIcons } from "@/types/expense"

interface RecurringExpenseListProps {
  expenses: RecurringExpense[]
  onDeleteExpense: (id: string) => void
  onToggleActive: (id: string, isActive: boolean) => void
}

const paymentMethodConfig = {
  pix: { label: "PIX", icon: Smartphone, color: "bg-success text-success-foreground" },
  debit: { label: "Débito", icon: CreditCard, color: "bg-info text-info-foreground" },
  credit: { label: "Crédito", icon: CreditCard, color: "bg-warning text-warning-foreground" }
}

export function RecurringExpenseList({ expenses, onDeleteExpense, onToggleActive }: RecurringExpenseListProps) {
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
            
            return (
              <div
                key={expense.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-all duration-300 hover:shadow-card ${
                  !expense.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
                  <div className={`p-2 rounded-full ${config.color} shrink-0`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{categoryIcons[expense.category]}</span>
                      <p className="font-medium text-foreground truncate">{expense.description}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                      <span>{categoryLabels[expense.category]}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>Cobrança: Dia {expense.day_of_month}</span>
                      <span className="hidden sm:inline">•</span>
                      <Badge variant="outline" className={`${config.color} text-xs w-fit`}>
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                  <p className="font-bold text-base sm:text-lg text-primary whitespace-nowrap">
                    R$ {expense.amount.toFixed(2).replace('.', ',')}
                  </p>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={expense.is_active}
                      onCheckedChange={(checked) => onToggleActive(expense.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteExpense(expense.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-300 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
