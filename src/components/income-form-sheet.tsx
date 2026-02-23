import { useState } from "react";
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
import { IncomeCategorySelector } from "@/components/income-category-selector";
import { useIncomeCategories } from "@/hooks/use-income-categories";

interface IncomeFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function IncomeFormSheet({ open, onOpenChange, onSuccess }: IncomeFormSheetProps) {
  const { user } = useAuth();
  const { currentContext } = useSharedGroups();
  const { activeCategories } = useIncomeCategories();
  const [isLoading, setIsLoading] = useState(false);
  
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryValue, setCategoryValue] = useState("");
  const [incomeDate, setIncomeDate] = useState<Date>(new Date());

  const isGroupContext = currentContext.type === 'group';

  // Set default category when categories load
  if (!categoryValue && activeCategories.length > 0) {
    setCategoryValue(activeCategories[0].id);
  }

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setCategoryValue(activeCategories.length > 0 ? activeCategories[0].id : "");
    setIncomeDate(new Date());
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
      // Determine if value is UUID (custom category) or enum
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryValue);
      const selectedCategory = isUUID ? activeCategories.find(c => c.id === categoryValue) : null;

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
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-2xl">💵</span>
            Nova Entrada
          </SheetTitle>
          <SheetDescription>
            Registre uma nova receita ou entrada de dinheiro
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Salário mensal"
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
              Adicionar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
