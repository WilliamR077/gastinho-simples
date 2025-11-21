import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { ExpenseCharts } from "@/components/expense-charts";
import { ExpenseFilters, ExpenseFilters as ExpenseFiltersType } from "@/components/expense-filters";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, User } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { generateBillingPeriods } from "@/utils/billing-period";

const Reports = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [filters, setFilters] = useState<ExpenseFiltersType>({});
  const [creditCardConfig, setCreditCardConfig] = useState<{ opening_day: number; closing_day: number } | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    
    fetchExpenses();
    fetchRecurringExpenses();
    fetchCreditCardConfig();
  }, [user, navigate]);

  const fetchExpenses = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .order("expense_date", { ascending: false });

    if (error) {
      console.error("Error fetching expenses:", error);
      return;
    }

    setExpenses(data || []);
  };

  const fetchRecurringExpenses = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("recurring_expenses")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching recurring expenses:", error);
      return;
    }

    setRecurringExpenses(data || []);
  };

  const fetchCreditCardConfig = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("credit_card_configs")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching credit card config:", error);
      return;
    }

    setCreditCardConfig(data);
  };

  const billingPeriods = useMemo(() => {
    if (!creditCardConfig) return [];
    return generateBillingPeriods(expenses, creditCardConfig);
  }, [expenses, creditCardConfig]);

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Relatórios e Gráficos
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/account")}
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                <User className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Conta</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={signOut}
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filtros */}
        <div className="mb-8">
          <ExpenseFilters 
            filters={filters}
            onFiltersChange={setFilters}
            billingPeriods={billingPeriods}
          />
        </div>

        {/* Gráficos */}
        <ExpenseCharts 
          expenses={expenses} 
          recurringExpenses={recurringExpenses}
          billingPeriod={filters.billingPeriod}
          startDate={filters.startDate}
          endDate={filters.endDate}
          creditCardConfig={creditCardConfig || undefined}
          paymentMethod={filters.paymentMethod}
          category={filters.category}
        />
      </main>
    </div>
  );
};

export default Reports;
