import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecurringExpense, RecurringExpenseFormData } from "@/types/recurring-expense";
import { categoryLabels } from "@/types/expense";

const recurringExpenseEditSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.number().positive("Valor deve ser positivo"),
  paymentMethod: z.enum(["pix", "debit", "credit"] as const),
  dayOfMonth: z.number().min(1, "Dia deve ser entre 1 e 31").max(31, "Dia deve ser entre 1 e 31"),
  category: z.enum(["alimentacao", "transporte", "lazer", "saude", "educacao", "moradia", "vestuario", "servicos", "outros"] as const),
});

type RecurringExpenseEditFormData = z.infer<typeof recurringExpenseEditSchema>;

interface RecurringExpenseEditDialogProps {
  expense: RecurringExpense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: RecurringExpenseFormData) => void;
}

export function RecurringExpenseEditDialog({ expense, open, onOpenChange, onSave }: RecurringExpenseEditDialogProps) {
  const form = useForm<RecurringExpenseEditFormData>({
    resolver: zodResolver(recurringExpenseEditSchema),
    defaultValues: {
      description: "",
      amount: 0,
      paymentMethod: "pix",
      dayOfMonth: 1,
      category: "outros",
    },
  });

  // Preencher formulário quando a despesa mudar
  useEffect(() => {
    if (expense) {
      form.reset({
        description: expense.description,
        amount: Number(expense.amount),
        paymentMethod: expense.payment_method,
        dayOfMonth: expense.day_of_month,
        category: expense.category,
      });
    }
  }, [expense, form]);

  const handleSubmit = (data: RecurringExpenseEditFormData) => {
    if (!expense) return;
    const formData: RecurringExpenseFormData = {
      description: data.description,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      dayOfMonth: data.dayOfMonth,
      category: data.category,
    };
    onSave(expense.id, formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-primary">Editar Despesa Fixa</DialogTitle>
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
                    <Input placeholder="Ex: Aluguel" {...field} />
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
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background">
                      {Object.entries(categoryLabels).map(([key, label]) => (
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

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forma de Pagamento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a forma de pagamento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background">
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="debit">Débito</SelectItem>
                      <SelectItem value="credit">Crédito</SelectItem>
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
                  <FormLabel>Dia do Vencimento (1-31)</FormLabel>
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
