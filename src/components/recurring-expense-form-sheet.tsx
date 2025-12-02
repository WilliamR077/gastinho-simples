import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RecurringExpenseFormData, PaymentMethod, ExpenseCategory } from "@/types/recurring-expense";
import { categoryLabels, categoryIcons } from "@/types/expense";
import { supabase } from "@/integrations/supabase/client";
import { Card as CardType } from "@/types/card";

interface RecurringExpenseFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddRecurringExpense: (data: RecurringExpenseFormData) => void;
}

export function RecurringExpenseFormSheet({
  open,
  onOpenChange,
  onAddRecurringExpense,
}: RecurringExpenseFormSheetProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit");
  const [dayOfMonth, setDayOfMonth] = useState("1");
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

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setPaymentMethod("credit");
    setDayOfMonth("1");
    setCategory("outros");
    setCardId("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!description || !amount || parseFloat(amount) <= 0) {
      return;
    }

    onAddRecurringExpense({
      description,
      amount: parseFloat(amount),
      paymentMethod,
      dayOfMonth: parseInt(dayOfMonth),
      category,
      cardId: cardId || undefined,
    });

    resetForm();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-primary">Nova Despesa Fixa</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pb-24">
          <div className="space-y-2">
            <Label htmlFor="recurring-sheet-description">Descrição</Label>
            <Input
              id="recurring-sheet-description"
              placeholder="Ex: Academia, Streaming, Escola"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-sheet-amount">Valor (R$)</Label>
            <Input
              id="recurring-sheet-amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recurring-sheet-day">Dia da Cobrança</Label>
            <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
              <SelectTrigger id="recurring-sheet-day">
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
            <Label htmlFor="recurring-sheet-category">Categoria</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as ExpenseCategory)}>
              <SelectTrigger id="recurring-sheet-category">
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
            <Label htmlFor="recurring-sheet-payment">Forma de Pagamento</Label>
            <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
              <SelectTrigger id="recurring-sheet-payment">
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
              <Label htmlFor="recurring-sheet-card">Selecione o Cartão</Label>
              <Select value={cardId} onValueChange={setCardId}>
                <SelectTrigger id="recurring-sheet-card">
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

          <Button type="submit" className="w-full bg-gradient-primary">
            Adicionar Despesa Fixa
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
