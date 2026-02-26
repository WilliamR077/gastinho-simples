import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RecurringIncome, incomeCategoryLabels, incomeCategoryIcons } from "@/types/income";
import { useIncomeCategories } from "@/hooks/use-income-categories";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, Calendar } from "lucide-react";
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
  const { categories: incomeCats } = useIncomeCategories();
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
              return (
                <div
                  key={income.id}
                  className={`py-3 px-4 hover:bg-muted/30 transition-colors ${
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

                  {/* Line 2: category • day ... actions */}
                  <div className="flex items-center justify-between mt-1 ml-7">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{catInfo.name}</span>
                      <span>•</span>
                      <span>Dia {income.day_of_month}</span>
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
              );
            })}
          </div>
        </CardContent>
      </Card>

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
