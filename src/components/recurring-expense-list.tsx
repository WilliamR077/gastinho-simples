import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { CreditCard, Smartphone, Calendar, User } from "lucide-react"
import { RecurringExpense } from "@/types/recurring-expense"
import { categoryLabels, categoryIcons, ExpenseCategory } from "@/types/expense"
import { useCategories } from "@/hooks/use-categories"
import { useValuesVisibility } from "@/hooks/use-values-visibility"
import { TransactionDetailSheet } from "@/components/transaction-detail-sheet"
import { useState } from "react"
import { SharedGroupMember } from "@/types/shared-group"
import { getMemberColor } from "@/components/group-member-summary"

interface RecurringExpenseListProps {
  expenses: RecurringExpense[]
  onDeleteExpense: (id: string) => void
  onToggleActive: (id: string, isActive: boolean) => void
  onEditRecurringExpense: (expense: RecurringExpense) => void
  onSendToCalculator?: (value: number) => void
  groupMembers?: SharedGroupMember[]
  isGroupContext?: boolean
}

const getUserDisplayName = (userId: string, members: SharedGroupMember[]): string | null => {
  const member = members.find((m) => m.user_id === userId);
  if (!member?.user_email) return null;
  return member.user_email.split("@")[0];
};

const paymentMethodConfig = {
  pix: { label: "PIX", icon: Smartphone },
  debit: { label: "Débito", icon: CreditCard },
  credit: { label: "Crédito", icon: CreditCard }
}

export function RecurringExpenseList({
  expenses,
  onDeleteExpense,
  onToggleActive,
  onEditRecurringExpense,
  onSendToCalculator,
  groupMembers = [],
  isGroupContext = false,
}: RecurringExpenseListProps) {
  const { categories } = useCategories()
  const { isHidden } = useValuesVisibility()
  const [selectedExpense, setSelectedExpense] = useState<RecurringExpense | null>(null)

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
    <>
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
              const cardColor = expense.card?.color || expense.card_color || undefined;
              const shortCardName = cardName
                ? (cardName.length > 5 ? cardName.slice(0, 5) + '…' : cardName)
                : null;
              
              return (
                <div
                  key={expense.id}
                  onClick={() => setSelectedExpense(expense)}
                  className={`py-3 px-4 hover:bg-muted/30 transition-colors cursor-pointer active:bg-muted/50 ${
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

                {/* Line 2: category • day • method • criado por */}
                <div className="flex items-center mt-1 ml-7">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-1">
                    <span className="truncate">{categoryDisplay.label}</span>
                    <span>•</span>
                    <span className="whitespace-nowrap">Dia {expense.day_of_month}</span>
                    <span>•</span>
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{methodLabel}</span>

                    {isGroupContext && expense.user_id && groupMembers.length > 0 && (
                      <>
                        <span>•</span>
                        <User
                          className="h-3 w-3 shrink-0"
                          style={{ color: getMemberColor(expense.user_id, groupMembers) }}
                        />
                        <span
                          className="truncate"
                          style={{ color: getMemberColor(expense.user_id, groupMembers) }}
                        >
                          {getUserDisplayName(expense.user_id, groupMembers) || "?"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

    <TransactionDetailSheet
      recurringExpense={selectedExpense}
      open={!!selectedExpense}
      onOpenChange={(open) => { if (!open) setSelectedExpense(null) }}
      onEdit={() => { if (selectedExpense) onEditRecurringExpense(selectedExpense) }}
      onDelete={() => { if (selectedExpense) onDeleteExpense(selectedExpense.id) }}
      onToggleActive={onToggleActive}
      groupMembers={groupMembers}
      isGroupContext={isGroupContext}
    />
    </>
  )
}
