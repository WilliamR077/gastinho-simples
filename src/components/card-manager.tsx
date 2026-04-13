import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardFormData, CardType, cardTypeLabels } from "@/types/card";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/use-subscription";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";
import { Button } from "@/components/ui/button";
import { Card as CardUI, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, CreditCard, Crown, MoreVertical, Pencil, Trash2, Check, CalendarClock, CalendarCheck, Loader2, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { getNextBillingDates, getClosingDateForBillingMonth, calculateBillingPeriod } from "@/utils/billing-period";
import { formatCurrencyLocaleWithVisibility } from "@/lib/utils";

interface CardExpense {
  amount: number;
  expense_date: string;
  card_id: string;
  installment_group_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
}

interface CardLimitInfo {
  currentInvoice: number;
  committedLimit: number;
  available: number;
  percentage: number;
}

export function CardManager() {
  const [cards, setCards] = useState<Card[]>([]);
  const [cardExpenses, setCardExpenses] = useState<CardExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const { canAddCard, features } = useSubscription();
  const { isOpen: isOnboardingOpen, currentStep, notifyEvent } = useOnboardingTour();
  const navigate = useNavigate();

  // Notify onboarding when form opens
  useEffect(() => {
    if (isOnboardingOpen && currentStep?.id === "add-card" && showForm) {
      notifyEvent("card-form-opened");
    }
  }, [showForm, isOnboardingOpen, currentStep?.id]);

  const [formData, setFormData] = useState<CardFormData>({
    name: "",
    card_type: "credit",
    due_day: undefined,
    days_before_due: 10,
    closing_day: undefined,
    opening_day: undefined,
    card_limit: undefined,
    color: "#FFA500",
  });

  // P2: Expanded color palette with visually distinct, dark-mode-friendly colors
  const availableColors = [
    { name: "Amarelo", value: "#FFA500" },
    { name: "Roxo", value: "#9333EA" },
    { name: "Azul", value: "#3B82F6" },
    { name: "Verde", value: "#10B981" },
    { name: "Vermelho", value: "#EF4444" },
    { name: "Laranja", value: "#F97316" },
    { name: "Rosa", value: "#EC4899" },
    { name: "Índigo", value: "#6366F1" },
    { name: "Ciano", value: "#06B6D4" },
    { name: "Lima", value: "#84CC16" },
    { name: "Amber", value: "#F59E0B" },
    { name: "Teal", value: "#14B8A6" },
    { name: "Fúcsia", value: "#D946EF" },
    { name: "Slate", value: "#64748B" },
    { name: "Sky", value: "#0EA5E9" },
    { name: "Esmeralda", value: "#059669" },
  ];

  useEffect(() => {
    loadCards();
  }, []);

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
      const loadedCards = data || [];
      setCards(loadedCards);

      // Fetch expenses for cards with limits
      const cardsWithLimit = loadedCards.filter(c => c.card_limit && Number(c.card_limit) > 0);
      if (cardsWithLimit.length > 0) {
        const cardIds = cardsWithLimit.map(c => c.id);
        const { data: expData } = await supabase
          .from("expenses")
          .select("amount, expense_date, card_id, installment_group_id, installment_number, total_installments")
          .eq("user_id", user.id)
          .eq("payment_method", "credit")
          .in("card_id", cardIds);
        setCardExpenses(expData || []);
      } else {
        setCardExpenses([]);
      }
    } catch (error) {
      console.error("Erro ao carregar cartões:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os cartões.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return;

    if (!formData.name.trim()) {
      toast({ title: "Erro", description: "Informe o nome do cartão.", variant: "destructive" });
      return;
    }

    const isCreditType = formData.card_type === "credit" || formData.card_type === "both";

    if (isCreditType && (!formData.due_day || formData.due_day < 1 || formData.due_day > 31)) {
      toast({ title: "Erro", description: "Informe um dia de vencimento válido (1-31).", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const cardData: any = {
        name: formData.name.trim(),
        card_type: formData.card_type,
        user_id: user.id,
        color: formData.color || "#FFA500",
      };

      if (isCreditType && formData.due_day) {
        const daysBefore = formData.days_before_due || 10;
        const now = new Date();
        const { closingDate } = getClosingDateForBillingMonth(now.getFullYear(), now.getMonth(), formData.due_day, daysBefore);
        const closingDay = closingDate.getDate();
        const openingDay = closingDay === 31 ? 1 : closingDay + 1;
        cardData.due_day = formData.due_day;
        cardData.days_before_due = daysBefore;
        cardData.closing_day = closingDay;
        cardData.opening_day = openingDay;
      }

      if (formData.card_limit && formData.card_limit > 0) {
        cardData.card_limit = formData.card_limit;
      }

      if (editingCard) {
        const { error } = await supabase.from("cards").update(cardData).eq("id", editingCard.id);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Cartão atualizado com sucesso!" });
      } else {
        const { error } = await supabase.from("cards").insert([cardData]);
        if (error) throw error;
        toast({ title: "Sucesso", description: "Cartão adicionado com sucesso!" });
        // Notify onboarding engine
        if (isOnboardingOpen && currentStep?.id === "add-card") {
          notifyEvent("card-submitted");
        }
      }

      resetForm();
      loadCards();
    } catch (error) {
      console.error("Erro ao salvar cartão:", error);
      toast({ title: "Erro", description: "Não foi possível salvar o cartão.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (card: Card) => {
    setEditingCard(card);
    setFormData({
      name: card.name,
      card_type: card.card_type as CardType,
      due_day: (card as any).due_day || undefined,
      days_before_due: (card as any).days_before_due || 10,
      opening_day: card.opening_day || undefined,
      closing_day: card.closing_day || undefined,
      card_limit: card.card_limit ? Number(card.card_limit) : undefined,
      color: card.color || "#FFA500",
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteCardId) return;
    try {
      const { error } = await supabase.from("cards").update({ is_active: false }).eq("id", deleteCardId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Cartão removido com sucesso!" });
      setDeleteCardId(null);
      loadCards();
    } catch (error) {
      console.error("Erro ao remover cartão:", error);
      toast({ title: "Erro", description: "Não foi possível remover o cartão.", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      card_type: "credit",
      due_day: undefined,
      days_before_due: 10,
      closing_day: undefined,
      opening_day: undefined,
      card_limit: undefined,
      color: "#FFA500",
    });
    setEditingCard(null);
    setShowForm(false);
  };

  const handleAddCard = () => {
    if (!canAddCard(cards.length)) {
      toast({
        title: "Cartões ilimitados no Premium ⭐",
        description: `Você atingiu o limite de ${features.cards} cartões do plano atual. Virar Premium para desbloquear!`,
        variant: "destructive",
      });
      navigate("/subscription");
      return;
    }
    setShowForm(!showForm);
  };

  const getCardBillingInfo = (card: Card) => {
    const isCreditType = card.card_type === "credit" || card.card_type === "both";
    if (!isCreditType) return null;

    const dueDay = (card as any).due_day;
    const daysBefore = (card as any).days_before_due;

    if (dueDay && daysBefore) {
      return getNextBillingDates({
        opening_day: card.opening_day || 1,
        closing_day: card.closing_day || 15,
        due_day: dueDay,
        days_before_due: daysBefore,
      }, new Date());
    }

    if (card.closing_day) {
      return getNextBillingDates({
        opening_day: card.opening_day || 1,
        closing_day: card.closing_day,
      }, new Date());
    }

    return null;
  };

  const formatDateShort = (date: Date) => {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="text-center py-4">Carregando...</div>;
  }

  const canAddMoreCards = canAddCard(cards.length);
  const isCreditType = formData.card_type === "credit" || formData.card_type === "both";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <h2 className="text-2xl font-semibold">Meus Cartões</h2>
        <div className="flex flex-wrap items-center gap-2">
          {!canAddMoreCards && (
            <Button variant="outline" size="sm" onClick={() => navigate("/subscription")} className="gap-2">
              <Crown className="h-4 w-4" />
              <span className="hidden sm:inline">Upgrade</span>
            </Button>
          )}
          <Button
            onClick={handleAddCard}
            size="sm"
            disabled={!canAddMoreCards && !editingCard}
            data-onboarding="cards-add-btn"
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Adicionar Cartão</span>
          </Button>
        </div>
      </div>

      {!canAddMoreCards && !showForm && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-sm">
          <p className="text-foreground">
            <strong>Cartões ilimitados no Premium</strong>
            <br />
            Virar Premium e libere <strong>cartões ilimitados</strong> + muito mais!
            {' '}<span className="underline cursor-pointer font-semibold text-primary" onClick={() => navigate("/subscription")}>Virar Premium ⭐</span>
          </p>
        </div>
      )}

      {showForm && (
        <CardUI>
          <CardHeader>
            <CardTitle>{editingCard ? "Editar Cartão" : "Novo Cartão"}</CardTitle>
            <CardDescription>
              {editingCard ? "Atualize as informações do seu cartão" : "Adicione um novo cartão"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" data-onboarding="card-form">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Cartão</Label>
                <Input
                  id="name"
                  placeholder="Ex: Nubank, Inter"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-onboarding="card-name-input"
                />
              </div>

              <div className="space-y-2" data-onboarding="card-type-select">
                <Label htmlFor="card_type">Tipo</Label>
                <Select value={formData.card_type} onValueChange={(value) => setFormData({ ...formData, card_type: value as CardType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(cardTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isCreditType && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="due_day">Dia de Vencimento da Fatura</Label>
                    <Input
                      id="due_day"
                      type="number"
                      min="1"
                      max="31"
                      placeholder="Ex: 10"
                      value={formData.due_day || ""}
                      onChange={(e) => setFormData({ ...formData, due_day: parseInt(e.target.value) || undefined })}
                      data-onboarding="card-due-day-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="days_before_due">Dias antes do vencimento que fecha</Label>
                    <Input
                      id="days_before_due"
                      type="number"
                      min="1"
                      max="28"
                      placeholder="Ex: 10"
                      value={formData.days_before_due || ""}
                      onChange={(e) => setFormData({ ...formData, days_before_due: parseInt(e.target.value) || 10 })}
                      data-onboarding="card-close-days-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      Quantos dias antes do vencimento a fatura fecha (geralmente 7 a 12 dias)
                    </p>
                  </div>

                  {formData.due_day && formData.days_before_due && (() => {
                    const billing = getNextBillingDates({
                      opening_day: 1, closing_day: 15,
                      due_day: formData.due_day, days_before_due: formData.days_before_due,
                    }, new Date());
                    return (
                      <div className="bg-primary/10 rounded-lg p-3 space-y-1">
                        <p className="text-sm font-medium text-primary">
                          Vence dia {formData.due_day} • Fecha {formData.days_before_due} dias antes
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Próximo fechamento: {formatDateShort(billing.closingDate)} • Próximo vencimento: {formatDateShort(billing.dueDate)}
                        </p>
                      </div>
                    );
                  })()}
                </>
              )}

              <div className="space-y-2" data-onboarding="card-limit-input">
                <Label htmlFor="card_limit">Limite (Opcional)</Label>
                <Input
                  id="card_limit"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 5000.00"
                  value={formData.card_limit || ""}
                  onChange={(e) => setFormData({ ...formData, card_limit: parseFloat(e.target.value) || undefined })}
                />
              </div>

              <div className="space-y-2" data-onboarding="card-color-picker">
                <Label>Cor do Cartão</Label>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        formData.color === color.value
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    >
                      {formData.color === color.value && (
                        <Check className="h-4 w-4 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" data-onboarding="card-submit-btn" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    editingCard ? "Atualizar" : "Adicionar"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </CardUI>
      )}

      <div className="space-y-3">
        {cards.map((card) => {
          const billing = getCardBillingInfo(card);
          return (
            <CardUI key={card.id} className="overflow-hidden">
              <div className="flex">
                <div className="w-2 shrink-0" style={{ backgroundColor: card.color || "#FFA500" }} />
                <div className="flex-1 p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-base">{card.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {cardTypeLabels[card.card_type as CardType] || card.card_type}
                        </Badge>
                      </div>
                      {card.card_limit && (
                        <p className="text-sm text-muted-foreground">
                          Limite: R$ {Number(card.card_limit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                      {billing && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5" />
                            Fecha: {formatDateShort(billing.closingDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarCheck className="h-3.5 w-3.5" />
                            Vence: {formatDateShort(billing.dueDate)}
                          </span>
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(card)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteCardId(card.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </CardUI>
          );
        })}
      </div>

      {cards.length === 0 && !showForm && (
        <div className="text-center py-8 text-muted-foreground">
          <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Nenhum cartão cadastrado</p>
          <p className="text-sm mt-1">Adicione seu primeiro cartão para começar</p>
        </div>
      )}

      <AlertDialog open={!!deleteCardId} onOpenChange={(open) => !open && setDeleteCardId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              O cartão será desativado. Despesas já vinculadas a ele continuarão com o registro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
