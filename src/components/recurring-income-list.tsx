import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RecurringIncome, incomeCategoryLabels, incomeCategoryIcons } from "@/types/income";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, Calendar, Wallet } from "lucide-react";
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
import { useState } from "react";

interface RecurringIncomeListProps {
  incomes: RecurringIncome[];
  onDelete: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onEdit?: (income: RecurringIncome) => void;
}

export function RecurringIncomeList({ 
  incomes, 
  onDelete, 
  onToggleActive,
  onEdit 
}: RecurringIncomeListProps) {
  const { isHidden } = useValuesVisibility();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const formatCurrency = (value: number) => 
    isHidden ? "R$ ***,**" : `R$ ${value.toFixed(2).replace('.', ',')}`;

  if (incomes.length === 0) {
    return (
      <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
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
      <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-green-600 dark:text-green-400">Entradas Fixas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {incomes.map((income) => (
              <div
                key={income.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-all duration-300 hover:shadow-card ${
                  !income.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
                  <div className="p-2 rounded-full shrink-0 bg-green-500">
                    <Wallet className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{incomeCategoryIcons[income.category]}</span>
                      <p className="font-medium text-foreground truncate">{income.description}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                      <span>{incomeCategoryLabels[income.category]}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>Recebimento: Dia {income.day_of_month}</span>
                    </div>
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
                        <DropdownMenuSeparator />
                        <div className="flex items-center justify-between px-2 py-2 text-sm">
                          <span className="mr-2">Ativo</span>
                          <Switch
                            checked={income.is_active}
                            onCheckedChange={(checked) => onToggleActive(income.id, checked)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
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
        </CardContent>
      </Card>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir entrada fixa?</AlertDialogTitle>
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
