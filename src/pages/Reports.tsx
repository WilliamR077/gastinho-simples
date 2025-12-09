import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { Card } from "@/types/card";
import { ReportsAccordion } from "@/components/reports-accordion";
import { PeriodSelector } from "@/components/period-selector";
import { ContextSelector } from "@/components/context-selector";
import { useSharedGroups } from "@/hooks/use-shared-groups";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { startOfMonth, endOfMonth } from "date-fns";
import { exportReportsToPDF } from "@/services/pdf-export-service";
import { toast } from "sonner";

interface GroupMember {
  user_id: string;
  user_email: string;
  role: string;
}

const Reports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentContext, getGroupMembers } = useSharedGroups();
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  
  // Estado para período selecionado
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [periodLabel, setPeriodLabel] = useState("");

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

  const handlePeriodChange = (newStartDate: Date, newEndDate: Date, label: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setPeriodLabel(label);
  };

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      await exportReportsToPDF(
        expenses,
        recurringExpenses,
        cards,
        startDate,
        endDate,
        isGroupContext,
        groupMembers,
        currentContext.groupName
      );
      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar relatório");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
              <Button
                variant="default"
                size="sm"
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                {isExporting ? (
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                ) : (
                  <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                )}
                <span className="hidden sm:inline">Exportar PDF</span>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Seletor de contexto (Pessoal / Grupo) */}
      <ContextSelector />

      {/* Seletor de período */}
      <div className="container mx-auto px-4">
        <PeriodSelector onPeriodChange={handlePeriodChange} />
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
