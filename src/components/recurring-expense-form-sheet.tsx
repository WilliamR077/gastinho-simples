import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RecurringExpenseFormData, PaymentMethod } from "@/types/recurring-expense";
import { supabase } from "@/integrations/supabase/client";
import { Card as CardType } from "@/types/card";
import { useSharedGroups } from "@/hooks/use-shared-groups";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Users, User } from "lucide-react";
import { CategorySelector } from "@/components/category-selector";
import { useCategories } from "@/hooks/use-categories";

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
  const [category, setCategory] = useState<string>("");
  const [cardId, setCardId] = useState<string>("");
  const [cards, setCards] = useState<CardType[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<string>("personal");

  const { groups, currentContext } = useSharedGroups();
  const { activeCategories } = useCategories();

  // Atualiza o destino selecionado quando o contexto atual muda ou o sheet abre
  useEffect(() => {
    if (open) {
      if (currentContext.type === "group" && currentContext.groupId) {
        setSelectedDestination(currentContext.groupId);
      } else {
        setSelectedDestination("personal");
      }
    }
  }, [open, currentContext]);

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
    setCategory(activeCategories.find(c => c.name.toLowerCase() === "outros")?.id || activeCategories[0]?.id || "");
    setCardId("");
    // Mantém o destino baseado no contexto atual
    if (currentContext.type === "group" && currentContext.groupId) {
      setSelectedDestination(currentContext.groupId);
    } else {
      setSelectedDestination("personal");
    }
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
      categoryId: category,
      cardId: cardId || undefined,
      sharedGroupId: selectedDestination !== "personal" ? selectedDestination : undefined,
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
                  <RadioGroupItem value="personal" id="recurring-personal" />
                  <Label htmlFor="recurring-personal" className="flex items-center gap-2 cursor-pointer font-normal">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Meus Gastos Pessoais
                  </Label>
                </div>
                {groups.map((group) => (
                  <div key={group.id} className="flex items-center space-x-3">
                    <RadioGroupItem value={group.id} id={`recurring-${group.id}`} />
                    <Label htmlFor={`recurring-${group.id}`} className="flex items-center gap-2 cursor-pointer font-normal">
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
            <CategorySelector
              value={category}
              onValueChange={setCategory}
            />
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
