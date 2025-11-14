import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RecurringExpenseFormData, PaymentMethod, ExpenseCategory } from "@/types/recurring-expense"
import { categoryLabels, categoryIcons } from "@/types/expense"
import { Calendar } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Card as CardType } from "@/types/card"

interface RecurringExpenseFormProps {
  onAddRecurringExpense: (data: RecurringExpenseFormData) => void
}

export function RecurringExpenseForm({ onAddRecurringExpense }: RecurringExpenseFormProps) {
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit")
  const [dayOfMonth, setDayOfMonth] = useState("1")
  const [category, setCategory] = useState<ExpenseCategory>("outros")
  const [cardId, setCardId] = useState<string>("")
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!description || !amount || parseFloat(amount) <= 0) {
      return
    }

    onAddRecurringExpense({
      description,
      amount: parseFloat(amount),
      paymentMethod,
      dayOfMonth: parseInt(dayOfMonth),
      category,
      cardId: cardId || undefined
    })

    setDescription("")
    setAmount("")
    setPaymentMethod("credit")
    setDayOfMonth("1")
    setCategory("outros")
    setCardId("")
  }

  return (
    <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-primary flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Nova Despesa Fixa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recurring-description">Descrição</Label>
            <Input
              id="recurring-description"
              placeholder="Ex: Academia, Streaming, Escola"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-amount">Valor (R$)</Label>
            <Input
              id="recurring-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-day">Dia da Cobrança</Label>
            <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
              <SelectTrigger id="recurring-day" className="bg-background/50">
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

          <div className="space-y-2">
            <Label htmlFor="recurring-category">Categoria</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as ExpenseCategory)}>
              <SelectTrigger id="recurring-category" className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {categoryIcons[key as ExpenseCategory]} {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-payment">Forma de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
              <SelectTrigger id="recurring-payment" className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit">Cartão de Crédito</SelectItem>
                <SelectItem value="debit">Cartão de Débito</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(paymentMethod === "credit" || paymentMethod === "debit") && (
            <div className="space-y-2">
              <Label htmlFor="recurring-card">Selecione o Cartão</Label>
              <Select value={cardId} onValueChange={setCardId}>
                <SelectTrigger id="recurring-card" className="bg-background/50">
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

          <Button type="submit" className="w-full">
            Adicionar Despesa Fixa
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
