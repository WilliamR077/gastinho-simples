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
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useSharedGroups } from "@/hooks/use-shared-groups";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { IncomeCategorySelector } from "@/components/income-category-selector";
import { useIncomeCategories } from "@/hooks/use-income-categories";

type IncomeType = "monthly" | "recurring" | "installment";

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
  const [installmentCount, setInstallmentCount] = useState("2");

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
    setInstallmentCount("2");
  };

  const parsedAmount = parseFloat(amount.replace(",", "."));
  const parsedInstallments = parseInt(installmentCount);
  const validAmount = !isNaN(parsedAmount) && parsedAmount > 0;
  const validInstallments = !isNaN(parsedInstallments) && parsedInstallments >= 2 && parsedInstallments <= 48;

  const installmentPreview = incomeType === "installment" && validAmount && validInstallments
    ? Array.from({ length: parsedInstallments }, (_, i) => ({
        number: i + 1,
        date: addMonths(incomeDate, i),
        amount: parsedAmount,
      }))
    : [];

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

    if (!validAmount) {
      toast.error("Informe um valor válido");
      return;
    }

    if (incomeType === "installment") {
      if (!validInstallments) {
        toast.error("Informe entre 2 e 48 parcelas. Use entrada do mês para um único recebimento.");
        return;
      }
    }

    setIsLoading(true);

    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryValue);
      const selectedCategory = isUUID ? activeCategories.find(c => c.id === categoryValue) : null;

      const baseFields = {
        user_id: user.id,
        category: isUUID ? "outros" : categoryValue,
        shared_group_id: isGroupContext ? currentContext.groupId : null,
        income_category_id: isUUID ? categoryValue : null,
        category_name: selectedCategory?.name || null,
        category_icon: selectedCategory?.icon || null,
      };

      if (incomeType === "monthly") {
        const { error } = await supabase.from("incomes").insert({
          ...baseFields,
          description: description.trim(),
          amount: parsedAmount,
          income_date: incomeDate.toISOString(),
        } as any);

        if (error) throw error;
        toast.success("Entrada adicionada com sucesso!");
      } else if (incomeType === "recurring") {
        const day = parseInt(dayOfMonth);
        if (isNaN(day) || day < 1 || day > 31) {
          toast.error("Informe um dia válido (1-31)");
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.from("recurring_incomes").insert({
          ...baseFields,
          description: description.trim(),
          amount: parsedAmount,
          day_of_month: day,
        } as any);

        if (error) throw error;
        toast.success("Entrada fixa adicionada com sucesso!");
      } else if (incomeType === "installment") {
        const groupId = crypto.randomUUID();
        const records = Array.from({ length: parsedInstallments }, (_, i) => ({
          ...baseFields,
          description: `${description.trim()} (${i + 1}/${parsedInstallments})`,
          amount: parsedAmount,
          income_date: addMonths(incomeDate, i).toISOString(),
          installment_group_id: groupId,
          installment_number: i + 1,
          total_installments: parsedInstallments,
        }));

        const { error } = await supabase.from("incomes").insert(records as any);
        if (error) throw error;
        toast.success(`${parsedInstallments} parcelas criadas com sucesso!`);
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
              className="flex flex-wrap gap-x-4 gap-y-2"
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
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="installment" id="income-installment" />
                <Label htmlFor="income-installment" className="cursor-pointer font-normal">
                  Entrada Parcelada
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder={
                incomeType === "monthly" ? "Ex: Salário mensal" :
                incomeType === "recurring" ? "Ex: Salário" :
                "Ex: Projeto Site"
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">
              {incomeType === "installment" ? "Valor da parcela (R$)" : "Valor (R$)"}
            </Label>
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

          {incomeType === "installment" && (
            <div className="space-y-2">
              <Label htmlFor="installmentCount">Quantidade de parcelas</Label>
              <Input
                id="installmentCount"
                type="number"
                min="2"
                max="48"
                placeholder="3"
                value={installmentCount}
                onChange={(e) => setInstallmentCount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 2 parcelas. Para um único recebimento, use "Entrada do Mês".
              </p>
            </div>
          )}

          {incomeType === "monthly" || incomeType === "installment" ? (
            <div className="space-y-2">
              <Label>{incomeType === "installment" ? "Primeira data de recebimento" : "Data"}</Label>
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
          ) : incomeType === "recurring" ? (
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
          ) : null}

          {/* Preview de parcelas */}
          {incomeType === "installment" && installmentPreview.length > 0 && (
            <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
              <Label className="text-sm font-medium">Prévia das parcelas</Label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {installmentPreview.map((p) => (
                  <div key={p.number} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Parcela {p.number}/{parsedInstallments} — {format(p.date, "MMM/yyyy", { locale: ptBR })}
                    </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parsedAmount * parsedInstallments)}
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
              {incomeType === "monthly" ? "Adicionar Entrada" :
               incomeType === "recurring" ? "Adicionar Entrada Fixa" :
               `Criar ${validInstallments ? parsedInstallments : ''} Parcelas`}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
