import { useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card as CardType } from "@/types/card";
import { PaymentMethod } from "@/types/expense";
import { requiresCard } from "@/lib/payment-methods";
import { CardManagerSheet } from "@/components/card-manager-sheet";

interface CardSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  paymentMethod: PaymentMethod | "";
  className?: string;
  triggerClassName?: string;
  /** Callback opcional para o pai receber a lista atualizada de cartões
   *  (útil para previews de fatura / limite ao lado do campo). */
  onCardsLoaded?: (cards: CardType[]) => void;
}

/**
 * Campo "Cartão" reutilizável. Replica o padrão do CategorySelector:
 * inclui um botão "Gerenciar cartões..." dentro do SelectContent que abre
 * o CardManager em um Sheet, sem o usuário precisar sair do formulário.
 *
 * Comportamento:
 * - Cartão é opcional: pode salvar despesa sem vínculo a cartão.
 * - Ao fechar o gerenciador, recarrega cartões; se o usuário criou um único
 *   cartão novo compatível durante a sessão do modal, pré-seleciona-o.
 * - Se o cartão atualmente selecionado deixar de existir/ser compatível,
 *   limpa o campo (cardId vazio).
 */
export function CardSelector({
  value,
  onValueChange,
  paymentMethod,
  className,
  triggerClassName,
  onCardsLoaded,
}: CardSelectorProps) {
  const [cards, setCards] = useState<CardType[]>([]);
  const [showManager, setShowManager] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const idsBeforeManagerRef = useRef<Set<string>>(new Set());

  const loadCards = async (): Promise<CardType[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const loaded = (data || []) as CardType[];
      setCards(loaded);
      onCardsLoaded?.(loaded);
      return loaded;
    } catch (err) {
      console.error("Erro ao carregar cartões:", err);
      return [];
    }
  };

  useEffect(() => {
    loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getAvailableCards = () => {
    if (!paymentMethod || !requiresCard(paymentMethod)) return [];
    return cards.filter((card) => {
      if (card.card_type === "both") return true;
      if (paymentMethod === "credit") return card.card_type === "credit";
      if (paymentMethod === "debit") return card.card_type === "debit";
      return false;
    });
  };

  const handleOpenManager = () => {
    setIsOpen(false);
    idsBeforeManagerRef.current = new Set(cards.map((c) => c.id));
    setTimeout(() => setShowManager(true), 100);
  };

  const handleManagerOpenChange = async (open: boolean) => {
    setShowManager(open);
    if (!open) {
      const loaded = await loadCards();
      // Filtrar pela compatibilidade com paymentMethod atual
      const compatible = loaded.filter((card) => {
        if (!paymentMethod || !requiresCard(paymentMethod)) return false;
        if (card.card_type === "both") return true;
        if (paymentMethod === "credit") return card.card_type === "credit";
        if (paymentMethod === "debit") return card.card_type === "debit";
        return false;
      });

      // Se o cartão atualmente selecionado não existe mais ou é incompatível, limpa.
      if (value && !compatible.some((c) => c.id === value)) {
        // Procura cartões compatíveis novos criados durante a sessão do modal.
        const newCompatibles = compatible.filter(
          (c) => !idsBeforeManagerRef.current.has(c.id)
        );
        if (newCompatibles.length === 1) {
          onValueChange(newCompatibles[0].id);
        } else {
          onValueChange("");
        }
        return;
      }

      // Conveniência: usuário não tinha cartão selecionado e criou exatamente
      // um cartão compatível novo → pré-seleciona.
      if (!value) {
        const newCompatibles = compatible.filter(
          (c) => !idsBeforeManagerRef.current.has(c.id)
        );
        if (newCompatibles.length === 1) {
          onValueChange(newCompatibles[0].id);
        }
      }
    }
  };

  const available = getAvailableCards();
  const hasCompatible = available.length > 0;

  return (
    <>
      {hasCompatible ? (
        <>
          <Select
            value={value}
            onValueChange={onValueChange}
            open={isOpen}
            onOpenChange={setIsOpen}
          >
            <SelectTrigger className={`${className ?? ""} ${triggerClassName ?? ""}`}>
              <SelectValue placeholder="Selecione o cartão (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {available.map((card) => (
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

              <Separator className="my-1" />

              <div className="p-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-start text-sm h-9"
                  onClick={handleOpenManager}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Gerenciar cartões...
                </Button>
              </div>
            </SelectContent>
          </Select>
          {!value && (
            <p className="text-xs text-muted-foreground">
              Sem cartão selecionado. A despesa será salva sem vínculo a um cartão.
            </p>
          )}
        </>
      ) : (
        <Alert className="border-primary/40 bg-primary/5">
          <CreditCard className="h-4 w-4 text-primary" />
          <AlertDescription className="text-foreground">
            Você ainda não tem cartões compatíveis cadastrados. A despesa será
            salva sem vínculo a um cartão.
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 ml-1 text-primary"
              onClick={handleOpenManager}
            >
              Cadastrar cartão agora →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <CardManagerSheet open={showManager} onOpenChange={handleManagerOpenChange} />
    </>
  );
}
