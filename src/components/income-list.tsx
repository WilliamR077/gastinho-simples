import { useState } from "react";
import { Income, incomeCategoryLabels, incomeCategoryIcons } from "@/types/income";
import { useIncomeCategories } from "@/hooks/use-income-categories";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionDetailSheet } from "@/components/transaction-detail-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface IncomeListProps {
  incomes: Income[];
  onDelete: (id: string) => void;
  onEdit?: (income: Income) => void;
  onDuplicate?: (income: Income) => void;
}

export function IncomeList({ incomes, onDelete, onEdit, onDuplicate }: IncomeListProps) {
  const { isHidden } = useValuesVisibility();
  const { categories: incomeCats } = useIncomeCategories();
  const [visibleCount, setVisibleCount] = useState(10);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIncome, setSelectedIncome] = useState<Income | null>(null);

  const getIncomeCatInfo = (income: Income) => {
    const catId = (income as any).income_category_id;
    if (catId) {
      const custom = incomeCats.find(c => c.id === catId);
      if (custom) return { icon: custom.icon, name: custom.name };
      if ((income as any).category_name) return { icon: (income as any).category_icon || "📦", name: (income as any).category_name };
    }
    return { icon: incomeCategoryIcons[income.category] || "📦", name: incomeCategoryLabels[income.category] || income.category };
  };
  const currentIncomes = incomes.slice(0, visibleCount);

  const formatCurrency = (amount: number) => {
    if (isHidden) return "R$ ••••";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);
  };

  const parseLocalDate = (dateString: string): Date => {
    const date = new Date(dateString);
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  };

  if (incomes.length === 0) {
    return (
      <Card className="bg-card border border-border/40 shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">
            Nenhuma entrada registrada
            <br />
            Adicione suas receitas usando o botão +
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border border-border/40 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">Suas Entradas</CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-border/30">
            {currentIncomes.map((income) => {
              const catInfo = getIncomeCatInfo(income);
              return (
                <div
                  key={income.id}
                  className="py-3 px-4 hover:bg-muted/30 transition-colors cursor-pointer active:bg-muted/50"
                  onClick={() => setSelectedIncome(income)}
                >
                  {/* Line 1: emoji + description ... +value */}
                  <div className="flex items-center gap-2">
                    <span className="text-lg shrink-0">{catInfo.icon}</span>
                    <p className="font-medium text-foreground truncate flex-1 min-w-0">{income.description}</p>
                    <p className="font-bold text-sm text-green-600 dark:text-green-400 whitespace-nowrap ml-2">
                      +{formatCurrency(income.amount)}
                    </p>
                  </div>

                  {/* Line 2: category • date */}
                  <div className="flex items-center mt-1 ml-7">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{catInfo.name}</span>
                      <span>•</span>
                      <span>{format(parseLocalDate(income.income_date), "dd/MM", { locale: ptBR })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {visibleCount < incomes.length && (
            <div className="py-4 px-4">
              <Button
                variant="outline"
                size="sm"
                className="w-full touch-manipulation"
                onClick={() => setVisibleCount(v => Math.min(v + 10, incomes.length))}
              >
                Carregar mais ({incomes.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionDetailSheet
        income={selectedIncome}
        open={!!selectedIncome}
        onOpenChange={(open) => { if (!open) setSelectedIncome(null); }}
        onEdit={() => { if (selectedIncome && onEdit) onEdit(selectedIncome); }}
        onDuplicate={() => { if (selectedIncome && onDuplicate) onDuplicate(selectedIncome); }}
        onDelete={() => { if (selectedIncome) setDeleteId(selectedIncome.id); }}
        formatCurrency={formatCurrency}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir entrada?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  onDelete(deleteId);
                  setDeleteId(null);
                  setSelectedIncome(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
