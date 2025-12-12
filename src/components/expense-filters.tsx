import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FilterX, ChevronDown } from "lucide-react";
import { PaymentMethod } from "@/types/expense";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card as CardType } from "@/types/card";
import { generateBillingPeriods, CreditCardConfig } from "@/utils/billing-period";

export interface ExpenseFilters {
  startDate?: Date;
  endDate?: Date;
  description?: string;
  minAmount?: number;
  maxAmount?: number;
  paymentMethod?: PaymentMethod;
  billingPeriod?: string;
  cardId?: string;
}

interface ExpenseFiltersProps {
  filters: ExpenseFilters;
  onFiltersChange: (filters: ExpenseFilters) => void;
  billingPeriods?: Array<{ value: string; label: string }>;
  expenses?: Array<{ expense_date: string; payment_method: string; card_id?: string | null }>;
  creditCardConfig?: CreditCardConfig | null;
  cardsConfigMap?: Map<string, CreditCardConfig>;
}

export function ExpenseFilters({ 
  filters, 
  onFiltersChange, 
  billingPeriods = [],
  expenses = [],
  creditCardConfig,
  cardsConfigMap
}: ExpenseFiltersProps) {
  const [localFilters, setLocalFilters] = useState<ExpenseFilters>({
    ...filters,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [cards, setCards] = useState<CardType[]>([]);
  const { user } = useAuth();

  // Sync localFilters when parent filters change (e.g., from MonthNavigator)
  useEffect(() => {
    setLocalFilters(prev => ({
      ...prev,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }));
  }, [filters.startDate, filters.endDate]);

  useEffect(() => {
    if (user) {
      loadCards();
    }
  }, [user]);

  const loadCards = async () => {
    try {
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("user_id", user?.id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCards(data || []);
    } catch (error) {
      console.error("Error loading cards:", error);
    }
  };

  // Gerar períodos de fatura baseado no cartão selecionado
  const filteredBillingPeriods = useMemo(() => {
    // Se tem um cartão selecionado e temos os dados necessários
    if (localFilters.cardId && expenses.length > 0 && cardsConfigMap) {
      const selectedCard = cards.find(c => c.id === localFilters.cardId);
      
      if (selectedCard && selectedCard.opening_day !== null && selectedCard.closing_day !== null) {
        // Filtrar despesas apenas do cartão selecionado
        const cardExpenses = expenses.filter(e => e.card_id === localFilters.cardId);
        
        if (cardExpenses.length === 0) return [];
        
        // Gerar períodos usando a config do cartão específico
        const cardConfig: CreditCardConfig = {
          opening_day: selectedCard.opening_day,
          closing_day: selectedCard.closing_day,
        };
        
        return generateBillingPeriods(cardExpenses, cardConfig);
      }
    }
    
    // Se não tem cartão selecionado, usar todos os períodos
    return billingPeriods;
  }, [localFilters.cardId, expenses, cards, cardsConfigMap, billingPeriods]);

  const handleFilterChange = (key: keyof ExpenseFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    
    // Se mudou o cartão, limpar o filtro de fatura (pois as faturas podem ser diferentes)
    if (key === 'cardId') {
      newFilters.billingPeriod = undefined;
    }
    
    setLocalFilters(newFilters);
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
  };

  const clearFilters = () => {
    // Keep the current date range from MonthNavigator, only clear other filters
    const defaultFilters: ExpenseFilters = {
      startDate: filters.startDate,
      endDate: filters.endDate,
    };
    setLocalFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

  // Verificar se o cartão selecionado é de crédito
  const selectedCard = localFilters.cardId ? cards.find(c => c.id === localFilters.cardId) : null;
  const showBillingPeriodFilter = 
    (filteredBillingPeriods.length > 0) && 
    (!localFilters.cardId || selectedCard?.card_type === 'credit' || selectedCard?.card_type === 'both');

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-primary flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FilterX className="h-5 w-5" />
                Filtros
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Filtro de Descrição */}
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  placeholder="Ex: Almoço, Gasolina..."
                  value={localFilters.description || ''}
                  onChange={(e) => handleFilterChange('description', e.target.value)}
                />
              </div>

              {/* Filtro de Valor Mínimo */}
              <div className="space-y-2">
                <Label>Valor Mínimo (R$)</Label>
                <Input
                  type="number"
                  placeholder="0,00"
                  step="0.01"
                  value={localFilters.minAmount || ''}
                  onChange={(e) => handleFilterChange('minAmount', parseFloat(e.target.value) || undefined)}
                />
              </div>

              {/* Filtro de Valor Máximo */}
              <div className="space-y-2">
                <Label>Valor Máximo (R$)</Label>
                <Input
                  type="number"
                  placeholder="0,00"
                  step="0.01"
                  value={localFilters.maxAmount || ''}
                  onChange={(e) => handleFilterChange('maxAmount', parseFloat(e.target.value) || undefined)}
                />
              </div>

              {/* Filtro de Forma de Pagamento */}
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select
                  value={localFilters.paymentMethod || 'all'}
                  onValueChange={(value) => handleFilterChange('paymentMethod', value === 'all' ? undefined : value as PaymentMethod)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as formas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as formas</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro de Cartão */}
              <div className="space-y-2">
                <Label>Cartão</Label>
                <Select
                  value={localFilters.cardId || 'all'}
                  onValueChange={(value) => handleFilterChange('cardId', value === 'all' ? undefined : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os cartões" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os cartões</SelectItem>
                    {cards.map(card => (
                      <SelectItem key={card.id} value={card.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            style={{ backgroundColor: card.color || "#FFA500" }} 
                            className="w-3 h-3 rounded-full" 
                          />
                          {card.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro de Fatura do Cartão - só aparece para cartões de crédito */}
              {showBillingPeriodFilter && (
                <div className="space-y-2">
                  <Label>
                    {localFilters.cardId ? `Fatura - ${selectedCard?.name}` : 'Fatura do Cartão'}
                  </Label>
                  <Select
                    value={localFilters.billingPeriod || 'all'}
                    onValueChange={(value) => handleFilterChange('billingPeriod', value === 'all' ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as faturas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as faturas</SelectItem>
                      {filteredBillingPeriods.map(period => (
                        <SelectItem key={period.value} value={period.value}>
                          {period.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={applyFilters} className="flex-1">
                Aplicar Filtros
              </Button>
              <Button variant="outline" onClick={clearFilters}>
                Limpar
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
