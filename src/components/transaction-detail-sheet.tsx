import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { adMobService } from "@/services/admob-service";
import { Expense, categoryLabels, categoryIcons, ExpenseCategory } from "@/types/expense";
import { Income, incomeCategoryLabels, incomeCategoryIcons } from "@/types/income";
import { RecurringExpense } from "@/types/recurring-expense";
import { RecurringIncome } from "@/types/income";
import { useCategories } from "@/hooks/use-categories";
import { useIncomeCategories } from "@/hooks/use-income-categories";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Copy, Trash2, CreditCard, Smartphone, Calendar, Tag, Clock, Users, Power, Receipt, User, Scale, ChevronDown, Layers, Info, ExternalLink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { splitTypeLabels, SplitType } from "@/types/expense-split";
import { calculateBillingPeriod, formatBillingPeriodLabel, getNextBillingDates, CreditCardConfig } from "@/utils/billing-period";
import { Card as CardType } from "@/types/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { getMemberColor } from "@/components/group-member-summary";
import { SharedGroupMember } from "@/types/shared-group";

interface TransactionDetailSheetProps {
  expense?: Expense | null;
  income?: Income | null;
  recurringExpense?: RecurringExpense | null;
  recurringIncome?: RecurringIncome | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  formatCurrency?: (value: number) => string;
  onToggleActive?: (id: string, isActive: boolean) => void;
  groupMembers?: SharedGroupMember[];
  isGroupContext?: boolean;
  onOpenFirstInstallment?: (installmentGroupId: string, type: 'expense' | 'income') => void;
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

const getUserDisplayName = (userId: string, members: SharedGroupMember[]): string | null => {
  const member = members.find((m) => m.user_id === userId);
  if (!member?.user_email) return null;
  return member.user_email.split("@")[0];
};

export function TransactionDetailSheet({
  expense,
  income,
  recurringExpense,
  recurringIncome,
  open,
  onOpenChange,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleActive,
  groupMembers = [],
  isGroupContext = false,
  onOpenFirstInstallment,
}: TransactionDetailSheetProps) {
  const { user } = useAuth();
  const [cardsData, setCardsData] = useState<CardType[]>([]);
  const [siblingInstallments, setSiblingInstallments] = useState<{ id: string; installment_number: number; total_installments: number; income_date: string; amount: number; description: string }[]>([]);
  const [siblingExpenseInstallments, setSiblingExpenseInstallments] = useState<{ id: string; installment_number: number; total_installments: number; expense_date: string; amount: number; description: string; paid_by: string | null }[]>([]);
  const { categories } = useCategories();
  const { categories: incomeCats } = useIncomeCategories();

  useEffect(() => {
    if (user && open) {
      supabase
        .from("cards")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .then(({ data }) => setCardsData(data || []));
    }
  }, [user, open]);

  // Fetch sibling installments for income
  useEffect(() => {
    if (open && income && (income as any).installment_group_id && (income as any).total_installments > 1) {
      supabase
        .from("incomes")
        .select("id, installment_number, total_installments, income_date, amount, description")
        .eq("installment_group_id", (income as any).installment_group_id)
        .order("installment_number", { ascending: true })
        .then(({ data }) => setSiblingInstallments((data as any) || []));
    } else {
      setSiblingInstallments([]);
    }
  }, [open, income]);

  // Fetch sibling installments for expense
  useEffect(() => {
    if (open && expense && expense.installment_group_id && expense.total_installments && expense.total_installments > 1) {
      supabase
        .from("expenses")
        .select("id, installment_number, total_installments, expense_date, amount, description, paid_by")
        .eq("installment_group_id", expense.installment_group_id)
        .order("installment_number", { ascending: true })
        .then(({ data }) => setSiblingExpenseInstallments((data as any) || []));
    } else {
      setSiblingExpenseInstallments([]);
    }
  }, [open, expense]);

  const isRecurring = !!recurringExpense || !!recurringIncome;
  const isExpense = !!expense || !!recurringExpense;
  const transaction = expense || income || recurringExpense || recurringIncome;
  if (!transaction) return null;

  // Series detection
  const isExpenseSeries = !!expense && !!expense.installment_group_id && (expense.total_installments ?? 1) > 1;
  const isIncomeSeries = !!income && !!(income as any).installment_group_id && ((income as any).total_installments ?? 1) > 1;
  const isSeries = isExpenseSeries || isIncomeSeries;
  const installmentNumber = expense?.installment_number ?? (income as any)?.installment_number ?? 1;
  const isFirstInstallment = installmentNumber === 1;
  const isSeriesSecondary = isSeries && !isFirstInstallment;
  const totalInstallments = expense?.total_installments ?? (income as any)?.total_installments ?? 1;
  const installmentGroupId = expense?.installment_group_id ?? (income as any)?.installment_group_id;

  const createdByUserId = (transaction as any).user_id;
const createdByName =
  isGroupContext && createdByUserId && groupMembers.length > 0
    ? getUserDisplayName(createdByUserId, groupMembers) || "?"
    : null;

const createdByColor =
  isGroupContext && createdByUserId && groupMembers.length > 0
    ? getMemberColor(createdByUserId, groupMembers)
    : undefined;

  // Category info
  let catIcon = "📦";
  let catName = "Outros";

  if (expense) {
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
  } else if (recurringExpense) {
    if (recurringExpense.category_name) {
      catIcon = recurringExpense.category_icon || "📦";
      catName = recurringExpense.category_name;
    } else if (recurringExpense.category_id) {
      const uc = categories.find((c) => c.id === recurringExpense.category_id);
      if (uc) { catIcon = uc.icon; catName = uc.name; }
    } else {
      catIcon = categoryIcons[recurringExpense.category as ExpenseCategory] || "📦";
      catName = categoryLabels[recurringExpense.category as ExpenseCategory] || "Outros";
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
  } else if (recurringIncome) {
    const catId = (recurringIncome as any).income_category_id;
    if (catId) {
      const custom = incomeCats.find((c) => c.id === catId);
      if (custom) { catIcon = custom.icon; catName = custom.name; }
      else if ((recurringIncome as any).category_name) { catIcon = (recurringIncome as any).category_icon || "📦"; catName = (recurringIncome as any).category_name; }
      else { catIcon = incomeCategoryIcons[recurringIncome.category] || "📦"; catName = incomeCategoryLabels[recurringIncome.category] || recurringIncome.category; }
    } else {
      catIcon = incomeCategoryIcons[recurringIncome.category] || "📦";
      catName = incomeCategoryLabels[recurringIncome.category] || recurringIncome.category;
    }
  }

  const amount = transaction.amount;
  const description = transaction.description;
  const createdAt = transaction.created_at;

  const handleAction = (action: () => void) => {
    onOpenChange(false);
    setTimeout(action, 200);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left pb-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{catIcon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <DrawerTitle className="text-lg truncate">{description}</DrawerTitle>
                {isSeries && isFirstInstallment && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0 bg-primary/10 text-primary border-primary/20">
                    Gerencia esta série
                  </Badge>
                )}
                {isSeriesSecondary && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0 bg-muted text-muted-foreground">
                    Série
                  </Badge>
                )}
              </div>
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

        <div className="px-4 py-3 space-y-3 overflow-y-auto">
          {/* Banner for secondary installments */}
          {isSeriesSecondary && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Esta parcela faz parte de uma série parcelada. Para editar ou excluir esta série, abra a 1ª parcela.
                </p>
              </div>
              {onOpenFirstInstallment && installmentGroupId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 text-xs border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  onClick={() => {
                    onOpenChange(false);
                    setTimeout(() => {
                      onOpenFirstInstallment(installmentGroupId, isExpenseSeries ? 'expense' : 'income');
                    }, 200);
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir 1ª parcela
                </Button>
              )}
            </div>
          )}

          {/* Categoria */}
          <DetailRow icon={<Tag className="h-4 w-4" />} label="Categoria" value={`${catIcon} ${catName}`} />

          {/* Data ou Dia do mês */}
          {isRecurring ? (
            <DetailRow
              icon={<Calendar className="h-4 w-4" />}
              label="Dia do mês"
              value={`Dia ${(recurringExpense || recurringIncome)!.day_of_month}`}
            />
          ) : (
            <DetailRow
              icon={<Calendar className="h-4 w-4" />}
              label="Data"
              value={format(parseLocalDate(
                expense ? expense.expense_date : (income as Income).income_date
              ), "dd/MM/yyyy", { locale: ptBR })}
            />
          )}

          {/* Método de pagamento (só despesas) */}
          {isExpense && (expense || recurringExpense) && (() => {
            const exp = expense || recurringExpense!;
            const MethodIcon = paymentMethodIcons[exp.payment_method] || CreditCard;
            const methodLabel = paymentMethodLabels[exp.payment_method] || exp.payment_method;
            const cardName = exp.card?.name || (exp as any).card_name;
            const fullMethod = cardName ? `${methodLabel} • ${cardName}` : methodLabel;
            return (
              <DetailRow
                icon={<MethodIcon className="h-4 w-4" />}
                label="Pagamento"
                value={fullMethod}
              />
            );
          })()}

          {/* Parcelas de despesa */}
          {expense && expense.total_installments && expense.total_installments > 1 && (
            <DetailRow
              icon={<CreditCard className="h-4 w-4" />}
              label="Parcelas"
              value={`${expense.installment_number}/${expense.total_installments}x`}
            />
          )}

          {/* Responsável da parcela */}
          {expense && expense.paid_by && !expense.is_shared && isGroupContext && groupMembers.length > 0 && (
            <DetailRow
              icon={<User className="h-4 w-4" style={{ color: getMemberColor(expense.paid_by, groupMembers) }} />}
              label="Responsável"
              value={getUserDisplayName(expense.paid_by, groupMembers) || "?"}
              valueStyle={{ color: getMemberColor(expense.paid_by, groupMembers) }}
            />
          )}

          {/* Todas as parcelas da despesa com responsáveis */}
          {expense && expense.total_installments && expense.total_installments > 1 && siblingExpenseInstallments.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer ml-7 mt-1">
                <ChevronDown className="h-3.5 w-3.5" />
                Ver todas as parcelas
              </CollapsibleTrigger>
              <CollapsibleContent className="ml-7 mt-2 space-y-1.5">
                {siblingExpenseInstallments.map((s) => {
                  const isCurrent = s.id === expense.id;
                  const responsibleName = s.paid_by && groupMembers.length > 0
                    ? getUserDisplayName(s.paid_by, groupMembers)
                    : null;
                  const responsibleColor = s.paid_by && groupMembers.length > 0
                    ? getMemberColor(s.paid_by, groupMembers)
                    : undefined;
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-center justify-between text-xs px-2 py-1 rounded",
                        isCurrent ? "bg-primary/10 font-semibold" : ""
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={isCurrent ? "text-foreground" : "text-muted-foreground"}>
                          {s.installment_number}/{s.total_installments} — {format(parseLocalDate(s.expense_date), "MMM/yyyy", { locale: ptBR })}
                        </span>
                        {responsibleName && (
                          <span className="text-[10px] px-1 py-0.5 rounded bg-muted" style={responsibleColor ? { color: responsibleColor } : undefined}>
                            {responsibleName}
                          </span>
                        )}
                      </div>
                      <span className={isCurrent ? "text-red-500 dark:text-red-400 font-bold" : "font-medium text-foreground"}>
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(s.amount)}
                      </span>
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Parcelas de entrada */}
          {income && (income as any).total_installments > 1 && (
            <>
              <DetailRow
                icon={<Layers className="h-4 w-4" />}
                label="Tipo"
                value="Entrada Parcelada"
              />
              <DetailRow
                icon={<CreditCard className="h-4 w-4" />}
                label="Parcela"
                value={`${(income as any).installment_number}/${(income as any).total_installments}`}
              />
              {siblingInstallments.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-primary hover:underline cursor-pointer ml-7 mt-1">
                    <ChevronDown className="h-3.5 w-3.5" />
                    Ver todas as parcelas
                  </CollapsibleTrigger>
                  <CollapsibleContent className="ml-7 mt-2 space-y-1.5">
                    {siblingInstallments.map((s) => {
                      const isCurrent = s.id === income.id;
                      return (
                        <div
                          key={s.id}
                          className={cn(
                            "flex items-center justify-between text-xs px-2 py-1 rounded",
                            isCurrent ? "bg-primary/10 font-semibold" : ""
                          )}
                        >
                          <span className={isCurrent ? "text-foreground" : "text-muted-foreground"}>
                            {s.installment_number}/{s.total_installments} — {format(parseLocalDate(s.income_date), "MMM/yyyy", { locale: ptBR })}
                          </span>
                          <span className={isCurrent ? "text-green-600 dark:text-green-400 font-bold" : "font-medium text-foreground"}>
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(s.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </>
          )}

          {/* Fatura (billing info for credit expenses) */}
          {expense && expense.payment_method === "credit" && (() => {
            const card = expense.card_id ? cardsData.find(c => c.id === expense.card_id) : null;
            if (!card || (card.due_day == null && card.closing_day == null)) return null;
            const config: CreditCardConfig = {
              opening_day: card.opening_day || 1,
              closing_day: card.closing_day || 15,
              due_day: card.due_day ?? undefined,
              days_before_due: card.days_before_due ?? undefined,
            };
            const expDate = parseLocalDate(expense.expense_date);
            const billingMonth = calculateBillingPeriod(expDate, config);
            const billingLabel = formatBillingPeriodLabel(billingMonth);
            const dates = getNextBillingDates(config, expDate);
            const closingStr = format(dates.closingDate, "dd/MM");
            const dueStr = format(dates.dueDate, "dd/MM");
            return (
              <DetailRow
                icon={<Receipt className="h-4 w-4 text-primary" />}
                label="Fatura"
                value={`${billingLabel} (fecha ${closingStr}, vence ${dueStr})`}
              />
            );
          })()}

          {/* Grupo compartilhado */}
          {expense?.shared_group && (
            <DetailRow
              icon={<Users className="h-4 w-4 text-indigo-500" />}
              label="Grupo"
              value={expense.shared_group.name}
            />
          )}

          {/* Rateio - despesa compartilhada */}
          {expense?.is_shared && expense.splits && expense.splits.length > 0 && (
            <>
              <div className="pt-2 pb-1">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5" />
                  Rateio
                </p>
              </div>
              {expense.paid_by && (
                <DetailRow
                  icon={<User className="h-4 w-4" />}
                  label="Pago por"
                  value={
                    groupMembers.find(m => m.user_id === expense.paid_by)
                      ? getUserDisplayName(expense.paid_by!, groupMembers) || '?'
                      : getUserDisplayName(expense.user_id, groupMembers) || '?'
                  }
                  valueStyle={expense.paid_by ? { color: getMemberColor(expense.paid_by, groupMembers) } : undefined}
                />
              )}
              <DetailRow
                icon={<Users className="h-4 w-4" />}
                label="Tipo"
                value={`${splitTypeLabels[(expense.split_type as SplitType) || 'equal']} • ${expense.splits.length} participantes`}
              />
              <div className="space-y-1 ml-7">
                {expense.splits.map(s => {
                  const name = s.user_email?.split('@')[0] || '?';
                  const color = getMemberColor(s.user_id, groupMembers);
                  const isMe = s.user_id === user?.id;
                  return (
                    <div key={s.id || s.user_id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className={isMe ? 'font-semibold' : ''}>{name}{isMe ? ' (você)' : ''}</span>
                      </div>
                      <span className="font-medium">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(s.share_amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {user && (() => {
                const mySplit = expense.splits!.find(s => s.user_id === user.id);
                if (!mySplit) return null;
                return (
                  <DetailRow
                    icon={<Receipt className="h-4 w-4 text-primary" />}
                    label="Sua parte"
                    value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(mySplit.share_amount)}
                  />
                );
              })()}
            </>
          )}

          {/* Status ativo (recurring) */}
          {isRecurring && onToggleActive && (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground shrink-0"><Power className="h-4 w-4" /></span>
              <span className="text-sm text-muted-foreground shrink-0 w-20">Status</span>
              <div className="flex items-center gap-2">
                <Switch
                  checked={(recurringExpense || recurringIncome)!.is_active}
                  onCheckedChange={(checked) =>
                    onToggleActive((recurringExpense || recurringIncome)!.id, checked)
                  }
                />
                <span className="text-sm font-medium text-foreground">
                  {(recurringExpense || recurringIncome)!.is_active ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
          )}

{/* Criado em */}
<DetailRow
  icon={<Clock className="h-4 w-4" />}
  label="Criado em"
  value={format(new Date(createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
/>

{/* Criado por */}
{isGroupContext && createdByName && createdByColor && (
  <DetailRow
    icon={<User className="h-4 w-4" style={{ color: createdByColor }} />}
    label="Criado por"
    value={createdByName}
    valueStyle={{ color: createdByColor }}
  />
)}
        </div>

        <Separator />

        {(() => {
          const isOwner = !isGroupContext || createdByUserId === user?.id;
          // Hide actions for secondary installments in a series
          if (!isOwner || isSeriesSecondary) return null;
          return (
            <DrawerFooter className="flex-row gap-2 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
              <Button
                variant="outline"
                className="flex-1 gap-1.5 touch-manipulation"
                onClick={() => handleAction(onEdit)}
              >
                <Pencil className="h-4 w-4" />
                Editar{isSeries && isFirstInstallment ? " série" : ""}
              </Button>
              {!isRecurring && onDuplicate && !isSeries && (
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5 touch-manipulation"
                  onClick={() => handleAction(onDuplicate)}
                >
                  <Copy className="h-4 w-4" />
                  Duplicar
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1 gap-1.5 text-destructive hover:text-destructive touch-manipulation"
                onClick={() => handleAction(onDelete)}
              >
                <Trash2 className="h-4 w-4" />
                Excluir{isSeries && isFirstInstallment ? " série" : ""}
              </Button>
            </DrawerFooter>
          );
        })()}
      </DrawerContent>
    </Drawer>
  );
}

function DetailRow({
  icon,
  label,
  value,
  valueStyle,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueStyle?: CSSProperties;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-sm text-muted-foreground shrink-0 w-20">{label}</span>
      <span className="text-sm font-medium text-foreground truncate" style={valueStyle}>
        {value}
      </span>
    </div>
  );
}
