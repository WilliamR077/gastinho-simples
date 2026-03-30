import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { Card } from "@/types/card";
import { Income, RecurringIncome } from "@/types/income";
import { ReportsAccordion } from "@/components/reports-accordion";
import { PeriodSelector, PeriodType } from "@/components/period-selector";
import { ContextSelector } from "@/components/context-selector";
import { useSharedGroups } from "@/hooks/use-shared-groups";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, Lock } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { exportReportsToPDF } from "@/services/pdf-export-service";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/use-subscription";
import { useCategories } from "@/hooks/use-categories";
import { buildReportViewModel } from "@/utils/report-view-model";
import { UpgradeDialog } from "@/components/upgrade-dialog";

interface GroupMember {
  user_id: string;
  user_email: string;
  role: string;
}

const Reports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentContext, getGroupMembers } = useSharedGroups();
  const { canExportPdf } = useSubscription();
  const { categories } = useCategories();
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [periodLabel, setPeriodLabel] = useState("");
  const [periodType, setPeriodType] = useState<PeriodType>("month");

  const isGroupContext = currentContext.type === 'group';

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchExpenses();
    fetchRecurringExpenses();
    fetchCards();
    fetchIncomes();
    fetchRecurringIncomes();
  }, [user, navigate, currentContext]);

  useEffect(() => {
    const fetchGroupMembersData = async () => {
      if (isGroupContext && currentContext.groupId) {
        const members = await getGroupMembers(currentContext.groupId);
        setGroupMembers(members as GroupMember[]);
      } else {
        setGroupMembers([]);
      }
    };
    fetchGroupMembersData();
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

  const fetchIncomes = async () => {
    if (!user) return;

    let query = supabase
      .from("incomes")
      .select("*")
      .order("income_date", { ascending: false });

    if (isGroupContext && currentContext.groupId) {
      query = query.eq("shared_group_id", currentContext.groupId);
    } else {
      query = query.eq("user_id", user.id).is("shared_group_id", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching incomes:", error);
      return;
    }

    setIncomes(data || []);
  };

  const fetchRecurringIncomes = async () => {
    if (!user) return;

    let query = supabase
      .from("recurring_incomes")
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
      console.error("Error fetching recurring incomes:", error);
      return;
    }

    setRecurringIncomes(data || []);
  };

  const handlePeriodChange = (newStartDate: Date, newEndDate: Date, label: string, type: PeriodType) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setPeriodLabel(label);
    setPeriodType(type);
  };

  // Compute shared view model
  const viewModel = useMemo(() => {
    return buildReportViewModel({
      expenses,
      recurringExpenses,
      incomes,
      recurringIncomes,
      cards,
      categories,
      startDate,
      endDate,
      periodType,
      isGroupContext,
      groupMembers,
    });
  }, [expenses, recurringExpenses, incomes, recurringIncomes, cards, categories, startDate, endDate, periodType, isGroupContext, groupMembers]);

  const handleExportPDF = async () => {
    if (!canExportPdf) {
      setShowUpgradeDialog(true);
      return;
    }
    
    try {
      setIsExporting(true);
      await exportReportsToPDF({
        viewModel,
        cards,
        startDate,
        endDate,
        periodType,
        periodLabel,
        isGroupContext,
        groupMembers,
        groupName: currentContext.groupName,
      });
      toast.success("Relatório exportado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar relatório");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="shrink-0 px-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Voltar</span>
              </Button>
              <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">
                Relatórios
              </h1>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 text-xs sm:text-sm shrink-0"
              data-onboarding="reports-export-btn"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : canExportPdf ? (
                <Download className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Exportar</span>
            </Button>
          </div>
        </div>
      </header>

      <div data-onboarding="reports-context-selector">
        <ContextSelector />
      </div>

      <div className="container mx-auto px-4" data-onboarding="reports-period-selector">
        <PeriodSelector onPeriodChange={handlePeriodChange} />
      </div>

      <main className="container mx-auto px-4 py-4">
        <ReportsAccordion 
          expenses={expenses}
          recurringExpenses={recurringExpenses}
          cards={cards}
          incomes={incomes}
          recurringIncomes={recurringIncomes}
          startDate={startDate}
          endDate={endDate}
          periodType={periodType}
          periodLabel={periodLabel}
          isGroupContext={isGroupContext}
          groupMembers={groupMembers}
          viewModel={viewModel}
        />
      </main>

      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        title="Exportar PDF é Premium"
        description="Gere um PDF com os mesmos gráficos e informações do relatório."
        features={[
          "Exportar relatórios para PDF",
          "Ver relatórios de períodos maiores",
          "Analisar por ano, trimestre ou período personalizado",
        ]}
      />
    </div>
  );
};

export default Reports;

