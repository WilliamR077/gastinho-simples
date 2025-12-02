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
import { CalendarIcon, AlertTriangle } from "lucide-react";
import { PaymentMethod, ExpenseFormData, ExpenseCategory, categoryLabels, categoryIcons, Expense } from "@/types/expense";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Card as CardType } from "@/types/card";
import { BudgetGoal } from "@/types/budget-goal";
import { RecurringExpense } from "@/types/recurring-expense";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ExpenseFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddExpense: (data: ExpenseFormData) => void;
  budgetGoals?: BudgetGoal[];
  expenses?: Expense[];
  recurringExpenses?: RecurringExpense[];
}

export function ExpenseFormSheet({
  open,
  onOpenChange,
  onAddExpense,
  budgetGoals = [],
  expenses = [],
  recurringExpenses = [],
}: ExpenseFormSheetProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [expenseDate, setExpenseDate] = useState<Date>(new Date());
  const [installments, setInstallments] = useState("1");
  const [category, setCategory] = useState<ExpenseCategory>("outros");
  const [cardId, setCardId] = useState<string>("");
  const [cards, setCards] = useState<CardType[]>([]);

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
      const expenseDate = new Date(expense.expense_date);
      return (
        expenseDate.getMonth() === currentMonth &&
        expenseDate.getFullYear() === currentYear
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
    setDescription("");
    setAmount("");
    setPaymentMethod("");
    setExpenseDate(new Date());
    setInstallments("1");
    setCategory("outros");
    setCardId("");
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

    const installmentCount = paymentMethod === "credit" ? parseInt(installments) : 1;

    onAddExpense({
      description: description.trim(),
      amount: numericAmount,
      paymentMethod,
      expenseDate,
      installments: installmentCount,
      category,
      cardId: cardId || undefined,
    });

    resetForm();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-primary">Nova Despesa</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pb-24">
          <div className="space-y-2">
            <Label htmlFor="sheet-description">Descrição</Label>
            <Input
              id="sheet-description"
              placeholder="Ex: Almoço, Transporte, Supermercado..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
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

          <div className="space-y-2">
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
                  onSelect={(date) => date && setExpenseDate(date)}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sheet-category">Categoria</Label>
            <Select value={category} onValueChange={(value: ExpenseCategory) => setCategory(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {categoryIcons[key as ExpenseCategory]} {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

          <div className="space-y-2">
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

          {paymentMethod === "credit" && (
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

          <Button
            type="submit"
            className="w-full bg-gradient-primary"
            disabled={!description.trim() || !amount || !paymentMethod}
          >
            Adicionar Despesa
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
