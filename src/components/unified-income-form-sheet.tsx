import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useSharedGroups } from "@/hooks/use-shared-groups";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { IncomeCategorySelector } from "@/components/income-category-selector";
import { useIncomeCategories } from "@/hooks/use-income-categories";

type IncomeType = "monthly" | "recurring";

export interface IncomeInitialData {
  description: string;
  amount: number;
  categoryId?: string;
  incomeDate?: Date;
  incomeType: "monthly" | "recurring";
  dayOfMonth?: number;
}

interface UnifiedIncomeFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialData?: IncomeInitialData;
}

export function UnifiedIncomeFormSheet({ open, onOpenChange, onSuccess, initialData }: UnifiedIncomeFormSheetProps) {
  const { user } = useAuth();
  const { currentContext } = useSharedGroups();
  const { activeCategories } = useIncomeCategories();
  const [isLoading, setIsLoading] = useState(false);
  
  const [incomeType, setIncomeType] = useState<IncomeType>("monthly");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryValue, setCategoryValue] = useState("");
  const [incomeDate, setIncomeDate] = useState<Date>(new Date());
  const [dayOfMonth, setDayOfMonth] = useState("5");

  const isGroupContext = currentContext.type === 'group';

  // Set default category
  if (!categoryValue && activeCategories.length > 0) {
    setCategoryValue(activeCategories[0].id);
  }

  useEffect(() => {
    if (open) {
      if (initialData) {
        setIncomeType(initialData.incomeType);
        setDescription(initialData.description);
        setAmount(initialData.amount.toString());
        setCategoryValue(initialData.categoryId || (activeCategories.length > 0 ? activeCategories[0].id : ""));
        setIncomeDate(initialData.incomeDate || new Date());
        setDayOfMonth(initialData.dayOfMonth?.toString() || "5");
      } else {
        setIncomeType("monthly");
      }
    }
  }, [open, initialData]);

  const resetForm = () => {
    setIncomeType("monthly");
    setDescription("");
    setAmount("");
    setCategoryValue(activeCategories.length > 0 ? activeCategories[0].id : "");
    setIncomeDate(new Date());
    setDayOfMonth("5");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("Você precisa estar logado");
      return;
    }

    if (!description.trim()) {
      toast.error("Informe uma descrição");
      return;
    }

    const amountValue = parseFloat(amount.replace(",", "."));
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    setIsLoading(true);

    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryValue);
      const selectedCategory = isUUID ? activeCategories.find(c => c.id === categoryValue) : null;

      if (incomeType === "monthly") {
        const { error } = await supabase.from("incomes").insert({
          user_id: user.id,
          description: description.trim(),
          amount: amountValue,
          category: isUUID ? "outros" : categoryValue,
          income_date: incomeDate.toISOString(),
          shared_group_id: isGroupContext ? currentContext.groupId : null,
          income_category_id: isUUID ? categoryValue : null,
          category_name: selectedCategory?.name || null,
          category_icon: selectedCategory?.icon || null,
        } as any);

        if (error) throw error;
        toast.success("Entrada adicionada com sucesso!");
      } else {
        const day = parseInt(dayOfMonth);
        if (isNaN(day) || day < 1 || day > 31) {
          toast.error("Informe um dia válido (1-31)");
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.from("recurring_incomes").insert({
          user_id: user.id,
          description: description.trim(),
          amount: amountValue,
          category: isUUID ? "outros" : categoryValue,
          day_of_month: day,
          shared_group_id: isGroupContext ? currentContext.groupId : null,
          income_category_id: isUUID ? categoryValue : null,
          category_name: selectedCategory?.name || null,
          category_icon: selectedCategory?.icon || null,
        } as any);

        if (error) throw error;
        toast.success("Entrada fixa adicionada com sucesso!");
      }

      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error adding income:", error);
      toast.error("Erro ao adicionar entrada");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-2xl">💵</span>
            Nova Entrada
          </SheetTitle>
          <SheetDescription>
            Registre uma nova receita ou entrada de dinheiro
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6 pb-24">
          <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
            <Label className="text-sm font-medium">Tipo de Entrada</Label>
            <RadioGroup
              value={incomeType}
              onValueChange={(v) => setIncomeType(v as IncomeType)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="monthly" id="income-monthly" />
                <Label htmlFor="income-monthly" className="cursor-pointer font-normal">
                  Entrada do Mês
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="recurring" id="income-recurring" />
                <Label htmlFor="income-recurring" className="cursor-pointer font-normal">
                  Entrada Fixa
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder={incomeType === "monthly" ? "Ex: Salário mensal" : "Ex: Salário"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <IncomeCategorySelector value={categoryValue} onValueChange={setCategoryValue} />
          </div>

          {incomeType === "monthly" ? (
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !incomeDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {incomeDate ? format(incomeDate, "PPP", { locale: ptBR }) : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={incomeDate}
                    onSelect={(date) => date && setIncomeDate(date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="dayOfMonth">Dia do recebimento</Label>
              <Input
                id="dayOfMonth"
                type="number"
                min="1"
                max="31"
                placeholder="5"
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Dia do mês em que você recebe essa entrada
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {incomeType === "monthly" ? "Adicionar Entrada" : "Adicionar Entrada Fixa"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
