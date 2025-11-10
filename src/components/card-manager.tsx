import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardFormData, cardTypeLabels } from "@/types/card";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card as CardUI, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CreditCard, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function CardManager() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState<CardFormData>({
    name: "",
    card_type: "credit",
    opening_day: undefined,
    closing_day: undefined,
    card_limit: undefined,
    color: "#FFA500",
  });

  const availableColors = [
    { name: "Amarelo", value: "#FFA500" },
    { name: "Roxo", value: "#9333EA" },
    { name: "Azul", value: "#3B82F6" },
    { name: "Verde", value: "#10B981" },
    { name: "Vermelho", value: "#EF4444" },
    { name: "Laranja", value: "#F97316" },
    { name: "Rosa", value: "#EC4899" },
    { name: "Índigo", value: "#6366F1" },
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
      setCards(data || []);
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

    if (!formData.name.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe o nome do cartão.",
        variant: "destructive",
      });
      return;
    }

    if (formData.card_type === "credit" && (!formData.closing_day || formData.closing_day < 1 || formData.closing_day > 31)) {
      toast({
        title: "Erro",
        description: "Por favor, informe um dia de fechamento válido (1-31).",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const cardData: any = {
        name: formData.name.trim(),
        card_type: formData.card_type,
        user_id: user.id,
        color: formData.color || "#FFA500",
      };

      if (formData.card_type === "credit") {
        const closingDay = formData.closing_day!;
        const openingDay = closingDay === 1 ? 31 : closingDay - 1;
        cardData.closing_day = closingDay;
        cardData.opening_day = openingDay;
      }

      if (formData.card_limit && formData.card_limit > 0) {
        cardData.card_limit = formData.card_limit;
      }

      if (editingCard) {
        const { error } = await supabase
          .from("cards")
          .update(cardData)
          .eq("id", editingCard.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Cartão atualizado com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from("cards")
          .insert([cardData]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Cartão adicionado com sucesso!",
        });
      }

      resetForm();
      loadCards();
    } catch (error) {
      console.error("Erro ao salvar cartão:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o cartão.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (card: Card) => {
    setEditingCard(card);
    setFormData({
      name: card.name,
      card_type: card.card_type as "credit" | "debit",
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
      const { error } = await supabase
        .from("cards")
        .update({ is_active: false })
        .eq("id", deleteCardId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cartão removido com sucesso!",
      });

      setDeleteCardId(null);
      loadCards();
    } catch (error) {
      console.error("Erro ao remover cartão:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o cartão.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      card_type: "credit",
      opening_day: undefined,
      closing_day: undefined,
      card_limit: undefined,
      color: "#FFA500",
    });
    setEditingCard(null);
    setShowForm(false);
  };

  if (loading) {
    return <div className="text-center py-4">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Meus Cartões</h2>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Cartão
        </Button>
      </div>

      {showForm && (
        <CardUI>
          <CardHeader>
            <CardTitle>{editingCard ? "Editar Cartão" : "Novo Cartão"}</CardTitle>
            <CardDescription>
              {editingCard ? "Atualize as informações do seu cartão" : "Adicione um novo cartão de crédito ou débito"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Cartão</Label>
                <Input
                  id="name"
                  placeholder="Ex: Nubank, Inter Débito"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="card_type">Tipo</Label>
                <Select
                  value={formData.card_type}
                  onValueChange={(value) => setFormData({ ...formData, card_type: value as "credit" | "debit" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Crédito</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.card_type === "credit" && (
                <div className="space-y-2">
                  <Label htmlFor="closing_day">Dia de Fechamento da Fatura</Label>
                  <Input
                    id="closing_day"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Ex: 15"
                    value={formData.closing_day || ""}
                    onChange={(e) => setFormData({ ...formData, closing_day: parseInt(e.target.value) || undefined })}
                  />
                  <p className="text-sm text-muted-foreground">
                    O período de abertura será calculado automaticamente (dia anterior ao fechamento)
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="card_limit">Limite do Cartão (Opcional)</Label>
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

              <div className="space-y-2">
                <Label>Cor do Cartão</Label>
                <div className="grid grid-cols-4 gap-2">
                  {availableColors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`h-10 rounded-lg border-2 transition-all ${
                        formData.color === color.value
                          ? "border-primary ring-2 ring-primary/20 scale-105"
                          : "border-border hover:border-primary/50"
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    >
                      {formData.color === color.value && (
                        <span className="text-white text-xl">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit">{editingCard ? "Atualizar" : "Adicionar"}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </CardUI>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <CardUI key={card.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: card.color || "#FFA500" }}
                  >
                    <CreditCard className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{card.name}</CardTitle>
                    <CardDescription>{cardTypeLabels[card.card_type as "credit" | "debit"]}</CardDescription>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => handleEdit(card)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteCardId(card.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {card.card_type === "credit" && (
                <div className="text-sm">
                  <span className="font-medium">Fechamento:</span> Dia {card.closing_day}
                  <br />
                  <span className="font-medium">Abertura:</span> Dia {card.opening_day}
                </div>
              )}
              {card.card_limit && (
                <div className="text-sm">
                  <span className="font-medium">Limite:</span> R$ {Number(card.card_limit).toFixed(2)}
                </div>
              )}
            </CardContent>
          </CardUI>
        ))}
      </div>

      {cards.length === 0 && !showForm && (
        <CardUI>
          <CardContent className="text-center py-8">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum cartão cadastrado</p>
            <p className="text-sm text-muted-foreground mt-2">
              Clique em "Adicionar Cartão" para começar
            </p>
          </CardContent>
        </CardUI>
      )}

      <AlertDialog open={!!deleteCardId} onOpenChange={(open) => !open && setDeleteCardId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este cartão? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
