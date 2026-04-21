import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CalendarIcon, AlertTriangle, Users, User } from "lucide-react";
import { ExpenseSplitSection } from "@/components/expense-split-section";
import { SplitType, SplitParticipant } from "@/types/expense-split";
import { SharedGroupMember } from "@/types/shared-group";
import { PaymentMethod, ExpenseFormData, Expense } from "@/types/expense";
import { RecurringExpenseFormData } from "@/types/recurring-expense";
import { cn, normalizeToLocalDate, parseLocalDate } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Card as CardType } from "@/types/card";
import { BudgetGoal } from "@/types/budget-goal";
import { RecurringExpense } from "@/types/recurring-expense";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSharedGroups } from "@/hooks/use-shared-groups";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CategorySelector } from "@/components/category-selector";
import { useCategories } from "@/hooks/use-categories";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";
import { DescriptionAutocomplete } from "@/components/description-autocomplete";
import { calculateBillingPeriod, formatBillingPeriodLabel, CreditCardConfig } from "@/utils/billing-period";
import { CardLimitSummary } from "@/components/card-limit-summary";
import { type CardLimitSummary as CardLimitSummaryData } from "@/utils/card-limit-view-model";
import {
  PAYMENT_METHOD_LIST,
  requiresCard,
  allowsInstallments,
  clearCardDependentFieldsIfNeeded,
} from "@/lib/payment-methods";

type ExpenseType = "monthly" | "recurring";

export interface ExpenseInitialData {
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  expenseDate?: Date;
  categoryId?: string;
  cardId?: string;
  expenseType: "monthly" | "recurring";
  dayOfMonth?: number;
  installments?: number;
  sharedGroupId?: string | null;
}

interface UnifiedExpenseFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddExpense: (data: ExpenseFormData) => void;
  onAddRecurringExpense: (data: RecurringExpenseFormData) => void;
  budgetGoals?: BudgetGoal[];
  expenses?: Expense[];
  recurringExpenses?: RecurringExpense[];
  defaultAmount?: number;
  preventClose?: boolean;
  initialData?: ExpenseInitialData;
  groupMembers?: SharedGroupMember[];
  currentUserId?: string;
  cardLimitSummaries?: Map<string, CardLimitSummaryData>;
}

export function UnifiedExpenseFormSheet({
  open,
  onOpenChange,
  onAddExpense,
  onAddRecurringExpense,
  budgetGoals = [],
  expenses = [],
  recurringExpenses = [],
  defaultAmount,
  preventClose,
  initialData,
  groupMembers = [],
  currentUserId = '',
  cardLimitSummaries,
}: UnifiedExpenseFormSheetProps) {
  const [expenseType, setExpenseType] = useState<ExpenseType>("monthly");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [expenseDate, setExpenseDate] = useState<Date>(normalizeToLocalDate(new Date()));
  const [installments, setInstallments] = useState("1");
  const [category, setCategory] = useState<string>("");
  const [cardId, setCardId] = useState<string>("");
  const [cards, setCards] = useState<CardType[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<string>("personal");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  // Split state
  const [isShared, setIsShared] = useState(false);
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [splitParticipants, setSplitParticipants] = useState<SplitParticipant[]>([]);
  // Installment responsible state
  const [installmentAssignment, setInstallmentAssignment] = useState<"same" | "per_installment">("same");
  const [installmentResponsibles, setInstallmentResponsibles] = useState<Record<number, string>>({});
  const [sameResponsible, setSameResponsible] = useState(currentUserId);
  
  const { activeCategories } = useCategories();
  const { groups, currentContext } = useSharedGroups();
  const { isOpen: isOnboardingOpen, currentStep, currentSubstep } = useOnboardingTour();
  const selectedCardLimitSummary = paymentMethod === "credit" && cardId
    ? cardLimitSummaries?.get(cardId)
    : undefined;
  const isExpenseTypeLocked =
    isOnboardingOpen &&
    ((currentStep?.id === "add-expense" && currentSubstep?.id === "expense-type-info") ||
     (currentStep?.id === "add-recurring-expense" && currentSubstep?.id === "recurring-type-info"));

  useEffect(() => {
    if (open) {
      if (initialData) {
        setExpenseType(initialData.expenseType);
        setDescription(initialData.description);
        setAmount(initialData.amount.toString());
        setPaymentMethod(initialData.paymentMethod);
        setCategory(initialData.categoryId || "");
        setCardId(initialData.cardId || "");
        setExpenseDate(initialData.expenseDate || normalizeToLocalDate(new Date()));
        setDayOfMonth(initialData.dayOfMonth?.toString() || "1");
        setInstallments(initialData.installments?.toString() || "1");
        setSelectedDestination(initialData.sharedGroupId || "personal");
      } else {
        if (currentContext.type === "group" && currentContext.groupId) {
          setSelectedDestination(currentContext.groupId);
        } else {
          setSelectedDestination("personal");
        }
        if (defaultAmount !== undefined && defaultAmount > 0) {
          setAmount(defaultAmount.toString());
        }
      }
    }
  }, [open, currentContext, defaultAmount, initialData]);

  useEffect(() => {
    if (open) {
      loadCards();
    }
  }, [open]);

  // Lock expense type based on which onboarding step is active
  const lockedType: ExpenseType | null =
    isOnboardingOpen && currentStep?.id === "add-recurring-expense" ? "recurring" :
    isOnboardingOpen && currentStep?.id === "add-expense" ? "monthly" :
    null;

  useEffect(() => {
    if (isExpenseTypeLocked && lockedType && expenseType !== lockedType) {
      setExpenseType(lockedType);
    }
  }, [expenseType, isExpenseTypeLocked, lockedType]);

  // Notify onboarding that the expense form is mounted and ready
  useEffect(() => {
    if (!open) return;
    // Wait for the form to render, then check for the type selector
    const timer = setTimeout(() => {
      const typeSelector = document.querySelector('[data-onboarding="expense-type-selector"]');
      if (typeSelector) {
        window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: "expense-form-opened" }));
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [open]);

  const loadCards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCards(data || []);
    } catch (error) {
      console.error("Erro ao carregar cartões:", error);
    }
  };

  const getAvailableCards = () => {
    if (!paymentMethod || !requiresCard(paymentMethod)) return [];

    return cards.filter((card) => {
      if (card.card_type === "both") return true;
      if (paymentMethod === "credit") return card.card_type === "credit";
      if (paymentMethod === "debit") return card.card_type === "debit";
      return false;
    });
  };

  const budgetWarning = useMemo(() => {
    if (!category) return null;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const categoryGoal = budgetGoals.find(
      (g) => g.type === "category" && g.category === category
    );
    const monthlyGoal = budgetGoals.find((g) => g.type === "monthly_total");

    const relevantGoal = categoryGoal || monthlyGoal;
    if (!relevantGoal) return null;

    const monthlyExpenses = expenses.filter((expense) => {
      const expDate = parseLocalDate(expense.expense_date);
      return (
        expDate.getMonth() === currentMonth &&
        expDate.getFullYear() === currentYear
      );
    });

    const activeRecurringExpenses = recurringExpenses.filter((re) => re.is_active);

    let totalSpent = 0;
    if (relevantGoal.type === "monthly_total") {
      totalSpent = monthlyExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
      totalSpent += activeRecurringExpenses.reduce((sum, re) => sum + Number(re.amount), 0);
    } else if (relevantGoal.type === "category" && relevantGoal.category) {
      totalSpent = monthlyExpenses
        .filter((exp) => exp.category === relevantGoal.category)
        .reduce((sum, exp) => sum + Number(exp.amount), 0);
      totalSpent += activeRecurringExpenses
        .filter((re) => re.category === relevantGoal.category)
        .reduce((sum, re) => sum + Number(re.amount), 0);
    }

    const limit = Number(relevantGoal.limit_amount);
    const percentage = (totalSpent / limit) * 100;
    const remaining = limit - totalSpent;

    if (percentage >= 70) {
      return {
        percentage,
        remaining,
        limit,
        goalType: relevantGoal.type === "monthly_total" ? "mensal" : "de categoria",
        isOver: remaining < 0,
      };
    }

    return null;
  }, [category, budgetGoals, expenses, recurringExpenses]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const resetForm = () => {
    setExpenseType("monthly");
    setDescription("");
    setAmount("");
    setPaymentMethod("");
    setExpenseDate(normalizeToLocalDate(new Date()));
    setInstallments("1");
    setCategory(activeCategories.find(c => c.name.toLowerCase() === "outros")?.id || activeCategories[0]?.id || "");
    setCardId("");
    setDayOfMonth("1");
    setIsShared(false);
    setPaidBy(currentUserId);
    setSplitType("equal");
    setSplitParticipants([]);
    setInstallmentAssignment("same");
    setInstallmentResponsibles({});
    setSameResponsible(currentUserId);
    if (currentContext.type === "group" && currentContext.groupId) {
      setSelectedDestination(currentContext.groupId);
    } else {
      setSelectedDestination("personal");
    }
  };

  const [splitError, setSplitError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSplitError(null);

    if (!description.trim() || !amount || !paymentMethod) {
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return;
    }

    if (requiresCard(paymentMethod) && !cardId) {
      setSplitError("Selecione um cartão para esta forma de pagamento.");
      return;
    }

    // Validações de split
    const isGroupDestination = selectedDestination !== "personal";
    if (isGroupDestination && isShared) {
      if (splitParticipants.length === 0) {
        setSplitError("Selecione pelo menos um participante para criar uma despesa compartilhada.");
        return;
      }
      if (splitType === 'percentage') {
        const totalPct = splitParticipants.reduce((s, p) => s + (p.percentage || 0), 0);
        if (Math.abs(totalPct - 100) > 0.1) return;
      }
      if (splitType === 'manual') {
        const totalAmt = splitParticipants.reduce((s, p) => s + p.amount, 0);
        if (Math.abs(totalAmt - numericAmount) > 0.01) return;
      }
    }

    // Validação de responsáveis por parcela — usa allowsInstallments para coerência.
    const installmentCount = allowsInstallments(paymentMethod) ? parseInt(installments) : 1;
    const sanitizedCardId = requiresCard(paymentMethod) ? (cardId || undefined) : undefined;
    const showInstallmentResponsible = isGroupDestination && allowsInstallments(paymentMethod) && installmentCount > 1 && expenseType === "monthly" && !isShared;
    if (showInstallmentResponsible && installmentAssignment === "per_installment") {
      for (let i = 1; i <= installmentCount; i++) {
        if (!installmentResponsibles[i]) {
          setSplitError(`Selecione o responsável pela parcela ${i}.`);
          return;
        }
      }
    }

    if (expenseType === "monthly") {
      onAddExpense({
        description: description.trim(),
        amount: numericAmount,
        paymentMethod,
        expenseDate,
        installments: installmentCount,
        categoryId: category,
        cardId: sanitizedCardId,
        sharedGroupId: selectedDestination !== "personal" ? selectedDestination : undefined,
        ...(isGroupDestination && isShared && splitParticipants.length > 0 && {
          isShared: true,
          paidBy: paidBy,
          splitType: splitType,
          participants: splitParticipants,
        }),
        ...(showInstallmentResponsible && {
          installmentAssignment,
          installmentResponsibles,
          sameResponsible,
        }),
      });
    } else {
      onAddRecurringExpense({
        description: description.trim(),
        amount: numericAmount,
        paymentMethod,
        dayOfMonth: parseInt(dayOfMonth),
        categoryId: category,
        cardId: sanitizedCardId,
        sharedGroupId: selectedDestination !== "personal" ? selectedDestination : undefined,
      });
    }

    resetForm();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          if (preventClose) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (preventClose) {
            e.preventDefault();
          }
        }}
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="text-primary">Nova Despesa</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pb-24">
          {/* Tipo de Despesa */}
          <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border" data-onboarding="expense-type-selector">
            <Label className="text-sm font-medium">Tipo de Despesa</Label>
            <RadioGroup
              value={expenseType}
              onValueChange={(v) => {
                if (isExpenseTypeLocked) return;
                setExpenseType(v as ExpenseType);
              }}
              className="flex gap-4"
              aria-disabled={isExpenseTypeLocked}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="monthly" id="expense-monthly" disabled={isExpenseTypeLocked} />
                <Label
                  htmlFor="expense-monthly"
                  className={cn(
                    "font-normal",
                    isExpenseTypeLocked ? "cursor-not-allowed opacity-80" : "cursor-pointer"
                  )}
                >
                  Despesa do Mês
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="recurring" id="expense-recurring" disabled={isExpenseTypeLocked} />
                <Label
                  htmlFor="expense-recurring"
                  className={cn(
                    "font-normal",
                    isExpenseTypeLocked ? "cursor-not-allowed opacity-80" : "cursor-pointer"
                  )}
                >
                  Despesa Fixa
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Seletor de Destino - só mostra se tem grupos */}
          {groups.length > 0 && (
            <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
              <Label className="text-sm font-medium">Adicionar em:</Label>
              <RadioGroup
                value={selectedDestination}
                onValueChange={setSelectedDestination}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="personal" id="personal" />
                  <Label htmlFor="personal" className="flex items-center gap-2 cursor-pointer font-normal">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Meus Gastos Pessoais
                  </Label>
                </div>
                {groups.map((group) => (
                  <div key={group.id} className="flex items-center space-x-3">
                    <RadioGroupItem value={group.id} id={group.id} />
                    <Label htmlFor={group.id} className="flex items-center gap-2 cursor-pointer font-normal">
                      <div 
                        className="w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: group.color }}
                      >
                        <Users className="h-2.5 w-2.5 text-white" />
                      </div>
                      {group.name}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          <div className="space-y-2" data-tour="form-description" data-onboarding="expense-description">
            <Label htmlFor="sheet-description">Descrição</Label>
            <DescriptionAutocomplete
              value={description}
              onChange={setDescription}
              placeholder={expenseType === "monthly" ? "Ex: Almoço, Transporte, Supermercado..." : "Ex: Academia, Streaming, Escola"}
            />
          </div>

          <div className="space-y-2" data-tour="form-amount" data-onboarding="expense-amount">
            <Label htmlFor="sheet-amount">Valor (R$)</Label>
            <Input
              id="sheet-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Campo condicional: Data (do mês) ou Dia da Cobrança (fixa) */}
          {expenseType === "monthly" ? (
            <div className="space-y-2" data-tour="form-date" data-onboarding="expense-date">
              <Label htmlFor="sheet-expense-date">Data do Gasto</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !expenseDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expenseDate
                      ? format(expenseDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : <span>Selecione a data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 z-[80]"
                  align="start"
                  data-onboarding="expense-date"
                >
                  <Calendar
                    mode="single"
                    selected={expenseDate}
                    onSelect={(date) => date && setExpenseDate(normalizeToLocalDate(date))}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div className="space-y-2" data-onboarding="expense-day-of-month">
              <Label htmlFor="sheet-day">Dia da Cobrança</Label>
              <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                <SelectTrigger id="sheet-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[80]">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      Dia {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2" data-tour="form-category" data-onboarding="expense-category-field">
            <Label htmlFor="sheet-category">Categoria</Label>
            <CategorySelector
              value={category}
              onValueChange={setCategory}
              onboardingTarget="expense-category-field"
            />

            {budgetWarning && (
              <Alert
                className={`mt-2 ${
                  budgetWarning.isOver
                    ? "border-destructive bg-destructive/10"
                    : "border-orange-500 bg-orange-500/10"
                }`}
              >
                <AlertTriangle
                  className={`h-4 w-4 ${
                    budgetWarning.isOver ? "text-destructive" : "text-orange-600"
                  }`}
                />
                <AlertDescription
                  className={budgetWarning.isOver ? "text-destructive" : "text-orange-600"}
                >
                  <strong>
                    {budgetWarning.isOver
                      ? "🚨 Meta estourada!"
                      : `⚠️ Atenção! ${budgetWarning.percentage.toFixed(0)}% da meta ${budgetWarning.goalType} usada`}
                  </strong>
                  <div className="text-sm mt-1">
                    {budgetWarning.isOver
                      ? `Você já excedeu o limite em ${formatCurrency(Math.abs(budgetWarning.remaining))}.`
                      : `Restam apenas ${formatCurrency(budgetWarning.remaining)} do orçamento de ${formatCurrency(budgetWarning.limit)}.`}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-2" data-tour="form-payment" data-onboarding="expense-payment">
            <Label htmlFor="sheet-payment-method">Forma de Pagamento</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value: PaymentMethod) => {
                const cleaned = clearCardDependentFieldsIfNeeded(value, {
                  cardId,
                  installments: parseInt(installments) || 1,
                });
                setPaymentMethod(value);
                setCardId(cleaned.cardId ?? "");
                setInstallments(String(cleaned.installments ?? 1));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_LIST.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresCard(paymentMethod) && (
            <div className="space-y-2" data-onboarding="expense-card-select">
              <Label htmlFor="sheet-card">Selecione o Cartão</Label>
              <Select value={cardId} onValueChange={setCardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cartão" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableCards().map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      <div className="flex items-center gap-2">
                        <div
                          style={{ backgroundColor: card.color }}
                          className="w-3 h-3 rounded-full"
                        />
                        {card.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {paymentMethod === "credit" && cardId && expenseType === "monthly" && (() => {
            const selectedCard = cards.find(c => c.id === cardId);
            if (!selectedCard) return null;
            const cardConfig: CreditCardConfig = {
              opening_day: selectedCard.opening_day || 1,
              closing_day: selectedCard.closing_day || 15,
              due_day: (selectedCard as any).due_day,
              days_before_due: (selectedCard as any).days_before_due,
            };
            const billingMonth = calculateBillingPeriod(expenseDate, cardConfig);
            const label = formatBillingPeriodLabel(billingMonth);
            return (
              <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-primary">Fatura: {label}</span>
              </div>
            );
          })()}

          {selectedCardLimitSummary && (
            <CardLimitSummary summary={selectedCardLimitSummary} variant="form" />
          )}


          {/* Parcelas - apenas para despesa do mês quando método permite */}
          {expenseType === "monthly" && allowsInstallments(paymentMethod) && (
            <div className="space-y-2" data-onboarding="expense-installments">
              <Label htmlFor="sheet-installments">Número de Parcelas</Label>
              <Select value={installments} onValueChange={setInstallments}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o número de parcelas" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}x de R$ {(parseFloat(amount || "0") / num).toFixed(2).replace(".", ",")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Seção de responsável por parcela - grupo, crédito, parcelas > 1, não compartilhada */}
          {expenseType === "monthly" && selectedDestination !== "personal" && groupMembers.length > 0 && paymentMethod === "credit" && parseInt(installments) > 1 && !isShared && (
            <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Responsável pelas parcelas
              </Label>
              <RadioGroup
                value={installmentAssignment}
                onValueChange={(v) => setInstallmentAssignment(v as "same" | "per_installment")}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="same" id="assign-same" />
                  <Label htmlFor="assign-same" className="cursor-pointer font-normal text-sm">
                    Mesmo responsável em todas
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="per_installment" id="assign-per" />
                  <Label htmlFor="assign-per" className="cursor-pointer font-normal text-sm">
                    Definir responsável por parcela
                  </Label>
                </div>
              </RadioGroup>

              {installmentAssignment === "same" && (
                <Select value={sameResponsible} onValueChange={setSameResponsible}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupMembers.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.user_email?.split("@")[0] || "?"}{m.user_id === currentUserId ? " (você)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {installmentAssignment === "per_installment" && (
                <div className="space-y-2">
                  {Array.from({ length: parseInt(installments) }, (_, i) => i + 1).map((num) => {
                    const installmentDate = new Date(expenseDate);
                    installmentDate.setMonth(installmentDate.getMonth() + (num - 1));
                    const monthLabel = format(installmentDate, "MMM/yyyy", { locale: ptBR });
                    const parcValue = (parseFloat(amount || "0") / parseInt(installments)).toFixed(2).replace(".", ",");
                    return (
                      <div key={num} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[120px]">
                          {num}/{installments} — {monthLabel} — R$ {parcValue}
                        </span>
                        <Select
                          value={installmentResponsibles[num] || ""}
                          onValueChange={(v) => setInstallmentResponsibles(prev => ({ ...prev, [num]: v }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Responsável" />
                          </SelectTrigger>
                          <SelectContent>
                            {groupMembers.map((m) => (
                              <SelectItem key={m.user_id} value={m.user_id}>
                                {m.user_email?.split("@")[0] || "?"}{m.user_id === currentUserId ? " (você)" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Aviso de bloqueio mútuo */}
          {expenseType === "monthly" && selectedDestination !== "personal" && groupMembers.length > 0 && paymentMethod === "credit" && parseInt(installments) > 1 && isShared && (
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-sm text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-4 w-4 inline mr-1.5" />
              Nesta versão, escolha entre despesa compartilhada ou responsáveis por parcela.
            </div>
          )}

          {/* Seção de rateio - apenas para grupo e despesa do mês, esconde se per_installment ativo */}
          {expenseType === "monthly" && selectedDestination !== "personal" && groupMembers.length > 0 && !(paymentMethod === "credit" && parseInt(installments) > 1 && installmentAssignment === "per_installment") && (
            <>
              <ExpenseSplitSection
                amount={parseFloat(amount || "0")}
                groupMembers={groupMembers}
                currentUserId={currentUserId}
                isShared={isShared}
                onIsSharedChange={(v) => { setIsShared(v); setSplitError(null); }}
                paidBy={paidBy}
                onPaidByChange={setPaidBy}
                splitType={splitType}
                onSplitTypeChange={setSplitType}
                participants={splitParticipants}
                onParticipantsChange={(p) => { setSplitParticipants(p); setSplitError(null); }}
              />
              {splitError && (
                <p className="text-xs text-destructive font-medium -mt-2 px-1">{splitError}</p>
              )}
            </>
          )}
          {/* Show splitError even when rateio section is hidden */}
          {splitError && paymentMethod === "credit" && parseInt(installments) > 1 && installmentAssignment === "per_installment" && (
            <p className="text-xs text-destructive font-medium px-1">{splitError}</p>
          )}

          <div data-tour="form-submit" data-onboarding="expense-submit-btn">
            <Button
              type="submit"
              className="w-full bg-gradient-primary"
              disabled={!description.trim() || !amount || !paymentMethod}
            >
              {expenseType === "monthly" ? "Adicionar Despesa" : "Adicionar Despesa Fixa"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
