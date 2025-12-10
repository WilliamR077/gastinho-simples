import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecurringExpense, RecurringExpenseFormData } from "@/types/recurring-expense";
import { supabase } from "@/integrations/supabase/client";
import { Card as CardType } from "@/types/card";
import { CategorySelector } from "@/components/category-selector";
import { useCategories } from "@/hooks/use-categories";

const recurringExpenseEditSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.number().positive("Valor deve ser positivo"),
  paymentMethod: z.enum(["pix", "debit", "credit"] as const),
  dayOfMonth: z.number().min(1, "Dia deve ser entre 1 e 31").max(31, "Dia deve ser entre 1 e 31"),
  categoryId: z.string().min(1, "Categoria é obrigatória"),
  cardId: z.string().optional(),
});

type RecurringExpenseEditFormData = z.infer<typeof recurringExpenseEditSchema>;

interface RecurringExpenseEditDialogProps {
  expense: RecurringExpense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: RecurringExpenseFormData) => void;
}

export function RecurringExpenseEditDialog({ expense, open, onOpenChange, onSave }: RecurringExpenseEditDialogProps) {
  const [cards, setCards] = useState<CardType[]>([]);
  const { activeCategories } = useCategories();

  const form = useForm<RecurringExpenseEditFormData>({
    resolver: zodResolver(recurringExpenseEditSchema),
    defaultValues: {
      description: "",
      amount: 0,
      paymentMethod: "pix",
      dayOfMonth: 1,
      categoryId: "",
      cardId: "",
    },
  });

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCards(data || []);
    } catch (error) {
      console.error("Erro ao carregar cartões:", error);
    }
  };

  const getAvailableCards = () => {
    const paymentMethod = form.watch("paymentMethod");
    if (!paymentMethod) return [];
    
    return cards.filter(card => {
      if (card.card_type === 'both') return true;
      if (paymentMethod === 'credit') return card.card_type === 'credit';
      if (paymentMethod === 'debit') return card.card_type === 'debit';
      return false;
    });
  };

  // Preencher formulário quando a despesa mudar
  useEffect(() => {
    if (expense && activeCategories.length > 0) {
      // Encontrar a categoria pelo category_id ou pelo nome
      let categoryId = expense.category_id || "";
      if (!categoryId && expense.category) {
        const found = activeCategories.find(c => 
          c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_") === expense.category
        );
        if (found) categoryId = found.id;
      }

      form.reset({
        description: expense.description,
        amount: Number(expense.amount),
        paymentMethod: expense.payment_method,
        dayOfMonth: expense.day_of_month,
        categoryId: categoryId,
        cardId: expense.card_id || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense, activeCategories]);

  const handleSubmit = (data: RecurringExpenseEditFormData) => {
    if (!expense) return;
    
    const selectedCategory = activeCategories.find(c => c.id === data.categoryId);
    
    const formData: RecurringExpenseFormData = {
      description: data.description,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      dayOfMonth: data.dayOfMonth,
      category: selectedCategory?.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_") as any || "outros",
      cardId: data.cardId || undefined,
      categoryId: data.categoryId || undefined,
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
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <FormControl>
                    <CategorySelector
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
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

            {(form.watch("paymentMethod") === "credit" || form.watch("paymentMethod") === "debit") && (
              <FormField
                control={form.control}
                name="cardId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cartão</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cartão" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background">
                        {getAvailableCards().map((card) => (
                          <SelectItem key={card.id} value={card.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                style={{ backgroundColor: card.color }} 
                                className="w-3 h-3 rounded-full"
                              />
                              {card.name}
                            </div>
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
