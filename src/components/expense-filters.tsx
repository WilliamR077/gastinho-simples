import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarIcon, FilterX, ChevronDown } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { PaymentMethod, ExpenseCategory, categoryLabels, categoryIcons } from "@/types/expense";

export interface ExpenseFilters {
  startDate?: Date;
  endDate?: Date;
  description?: string;
  minAmount?: number;
  maxAmount?: number;
  paymentMethod?: PaymentMethod;
  billingPeriod?: string;
  category?: ExpenseCategory;
}

interface ExpenseFiltersProps {
  filters: ExpenseFilters;
  onFiltersChange: (filters: ExpenseFilters) => void;
  billingPeriods?: Array<{ value: string; label: string }>;
}

export function ExpenseFilters({ filters, onFiltersChange, billingPeriods = [] }: ExpenseFiltersProps) {
  const [localFilters, setLocalFilters] = useState<ExpenseFilters>(() => {
    const currentDate = new Date();
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    return {
      ...filters,
      startDate: filters.startDate || monthStart,
      endDate: filters.endDate || monthEnd,
    };
  });
  const [isOpen, setIsOpen] = useState(false);

  // Atualiza os filtros quando o componente é montado com as datas padrão
  useEffect(() => {
    if (!filters.startDate && !filters.endDate) {
      const currentDate = new Date();
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      
      const defaultFilters = {
        ...filters,
        startDate: monthStart,
        endDate: monthEnd,
      };
      
      onFiltersChange(defaultFilters);
    }
  }, []);

  const handleFilterChange = (key: keyof ExpenseFilters, value: any) => {
    const newFilters = { ...localFilters, [key]: value };
    setLocalFilters(newFilters);
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
  };

  const clearFilters = () => {
    const currentDate = new Date();
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    const defaultFilters: ExpenseFilters = {
      startDate: monthStart,
      endDate: monthEnd,
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
              {/* Filtro de Data Início */}
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !localFilters.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {localFilters.startDate ? format(localFilters.startDate, "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={localFilters.startDate}
                      onSelect={(date) => handleFilterChange('startDate', date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Filtro de Data Fim */}
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !localFilters.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {localFilters.endDate ? format(localFilters.endDate, "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={localFilters.endDate}
                      onSelect={(date) => handleFilterChange('endDate', date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
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