import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FilterX, ChevronDown, CalendarIcon } from "lucide-react";
import { PaymentMethod } from "@/types/expense";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card as CardType } from "@/types/card";
import { generateBillingPeriods, CreditCardConfig } from "@/utils/billing-period";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type FilterTab = "expenses" | "incomes";

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
  activeFilterTab?: FilterTab;
  onFilterTabChange?: (tab: FilterTab) => void;
  monthStartDate?: Date;
  monthEndDate?: Date;
}

export function ExpenseFilters({ 
  filters, 
  onFiltersChange, 
  billingPeriods = [],
  expenses = [],
  creditCardConfig,
  cardsConfigMap,
  activeFilterTab = "expenses",
  onFilterTabChange,
  monthStartDate,
  monthEndDate,
}: ExpenseFiltersProps) {
  const [localFilters, setLocalFilters] = useState<ExpenseFilters>({
    ...filters,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [cards, setCards] = useState<CardType[]>([]);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
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
    if (localFilters.cardId && expenses.length > 0 && cardsConfigMap) {
      const selectedCard = cards.find(c => c.id === localFilters.cardId);
      
      if (selectedCard && selectedCard.opening_day !== null && selectedCard.closing_day !== null) {
        const cardExpenses = expenses.filter(e => e.card_id === localFilters.cardId);
        
        if (cardExpenses.length === 0) return [];
        
        const cardConfig: CreditCardConfig = {
          opening_day: selectedCard.opening_day,
          closing_day: selectedCard.closing_day,
        };
        
        return generateBillingPeriods(cardExpenses, cardConfig);
      }
    }
    
    return billingPeriods;
  }, [localFilters.cardId, expenses, cards, cardsConfigMap, billingPeriods]);

  const handleFilterChange = (key: keyof ExpenseFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    
    if (key === 'cardId') {
      newFilters.billingPeriod = undefined;
    }
    
    setLocalFilters(newFilters);
  };

  const applyFilters = () => {
    const appliedFilters = { ...localFilters };
    
    // Se tem data personalizada, sobrescrever as datas do MonthNavigator
    if (customStartDate) {
      appliedFilters.startDate = customStartDate;
    }
    if (customEndDate) {
      appliedFilters.endDate = customEndDate;
    }
    
    onFiltersChange(appliedFilters);
  };

  const clearFilters = () => {
    // Restaurar datas do MonthNavigator
    const defaultFilters: ExpenseFilters = {
      startDate: monthStartDate || filters.startDate,
      endDate: monthEndDate || filters.endDate,
    };
    setLocalFilters(defaultFilters);
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
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
            {/* Filtro de Data Personalizada */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Sub-abas: Despesas / Entradas */}
            <Tabs value={activeFilterTab} onValueChange={(v) => onFilterTabChange?.(v as FilterTab)} className="mb-4">
              <TabsList className="grid w-full grid-cols-2 h-9">
                <TabsTrigger value="expenses" className="text-sm">Despesas</TabsTrigger>
                <TabsTrigger value="incomes" className="text-sm">Entradas</TabsTrigger>
              </TabsList>

              <TabsContent value="expenses">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

                  {/* Filtro de Fatura do Cartão */}
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
              </TabsContent>

              <TabsContent value="incomes">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Filtro de Descrição */}
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      placeholder="Ex: Salário, Freelance..."
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
                </div>
              </TabsContent>
            </Tabs>

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
