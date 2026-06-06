import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RecurringExpenseFormData, PaymentMethod } from "@/types/recurring-expense"
import { Calendar } from "lucide-react"
import { CategorySelector } from "@/components/category-selector"
import { CardSelector } from "@/components/card-selector"
import { useCategories } from "@/hooks/use-categories"
import {
  PAYMENT_METHOD_LIST,
  requiresCard,
  clearCardDependentFieldsIfNeeded,
} from "@/lib/payment-methods"

interface RecurringExpenseFormProps {
  onAddRecurringExpense: (data: RecurringExpenseFormData) => void
}

export function RecurringExpenseForm({ onAddRecurringExpense }: RecurringExpenseFormProps) {
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit")
  const [dayOfMonth, setDayOfMonth] = useState("1")
  const [categoryId, setCategoryId] = useState<string>("")
  const [cardId, setCardId] = useState<string>("")
  const { activeCategories } = useCategories()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!description || !amount || parseFloat(amount) <= 0) {
      return
    }

    // Cartão é opcional: se o método exige cartão mas nenhum foi selecionado,
    // a despesa é gravada sem vínculo.

    const sanitizedCardId = requiresCard(paymentMethod) ? (cardId || undefined) : undefined;
    const selectedCategory = activeCategories.find(c => c.id === categoryId);

    onAddRecurringExpense({
      description,
      amount: parseFloat(amount),
      paymentMethod,
      dayOfMonth: parseInt(dayOfMonth),
      category: selectedCategory?.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_") as any || "outros",
      cardId: sanitizedCardId,
      categoryId: categoryId || undefined,
    })

    setDescription("")
    setAmount("")
    setPaymentMethod("credit")
    setDayOfMonth("1")
    setCategoryId("")
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
            <CategorySelector
              value={categoryId}
              onValueChange={setCategoryId}
              triggerClassName="bg-background/50"
              context="recurring"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-payment">Forma de Pagamento</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => {
                const newMethod = value as PaymentMethod;
                const cleaned = clearCardDependentFieldsIfNeeded(newMethod, { cardId });
                setPaymentMethod(newMethod);
                setCardId(cleaned.cardId ?? "");
              }}
            >
              <SelectTrigger id="recurring-payment" className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_LIST.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresCard(paymentMethod) && (
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
