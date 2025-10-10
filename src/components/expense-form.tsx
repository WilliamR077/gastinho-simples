import { useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PlusCircle, CalendarIcon } from "lucide-react"
import { PaymentMethod, ExpenseFormData, ExpenseCategory, categoryLabels, categoryIcons } from "@/types/expense"
import { cn } from "@/lib/utils"

interface ExpenseFormProps {
  onAddExpense: (data: ExpenseFormData) => void
}

export function ExpenseForm({ onAddExpense }: ExpenseFormProps) {
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("")
  const [expenseDate, setExpenseDate] = useState<Date>(new Date())
  const [installments, setInstallments] = useState("1")
  const [category, setCategory] = useState<ExpenseCategory>("outros")

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
      category
    })
    
    // Reset form
    setDescription("")
    setAmount("")
    setPaymentMethod("")
    setExpenseDate(new Date())
    setInstallments("1")
    setCategory("outros")
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
            <Input
              id="description"
              placeholder="Ex: Almoço, Transporte, Supermercado..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                  {expenseDate ? format(expenseDate, "PPP") : <span>Selecione a data</span>}
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
            <Label htmlFor="category">Categoria</Label>
            <Select value={category} onValueChange={(value: ExpenseCategory) => setCategory(value)}>
              <SelectTrigger className="transition-all duration-300 focus:shadow-elegant">
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