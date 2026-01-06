import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecurringIncome, IncomeCategory, incomeCategoryLabels, incomeCategoryIcons } from "@/types/income";

const recurringIncomeEditSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.number().positive("Valor deve ser positivo"),
  category: z.string().min(1, "Categoria é obrigatória"),
  dayOfMonth: z.number().min(1, "Dia deve ser entre 1 e 31").max(31, "Dia deve ser entre 1 e 31"),
});

type RecurringIncomeEditFormData = z.infer<typeof recurringIncomeEditSchema>;

export interface RecurringIncomeFormData {
  description: string;
  amount: number;
  category: IncomeCategory;
  dayOfMonth: number;
}

interface RecurringIncomeEditDialogProps {
  income: RecurringIncome | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: RecurringIncomeFormData) => void;
}

export function RecurringIncomeEditDialog({ income, open, onOpenChange, onSave }: RecurringIncomeEditDialogProps) {
  const lastIncomeIdRef = useRef<string | null>(null);

  const form = useForm<RecurringIncomeEditFormData>({
    resolver: zodResolver(recurringIncomeEditSchema),
    defaultValues: {
      description: "",
      amount: 0,
      category: "salario",
      dayOfMonth: 5,
    },
  });

  // Preencher formulário quando a entrada mudar
  useEffect(() => {
    if (income && income.id !== lastIncomeIdRef.current) {
      lastIncomeIdRef.current = income.id;
      
      form.reset({
        description: income.description,
        amount: Number(income.amount),
        category: income.category,
        dayOfMonth: income.day_of_month,
      });
    }
    
    if (!income) {
      lastIncomeIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [income]);

  const handleSubmit = (data: RecurringIncomeEditFormData) => {
    if (!income) return;
    
    const formData: RecurringIncomeFormData = {
      description: data.description,
      amount: data.amount,
      category: data.category as IncomeCategory,
      dayOfMonth: data.dayOfMonth,
    };
    onSave(income.id, formData);
    onOpenChange(false);
  };

  const categories = Object.entries(incomeCategoryLabels) as [IncomeCategory, string][];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-emerald-600">Editar Entrada Fixa</DialogTitle>
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
                    <Input placeholder="Ex: Salário" {...field} />
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background">
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dayOfMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia do Recebimento (1-31)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
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
