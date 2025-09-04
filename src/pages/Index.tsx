import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ExpenseSummary } from "@/components/expense-summary";
import { ExpenseForm } from "@/components/expense-form";
import { ExpenseList } from "@/components/expense-list";
import { ExpenseFilters, ExpenseFilters as ExpenseFiltersType } from "@/components/expense-filters";
import { Expense, PaymentMethod } from "@/types/expense";
import { toast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Wallet, User } from "lucide-react";
import { generateBillingPeriods, filterExpensesByBillingPeriod } from "@/utils/billing-period";

export default function Index() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ExpenseFiltersType>({});
  const [creditCardConfig, setCreditCardConfig] = useState<{opening_day: number; closing_day: number} | null>(null);
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Load expenses and credit card config from Supabase
  useEffect(() => {
    if (user) {
      loadExpenses();
      loadCreditCardConfig();
    }
  }, [user]);

  const loadExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error("Error loading expenses:", error);
      toast({
        title: "Erro ao carregar gastos",
        description: "Não foi possível carregar os gastos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCreditCardConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("credit_card_configs")
        .select("opening_day, closing_day")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setCreditCardConfig(data);
      }
    } catch (error) {
      console.error("Error loading credit card config:", error);
    }
  };

  const addExpense = async (description: string, amount: number, paymentMethod: PaymentMethod, expenseDate: Date) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("expenses")
        .insert({
          description,
          amount,
          payment_method: paymentMethod,
          user_id: user.id,
          expense_date: expenseDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
        })
        .select()
        .single();

      if (error) throw error;

      setExpenses(prev => [data, ...prev]);
      
      toast({
        title: "Gasto adicionado!",
        description: `${description} - R$ ${amount.toFixed(2)}`,
      });
    } catch (error) {
      console.error("Error adding expense:", error);
      toast({
        title: "Erro ao adicionar gasto",
        description: "Não foi possível adicionar o gasto.",
        variant: "destructive",
      });
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setExpenses(prev => prev.filter(expense => expense.id !== id));
      
      toast({
        title: "Gasto removido",
        description: "O gasto foi excluído com sucesso.",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({
        title: "Erro ao remover gasto",
        description: "Não foi possível remover o gasto.",
        variant: "destructive",
      });
    }
  };

  // Gerar períodos de faturamento disponíveis
  const billingPeriods = useMemo(() => {
    if (!creditCardConfig) return [];
    return generateBillingPeriods(expenses, creditCardConfig);
  }, [expenses, creditCardConfig]);

  // Filtrar despesas baseado nos filtros aplicados
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      // Filtro de data início
      if (filters.startDate) {
        const expenseDate = new Date(expense.expense_date);
        if (expenseDate < filters.startDate) return false;
      }

      // Filtro de data fim
      if (filters.endDate) {
        const expenseDate = new Date(expense.expense_date);
        if (expenseDate > filters.endDate) return false;
      }

      // Filtro de descrição
      if (filters.description) {
        if (!expense.description.toLowerCase().includes(filters.description.toLowerCase())) {
          return false;
        }
      }

      // Filtro de valor mínimo
      if (filters.minAmount !== undefined) {
        if (expense.amount < filters.minAmount) return false;
      }

      // Filtro de valor máximo
      if (filters.maxAmount !== undefined) {
        if (expense.amount > filters.maxAmount) return false;
      }

      // Filtro de forma de pagamento
      if (filters.paymentMethod) {
        if (expense.payment_method !== filters.paymentMethod) return false;
      }

      // Filtro de período de faturamento (apenas para crédito)
      if (filters.billingPeriod && creditCardConfig) {
        const billingExpenses = filterExpensesByBillingPeriod(
          [expense], 
          filters.billingPeriod, 
          creditCardConfig
        );
        if (billingExpenses.length === 0) return false;
      }

      return true;
    });
  }, [expenses, filters, creditCardConfig]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-gradient-primary shadow-elegant">
              <Wallet className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Controle de Gastos</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Gerencie suas despesas de forma simples e eficiente</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/account")}
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <User className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Minha Conta</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-8">
          <ExpenseFilters 
            filters={filters}
            onFiltersChange={setFilters}
            billingPeriods={billingPeriods}
          />
        </div>

        {/* Summary Cards */}
        <div className="mb-8">
          <ExpenseSummary expenses={filteredExpenses} />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Expense Form */}
          <div className="space-y-6">
            <ExpenseForm onAddExpense={addExpense} />
          </div>

          {/* Expense List */}
          <div className="space-y-6">
            <ExpenseList 
              expenses={filteredExpenses} 
              onDeleteExpense={deleteExpense}
            />
          </div>
        </div>
      </div>
    </div>
  );
};