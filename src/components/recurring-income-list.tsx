import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecurringIncome, incomeCategoryLabels, incomeCategoryIcons } from "@/types/income";
import { useIncomeCategories } from "@/hooks/use-income-categories";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { Calendar, User } from "lucide-react";
import { TransactionDetailSheet } from "@/components/transaction-detail-sheet";
import { useState } from "react";
import { SharedGroupMember } from "@/types/shared-group";
import { getMemberColor } from "@/components/group-member-summary";

interface RecurringIncomeListProps {
  incomes: RecurringIncome[];
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onEdit?: (income: RecurringIncome) => void;
  groupMembers?: SharedGroupMember[];
  isGroupContext?: boolean;
}

const getUserDisplayName = (userId: string, members: SharedGroupMember[]): string | null => {
  const member = members.find((m) => m.user_id === userId);
  if (!member?.user_email) return null;
  return member.user_email.split("@")[0];
};

export function RecurringIncomeList({ 
  incomes, 
  onDelete, 
  onToggleActive,
  onEdit,
  groupMembers = [],
  isGroupContext = false,
}: RecurringIncomeListProps) {
  const { isHidden } = useValuesVisibility();
  const { categories: incomeCats } = useIncomeCategories();
  const [selectedIncome, setSelectedIncome] = useState<RecurringIncome | null>(null);

  const getIncomeCatInfo = (income: RecurringIncome) => {
    const catId = (income as any).income_category_id;
    if (catId) {
      const custom = incomeCats.find(c => c.id === catId);
      if (custom) return { icon: custom.icon, name: custom.name };
      if ((income as any).category_name) return { icon: (income as any).category_icon || "📦", name: (income as any).category_name };
    }
    return { icon: incomeCategoryIcons[income.category] || "📦", name: incomeCategoryLabels[income.category] || income.category };
  };

  const formatCurrency = (value: number) => 
    isHidden ? "R$ ***,**" : `R$ ${value.toFixed(2).replace('.', ',')}`;

  if (incomes.length === 0) {
    return (
      <Card className="bg-card border border-border/40 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Nenhuma entrada fixa registrada ainda.
            <br />
            Adicione seu salário ou outras receitas fixas!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border border-border/40 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">Entradas Fixas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/30">
            {incomes.map((income) => {
              const catInfo = getIncomeCatInfo(income);
              const createdByUserId = (income as any).user_id;
              return (
                <div
                  key={income.id}
                  onClick={() => setSelectedIncome(income)}
                  className={`py-3 px-4 hover:bg-muted/30 transition-colors cursor-pointer active:bg-muted/50 ${
                    !income.is_active ? 'opacity-60' : ''
                  }`}
                >
                  {/* Line 1: emoji + description ... +value */}
                  <div className="flex items-center gap-2">
                    <span className="text-lg shrink-0">{catInfo.icon}</span>
                    <p className="font-medium text-foreground truncate flex-1 min-w-0">{income.description}</p>
                    <p className="font-bold text-sm text-green-600 dark:text-green-400 whitespace-nowrap ml-2">
                      +{formatCurrency(income.amount)}
                    </p>
                  </div>

                  {/* Line 2: category • day • criado por */}
                  <div className="flex items-center mt-1 ml-7">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-1">
                      <span className="truncate">{catInfo.name}</span>
                      <span>•</span>
                      <span>Dia {income.day_of_month}</span>

                      {isGroupContext && createdByUserId && groupMembers.length > 0 && (
                        <>
                          <span>•</span>
                          <User
                            className="h-3 w-3 shrink-0"
                            style={{ color: getMemberColor(createdByUserId, groupMembers) }}
                          />
                          <span
                            className="truncate"
                            style={{ color: getMemberColor(createdByUserId, groupMembers) }}
                          >
                            {getUserDisplayName(createdByUserId, groupMembers) || "?"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

    <TransactionDetailSheet
      recurringIncome={selectedIncome}
      open={!!selectedIncome}
      onOpenChange={(open) => { if (!open) setSelectedIncome(null) }}
      onEdit={() => { if (selectedIncome && onEdit) onEdit(selectedIncome) }}
      onDelete={() => { if (selectedIncome) onDelete(selectedIncome.id) }}
      onToggleActive={onToggleActive}
      groupMembers={groupMembers}
      isGroupContext={isGroupContext}
    />
    </>
  );
}
