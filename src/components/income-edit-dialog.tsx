import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Income, IncomeCategory } from "@/types/income";
import { cn, parseLocalDate, normalizeToLocalDate, stripInstallmentSuffix } from "@/lib/utils";
import { IncomeCategorySelector } from "@/components/income-category-selector";
import { useIncomeCategories } from "@/hooks/use-income-categories";

const incomeEditSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.number().positive("Valor deve ser positivo"),
  category: z.string().min(1, "Categoria é obrigatória"),
  incomeDate: z.date(),
});

type IncomeEditFormData = z.infer<typeof incomeEditSchema>;

export interface IncomeFormData {
  description: string;
  amount: number;
  category: IncomeCategory;
  incomeDate: Date;
  incomeCategoryId?: string | null;
  categoryName?: string | null;
  categoryIcon?: string | null;
}

interface IncomeEditDialogProps {
  income: Income | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: IncomeFormData) => void;
}

export function IncomeEditDialog({ income, open, onOpenChange, onSave }: IncomeEditDialogProps) {
  const lastIncomeIdRef = useRef<string | null>(null);
  const { activeCategories } = useIncomeCategories();

  const form = useForm<IncomeEditFormData>({
    resolver: zodResolver(incomeEditSchema),
    defaultValues: {
      description: "",
      amount: 0,
      category: "salario",
      incomeDate: new Date(),
    },
  });

  // Preencher formulário quando a entrada mudar
  useEffect(() => {
    if (income && income.id !== lastIncomeIdRef.current) {
      lastIncomeIdRef.current = income.id;
      
      const totalInstallments = (income as any).total_installments || 1;
      const baseDescription = totalInstallments > 1 
        ? stripInstallmentSuffix(income.description) 
        : income.description;

      form.reset({
        description: baseDescription,
        amount: Number(income.amount),
        category: (income as any).income_category_id || income.category,
        incomeDate: parseLocalDate(income.income_date),
      });
    }
    
    if (!income) {
      lastIncomeIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [income]);

  const handleSubmit = (data: IncomeEditFormData) => {
    if (!income) return;
    
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.category);
    const selectedCategory = isUUID ? activeCategories.find(c => c.id === data.category) : null;

    const formData: IncomeFormData = {
      description: data.description,
      amount: data.amount,
      category: isUUID ? ("outros" as IncomeCategory) : (data.category as IncomeCategory),
      incomeDate: data.incomeDate,
      incomeCategoryId: isUUID ? data.category : null,
      categoryName: selectedCategory?.name || null,
      categoryIcon: selectedCategory?.icon || null,
    };
    onSave(income.id, formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-emerald-600">Editar Entrada</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Salário mensal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <FormControl>
                    <IncomeCategorySelector value={field.value} onValueChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="incomeDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data da Entrada</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: ptBR })
                          ) : (
                            <span>Selecione uma data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => date && field.onChange(normalizeToLocalDate(date))}
                        locale={ptBR}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                Salvar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
