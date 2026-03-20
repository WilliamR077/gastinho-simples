import { useEffect, useState, useRef } from "react";
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
import { Expense, PaymentMethod, ExpenseFormData } from "@/types/expense";
import { SplitType, SplitParticipant } from "@/types/expense-split";
import { SharedGroupMember } from "@/types/shared-group";
import { cn, parseLocalDate, normalizeToLocalDate, stripInstallmentSuffix } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Card as CardType } from "@/types/card";
import { CategorySelector } from "@/components/category-selector";
import { useCategories } from "@/hooks/use-categories";
import { ExpenseSplitSection } from "@/components/expense-split-section";

const expenseEditSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.number().positive("Valor deve ser positivo"),
  paymentMethod: z.enum(["pix", "debit", "credit"] as const),
  expenseDate: z.date(),
  categoryId: z.string().min(1, "Categoria é obrigatória"),
  cardId: z.string().optional(),
});

type ExpenseEditFormData = z.infer<typeof expenseEditSchema>;

interface ExpenseEditDialogProps {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: ExpenseFormData) => void;
  groupMembers?: SharedGroupMember[];
  currentUserId?: string;
  isGroupContext?: boolean;
}

export function ExpenseEditDialog({
  expense,
  open,
  onOpenChange,
  onSave,
  groupMembers = [],
  currentUserId = '',
  isGroupContext = false,
}: ExpenseEditDialogProps) {
  const [cards, setCards] = useState<CardType[]>([]);
  const { activeCategories } = useCategories();
  const lastExpenseIdRef = useRef<string | null>(null);

  // Split state
  const [isShared, setIsShared] = useState(false);
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [splitParticipants, setSplitParticipants] = useState<SplitParticipant[]>([]);
  const [splitError, setSplitError] = useState<string | null>(null);

  const form = useForm<ExpenseEditFormData>({
    resolver: zodResolver(expenseEditSchema),
    defaultValues: {
      description: "",
      amount: 0,
      paymentMethod: "pix",
      expenseDate: new Date(),
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

  // Populate form when expense changes
  useEffect(() => {
    if (expense && activeCategories.length > 0 && expense.id !== lastExpenseIdRef.current) {
      lastExpenseIdRef.current = expense.id;
      
      let categoryId = expense.category_id || "";
      if (!categoryId && expense.category) {
        const found = activeCategories.find(c => 
          c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_") === expense.category
        );
        if (found) categoryId = found.id;
      }

      const baseDescription = expense.total_installments > 1 
        ? stripInstallmentSuffix(expense.description) 
        : expense.description;

      form.reset({
        description: baseDescription,
        amount: Number(expense.amount),
        paymentMethod: expense.payment_method as PaymentMethod,
        expenseDate: parseLocalDate(expense.expense_date),
        categoryId: categoryId,
        cardId: expense.card_id || "",
      });

      // Populate split state from expense data
      setIsShared(!!expense.is_shared);
      setPaidBy(expense.paid_by || currentUserId);
      setSplitType((expense.split_type as SplitType) || "equal");
      setSplitError(null);
      
      // Note: splitParticipants are populated via initialSelectedUserIds + initialManualAmounts/Percentages
      // passed to ExpenseSplitSection
    }
    
    if (!expense) {
      lastExpenseIdRef.current = null;
      setIsShared(false);
      setPaidBy(currentUserId);
      setSplitType("equal");
      setSplitParticipants([]);
      setSplitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense, activeCategories]);

  const handleSubmit = (data: ExpenseEditFormData) => {
    if (!expense) return;
    setSplitError(null);

    const selectedCategory = activeCategories.find(c => c.id === data.categoryId);
    
    // Validate split
    if (isGroupContext && isShared) {
      if (splitParticipants.length === 0) {
        setSplitError("Selecione pelo menos um participante para criar uma despesa compartilhada.");
        return;
      }
      if (splitType === 'percentage') {
        const totalPct = splitParticipants.reduce((s, p) => s + (p.percentage || 0), 0);
        if (Math.abs(totalPct - 100) > 0.1) {
          setSplitError("A soma das porcentagens precisa ser 100%.");
          return;
        }
      }
      if (splitType === 'manual') {
        const totalAmt = splitParticipants.reduce((s, p) => s + p.amount, 0);
        if (Math.abs(totalAmt - data.amount) > 0.01) {
          setSplitError("A soma dos valores precisa ser igual ao valor total da despesa.");
          return;
        }
      }
    }
    
    const formData: ExpenseFormData = {
      description: data.description,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      expenseDate: data.expenseDate,
      category: selectedCategory?.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_") as any || "outros",
      cardId: data.cardId || undefined,
      categoryId: data.categoryId || undefined,
      ...(isGroupContext && isShared && splitParticipants.length > 0 && {
        isShared: true,
        paidBy: paidBy,
        splitType: splitType,
        participants: splitParticipants,
      }),
      // If changed from shared to individual, signal removal
      ...(isGroupContext && !isShared && expense.is_shared && {
        isShared: false,
      }),
    };
    onSave(expense.id, formData);
    onOpenChange(false);
  };

  // Build initial data for ExpenseSplitSection from existing splits
  const initialSelectedUserIds = expense?.splits?.map(s => s.user_id) || [];
  const initialManualAmounts: Record<string, string> = {};
  const initialManualPercentages: Record<string, string> = {};
  if (expense?.splits) {
    for (const s of expense.splits) {
      if (expense.split_type === 'manual') {
        initialManualAmounts[s.user_id] = String(s.share_amount);
      }
      if (expense.split_type === 'percentage' && s.share_percentage != null) {
        initialManualPercentages[s.user_id] = String(s.share_percentage);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
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

            {expense && expense.total_installments > 1 && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                ⚠️ Esta é uma despesa parcelada ({expense.installment_number}/{expense.total_installments}). 
                Você pode editar os detalhes, mas não o número de parcelas.
              </div>
            )}

            {/* Split section - only for group context */}
            {isGroupContext && groupMembers.length > 0 && (
              <>
                <ExpenseSplitSection
                  amount={form.watch("amount") || 0}
                  groupMembers={groupMembers}
                  currentUserId={currentUserId}
                  isShared={isShared}
                  onIsSharedChange={(v) => { setIsShared(v); setSplitError(null); }}
                  paidBy={paidBy}
                  onPaidByChange={setPaidBy}
                  splitType={splitType}
                  onSplitTypeChange={setSplitType}
                  participants={splitParticipants}
                  onParticipantsChange={(p) => { setSplitParticipants(p); setSplitError(null); }}
                  initialSelectedUserIds={initialSelectedUserIds}
                  initialManualAmounts={initialManualAmounts}
                  initialManualPercentages={initialManualPercentages}
                />
                {splitError && (
                  <p className="text-xs text-destructive font-medium -mt-2 px-1">{splitError}</p>
                )}
              </>
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
