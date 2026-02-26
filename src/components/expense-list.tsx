import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreditCard, Smartphone, Receipt, Users, User, Calculator } from "lucide-react"
import { Expense, categoryLabels, categoryIcons, ExpenseCategory } from "@/types/expense"
import { SharedGroupMember } from "@/types/shared-group"
import { useCategories } from "@/hooks/use-categories"
import { useValuesVisibility } from "@/hooks/use-values-visibility"
import { TransactionDetailSheet } from "@/components/transaction-detail-sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ExpenseListProps {
  expenses: Expense[]
  onDeleteExpense: (id: string) => void
  onEditExpense: (expense: Expense) => void
  onDuplicateExpense?: (expense: Expense) => void
  onSendToCalculator?: (value: number) => void
  groupMembers?: SharedGroupMember[]
  isGroupContext?: boolean
}

const getUserDisplayName = (userId: string, members: SharedGroupMember[]): string | null => {
  const member = members.find(m => m.user_id === userId);
  if (!member?.user_email) return null;
  return member.user_email.split('@')[0];
};

const paymentMethodConfig = {
  pix: { label: "PIX", icon: Smartphone },
  debit: { label: "Débito", icon: CreditCard },
  credit: { label: "Crédito", icon: CreditCard }
}

const parseLocalDate = (dateString: string) => {
  const datePart = dateString.split('T')[0].split(' ')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export function ExpenseList({ expenses, onDeleteExpense, onEditExpense, onDuplicateExpense, onSendToCalculator, groupMembers = [], isGroupContext = false }: ExpenseListProps) {
  const [visibleCount, setVisibleCount] = useState(10)
  const { categories } = useCategories()
  const { isHidden } = useValuesVisibility()
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const formatCurrency = (value: number) => 
    isHidden ? "R$ ***,**" : `R$ ${value.toFixed(2).replace('.', ',')}`

  const currentExpenses = expenses.slice(0, visibleCount)

  const getCategoryDisplay = (expense: Expense) => {
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
          <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Nenhuma despesa registrada ainda.
            <br />
            Comece adicionando sua primeira despesa!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="bg-card border border-border/40 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">Suas Despesas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/30">
            {currentExpenses.map((expense) => {
              const config = paymentMethodConfig[expense.payment_method]
              const Icon = config.icon
              const categoryDisplay = getCategoryDisplay(expense)
              const cardName = expense.card?.name || expense.card_name;
              const shortCardName = cardName
                ? (cardName.length > 5 ? cardName.slice(0, 5) + '…' : cardName)
                : null;
              const methodLabel = shortCardName
                ? `${config.label} • ${shortCardName}`
                : config.label;
              
              return (
                <div
                  key={expense.id}
                  className="py-3 px-4 hover:bg-muted/30 transition-colors cursor-pointer active:bg-muted/50"
                  onClick={() => setSelectedExpense(expense)}
                >
                  {/* Line 1: emoji + description + installments ... value */}
                  <div className="flex items-center gap-2">
                    <span className="text-lg shrink-0">{categoryDisplay.icon}</span>
                    <p className="font-medium text-foreground truncate flex-1 min-w-0">{expense.description}</p>
                    {expense.total_installments > 1 && (
                      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {expense.installment_number}/{expense.total_installments}x
                      </span>
                    )}
                    <p className="font-bold text-sm text-red-500 dark:text-red-400 whitespace-nowrap ml-2">
                      -{formatCurrency(expense.amount)}
                    </p>
                  </div>

                  {/* Line 2: category • date • method ... group */}
                  <div className="flex items-center justify-between mt-1 ml-7">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-1">
                      <span className="truncate">{categoryDisplay.label}</span>
                      <span>•</span>
                      <span className="whitespace-nowrap">{parseLocalDate(expense.expense_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                      <span>•</span>
                      <Icon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{methodLabel}</span>
                      {expense.shared_group && (
                        <>
                          <span>•</span>
                          <Users className="h-3 w-3 shrink-0 text-indigo-500" />
                          <span className="text-indigo-500 truncate">{expense.shared_group.name}</span>
                        </>
                      )}
                      {isGroupContext && expense.user_id && groupMembers.length > 0 && (
                        <>
                          <span>•</span>
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate">{getUserDisplayName(expense.user_id, groupMembers) || '?'}</span>
                        </>
                      )}
                    </div>
                    {onSendToCalculator && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 min-h-[36px] min-w-[36px] text-muted-foreground hover:text-primary touch-manipulation shrink-0"
                        onClick={(e) => { e.stopPropagation(); onSendToCalculator(expense.amount); }}
                        aria-label="Enviar para calculadora"
                      >
                        <Calculator className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {visibleCount < expenses.length && (
            <div className="py-4 px-4">
              <Button
                variant="outline"
                size="sm"
                className="w-full touch-manipulation"
                onClick={() => setVisibleCount(v => Math.min(v + 10, expenses.length))}
              >
                Carregar mais ({expenses.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionDetailSheet
        expense={selectedExpense}
        open={!!selectedExpense}
        onOpenChange={(open) => { if (!open) setSelectedExpense(null); }}
        onEdit={() => { if (selectedExpense) onEditExpense(selectedExpense); }}
        onDuplicate={() => { if (selectedExpense && onDuplicateExpense) onDuplicateExpense(selectedExpense); }}
        onDelete={() => { if (selectedExpense) setDeleteId(selectedExpense.id); }}
        formatCurrency={formatCurrency}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  onDeleteExpense(deleteId);
                  setDeleteId(null);
                  setSelectedExpense(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
