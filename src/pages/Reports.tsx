import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { Card } from "@/types/card";
import { ReportsAccordion } from "@/components/reports-accordion";
import { MonthNavigator } from "@/components/month-navigator";
import { ContextSelector } from "@/components/context-selector";
import { useSharedGroups } from "@/hooks/use-shared-groups";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, User } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { startOfMonth, endOfMonth } from "date-fns";

interface GroupMember {
  user_id: string;
  user_email: string;
  role: string;
}

const Reports = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { currentContext, getGroupMembers } = useSharedGroups();
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  
  // Estado para navegação de mês
  const [currentDate, setCurrentDate] = useState(new Date());
  const startDate = startOfMonth(currentDate);
  const endDate = endOfMonth(currentDate);

  const isGroupContext = currentContext.type === 'group';

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    
    fetchExpenses();
    fetchRecurringExpenses();
    fetchCards();
  }, [user, navigate, currentContext]);

  // Buscar membros do grupo quando em contexto de grupo
  useEffect(() => {
    const fetchGroupMembers = async () => {
      if (isGroupContext && currentContext.groupId) {
        const members = await getGroupMembers(currentContext.groupId);
        setGroupMembers(members as GroupMember[]);
      } else {
        setGroupMembers([]);
      }
    };
    
    fetchGroupMembers();
  }, [isGroupContext, currentContext.groupId, getGroupMembers]);

  const fetchExpenses = async () => {
    if (!user) return;

    let query = supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false });

    if (isGroupContext && currentContext.groupId) {
      query = query.eq("shared_group_id", currentContext.groupId);
    } else {
      query = query.eq("user_id", user.id).is("shared_group_id", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching expenses:", error);
      return;
    }

    setExpenses(data || []);
  };

  const fetchRecurringExpenses = async () => {
    if (!user) return;

    let query = supabase
      .from("recurring_expenses")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (isGroupContext && currentContext.groupId) {
      query = query.eq("shared_group_id", currentContext.groupId);
    } else {
      query = query.eq("user_id", user.id).is("shared_group_id", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching recurring expenses:", error);
      return;
    }

    setRecurringExpenses(data || []);
  };

  const fetchCards = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching cards:", error);
      return;
    }

    setCards(data || []);
  };

  const handleMonthChange = (newStartDate: Date) => {
    setCurrentDate(newStartDate);
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
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
                Relatórios
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

      {/* Seletor de contexto (Pessoal / Grupo) */}
      <ContextSelector />

      {/* Navegador de mês */}
      <div className="container mx-auto px-4">
        <MonthNavigator 
          currentDate={currentDate}
          onMonthChange={handleMonthChange}
        />
      </div>

      <main className="container mx-auto px-4 py-4">
        <ReportsAccordion 
          expenses={expenses}
          recurringExpenses={recurringExpenses}
          cards={cards}
          startDate={startDate}
          endDate={endDate}
          isGroupContext={isGroupContext}
          groupMembers={groupMembers}
        />
      </main>
    </div>
  );
};

export default Reports;
