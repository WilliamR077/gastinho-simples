import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BudgetGoal } from "@/types/budget-goal";
import { categoryLabels } from "@/types/expense";
import { incomeCategoryLabels } from "@/types/income";

const budgetGoalEditSchema = z.object({
  type: z.enum(["monthly_total", "category", "income_monthly_total", "income_category"] as const),
  category: z.string().optional(),
  limitAmount: z.number().positive("Valor limite deve ser positivo"),
});

type BudgetGoalEditFormData = z.infer<typeof budgetGoalEditSchema>;

interface BudgetGoalEditDialogProps {
  goal: BudgetGoal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: { type: string; category?: string; limitAmount: number }) => void;
}

export function BudgetGoalEditDialog({ goal, open, onOpenChange, onSave }: BudgetGoalEditDialogProps) {
  const form = useForm<BudgetGoalEditFormData>({
    resolver: zodResolver(budgetGoalEditSchema),
    defaultValues: {
      type: "monthly_total",
      category: undefined,
      limitAmount: 0,
    },
  });

  const goalType = form.watch("type");

  // Preencher formulário quando a meta mudar
  useEffect(() => {
    if (goal) {
      form.reset({
        type: goal.type,
        category: goal.category || undefined,
        limitAmount: Number(goal.limit_amount),
      });
    }
  }, [goal, form]);

  const handleSubmit = (data: BudgetGoalEditFormData) => {
    if (!goal) return;
    onSave(goal.id, {
      type: data.type,
      category: data.type === "category" ? data.category : undefined,
      limitAmount: data.limitAmount,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-primary">Editar Meta</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Meta</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de meta" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background">
                      <SelectItem value="monthly_total">Limite Mensal Total</SelectItem>
                      <SelectItem value="category">Limite por Categoria</SelectItem>
                      <SelectItem value="income_monthly_total">Meta Mensal de Entradas</SelectItem>
                      <SelectItem value="income_category">Meta por Categoria de Entrada</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(goalType === "category" || goalType === "income_category") && (
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background">
                        {Object.entries(goalType === "income_category" ? incomeCategoryLabels : categoryLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="limitAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Limite (R$)</FormLabel>
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

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-gradient-primary">
                Salvar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
