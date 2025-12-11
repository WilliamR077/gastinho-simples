import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PlusCircle, CalendarIcon, AlertTriangle } from "lucide-react"
import { PaymentMethod, ExpenseFormData, Expense } from "@/types/expense"
import { cn, normalizeToLocalDate, parseLocalDate } from "@/lib/utils"
import { supabase } from "@/integrations/supabase/client"
import { Card as CardType } from "@/types/card"
import { BudgetGoal } from "@/types/budget-goal"
import { RecurringExpense } from "@/types/recurring-expense"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CategorySelector } from "@/components/category-selector"
import { useCategories } from "@/hooks/use-categories"
import { DescriptionAutocomplete } from "@/components/description-autocomplete"

interface ExpenseFormProps {
  onAddExpense: (data: ExpenseFormData) => void;
  budgetGoals?: BudgetGoal[];
  expenses?: Expense[];
  recurringExpenses?: RecurringExpense[];
}

export function ExpenseForm({ 
  onAddExpense, 
  budgetGoals = [], 
  expenses = [], 
  recurringExpenses = [] 
}: ExpenseFormProps) {
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("")
  const [expenseDate, setExpenseDate] = useState<Date>(normalizeToLocalDate(new Date()))
  const [installments, setInstallments] = useState("1")
  const [categoryId, setCategoryId] = useState<string>("")
  const [cardId, setCardId] = useState<string>("")
  const { activeCategories } = useCategories()
  const [cards, setCards] = useState<CardType[]>([])

  useEffect(() => {
    loadCards()
  }, [])

  const loadCards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })

      if (error) throw error
      setCards(data || [])
    } catch (error) {
      console.error("Erro ao carregar cartões:", error)
    }
  }

  const getAvailableCards = () => {
    if (!paymentMethod) return [];
    
    return cards.filter(card => {
      if (card.card_type === 'both') return true;
      if (paymentMethod === 'credit') return card.card_type === 'credit';
      if (paymentMethod === 'debit') return card.card_type === 'debit';
      return false;
    });
  };

  // Encontrar a categoria selecionada para verificação de orçamento
  const selectedCategory = activeCategories.find(c => c.id === categoryId);

  const budgetWarning = useMemo(() => {
    if (!categoryId || !selectedCategory) return null;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Buscar meta mensal total (por enquanto, categorias personalizadas não têm metas específicas)
    const monthlyGoal = budgetGoals.find(g => g.type === "monthly_total");

    const relevantGoal = monthlyGoal;
    if (!relevantGoal) return null;

    // Calcular gastos atuais
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
    }

    const limit = Number(relevantGoal.limit_amount);
    const percentage = (totalSpent / limit) * 100;
    const remaining = limit - totalSpent;

    if (percentage >= 70) {
      return {
        percentage,
        remaining,
        limit,
        goalType: "mensal",
        isOver: remaining < 0,
      };
    }

    return null;
  }, [categoryId, selectedCategory, budgetGoals, expenses, recurringExpenses]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!description.trim() || !amount || !paymentMethod) {
      return
    }

    const numericAmount = parseFloat(amount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return
    }

    const installmentCount = paymentMethod === "credit" ? parseInt(installments) : 1
    
    onAddExpense({
      description: description.trim(),
      amount: numericAmount,
      paymentMethod,
      expenseDate,
      installments: installmentCount,
      category: selectedCategory?.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_") as any || "outros",
      cardId: cardId || undefined,
      categoryId: categoryId || undefined,
    })
    
    // Reset form
    setDescription("")
    setAmount("")
    setPaymentMethod("")
    setExpenseDate(normalizeToLocalDate(new Date()))
    setInstallments("1")
    setCategoryId("")
    setCardId("")
  }

  return (
    <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <PlusCircle className="h-5 w-5" />
          Registrar Nova Despesa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <DescriptionAutocomplete
              value={description}
              onChange={setDescription}
              placeholder="Ex: Almoço, Transporte, Supermercado..."
              className="transition-all duration-300 focus:shadow-elegant"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="transition-all duration-300 focus:shadow-elegant"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="expense-date">Data do Gasto</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal transition-all duration-300 focus:shadow-elegant",
                    !expenseDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expenseDate ? format(expenseDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : <span>Selecione a data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expenseDate}
                  onSelect={(date) => date && setExpenseDate(normalizeToLocalDate(date))}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <CategorySelector
              value={categoryId}
              onValueChange={setCategoryId}
              triggerClassName="transition-all duration-300 focus:shadow-elegant"
            />

            {budgetWarning && (
              <Alert className={`mt-2 ${budgetWarning.isOver ? 'border-destructive bg-destructive/10' : 'border-orange-500 bg-orange-500/10'}`}>
                <AlertTriangle className={`h-4 w-4 ${budgetWarning.isOver ? 'text-destructive' : 'text-orange-600'}`} />
                <AlertDescription className={budgetWarning.isOver ? 'text-destructive' : 'text-orange-600'}>
                  <strong>
                    {budgetWarning.isOver 
                      ? '🚨 Meta estourada!' 
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
            <Label htmlFor="payment-method">Forma de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={(value: PaymentMethod) => setPaymentMethod(value)}>
              <SelectTrigger className="transition-all duration-300 focus:shadow-elegant">
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
              <Label htmlFor="card">Selecione o Cartão</Label>
              <Select value={cardId} onValueChange={setCardId}>
                <SelectTrigger className="transition-all duration-300 focus:shadow-elegant">
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
              <Label htmlFor="installments">Número de Parcelas</Label>
              <Select value={installments} onValueChange={setInstallments}>
                <SelectTrigger className="transition-all duration-300 focus:shadow-elegant">
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
            className="w-full bg-gradient-primary hover:scale-105 transition-all duration-300 shadow-elegant"
            disabled={!description.trim() || !amount || !paymentMethod}
          >
            Adicionar Despesa
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}