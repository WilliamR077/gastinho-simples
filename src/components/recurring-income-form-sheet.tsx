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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { IncomeCategory, incomeCategoryLabels, incomeCategoryIcons } from "@/types/income";
import { useSharedGroups } from "@/hooks/use-shared-groups";

interface RecurringIncomeFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RecurringIncomeFormSheet({ open, onOpenChange, onSuccess }: RecurringIncomeFormSheetProps) {
  const { user } = useAuth();
  const { currentContext } = useSharedGroups();
  const [isLoading, setIsLoading] = useState(false);
  
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<IncomeCategory>("salario");
  const [dayOfMonth, setDayOfMonth] = useState("5");

  const isGroupContext = currentContext.type === 'group';

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setCategory("salario");
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

    const day = parseInt(dayOfMonth);
    if (isNaN(day) || day < 1 || day > 31) {
      toast.error("Informe um dia válido (1-31)");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.from("recurring_incomes").insert({
        user_id: user.id,
        description: description.trim(),
        amount: amountValue,
        category,
        day_of_month: day,
        shared_group_id: isGroupContext ? currentContext.groupId : null,
      });

      if (error) throw error;

      toast.success("Entrada fixa adicionada com sucesso!");
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error adding recurring income:", error);
      toast.error("Erro ao adicionar entrada fixa");
    } finally {
      setIsLoading(false);
    }
  };

  const categories = Object.entries(incomeCategoryLabels) as [IncomeCategory, string][];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-2xl">🔄</span>
            Nova Entrada Fixa
          </SheetTitle>
          <SheetDescription>
            Registre uma receita que se repete todo mês (ex: salário)
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Salário"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Valor */}
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

          {/* Categoria */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as IncomeCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    <span className="flex items-center gap-2">
                      <span>{incomeCategoryIcons[value]}</span>
                      <span>{label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dia do mês */}
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

          {/* Botões */}
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
