import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { SlidersHorizontal, X, ChevronDown, CalendarIcon } from "lucide-react";
import { PaymentMethod } from "@/types/expense";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card as CardType } from "@/types/card";
import { generateBillingPeriods, CreditCardConfig } from "@/utils/billing-period";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ExpenseFilters } from "@/components/expense-filters";
import { Badge } from "@/components/ui/badge";

interface CompactFilterBarProps {
  filters: ExpenseFilters;
  onFiltersChange: (filters: ExpenseFilters) => void;
  billingPeriods?: Array<{ value: string; label: string }>;
  expenses?: Array<{ expense_date: string; payment_method: string; card_id?: string | null }>;
  creditCardConfig?: CreditCardConfig | null;
  cardsConfigMap?: Map<string, CreditCardConfig>;
  activeTab: "expenses" | "incomes" | "goals";
  monthStartDate?: Date;
  monthEndDate?: Date;
}

export function CompactFilterBar({
  filters,
  onFiltersChange,
  billingPeriods = [],
  expenses = [],
  creditCardConfig,
  cardsConfigMap,
  activeTab,
  monthStartDate,
  monthEndDate,
}: CompactFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localFilters, setLocalFilters] = useState<ExpenseFilters>({ ...filters });
  const [cards, setCards] = useState<CardType[]>([]);
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const { user } = useAuth();

  useEffect(() => {
    setLocalFilters(prev => ({
      ...prev,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }));
  }, [filters.startDate, filters.endDate]);

  useEffect(() => {
    if (user) {
      supabase
        .from("cards")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("name")
        .then(({ data }) => setCards(data || []));
    }
  }, [user]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.description) count++;
    if (filters.minAmount !== undefined) count++;
    if (filters.maxAmount !== undefined) count++;
    if (filters.paymentMethod) count++;
    if (filters.cardId) count++;
    if (filters.billingPeriod) count++;
    return count;
  }, [filters]);

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
    if (key === 'cardId') newFilters.billingPeriod = undefined;
    setLocalFilters(newFilters);
  };

  const applyFilters = () => {
    const appliedFilters = { ...localFilters };
    if (customStartDate) appliedFilters.startDate = customStartDate;
    if (customEndDate) appliedFilters.endDate = customEndDate;
    onFiltersChange(appliedFilters);
    setIsExpanded(false);
  };

  const clearFilters = () => {
    const defaultFilters: ExpenseFilters = {
      startDate: monthStartDate || filters.startDate,
      endDate: monthEndDate || filters.endDate,
    };
    setLocalFilters(defaultFilters);
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
    onFiltersChange(defaultFilters);
  };

  const selectedCard = localFilters.cardId ? cards.find(c => c.id === localFilters.cardId) : null;
  const showBillingPeriodFilter =
    activeTab === "expenses" &&
    filteredBillingPeriods.length > 0 &&
    (!localFilters.cardId || selectedCard?.card_type === 'credit' || selectedCard?.card_type === 'both');

  const periodLabel = filters.startDate
    ? format(filters.startDate, "MMM yyyy", { locale: ptBR })
    : "Período";

  return (
    <div className="rounded-lg border border-border/40 bg-card shadow-sm overflow-hidden" data-tour="expense-filters">
      {/* Compact bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground capitalize">{periodLabel}</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 font-semibold">
              {activeFilterCount} {activeFilterCount === 1 ? 'filtro' : 'filtros'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                clearFilters();
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
        </div>
      </button>

      {/* Expanded filter form */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border/30 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {/* Custom date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("w-full justify-start text-left font-normal h-9", !customStartDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {customStartDate ? format(customStartDate, "dd/MM/yy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customStartDate} onSelect={setCustomStartDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("w-full justify-start text-left font-normal h-9", !customEndDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {customEndDate ? format(customEndDate, "dd/MM/yy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customEndDate} onSelect={setCustomEndDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Common filters: description + amounts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Input
                placeholder={activeTab === "incomes" ? "Ex: Salário..." : "Ex: Almoço..."}
                value={localFilters.description || ''}
                onChange={(e) => handleFilterChange('description', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor Mín (R$)</Label>
              <Input
                type="number"
                placeholder="0,00"
                step="0.01"
                value={localFilters.minAmount || ''}
                onChange={(e) => handleFilterChange('minAmount', parseFloat(e.target.value) || undefined)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor Máx (R$)</Label>
              <Input
                type="number"
                placeholder="0,00"
                step="0.01"
                value={localFilters.maxAmount || ''}
                onChange={(e) => handleFilterChange('maxAmount', parseFloat(e.target.value) || undefined)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Expense-specific filters */}
          {activeTab === "expenses" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Pagamento</Label>
                <Select
                  value={localFilters.paymentMethod || 'all'}
                  onValueChange={(v) => handleFilterChange('paymentMethod', v === 'all' ? undefined : v as PaymentMethod)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Cartão</Label>
                <Select
                  value={localFilters.cardId || 'all'}
                  onValueChange={(v) => handleFilterChange('cardId', v === 'all' ? undefined : v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {cards.map(card => (
                      <SelectItem key={card.id} value={card.id}>
                        <div className="flex items-center gap-2">
                          <div style={{ backgroundColor: card.color || "#FFA500" }} className="w-2.5 h-2.5 rounded-full" />
                          {card.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showBillingPeriodFilter && (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {localFilters.cardId ? `Fatura - ${selectedCard?.name}` : 'Fatura'}
                  </Label>
                  <Select
                    value={localFilters.billingPeriod || 'all'}
                    onValueChange={(v) => handleFilterChange('billingPeriod', v === 'all' ? undefined : v)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {filteredBillingPeriods.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <Button onClick={applyFilters} size="sm" className="flex-1 h-9">
              Aplicar
            </Button>
            <Button variant="outline" size="sm" onClick={clearFilters} className="h-9">
              Limpar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
