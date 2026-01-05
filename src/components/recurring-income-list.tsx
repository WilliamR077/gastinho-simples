import { useState } from "react";
import { RecurringIncome, incomeCategoryLabels, incomeCategoryIcons } from "@/types/income";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
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

  const formatCurrency = (amount: number) => {
    if (isHidden) return "R$ ••••";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  if (incomes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Nenhuma entrada fixa registrada</p>
        <p className="text-sm">Adicione seu salário ou outras receitas fixas</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {incomes.map((income) => (
          <div
            key={income.id}
            className={`flex items-center justify-between p-3 bg-card rounded-lg border ${
              !income.is_active ? "opacity-50" : ""
            }`}
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
                  <span>Todo dia {income.day_of_month}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-green-600 dark:text-green-400">
                +{formatCurrency(income.amount)}
              </span>
              
              <Switch
                checked={income.is_active}
                onCheckedChange={(checked) => onToggleActive(income.id, checked)}
              />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background">
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
