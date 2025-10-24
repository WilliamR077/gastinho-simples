import { useEffect } from "react";
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
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Expense, PaymentMethod, ExpenseCategory, categoryLabels, ExpenseFormData } from "@/types/expense";
import { cn } from "@/lib/utils";

const expenseEditSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.number().positive("Valor deve ser positivo"),
  paymentMethod: z.enum(["pix", "debit", "credit"] as const),
  expenseDate: z.date(),
  category: z.enum(["alimentacao", "transporte", "lazer", "saude", "educacao", "moradia", "vestuario", "servicos", "outros"] as const),
});

type ExpenseEditFormData = z.infer<typeof expenseEditSchema>;

interface ExpenseEditDialogProps {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: ExpenseFormData) => void;
}

export function ExpenseEditDialog({ expense, open, onOpenChange, onSave }: ExpenseEditDialogProps) {
  const form = useForm<ExpenseEditFormData>({
    resolver: zodResolver(expenseEditSchema),
    defaultValues: {
      description: "",
      amount: 0,
      paymentMethod: "pix",
      expenseDate: new Date(),
      category: "outros",
    },
  });

  // Preencher formulário quando a despesa mudar
  useEffect(() => {
    if (expense) {
      form.reset({
        description: expense.description,
        amount: Number(expense.amount),
        paymentMethod: expense.payment_method as PaymentMethod,
        expenseDate: new Date(expense.expense_date),
        category: expense.category as ExpenseCategory,
      });
    }
  }, [expense, form]);

  const handleSubmit = (data: ExpenseEditFormData) => {
    if (!expense) return;
    const formData: ExpenseFormData = {
      description: data.description,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      expenseDate: data.expenseDate,
      category: data.category,
    };
    onSave(expense.id, formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-primary">Editar Despesa</DialogTitle>
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
                    <Input placeholder="Ex: Almoço no restaurante" {...field} />
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
              name="expenseDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data da Despesa</FormLabel>
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
                        onSelect={field.onChange}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {expense && expense.total_installments > 1 && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                ⚠️ Esta é uma despesa parcelada ({expense.installment_number}/{expense.total_installments}). 
                Você pode editar os detalhes, mas não o número de parcelas.
              </div>
            )}

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
