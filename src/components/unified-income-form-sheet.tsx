import { useState, useEffect, useRef } from "react";
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
  preventClose?: boolean;
}

export function UnifiedIncomeFormSheet({ open, onOpenChange, onSuccess, initialData, preventClose }: UnifiedIncomeFormSheetProps) {
  const { user } = useAuth();
  const { currentContext } = useSharedGroups();
  const { activeCategories } = useIncomeCategories();
  const [isLoading, setIsLoading] = useState(false);
  
  const [incomeType, setIncomeType] = useState<IncomeType | "">("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryValue, setCategoryValue] = useState("");
  const [incomeDate, setIncomeDate] = useState<Date>(new Date());
  const [dayOfMonth, setDayOfMonth] = useState("5");
  const [installmentCount, setInstallmentCount] = useState("2");
  const hasEmittedOpenRef = useRef(false);

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
      } else if (!preventClose) {
        // Only set default type when NOT in guided flow
        setIncomeType("monthly");
      } else {
        // Guided flow: start with no type selected
        setIncomeType("");
      }
      hasEmittedOpenRef.current = false;
    }
  }, [open, initialData, preventClose]);

  // Emit income-form-opened when form is open and type selector is mounted
  useEffect(() => {
    if (!open || hasEmittedOpenRef.current) return;

    const check = () => {
      const el = document.querySelector('[data-onboarding="income-type-selector"]');
      if (el) {
        hasEmittedOpenRef.current = true;
        window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: "income-form-opened" }));
        return true;
      }
      return false;
    };

    if (check()) return;

    const observer = new MutationObserver(() => {
      if (check()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timeout = setTimeout(() => observer.disconnect(), 5000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [open]);

  // Emit income-type-changed when type changes (for validation)
  useEffect(() => {
    if (open && incomeType) {
      window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: "income-type-changed" }));
    }
  }, [incomeType, open]);

  const resetForm = () => {
    setIncomeType("monthly");
    setDescription("");
    setAmount("");
    setCategoryValue(activeCategories.length > 0 ? activeCategories[0].id : "");
    setIncomeDate(new Date());
    setDayOfMonth("5");
    setInstallmentCount("2");
  };

  const effectiveType = incomeType || "monthly";
  const parsedAmount = parseFloat(amount.replace(",", "."));
  const parsedInstallments = parseInt(installmentCount);
  const validAmount = !isNaN(parsedAmount) && parsedAmount > 0;
  const validInstallments = !isNaN(parsedInstallments) && parsedInstallments >= 2 && parsedInstallments <= 48;

  const installmentPreview = effectiveType === "installment" && validAmount && validInstallments
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

    if (!incomeType) {
      toast.error("Selecione o tipo de entrada");
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

    if (effectiveType === "installment") {
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

      if (effectiveType === "monthly") {
        const { error } = await supabase.from("incomes").insert({
          ...baseFields,
          description: description.trim(),
          amount: parsedAmount,
          income_date: incomeDate.toISOString(),
        } as any);

        if (error) throw error;
        toast.success("Entrada adicionada com sucesso!");
      } else if (effectiveType === "recurring") {
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
      } else if (effectiveType === "installment") {
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

      // Dispatch event BEFORE closing for onboarding to catch
      window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: "income-submitted" }));

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

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && preventClose) return;
    onOpenChange(newOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
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
          <div data-onboarding="income-type-selector" className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
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

          <div data-onboarding="income-description" className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder={
                effectiveType === "monthly" ? "Ex: Salário mensal" :
                effectiveType === "recurring" ? "Ex: Salário" :
                "Ex: Projeto Site"
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
            />
          </div>

          <div data-onboarding="income-amount" className="space-y-2">
            <Label htmlFor="amount">
              {effectiveType === "installment" ? "Valor da parcela (R$)" : "Valor (R$)"}
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

          <div data-onboarding="income-category-field" className="space-y-2">
            <Label>Categoria</Label>
            <IncomeCategorySelector value={categoryValue} onValueChange={setCategoryValue} />
          </div>

          {effectiveType === "installment" && (
            <div data-onboarding="income-installment-count" className="space-y-2">
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

          {effectiveType === "monthly" || effectiveType === "installment" ? (
            <div data-onboarding={effectiveType === "installment" ? "income-installment-date" : "income-date"} className="space-y-2">
              <Label>{effectiveType === "installment" ? "Primeira data de recebimento" : "Data"}</Label>
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
                <PopoverContent className="w-auto p-0 z-[80]" align="start">
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
          ) : effectiveType === "recurring" ? (
            <div data-onboarding="income-day-of-month" className="space-y-2">
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
          {effectiveType === "installment" && installmentPreview.length > 0 && (
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
            <Button data-onboarding="income-submit-btn" type="submit" className="flex-1" disabled={isLoading || !incomeType}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {effectiveType === "monthly" ? "Adicionar Entrada" :
               effectiveType === "recurring" ? "Adicionar Entrada Fixa" :
               `Criar ${validInstallments ? parsedInstallments : ''} Parcelas`}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}