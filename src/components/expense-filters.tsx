import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FilterX, ChevronDown } from "lucide-react";
import { PaymentMethod, ExpenseCategory, categoryLabels, categoryIcons } from "@/types/expense";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card as CardType } from "@/types/card";

export interface ExpenseFilters {
  startDate?: Date;
  endDate?: Date;
  description?: string;
  minAmount?: number;
  maxAmount?: number;
  paymentMethod?: PaymentMethod;
  billingPeriod?: string;
  category?: ExpenseCategory;
  cardId?: string;
}

interface ExpenseFiltersProps {
  filters: ExpenseFilters;
  onFiltersChange: (filters: ExpenseFilters) => void;
  billingPeriods?: Array<{ value: string; label: string }>;
}

export function ExpenseFilters({ filters, onFiltersChange, billingPeriods = [] }: ExpenseFiltersProps) {
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

  const handleFilterChange = (key: keyof ExpenseFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
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

              {/* Filtro de Categoria */}
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={localFilters.category || 'all'}
                  onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value as ExpenseCategory)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {categoryIcons[key as ExpenseCategory]} {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              {billingPeriods.length > 0 && (
                <div className="space-y-2">
                  <Label>Fatura do Cartão</Label>
                  <Select
                    value={localFilters.billingPeriod || 'all'}
                    onValueChange={(value) => handleFilterChange('billingPeriod', value === 'all' ? undefined : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as faturas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as faturas</SelectItem>
                      {billingPeriods.map(period => (
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