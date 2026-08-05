import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
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
import { exportSelectedReportToPDF } from "@/services/pdf-export-service";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/use-subscription";
import { useCategories } from "@/hooks/use-categories";
import { buildReportViewModel } from "@/utils/report-view-model";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { AiHelpHint } from "@/components/ai/ai-help-hint";
import { AI_CONTEXTUAL_HINTS, buildReportsPrompts } from "@/lib/mcp/aiContextualHints";
import {
  initialReportLoadState,
  isReportViewReady,
  reduceReportLoadState,
  ReportLoadAction,
  ReportLoadState,
} from "@/utils/report-load-state";

interface GroupMember {
  user_id: string;
  user_email: string;
  role: string;
}

interface ReportDataSets {
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  cards: Card[];
  incomes: Income[];
  recurringIncomes: RecurringIncome[];
  groupMembers: GroupMember[];
}

const EMPTY_REPORT_DATA: ReportDataSets = {
  expenses: [],
  recurringExpenses: [],
  cards: [],
  incomes: [],
  recurringIncomes: [],
  groupMembers: [],
};

const Reports = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentContext, getGroupMembers } = useSharedGroups();
  const { canExportPdf } = useSubscription();
  const { categories, loading: categoriesLoading } = useCategories();
  
  const [reportLoadState, dispatchReportLoad] = useReducer(
    (
      state: ReportLoadState<ReportDataSets>,
      action: ReportLoadAction<ReportDataSets>,
    ) => reduceReportLoadState(state, action),
    initialReportLoadState<ReportDataSets>(),
  );
  const reportRequestId = useRef(0);
  const [isExporting, setIsExporting] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  
  const [startDate, setStartDate] = useState(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState(endOfMonth(new Date()));
  const [periodLabel, setPeriodLabel] = useState("");
  const [periodType, setPeriodType] = useState<PeriodType>("month");

  const isGroupContext = currentContext.type === 'group';

  const fetchExpenses = useCallback(async (): Promise<Expense[]> => {
    if (!user) return [];

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
      throw error;
    }

    return data || [];
  }, [currentContext.groupId, isGroupContext, user]);

  const fetchRecurringExpenses = useCallback(async (): Promise<RecurringExpense[]> => {
    if (!user) return [];

    let query = supabase
      .from("recurring_expenses")
      .select("*")
      .order("created_at", { ascending: false });

    if (isGroupContext && currentContext.groupId) {
      query = query.eq("shared_group_id", currentContext.groupId);
    } else {
      query = query.eq("user_id", user.id).is("shared_group_id", null);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return data || [];
  }, [currentContext.groupId, isGroupContext, user]);

  const fetchCards = useCallback(async (): Promise<Card[]> => {
    if (!user) return [];

    const { data, error } = await supabase
      .from("cards")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  }, [user]);

  const fetchIncomes = useCallback(async (): Promise<Income[]> => {
    if (!user) return [];

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
      throw error;
    }

    return (data || []) as Income[];
  }, [currentContext.groupId, isGroupContext, user]);

  const fetchRecurringIncomes = useCallback(async (): Promise<RecurringIncome[]> => {
    if (!user) return [];

    let query = supabase
      .from("recurring_incomes")
      .select("*")
      .order("created_at", { ascending: false });

    if (isGroupContext && currentContext.groupId) {
      query = query.eq("shared_group_id", currentContext.groupId);
    } else {
      query = query.eq("user_id", user.id).is("shared_group_id", null);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data || []) as RecurringIncome[];
  }, [currentContext.groupId, isGroupContext, user]);

  const contextSelectionKey = isGroupContext && currentContext.groupId
    ? `group:${currentContext.groupId}`
    : `personal:${user?.id || "anonymous"}`;

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const requestId = ++reportRequestId.current;
    dispatchReportLoad({ type: "start", selectionKey: contextSelectionKey, requestId });

    const groupMembersRequest: Promise<GroupMember[]> = isGroupContext && currentContext.groupId
      ? getGroupMembers(currentContext.groupId).then((members) => members as GroupMember[])
      : Promise.resolve([]);

    Promise.all([
      fetchExpenses(),
      fetchRecurringExpenses(),
      fetchCards(),
      fetchIncomes(),
      fetchRecurringIncomes(),
      groupMembersRequest,
    ]).then(([
      expenses,
      recurringExpenses,
      cards,
      incomes,
      recurringIncomes,
      groupMembers,
    ]) => {
      dispatchReportLoad({
        type: "success",
        selectionKey: contextSelectionKey,
        requestId,
        data: { expenses, recurringExpenses, cards, incomes, recurringIncomes, groupMembers },
      });
    }).catch((error: unknown) => {
      console.error("Error fetching report data:", error);
      dispatchReportLoad({ type: "failure", selectionKey: contextSelectionKey, requestId });
    });
  }, [
    contextSelectionKey,
    currentContext.groupId,
    fetchCards,
    fetchExpenses,
    fetchIncomes,
    fetchRecurringExpenses,
    fetchRecurringIncomes,
    getGroupMembers,
    isGroupContext,
    navigate,
    user,
  ]);

  const handlePeriodChange = (newStartDate: Date, newEndDate: Date, label: string, type: PeriodType) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setPeriodLabel(label);
    setPeriodType(type);
  };

  const reportData = reportLoadState.data || EMPTY_REPORT_DATA;
  const { expenses, recurringExpenses, cards, incomes, recurringIncomes, groupMembers } = reportData;
  const reportViewReady = isReportViewReady(reportLoadState, categoriesLoading);
  const reportRenderKey = `${contextSelectionKey}:${startDate.getTime()}:${endDate.getTime()}:${periodType}`;

  // Compute shared view model from one atomic context snapshot.
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

    if (!reportViewReady) {
      toast.info("Aguarde o carregamento do relatório antes de exportar.");
      return;
    }
    
    try {
      setIsExporting(true);
      await exportSelectedReportToPDF({
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
              <AiHelpHint
                title={AI_CONTEXTUAL_HINTS.reports.title}
                description={AI_CONTEXTUAL_HINTS.reports.description}
                prompts={buildReportsPrompts(periodLabel)}
                ariaLabel={AI_CONTEXTUAL_HINTS.reports.ariaLabel}
              />
            </div>

            <Button
              variant="default"
              size="sm"
              onClick={handleExportPDF}
              disabled={isExporting || !reportViewReady}
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
        {reportViewReady ? (
          <ReportsAccordion
            key={reportRenderKey}
            cards={cards}
            periodType={periodType}
            periodLabel={periodLabel}
            isGroupContext={isGroupContext}
            groupMembers={groupMembers}
            viewModel={viewModel}
          />
        ) : (
          <div className="space-y-3" aria-busy="true" aria-label="Carregando relatório">
            <div className="h-24 rounded-lg bg-muted animate-pulse" />
            <div className="h-40 rounded-lg bg-muted animate-pulse" />
            <div className="h-40 rounded-lg bg-muted animate-pulse" />
          </div>
        )}
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

