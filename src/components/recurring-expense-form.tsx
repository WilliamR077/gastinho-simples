import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RecurringExpenseFormData } from "@/types/recurring-expense"
import { PaymentMethod } from "@/types/expense"
import { Calendar } from "lucide-react"

interface RecurringExpenseFormProps {
  onAddRecurringExpense: (data: RecurringExpenseFormData) => void
}

export function RecurringExpenseForm({ onAddRecurringExpense }: RecurringExpenseFormProps) {
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit")
  const [dayOfMonth, setDayOfMonth] = useState("1")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!description || !amount || parseFloat(amount) <= 0) {
      return
    }

    onAddRecurringExpense({
      description,
      amount: parseFloat(amount),
      paymentMethod,
      dayOfMonth: parseInt(dayOfMonth)
    })

    setDescription("")
    setAmount("")
    setPaymentMethod("credit")
    setDayOfMonth("1")
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
            <Label htmlFor="recurring-day">Dia do Vencimento</Label>
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

          <Button type="submit" className="w-full">
            Adicionar Despesa Fixa
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
