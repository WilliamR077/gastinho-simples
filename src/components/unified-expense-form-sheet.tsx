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
import { DescriptionAutocomplete } from "@/components/description-autocomplete";

type ExpenseType = "monthly" | "recurring";

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
  
  const { activeCategories } = useCategories();
  const { groups, currentContext } = useSharedGroups();

  useEffect(() => {
    if (open) {
      if (currentContext.type === "group" && currentContext.groupId) {
        setSelectedDestination(currentContext.groupId);
      } else {
        setSelectedDestination("personal");
      }
      if (defaultAmount !== undefined && defaultAmount > 0) {
        setAmount(defaultAmount.toString());
      }
    }
  }, [open, currentContext, defaultAmount]);

  useEffect(() => {
    if (open) {
      loadCards();
    }
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
    if (!paymentMethod) return [];

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
    if (currentContext.type === "group" && currentContext.groupId) {
      setSelectedDestination(currentContext.groupId);
    } else {
      setSelectedDestination("personal");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim() || !amount || !paymentMethod) {
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return;
    }

    if (expenseType === "monthly") {
      const installmentCount = paymentMethod === "credit" ? parseInt(installments) : 1;

      onAddExpense({
        description: description.trim(),
        amount: numericAmount,
        paymentMethod,
        expenseDate,
        installments: installmentCount,
        categoryId: category,
        cardId: cardId || undefined,
        sharedGroupId: selectedDestination !== "personal" ? selectedDestination : undefined,
      });
    } else {
      onAddRecurringExpense({
        description: description.trim(),
        amount: numericAmount,
        paymentMethod,
        dayOfMonth: parseInt(dayOfMonth),
        categoryId: category,
        cardId: cardId || undefined,
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
          <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
            <Label className="text-sm font-medium">Tipo de Despesa</Label>
            <RadioGroup
              value={expenseType}
              onValueChange={(v) => setExpenseType(v as ExpenseType)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="monthly" id="expense-monthly" />
                <Label htmlFor="expense-monthly" className="cursor-pointer font-normal">
                  Despesa do Mês
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="recurring" id="expense-recurring" />
                <Label htmlFor="expense-recurring" className="cursor-pointer font-normal">
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

          <div className="space-y-2" data-tour="form-description">
            <Label htmlFor="sheet-description">Descrição</Label>
            <DescriptionAutocomplete
              value={description}
              onChange={setDescription}
              placeholder={expenseType === "monthly" ? "Ex: Almoço, Transporte, Supermercado..." : "Ex: Academia, Streaming, Escola"}
            />
          </div>

          <div className="space-y-2" data-tour="form-amount">
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
            <div className="space-y-2" data-tour="form-date">
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
                <PopoverContent className="w-auto p-0" align="start">
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
            <div className="space-y-2">
              <Label htmlFor="sheet-day">Dia da Cobrança</Label>
              <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                <SelectTrigger id="sheet-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      Dia {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2" data-tour="form-category">
            <Label htmlFor="sheet-category">Categoria</Label>
            <CategorySelector
              value={category}
              onValueChange={setCategory}
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

          <div className="space-y-2" data-tour="form-payment">
            <Label htmlFor="sheet-payment-method">Forma de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={(value: PaymentMethod) => setPaymentMethod(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="debit">Cartão de Débito</SelectItem>
                <SelectItem value="credit">Cartão de Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(paymentMethod === "credit" || paymentMethod === "debit") && (
            <div className="space-y-2">
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

          {/* Parcelas - apenas para despesa do mês no crédito */}
          {expenseType === "monthly" && paymentMethod === "credit" && (
            <div className="space-y-2">
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

          <div data-tour="form-submit">
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
