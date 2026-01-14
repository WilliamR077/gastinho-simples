// income-list.tsx (substitua o arquivo atual)
import { useState } from "react";
import { Income, incomeCategoryLabels, incomeCategoryIcons } from "@/types/income";
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
      <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
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
      <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-green-600 dark:text-green-400">Suas Entradas</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {currentIncomes.map((income) => (
              <div
                key={income.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-all duration-300 hover:shadow-card ${
                  !income.is_active ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center gap-3 flex-1 w-full sm:w-auto min-w-0">
                  <div className="p-2 rounded-full shrink-0 bg-green-500">
                    <span className="sr-only">Ícone</span>
                    {/* ícone categórico */}
                    <span className="h-4 w-4 inline-block">{incomeCategoryIcons[income.category]}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{incomeCategoryIcons[income.category]}</span>
                      <p className="font-medium text-foreground truncate">{income.description}</p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{incomeCategoryLabels[income.category]}</span>
                      <span>•</span>
                      <span>{format(parseLocalDate(income.income_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>

                    {/* criado em - se necessário */}
                    {income.created_at && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Criado em: {format(new Date(income.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  <p className="font-bold text-base sm:text-lg text-green-600 dark:text-green-400 whitespace-nowrap">
                    +{formatCurrency(income.amount)}
                  </p>

                  <div className="flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 touch-manipulation"
                          aria-label="Mais opções"
                        >
                          <MoreVertical className="h-5 w-5" />
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
        </CardContent>
      </Card>

      {/* Dialog de confirmação de exclusão */}
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
