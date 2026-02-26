import { useState } from "react";
import { Income, incomeCategoryLabels, incomeCategoryIcons } from "@/types/income";
import { useIncomeCategories } from "@/hooks/use-income-categories";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
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
}

export function IncomeList({ incomes, onDelete, onEdit }: IncomeListProps) {
  const { isHidden } = useValuesVisibility();
  const { categories: incomeCats } = useIncomeCategories();
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const getIncomeCatInfo = (income: Income) => {
    const catId = (income as any).income_category_id;
    if (catId) {
      const custom = incomeCats.find(c => c.id === catId);
      if (custom) return { icon: custom.icon, name: custom.name };
      if ((income as any).category_name) return { icon: (income as any).category_icon || "📦", name: (income as any).category_name };
    }
    return { icon: incomeCategoryIcons[income.category] || "📦", name: incomeCategoryLabels[income.category] || income.category };
  };
  const itemsPerPage = 10;

  const totalPages = Math.ceil(incomes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentIncomes = incomes.slice(startIndex, startIndex + itemsPerPage);

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
                  className="py-3 px-4 hover:bg-muted/30 transition-colors"
                >
                  {/* Line 1: emoji + description ... +value */}
                  <div className="flex items-center gap-2">
                    <span className="text-lg shrink-0">{catInfo.icon}</span>
                    <p className="font-medium text-foreground truncate flex-1 min-w-0">{income.description}</p>
                    <p className="font-bold text-sm text-green-600 dark:text-green-400 whitespace-nowrap ml-2">
                      +{formatCurrency(income.amount)}
                    </p>
                  </div>

                  {/* Line 2: category • date ... actions */}
                  <div className="flex items-center justify-between mt-1 ml-7">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{catInfo.name}</span>
                      <span>•</span>
                      <span>{format(parseLocalDate(income.income_date), "dd/MM", { locale: ptBR })}</span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 min-h-[36px] min-w-[36px] shrink-0 touch-manipulation"
                          aria-label="Mais opções"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="top" className="bg-background z-50">
                        {onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(income)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(income.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-4 px-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
