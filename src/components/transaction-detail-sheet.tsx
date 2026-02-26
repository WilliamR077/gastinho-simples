import { Expense, categoryLabels, categoryIcons, ExpenseCategory } from "@/types/expense";
import { Income, incomeCategoryLabels, incomeCategoryIcons } from "@/types/income";
import { useCategories } from "@/hooks/use-categories";
import { useIncomeCategories } from "@/hooks/use-income-categories";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Copy, Trash2, CreditCard, Smartphone, Calendar, Tag, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";

interface TransactionDetailSheetProps {
  expense?: Expense | null;
  income?: Income | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  formatCurrency: (value: number) => string;
}

const paymentMethodLabels: Record<string, string> = {
  pix: "PIX",
  debit: "Débito",
  credit: "Crédito",
};

const paymentMethodIcons: Record<string, typeof Smartphone> = {
  pix: Smartphone,
  debit: CreditCard,
  credit: CreditCard,
};

const parseLocalDate = (dateString: string): Date => {
  const datePart = dateString.split("T")[0].split(" ")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export function TransactionDetailSheet({
  expense,
  income,
  open,
  onOpenChange,
  onEdit,
  onDuplicate,
  onDelete,
}: TransactionDetailSheetProps) {
  const { categories } = useCategories();
  const { categories: incomeCats } = useIncomeCategories();

  const isExpense = !!expense;
  const transaction = expense || income;
  if (!transaction) return null;

  // Category info
  let catIcon = "📦";
  let catName = "Outros";

  if (isExpense && expense) {
    if (expense.category_name) {
      catIcon = expense.category_icon || "📦";
      catName = expense.category_name;
    } else if (expense.category_id) {
      const uc = categories.find((c) => c.id === expense.category_id);
      if (uc) { catIcon = uc.icon; catName = uc.name; }
    } else {
      catIcon = categoryIcons[expense.category as ExpenseCategory] || "📦";
      catName = categoryLabels[expense.category as ExpenseCategory] || "Outros";
    }
  } else if (income) {
    const catId = (income as any).income_category_id;
    if (catId) {
      const custom = incomeCats.find((c) => c.id === catId);
      if (custom) { catIcon = custom.icon; catName = custom.name; }
      else if ((income as any).category_name) { catIcon = (income as any).category_icon || "📦"; catName = (income as any).category_name; }
      else { catIcon = incomeCategoryIcons[income.category] || "📦"; catName = incomeCategoryLabels[income.category] || income.category; }
    } else {
      catIcon = incomeCategoryIcons[income.category] || "📦";
      catName = incomeCategoryLabels[income.category] || income.category;
    }
  }

  const amount = transaction.amount;
  const description = transaction.description;
  const dateStr = isExpense ? (expense as Expense).expense_date : (income as Income).income_date;
  const createdAt = transaction.created_at;

  const handleAction = (action: () => void) => {
    onOpenChange(false);
    // Small delay so drawer closes first
    setTimeout(action, 200);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left pb-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{catIcon}</span>
            <div className="flex-1 min-w-0">
              <DrawerTitle className="text-lg truncate">{description}</DrawerTitle>
              <p
                className={`text-xl font-bold mt-0.5 ${
                  isExpense
                    ? "text-red-500 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                {isExpense ? "-" : "+"}
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)}
              </p>
            </div>
          </div>
        </DrawerHeader>

        <Separator />

        <div className="px-4 py-3 space-y-3">
          {/* Categoria */}
          <DetailRow icon={<Tag className="h-4 w-4" />} label="Categoria" value={`${catIcon} ${catName}`} />

          {/* Data */}
          <DetailRow
            icon={<Calendar className="h-4 w-4" />}
            label="Data"
            value={format(parseLocalDate(dateStr), "dd/MM/yyyy", { locale: ptBR })}
          />

          {/* Método de pagamento (só despesas) */}
          {isExpense && expense && (() => {
            const MethodIcon = paymentMethodIcons[expense.payment_method] || CreditCard;
            const methodLabel = paymentMethodLabels[expense.payment_method] || expense.payment_method;
            const cardName = expense.card?.name || expense.card_name;
            const fullMethod = cardName ? `${methodLabel} • ${cardName}` : methodLabel;
            return (
              <DetailRow
                icon={<MethodIcon className="h-4 w-4" />}
                label="Pagamento"
                value={fullMethod}
              />
            );
          })()}

          {/* Parcelas */}
          {isExpense && expense && expense.total_installments && expense.total_installments > 1 && (
            <DetailRow
              icon={<CreditCard className="h-4 w-4" />}
              label="Parcelas"
              value={`${expense.installment_number}/${expense.total_installments}x`}
            />
          )}

          {/* Grupo compartilhado */}
          {isExpense && expense?.shared_group && (
            <DetailRow
              icon={<Users className="h-4 w-4 text-indigo-500" />}
              label="Grupo"
              value={expense.shared_group.name}
            />
          )}

          {/* Criado em */}
          <DetailRow
            icon={<Clock className="h-4 w-4" />}
            label="Criado em"
            value={format(new Date(createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          />
        </div>

        <Separator />

        <DrawerFooter className="flex-row gap-2 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
          <Button
            variant="outline"
            className="flex-1 gap-1.5 touch-manipulation"
            onClick={() => handleAction(onEdit)}
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-1.5 touch-manipulation"
            onClick={() => handleAction(onDuplicate)}
          >
            <Copy className="h-4 w-4" />
            Duplicar
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-1.5 text-destructive hover:text-destructive touch-manipulation"
            onClick={() => handleAction(onDelete)}
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-sm text-muted-foreground shrink-0 w-20">{label}</span>
      <span className="text-sm font-medium text-foreground truncate">{value}</span>
    </div>
  );
}
