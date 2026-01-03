import { useState } from "react";
import { Income, incomeCategoryLabels, incomeCategoryIcons } from "@/types/income";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { Button } from "@/components/ui/button";
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
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(incomes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentIncomes = incomes.slice(startIndex, startIndex + itemsPerPage);

  const formatCurrency = (amount: number) => {
    if (isHidden) return "R$ ••••";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  const parseLocalDate = (dateString: string): Date => {
    const date = new Date(dateString);
    return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  };

  if (incomes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Nenhuma entrada registrada</p>
        <p className="text-sm">Adicione suas receitas usando o botão +</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {currentIncomes.map((income) => (
          <div
            key={income.id}
            className="flex items-center justify-between p-3 bg-card rounded-lg border"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-2xl">
                {incomeCategoryIcons[income.category]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{income.description}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{incomeCategoryLabels[income.category]}</span>
                  <span>•</span>
                  <span>
                    {format(parseLocalDate(income.income_date), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-green-600 dark:text-green-400">
                +{formatCurrency(income.amount)}
              </span>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
        ))}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4">
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

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir entrada?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
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
