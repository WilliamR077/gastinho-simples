import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ExpenseSummary } from "@/components/expense-summary";
import { ExpenseList } from "@/components/expense-list";
import { ExpenseFilters as ExpenseFiltersType, FilterTab } from "@/components/expense-filters";
import { CompactFilterBar } from "@/components/compact-filter-bar";
import { CategoryInsightCard } from "@/components/category-insight-card";
import { ExpenseEditDialog } from "@/components/expense-edit-dialog";
import { RecurringExpenseEditDialog } from "@/components/recurring-expense-edit-dialog";
import { BudgetGoalEditDialog } from "@/components/budget-goal-edit-dialog";
import { IncomeEditDialog, IncomeFormData } from "@/components/income-edit-dialog";
import { RecurringIncomeEditDialog, RecurringIncomeFormData } from "@/components/recurring-income-edit-dialog";
import { BudgetAlertBanner } from "@/components/budget-alert-banner";
import { IncomeGoalBanner } from "@/components/income-goal-banner";
import { BalanceGoalBanner } from "@/components/balance-goal-banner";
import { MonthNavigator } from "@/components/month-navigator";
import { FloatingActionButton } from "@/components/floating-action-button";
import { CalculatorDrawer } from "@/components/calculator-drawer";
import { UnifiedExpenseFormSheet } from "@/components/unified-expense-form-sheet";
import { BudgetGoalFormSheet } from "@/components/budget-goal-form-sheet";
import { ContextSelector } from "@/components/context-selector";
import { useSharedGroups } from "@/hooks/use-shared-groups";
import { useCategories } from "@/hooks/use-categories";
import { ProductTour } from "@/components/product-tour";
import { BalanceSummary } from "@/components/balance-summary";
import { UpsellBanner } from "@/components/upsell-banner";
import { GroupMemberSummary } from "@/components/group-member-summary";
import { UnifiedIncomeFormSheet } from "@/components/unified-income-form-sheet";
import { IncomeList } from "@/components/income-list";
import { RecurringIncomeList } from "@/components/recurring-income-list";
import { Income, RecurringIncome as RecurringIncomeType } from "@/types/income";
import { IncomeCategoryInsightCard } from "@/components/income-category-insight-card";
import { Separator } from "@/components/ui/separator";

import { Expense, PaymentMethod, ExpenseFormData, ExpenseCategory, categoryLabels } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { SharedGroupMember } from "@/types/shared-group";
import { RecurringExpenseList } from "@/components/recurring-expense-list";
import { RecurringExpenseFormData } from "@/types/recurring-expense";
import { BudgetGoal } from "@/types/budget-goal";
import { BudgetProgress } from "@/components/budget-progress";
import { toast } from "@/hooks/use-toast";
import { FilterX, CalendarDays, Receipt, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/app-header";
import { generateBillingPeriods, filterExpensesByBillingPeriod, calculateBillingPeriod, CreditCardConfig } from "@/utils/billing-period";
import { Card as CardType } from "@/types/card";
import { Footer } from "@/components/footer";
import { NotificationService } from "@/services/notification-service";
import { App as CapacitorApp } from '@capacitor/app';
import { adMobService } from "@/services/admob-service";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { parseLocalDate, cn } from "@/lib/utils";

export default function Index() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [budgetGoals, setBudgetGoals] = useState<BudgetGoal[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncomeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ExpenseFiltersType>(() => {
    const now = new Date();
    return {
      startDate: startOfMonth(now),
      endDate: endOfMonth(now)
    };
  });
  const [creditCardConfig, setCreditCardConfig] = useState<CreditCardConfig | null>(null);
  const [cards, setCards] = useState<CardType[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("expenses");
  const [expenseSubTab, setExpenseSubTab] = useState("monthly");
  const [incomeSubTab, setIncomeSubTab] = useState("monthly");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [activeIncomeCategoryFilter, setActiveIncomeCategoryFilter] = useState<string | null>(null);
  const [activeCardFilter, setActiveCardFilter] = useState<{ cardName: string; method: PaymentMethod } | null>(null);
  // filterTab removed - CompactFilterBar adapts automatically to activeTab
  const [viewMode, setViewMode] = useState<"calendar" | "billing">("calendar");
  const [billingCardId, setBillingCardId] = useState<string | null>(null);

  // Estado para o mês atual da navegação
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Estados para os sheets de formulário
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [budgetGoalSheetOpen, setBudgetGoalSheetOpen] = useState(false);
  const [incomeSheetOpen, setIncomeSheetOpen] = useState(false);

  // Estados para os modais de edição
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingRecurringExpense, setEditingRecurringExpense] = useState<RecurringExpense | null>(null);
  const [recurringExpenseDialogOpen, setRecurringExpenseDialogOpen] = useState(false);
  const [editingBudgetGoal, setEditingBudgetGoal] = useState<BudgetGoal | null>(null);
  const [budgetGoalDialogOpen, setBudgetGoalDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [incomeDialogOpen, setIncomeDialogOpen] = useState(false);
  const [editingRecurringIncome, setEditingRecurringIncome] = useState<RecurringIncomeType | null>(null);
  const [recurringIncomeDialogOpen, setRecurringIncomeDialogOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorInitialValue, setCalculatorInitialValue] = useState<number | undefined>();
  const [expenseDefaultAmount, setExpenseDefaultAmount] = useState<number | undefined>();
  const [expenseInitialData, setExpenseInitialData] = useState<import("@/components/unified-expense-form-sheet").ExpenseInitialData | undefined>();
  const [incomeInitialData, setIncomeInitialData] = useState<import("@/components/unified-income-form-sheet").IncomeInitialData | undefined>();


  const handleSendToCalculator = (value: number) => {
    setCalculatorInitialValue(value);
    setCalculatorOpen(true);
  };

  const handleCreateExpenseFromCalculator = (value: number) => {
    setExpenseDefaultAmount(value);
    setCalculatorOpen(false);
    setExpenseSheetOpen(true);
  };

  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { currentContext, groups, getGroupMembers } = useSharedGroups();
  const { categories } = useCategories();
  const [groupMembers, setGroupMembers] = useState<SharedGroupMember[]>([]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/landing");
    }
  }, [user, authLoading, navigate]);

  // Load group members when context changes to a group
  useEffect(() => {
    if (currentContext.type === 'group' && currentContext.groupId) {
      getGroupMembers(currentContext.groupId).then((members) => {
        setGroupMembers(members);
      }).catch((err) => {
        console.error("Error loading group members:", err);
        setGroupMembers([]);
      });
    } else {
      setGroupMembers([]);
    }
  }, [currentContext, getGroupMembers]);

  // Initialize notifications when recurring expenses are loaded
  useEffect(() => {
    if (recurringExpenses.length > 0 && notificationSettings) {
      NotificationService.requestPermissions().then((granted) => {
        if (granted) {
          NotificationService.rescheduleAllNotifications(
            recurringExpenses.filter((e) => e.is_active),
            notificationSettings
          );
        }
      });
    }
  }, [recurringExpenses, notificationSettings]);

  // Load notification settings
  useEffect(() => {
    if (user) {
      loadNotificationSettings();
    }
  }, [user]);

  const loadNotificationSettings = async () => {
    try {
      const { data, error } = await supabase.
      from("notification_settings").
      select("*").
      eq("user_id", user?.id).
      maybeSingle();

      if (error) throw error;

      if (data) {
        setNotificationSettings(data);
      } else {
        // Configurações padrão
        setNotificationSettings({
          is_enabled: true,
          notify_3_days_before: true,
          notify_1_day_before: true,
          notify_on_day: true
        });
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
    }
  };

  // Setup notification click listener
  useEffect(() => {
    NotificationService.addNotificationClickListener((notification) => {
      // Navega para a tab de lembretes quando clicar na notificação
      setActiveTab("recurring");

      toast({
        title: "📱 Notificação recebida",
        description: "Verifique suas despesas fixas"
      });
    });

    return () => {
      NotificationService.removeAllListeners();
    };
  }, []);

  // Setup app state listener for automatic resync
  useEffect(() => {
    let listenerHandle: any;

    const setupListener = async () => {
      listenerHandle = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive && user) {
          console.log('🔄 App voltou para foreground - sincronizando notificações');

          // Recarrega despesas e sincroniza notificações
          loadRecurringExpenses().then(() => {
            if (notificationSettings) {
              NotificationService.syncNotifications(
                recurringExpenses.filter((e) => e.is_active),
                notificationSettings
              );
            }
          });
        }
      });
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [user, recurringExpenses, notificationSettings]);

  // Load expenses and credit card config from Supabase
  useEffect(() => {
    if (user) {
      loadExpenses();
      loadRecurringExpenses();
      loadCreditCardConfig();
      loadBudgetGoals();
      loadCards();
      loadIncomes();
      loadRecurringIncomes();
    }
  }, [user, currentContext]);

  const loadCards = async () => {
    try {
      const { data, error } = await supabase.
      from("cards").
      select("*").
      eq("user_id", user?.id).
      eq("is_active", true);

      if (error) throw error;
      setCards(data || []);
    } catch (error) {
      console.error("Error loading cards:", error);
    }
  };

  const loadExpenses = async () => {
    try {
      let query = supabase.
      from("expenses").
      select(`
          *,
          card:cards(id, name, color, card_type),
          shared_group:shared_groups(id, name, color)
        `).
      order("created_at", { ascending: false });

      // Filtrar por contexto
      if (currentContext.type === 'personal') {
        query = query.is('shared_group_id', null);
      } else if (currentContext.type === 'group' && currentContext.groupId) {
        query = query.eq('shared_group_id', currentContext.groupId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error("Error loading expenses:", error);
      toast({
        title: "Erro ao carregar gastos",
        description: "Não foi possível carregar os gastos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRecurringExpenses = async () => {
    try {
      let query = supabase.
      from("recurring_expenses").
      select(`
          *,
          card:cards(id, name, color, card_type),
          shared_group:shared_groups(id, name, color)
        `).
      order("day_of_month", { ascending: true });

      // Filtrar por contexto
      if (currentContext.type === 'personal') {
        query = query.is('shared_group_id', null);
      } else if (currentContext.type === 'group' && currentContext.groupId) {
        query = query.eq('shared_group_id', currentContext.groupId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecurringExpenses(data || []);
    } catch (error) {
      console.error("Error loading recurring expenses:", error);
      toast({
        title: "Erro ao carregar despesas fixas",
        description: "Não foi possível carregar as despesas fixas.",
        variant: "destructive"
      });
    }
  };

  const loadCreditCardConfig = async () => {
    try {
      const { data, error } = await supabase.
      from("credit_card_configs").
      select("opening_day, closing_day").
      eq("user_id", user?.id).
      maybeSingle();

      if (error) throw error;

      if (data) {
        setCreditCardConfig(data);
      }
    } catch (error) {
      console.error("Error loading credit card config:", error);
    }
  };

  const loadBudgetGoals = async () => {
    try {
      let query = supabase.
      from("budget_goals").
      select("*").
      order("created_at", { ascending: false });

      // Filtrar por contexto
      if (currentContext.type === 'personal') {
        query = query.is('shared_group_id', null);
      } else if (currentContext.type === 'group' && currentContext.groupId) {
        query = query.eq('shared_group_id', currentContext.groupId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBudgetGoals(data || []);
    } catch (error) {
      console.error("Error loading budget goals:", error);
      toast({
        title: "Erro ao carregar metas",
        description: "Não foi possível carregar as metas de gastos.",
        variant: "destructive"
      });
    }
  };

  const loadIncomes = async () => {
    try {
      let query = supabase.
      from("incomes").
      select("*").
      order("income_date", { ascending: false });

      // Filtrar por contexto
      if (currentContext.type === 'personal') {
        query = query.is('shared_group_id', null);
      } else if (currentContext.type === 'group' && currentContext.groupId) {
        query = query.eq('shared_group_id', currentContext.groupId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setIncomes((data || []) as Income[]);
    } catch (error) {
      console.error("Error loading incomes:", error);
    }
  };

  const loadRecurringIncomes = async () => {
    try {
      let query = supabase.
      from("recurring_incomes").
      select("*").
      order("day_of_month", { ascending: true });

      // Filtrar por contexto
      if (currentContext.type === 'personal') {
        query = query.is('shared_group_id', null);
      } else if (currentContext.type === 'group' && currentContext.groupId) {
        query = query.eq('shared_group_id', currentContext.groupId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecurringIncomes((data || []) as RecurringIncomeType[]);
    } catch (error) {
      console.error("Error loading recurring incomes:", error);
    }
  };

  const deleteIncome = async (id: string) => {
    try {
      const { error } = await supabase.from("incomes").delete().eq("id", id);
      if (error) throw error;
      setIncomes((prev) => prev.filter((i) => i.id !== id));
      toast({
        title: "Entrada removida",
        description: "A entrada foi excluída com sucesso."
      });
    } catch (error) {
      console.error("Error deleting income:", error);
      toast({
        title: "Erro ao remover entrada",
        description: "Não foi possível remover a entrada.",
        variant: "destructive"
      });
    }
  };

  const deleteRecurringIncome = async (id: string) => {
    try {
      const { error } = await supabase.from("recurring_incomes").delete().eq("id", id);
      if (error) throw error;
      setRecurringIncomes((prev) => prev.filter((i) => i.id !== id));
      toast({
        title: "Entrada fixa removida",
        description: "A entrada fixa foi excluída com sucesso."
      });
    } catch (error) {
      console.error("Error deleting recurring income:", error);
      toast({
        title: "Erro ao remover entrada fixa",
        description: "Não foi possível remover a entrada fixa.",
        variant: "destructive"
      });
    }
  };

  const toggleRecurringIncomeActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase.
      from("recurring_incomes").
      update({ is_active: isActive }).
      eq("id", id);

      if (error) throw error;

      setRecurringIncomes((prev) =>
      prev.map((i) => i.id === id ? { ...i, is_active: isActive } : i)
      );

      toast({
        title: isActive ? "Entrada ativada" : "Entrada desativada",
        description: `A entrada fixa foi ${isActive ? "ativada" : "desativada"}.`
      });
    } catch (error) {
      console.error("Error toggling recurring income:", error);
    }
  };

  // Handlers para edição de entradas
  const handleEditIncome = (income: Income) => {
    setEditingIncome(income);
    setIncomeDialogOpen(true);
  };

  const handleDuplicateExpense = (expense: Expense) => {
    setExpenseInitialData({
      description: expense.description,
      amount: expense.amount,
      paymentMethod: expense.payment_method,
      expenseDate: parseLocalDate(expense.expense_date),
      categoryId: expense.category_id || expense.category,
      cardId: expense.card_id || undefined,
      expenseType: "monthly",
      installments: 1,
      sharedGroupId: expense.shared_group_id
    });
    setExpenseSheetOpen(true);
  };

  const handleDuplicateIncome = (income: Income) => {
    const catId = (income as any).income_category_id;
    setIncomeInitialData({
      description: income.description,
      amount: income.amount,
      categoryId: catId || income.category,
      incomeDate: parseLocalDate(income.income_date),
      incomeType: "monthly"
    });
    setIncomeSheetOpen(true);
  };

  const handleEditRecurringIncome = (income: RecurringIncomeType) => {
    setEditingRecurringIncome(income);
    setRecurringIncomeDialogOpen(true);
  };

  const updateIncome = async (id: string, data: IncomeFormData) => {
    try {
      const formatDateLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const { error } = await supabase.
      from("incomes").
      update({
        description: data.description,
        amount: data.amount,
        category: data.category,
        income_date: formatDateLocal(data.incomeDate),
        income_category_id: data.incomeCategoryId || null,
        category_name: data.categoryName || null,
        category_icon: data.categoryIcon || null
      } as any).
      eq("id", id);

      if (error) throw error;

      setIncomes((prev) =>
      prev.map((i) =>
      i.id === id ?
      {
        ...i,
        description: data.description,
        amount: data.amount,
        category: data.category,
        income_date: formatDateLocal(data.incomeDate),
        income_category_id: data.incomeCategoryId || null,
        category_name: data.categoryName || null,
        category_icon: data.categoryIcon || null
      } :
      i
      )
      );

      toast({
        title: "Entrada atualizada",
        description: "A entrada foi atualizada com sucesso."
      });
    } catch (error) {
      console.error("Error updating income:", error);
      toast({
        title: "Erro ao atualizar entrada",
        description: "Não foi possível atualizar a entrada.",
        variant: "destructive"
      });
    }
  };

  const updateRecurringIncome = async (id: string, data: RecurringIncomeFormData) => {
    try {
      const { error } = await supabase.
      from("recurring_incomes").
      update({
        description: data.description,
        amount: data.amount,
        category: data.category,
        day_of_month: data.dayOfMonth,
        income_category_id: data.incomeCategoryId || null,
        category_name: data.categoryName || null,
        category_icon: data.categoryIcon || null
      } as any).
      eq("id", id);

      if (error) throw error;

      setRecurringIncomes((prev) =>
      prev.map((i) =>
      i.id === id ?
      {
        ...i,
        description: data.description,
        amount: data.amount,
        category: data.category,
        day_of_month: data.dayOfMonth,
        income_category_id: data.incomeCategoryId || null,
        category_name: data.categoryName || null,
        category_icon: data.categoryIcon || null
      } :
      i
      )
      );

      toast({
        title: "Entrada fixa atualizada",
        description: "A entrada fixa foi atualizada com sucesso."
      });
    } catch (error) {
      console.error("Error updating recurring income:", error);
      toast({
        title: "Erro ao atualizar entrada fixa",
        description: "Não foi possível atualizar a entrada fixa.",
        variant: "destructive"
      });
    }
  };

  const handleMonthChange = (startDate: Date, endDate: Date) => {
    setCurrentMonth(startDate);
    setFilters((prev) => ({
      ...prev,
      startDate,
      endDate
    }));
  };

  const addExpense = async (data: ExpenseFormData) => {
    if (!user) return;

    // Validar se categoryId é UUID válido
    const isUUID = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

    try {
      const { description, amount, paymentMethod, expenseDate, installments = 1, categoryId, cardId, sharedGroupId } = data;

      // Format date to YYYY-MM-DD in local timezone (avoid UTC conversion issues)
      const formatDateLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Usar sharedGroupId do formulário (permite escolher destino diferente do contexto atual)
      const groupId = sharedGroupId || null;

      // Determinar se categoryId é UUID ou enum string
      const categoryIsUUID = categoryId ? isUUID(categoryId) : false;
      const categoryEnumValue = categoryId && !categoryIsUUID ? categoryId as ExpenseCategory : undefined;

      // Buscar dados desnormalizados para exibição em grupos
      const selectedCategory = categoryIsUUID ? categories.find((c) => c.id === categoryId) : null;
      const selectedCard = cardId ? cards.find((c) => c.id === cardId) : null;
      const categoryName = selectedCategory?.name || (categoryEnumValue ? categoryLabels[categoryEnumValue] : 'Outros');
      const categoryIcon = selectedCategory?.icon || '📦';
      const cardName = selectedCard?.name || null;

      if (installments === 1) {
        // Single expense
        const { data: insertedData, error } = await supabase.
        from("expenses").
        insert({
          description,
          amount,
          payment_method: paymentMethod,
          user_id: user.id,
          expense_date: formatDateLocal(expenseDate),
          total_installments: 1,
          installment_number: 1,
          ...(categoryIsUUID && { category_id: categoryId }),
          ...(categoryEnumValue && { category: categoryEnumValue }),
          ...(cardId && { card_id: cardId }),
          ...(groupId && { shared_group_id: groupId }),
          // Campos desnormalizados para visualização em grupos
          category_name: categoryName,
          category_icon: categoryIcon,
          card_name: cardName,
          card_color: selectedCard?.color || null
        }).
        select(`
          *,
          card:cards(id, name, color, card_type),
          shared_group:shared_groups(id, name, color)
        `).
        single();

        if (error) throw error;
        setExpenses((prev) => [insertedData, ...prev]);
      } else {
        // Multiple installments
        const installmentGroupId = crypto.randomUUID();
        const installmentAmount = amount / installments;
        const expensesToInsert = [];

        for (let i = 1; i <= installments; i++) {
          const installmentDate = new Date(expenseDate);
          installmentDate.setMonth(installmentDate.getMonth() + (i - 1));

          expensesToInsert.push({
            description: `${description} (${i}/${installments})`,
            amount: installmentAmount,
            payment_method: paymentMethod,
            user_id: user.id,
            expense_date: formatDateLocal(installmentDate),
            total_installments: installments,
            installment_number: i,
            installment_group_id: installmentGroupId,
            ...(categoryIsUUID && { category_id: categoryId }),
            ...(categoryEnumValue && { category: categoryEnumValue }),
            ...(cardId && { card_id: cardId }),
            ...(groupId && { shared_group_id: groupId }),
            // Campos desnormalizados para visualização em grupos
            category_name: categoryName,
            category_icon: categoryIcon,
            card_name: cardName,
            card_color: selectedCard?.color || null
          });
        }

        const { data: insertedData, error } = await supabase.
        from("expenses").
        insert(expensesToInsert).
        select(`
          *,
          card:cards(id, name, color, card_type),
          shared_group:shared_groups(id, name, color)
        `);

        if (error) throw error;
        setExpenses((prev) => [...(insertedData || []), ...prev]);
      }

      // Determinar label do contexto baseado no grupo selecionado no formulário
      const selectedGroup = groupId ? groups.find((g) => g.id === groupId) : null;
      const contextLabel = selectedGroup ? ` (${selectedGroup.name})` : '';
      toast({
        title: installments === 1 ? "Gasto adicionado!" : "Gasto parcelado adicionado!",
        description: installments === 1 ?
        `${description} - R$ ${amount.toFixed(2)}${contextLabel}` :
        `${description} - ${installments}x de R$ ${(amount / installments).toFixed(2)}${contextLabel}`
      });

      // Notificar membros do grupo (fire-and-forget)
      const groupId_ = data.sharedGroupId || (currentContext.type === 'group' ? currentContext.groupId : null);
      if (groupId_) {
        const selectedGroup_ = groups.find((g) => g.id === groupId_);
        const catName = categories.find((c) => c.id === data.categoryId)?.name;
        supabase.functions.invoke("notify-group-expense", {
          body: {
            group_id: groupId_,
            user_id: user.id,
            description: data.description,
            amount: data.amount,
            category_name: catName || categoryName,
            group_name: selectedGroup_?.name || currentContext.groupName || "Grupo"
          },
          headers: { "x-internal-secret": import.meta.env.VITE_INTERNAL_API_SECRET || "" }
        }).catch((err) => console.warn("⚠️ Falha ao notificar grupo:", err));
      }

      // Incrementar contador de despesas para controlar exibição de anúncios
      adMobService.incrementExpenseCount();
    } catch (error) {
      console.error("Error adding expense:", error);
      toast({
        title: "Erro ao adicionar gasto",
        description: "Não foi possível adicionar o gasto.",
        variant: "destructive"
      });
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const { error } = await supabase.
      from("expenses").
      delete().
      eq("id", id);

      if (error) throw error;

      setExpenses((prev) => prev.filter((expense) => expense.id !== id));

      toast({
        title: "Gasto removido",
        description: "O gasto foi excluído com sucesso.",
        variant: "destructive"
      });
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({
        title: "Erro ao remover gasto",
        description: "Não foi possível remover o gasto.",
        variant: "destructive"
      });
    }
  };

  const addRecurringExpense = async (data: RecurringExpenseFormData) => {
    if (!user) return;

    // Usar sharedGroupId do formulário (permite escolher destino diferente do contexto atual)
    const groupId = data.sharedGroupId || null;

    // Buscar dados desnormalizados para exibição em grupos
    const selectedCategory = data.categoryId ? categories.find((c) => c.id === data.categoryId) : null;
    const selectedCard = data.cardId ? cards.find((c) => c.id === data.cardId) : null;
    const categoryName = selectedCategory?.name || 'Outros';
    const categoryIcon = selectedCategory?.icon || '📦';
    const cardName = selectedCard?.name || null;

    try {
      const { data: insertedData, error } = await supabase.
      from("recurring_expenses").
      insert({
        description: data.description,
        amount: data.amount,
        payment_method: data.paymentMethod,
        day_of_month: data.dayOfMonth,
        user_id: user.id,
        ...(data.categoryId && { category_id: data.categoryId }),
        ...(data.cardId && { card_id: data.cardId }),
        ...(groupId && { shared_group_id: groupId }),
        // Campos desnormalizados para visualização em grupos
        category_name: categoryName,
        category_icon: categoryIcon,
        card_name: cardName,
        card_color: selectedCard?.color || null
      }).
      select(`
        *,
        card:cards(id, name, color, card_type),
        shared_group:shared_groups(id, name, color)
      `).
      single();

      if (error) throw error;
      setRecurringExpenses((prev) => [...prev, insertedData].sort((a, b) => a.day_of_month - b.day_of_month));

      // Agendar notificações para a nova despesa
      await NotificationService.scheduleNotificationsForExpense(insertedData, notificationSettings);

      // Determinar label do contexto baseado no grupo selecionado no formulário
      const selectedGroup = groupId ? groups.find((g) => g.id === groupId) : null;
      const contextLabel = selectedGroup ? ` (${selectedGroup.name})` : '';
      toast({
        title: "Despesa fixa adicionada!",
        description: `${data.description} - R$ ${data.amount.toFixed(2)} (Dia ${data.dayOfMonth})${contextLabel}`
      });
    } catch (error) {
      console.error("Error adding recurring expense:", error);
      toast({
        title: "Erro ao adicionar despesa fixa",
        description: "Não foi possível adicionar a despesa fixa.",
        variant: "destructive"
      });
    }
  };

  const deleteRecurringExpense = async (id: string) => {
    try {
      // Cancelar notificações antes de deletar
      await NotificationService.cancelNotificationsForExpense(id);

      const { error } = await supabase.
      from("recurring_expenses").
      delete().
      eq("id", id);

      if (error) throw error;

      setRecurringExpenses((prev) => prev.filter((expense) => expense.id !== id));

      toast({
        title: "Despesa fixa removida",
        description: "A despesa fixa foi excluída com sucesso.",
        variant: "destructive"
      });
    } catch (error) {
      console.error("Error deleting recurring expense:", error);
      toast({
        title: "Erro ao remover despesa fixa",
        description: "Não foi possível remover a despesa fixa.",
        variant: "destructive"
      });
    }
  };

  const toggleRecurringExpenseActive = async (id: string, isActive: boolean) => {
    try {
      // Se desativando, definir end_date; se ativando, limpar end_date
      const updateData = isActive ?
      { is_active: isActive, end_date: null } :
      { is_active: isActive, end_date: new Date().toISOString().split('T')[0] };

      const { error } = await supabase.
      from("recurring_expenses").
      update(updateData).
      eq("id", id);

      if (error) throw error;

      const updatedExpense = recurringExpenses.find((e) => e.id === id);

      setRecurringExpenses((prev) =>
      prev.map((expense) =>
      expense.id === id ?
      { ...expense, is_active: isActive, end_date: isActive ? null : new Date().toISOString().split('T')[0] } :
      expense
      )
      );

      // Gerenciar notificações baseado no status
      if (updatedExpense) {
        if (isActive) {
          // Ativar: agendar notificações
          await NotificationService.scheduleNotificationsForExpense(
            { ...updatedExpense, is_active: isActive },
            notificationSettings
          );
        } else {
          // Desativar: cancelar notificações
          await NotificationService.cancelNotificationsForExpense(id);
        }
      }

      toast({
        title: isActive ? "Despesa fixa ativada" : "Despesa fixa desativada",
        description: isActive ?
        "A despesa fixa foi ativada e será considerada nos cálculos." :
        "A despesa fixa foi desativada e não será mais considerada."
      });
    } catch (error) {
      console.error("Error toggling recurring expense:", error);
      toast({
        title: "Erro ao atualizar despesa fixa",
        description: "Não foi possível atualizar a despesa fixa.",
        variant: "destructive"
      });
    }
  };

  const addBudgetGoal = async (data: {type: string;category?: string;limitAmount: number;sharedGroupId?: string;}) => {
    if (!user) return;

    // Usar sharedGroupId do formulário ou do contexto atual
    const groupId = data.sharedGroupId || (currentContext.type === 'group' ? currentContext.groupId : null);

    try {
      const { data: insertedData, error } = await supabase.
      from("budget_goals").
      insert([{
        user_id: user.id,
        type: data.type as any,
        category: data.category as any || null,
        limit_amount: data.limitAmount,
        ...(groupId && { shared_group_id: groupId })
      }]).
      select().
      single();

      if (error) throw error;

      setBudgetGoals((prev) => [insertedData, ...prev]);

      const contextLabel = currentContext.type === 'group' && currentContext.groupName ?
      ` (${currentContext.groupName})` :
      '';
      const isIncome = data.type.startsWith('income_');
      const goalLabel = isIncome ? 'meta de entradas' : 'meta de gastos';
      toast({
        title: "Meta adicionada!",
        description: `Sua ${goalLabel} foi criada com sucesso${contextLabel}.`
      });
    } catch (error) {
      console.error("Error adding budget goal:", error);
      const isIncome = data.type.startsWith('income_');
      const goalLabel = isIncome ? 'meta de entradas' : 'meta de gastos';
      toast({
        title: "Erro ao adicionar meta",
        description: `Não foi possível adicionar a ${goalLabel}.`,
        variant: "destructive"
      });
    }
  };

  const deleteBudgetGoal = async (id: string) => {
    try {
      const { error } = await supabase.
      from("budget_goals").
      delete().
      eq("id", id);

      if (error) throw error;

      setBudgetGoals((prev) => prev.filter((goal) => goal.id !== id));

      toast({
        title: "Meta removida",
        description: "A meta de gastos foi excluída com sucesso.",
        variant: "destructive"
      });
    } catch (error) {
      console.error("Error deleting budget goal:", error);
      toast({
        title: "Erro ao remover meta",
        description: "Não foi possível remover a meta de gastos.",
        variant: "destructive"
      });
    }
  };

  // Funções de edição
  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseDialogOpen(true);
  };

  const updateExpense = async (id: string, data: ExpenseFormData) => {
    try {
      const formatDateLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const { data: updatedData, error } = await supabase.
      from("expenses").
      update({
        description: data.description,
        amount: data.amount,
        payment_method: data.paymentMethod,
        expense_date: formatDateLocal(data.expenseDate),
        ...(data.categoryId && { category_id: data.categoryId }),
        ...(data.cardId && { card_id: data.cardId })
      }).
      eq("id", id).
      select(`
          *,
          card:cards(id, name, color, card_type)
        `).
      single();

      if (error) throw error;

      if (updatedData) {
        setExpenses((prev) => prev.map((e) =>
        e.id === id ? updatedData : e
        ));
      }

      setExpenseDialogOpen(false);
      setEditingExpense(null);

      toast({
        title: "Despesa atualizada!",
        description: "As alterações foram salvas com sucesso."
      });
    } catch (error) {
      console.error("Error updating expense:", error);
      toast({
        title: "Erro ao atualizar despesa",
        description: "Não foi possível atualizar a despesa.",
        variant: "destructive"
      });
    }
  };

  const handleEditRecurringExpense = (expense: RecurringExpense) => {
    setEditingRecurringExpense(expense);
    setRecurringExpenseDialogOpen(true);
  };

  const updateRecurringExpense = async (id: string, data: RecurringExpenseFormData) => {
    try {
      const { data: updatedData, error } = await supabase.
      from("recurring_expenses").
      update({
        description: data.description,
        amount: data.amount,
        payment_method: data.paymentMethod,
        day_of_month: data.dayOfMonth,
        ...(data.categoryId && { category_id: data.categoryId }),
        ...(data.cardId && { card_id: data.cardId })
      }).
      eq("id", id).
      select(`
          *,
          card:cards(id, name, color, card_type)
        `).
      single();

      if (error) throw error;

      if (updatedData) {
        setRecurringExpenses((prev) =>
        prev.map((e) => e.id === id ? updatedData : e).sort((a, b) => a.day_of_month - b.day_of_month)
        );
      }

      // Re-agendar notificações se estiver ativa
      if (updatedData.is_active) {
        await NotificationService.cancelNotificationsForExpense(id);
        await NotificationService.scheduleNotificationsForExpense(updatedData, notificationSettings);
      }

      setRecurringExpenseDialogOpen(false);
      setEditingRecurringExpense(null);

      toast({
        title: "Despesa fixa atualizada!",
        description: "As alterações foram salvas com sucesso."
      });
    } catch (error) {
      console.error("Error updating recurring expense:", error);
      toast({
        title: "Erro ao atualizar despesa fixa",
        description: "Não foi possível atualizar a despesa fixa.",
        variant: "destructive"
      });
    }
  };

  const handleEditBudgetGoal = (goal: BudgetGoal) => {
    setEditingBudgetGoal(goal);
    setBudgetGoalDialogOpen(true);
  };

  const updateBudgetGoal = async (id: string, data: {type: string;category?: string;limitAmount: number;}) => {
    try {
      const { error } = await supabase.
      from("budget_goals").
      update({
        type: data.type as any,
        category: data.category as any || null,
        limit_amount: data.limitAmount
      }).
      eq("id", id);

      if (error) throw error;

      setBudgetGoals((prev) => prev.map((g) => {
        if (g.id === id) {
          return {
            ...g,
            type: data.type as any,
            category: data.category as any || null,
            limit_amount: data.limitAmount
          };
        }
        return g;
      }));

      setBudgetGoalDialogOpen(false);
      setEditingBudgetGoal(null);

      toast({
        title: "Meta atualizada!",
        description: "As alterações foram salvas com sucesso."
      });
    } catch (error) {
      console.error("Error updating budget goal:", error);
      toast({
        title: "Erro ao atualizar meta",
        description: "Não foi possível atualizar a meta.",
        variant: "destructive"
      });
    }
  };

  // Criar mapa de configs de cartões
  const cardsConfigMap = useMemo(() => {
    const map = new Map<string, CreditCardConfig>();
    cards.forEach((card) => {
      if (card.opening_day !== null && card.closing_day !== null) {
        map.set(card.id, {
          opening_day: card.opening_day,
          closing_day: card.closing_day,
          due_day: card.due_day ?? undefined,
          days_before_due: card.days_before_due ?? undefined,
        });
      }
    });
    return map;
  }, [cards]);

  // Credit cards for billing mode selector
  const creditCards = useMemo(() => {
    return cards.filter(c => c.card_type === "credit" || c.card_type === "both");
  }, [cards]);

  // Auto-select card when switching to billing mode
  useEffect(() => {
    if (viewMode === "billing") {
      if (creditCards.length === 1) {
        setBillingCardId(creditCards[0].id);
      } else if (creditCards.length === 0) {
        setBillingCardId(null);
      }
    } else {
      setBillingCardId(null);
    }
  }, [viewMode, creditCards]);

  // Gerar períodos de faturamento disponíveis
  const billingPeriods = useMemo(() => {
    if (!creditCardConfig) return [];
    return generateBillingPeriods(expenses, creditCardConfig, cardsConfigMap);
  }, [expenses, creditCardConfig, cardsConfigMap]);

  // Filtrar despesas baseado nos filtros aplicados
  const filteredExpenses = useMemo(() => {
    const selectedMonth = format(currentMonth, "yyyy-MM");

    return expenses.filter((expense) => {
      // In billing mode, ONLY credit expenses are shown
      if (viewMode === "billing") {
        if (expense.payment_method !== "credit") return false;
        
        // If a specific card is selected, filter by it
        if (billingCardId && expense.card_id !== billingCardId) return false;
        
        const expenseDate = parseLocalDate(expense.expense_date);
        let config: CreditCardConfig | undefined;
        if (expense.card_id && cardsConfigMap.has(expense.card_id)) {
          config = cardsConfigMap.get(expense.card_id);
        } else if (creditCardConfig) {
          config = creditCardConfig;
        }
        if (config) {
          const billingMonth = calculateBillingPeriod(expenseDate, config);
          if (billingMonth !== selectedMonth) return false;
        } else {
          // No config, fallback to date filter
          if (filters.startDate && expenseDate < filters.startDate) return false;
          if (filters.endDate && expenseDate > filters.endDate) return false;
        }
      } else {
        // Calendar mode: filter by expense_date
        if (filters.startDate) {
          const expenseDate = parseLocalDate(expense.expense_date);
          if (expenseDate < filters.startDate) return false;
        }
        if (filters.endDate) {
          const expenseDate = parseLocalDate(expense.expense_date);
          if (expenseDate > filters.endDate) return false;
        }
      }

      if (filters.description) {
        if (!expense.description.toLowerCase().includes(filters.description.toLowerCase())) {
          return false;
        }
      }
      if (filters.minAmount !== undefined && expense.amount < filters.minAmount) return false;
      if (filters.maxAmount !== undefined && expense.amount > filters.maxAmount) return false;
      if (filters.paymentMethod && expense.payment_method !== filters.paymentMethod) return false;
      if (filters.cardId && expense.card_id !== filters.cardId) return false;

      // Billing period filter (only in calendar mode)
      if (viewMode === "calendar" && filters.billingPeriod && creditCardConfig) {
        const billingExpenses = filterExpensesByBillingPeriod(
          [expense],
          filters.billingPeriod,
          creditCardConfig,
          cardsConfigMap
        );
        if (billingExpenses.length === 0) return false;
      }

      return true;
    });
  }, [expenses, filters, creditCardConfig, cardsConfigMap, viewMode, currentMonth, billingCardId]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handlePaymentMethodFilter = (method: PaymentMethod) => {
    setFilters((prev) => {
      const isActive = prev.paymentMethod === method;
      if (isActive) {
        const { paymentMethod, ...rest } = prev;
        toast({
          title: "Filtro removido",
          description: "Exibindo todas as formas de pagamento"
        });
        return rest;
      } else {
        toast({
          title: "Filtro aplicado",
          description: `Exibindo apenas ${method === 'pix' ? 'PIX' : method === 'debit' ? 'Débito' : 'Crédito'}`
        });
        return { ...prev, paymentMethod: method };
      }
    });
  };

  const handleCategoryFilter = (categoryId: string) => {
    setActiveCategoryFilter((prev) => {
      if (prev === categoryId) {
        toast({
          title: "Filtro removido",
          description: "Exibindo todas as categorias"
        });
        return null;
      } else {
        toast({
          title: "Filtro aplicado",
          description: "Filtrando por categoria selecionada"
        });
        return categoryId;
      }
    });
  };

  // Handler para filtro por cartão específico
  const handleCardFilter = (cardName: string, method: PaymentMethod) => {
    setActiveCardFilter((prev) => {
      if (prev?.cardName === cardName && prev?.method === method) {
        toast({
          title: "Filtro removido",
          description: "Exibindo todos os cartões"
        });
        return null;
      } else {
        toast({
          title: "Filtro aplicado",
          description: `Filtrando por ${cardName}`
        });
        return { cardName, method };
      }
    });
  };

  // Filtrar despesas recorrentes baseado nos filtros aplicados
  const filteredRecurringExpenses = useMemo(() => {
    return recurringExpenses.filter((expense) => {
      if (filters.description) {
        if (!expense.description.toLowerCase().includes(filters.description.toLowerCase())) {
          return false;
        }
      }
      if (filters.minAmount !== undefined) {
        if (expense.amount < filters.minAmount) return false;
      }
      if (filters.maxAmount !== undefined) {
        if (expense.amount > filters.maxAmount) return false;
      }
      if (filters.paymentMethod) {
        if (expense.payment_method !== filters.paymentMethod) return false;
      }
      if (filters.cardId && expense.card_id !== filters.cardId) {
        return false;
      }
      return true;
    });
  }, [recurringExpenses, filters]);

  // Despesas filtradas por categoria e cartão
  const displayedExpenses = useMemo(() => {
    let result = filteredExpenses;
    if (activeCategoryFilter) {
      result = result.filter((e) =>
        e.category_id === activeCategoryFilter || e.category === activeCategoryFilter
      );
    }
    if (activeCardFilter) {
      result = result.filter((e) => {
        if (e.payment_method !== activeCardFilter.method) return false;
        const expCardName = e.card?.name || e.card_name || 'Sem cartão';
        return expCardName === activeCardFilter.cardName;
      });
    }
    return result;
  }, [filteredExpenses, activeCategoryFilter, activeCardFilter]);

  // Despesas recorrentes filtradas por categoria e cartão
  const displayedRecurringExpenses = useMemo(() => {
    let result = filteredRecurringExpenses;
    if (activeCategoryFilter) {
      result = result.filter((e) =>
        e.category_id === activeCategoryFilter || e.category === activeCategoryFilter
      );
    }
    if (activeCardFilter) {
      result = result.filter((e) => {
        if (e.payment_method !== activeCardFilter.method) return false;
        const expCardName = e.card?.name || e.card_name || 'Sem cartão';
        return expCardName === activeCardFilter.cardName;
      });
    }
    return result;
  }, [filteredRecurringExpenses, activeCategoryFilter, activeCardFilter]);

  // Verificar se há filtros ativos
  const hasActiveFilters = useMemo(() => {
    return !!(
    filters.description ||
    filters.minAmount !== undefined ||
    filters.maxAmount !== undefined ||
    filters.paymentMethod ||
    filters.cardId ||
    activeCategoryFilter ||
    activeIncomeCategoryFilter ||
    activeCardFilter);

  }, [filters, activeCategoryFilter, activeIncomeCategoryFilter, activeCardFilter]);

  // Função para limpar todos os filtros
  const clearAllFilters = () => {
    setFilters((prev) => ({
      ...prev,
      description: undefined,
      minAmount: undefined,
      maxAmount: undefined,
      paymentMethod: undefined,
      cardId: undefined
    }));
    setActiveCategoryFilter(null);
    setActiveIncomeCategoryFilter(null);
    setActiveCardFilter(null);
  };

  // Handler para filtro de categoria de entrada
  const handleIncomeCategoryFilter = (category: string) => {
    setActiveIncomeCategoryFilter((prev) => {
      if (prev === category) {
        toast({
          title: "Filtro removido",
          description: "Exibindo todas as categorias de entrada"
        });
        return null;
      } else {
        toast({
          title: "Filtro aplicado",
          description: "Filtrando por categoria de entrada selecionada"
        });
        return category;
      }
    });
  };

  // Entradas filtradas por categoria e filtros globais
  const displayedIncomes = useMemo(() => {
    const dateFiltered = incomes.filter((i) => {
      const date = parseLocalDate(i.income_date);
      return date >= (filters.startDate || startOfMonth(new Date())) &&
      date <= (filters.endDate || endOfMonth(new Date()));
    });
    return dateFiltered.filter((i) => {
      // Filtro de categoria
      if (activeIncomeCategoryFilter && (i as any).income_category_id !== activeIncomeCategoryFilter && i.category !== activeIncomeCategoryFilter) return false;
      // Filtro de descrição
      if (filters.description && !i.description.toLowerCase().includes(filters.description.toLowerCase())) return false;
      // Filtro de valor mínimo
      if (filters.minAmount !== undefined && i.amount < filters.minAmount) return false;
      // Filtro de valor máximo
      if (filters.maxAmount !== undefined && i.amount > filters.maxAmount) return false;
      return true;
    });
  }, [incomes, filters.startDate, filters.endDate, filters.description, filters.minAmount, filters.maxAmount, activeIncomeCategoryFilter]);

  // Entradas recorrentes filtradas por categoria e filtros globais
  const displayedRecurringIncomes = useMemo(() => {
    return recurringIncomes.filter((i) => {
      if (activeIncomeCategoryFilter && (i as any).income_category_id !== activeIncomeCategoryFilter && i.category !== activeIncomeCategoryFilter) return false;
      if (filters.description && !i.description.toLowerCase().includes(filters.description.toLowerCase())) return false;
      if (filters.minAmount !== undefined && i.amount < filters.minAmount) return false;
      if (filters.maxAmount !== undefined && i.amount > filters.maxAmount) return false;
      return true;
    });
  }, [recurringIncomes, filters.description, filters.minAmount, filters.maxAmount, activeIncomeCategoryFilter]);

  // Calcular metas em risco (usa o mês selecionado, não o mês atual)
  const goalsAtRisk = useMemo(() => {
    const selectedMonthNum = currentMonth.getMonth();
    const selectedYearNum = currentMonth.getFullYear();

    const monthlyExpensesForGoals = expenses.filter((expense) => {
      const expenseDate = parseLocalDate(expense.expense_date);
      return (
        expenseDate.getMonth() === selectedMonthNum &&
        expenseDate.getFullYear() === selectedYearNum);

    });

    const activeRecurring = recurringExpenses.filter((re) => re.is_active);

    return budgetGoals.
    filter((goal) => goal.type === "monthly_total" || goal.type === "category").
    map((goal) => {
      let totalSpent = 0;

      if (goal.type === "monthly_total") {
        totalSpent = monthlyExpensesForGoals.reduce((sum, exp) => sum + Number(exp.amount), 0);
        totalSpent += activeRecurring.reduce((sum, re) => sum + Number(re.amount), 0);
      } else if (goal.type === "category" && goal.category) {
        // Match por enum OU por category_id que corresponda ao nome da categoria
        const goalCategoryLabel = categoryLabels[goal.category as keyof typeof categoryLabels];

        totalSpent = monthlyExpensesForGoals.
        filter((exp) => exp.category === goal.category).
        reduce((sum, exp) => sum + Number(exp.amount), 0);
        totalSpent += activeRecurring.
        filter((re) => re.category === goal.category).
        reduce((sum, re) => sum + Number(re.amount), 0);
      }

      const limit = Number(goal.limit_amount);
      const percentage = totalSpent / limit * 100;
      const remaining = limit - totalSpent;

      return { goal, totalSpent, limit, percentage, remaining };
    }).
    filter((item) => item.percentage >= 80);
  }, [budgetGoals, expenses, recurringExpenses, currentMonth]);

  // Calcular totais de entradas e saídas do mês
  const monthlyTotals = useMemo(() => {
    const monthStart = filters.startDate || startOfMonth(new Date());
    const monthEnd = filters.endDate || endOfMonth(new Date());
    const selectedMonth = format(currentMonth, "yyyy-MM");

    // Despesas do período (billing-aware)
    const periodExpenses = expenses.filter((e) => {
      if (viewMode === "billing") {
        if (e.payment_method !== "credit") return false;
        if (billingCardId && e.card_id !== billingCardId) return false;
        const expDate = parseLocalDate(e.expense_date);
        let config: CreditCardConfig | undefined;
        if (e.card_id && cardsConfigMap.has(e.card_id)) {
          config = cardsConfigMap.get(e.card_id);
        } else if (creditCardConfig) {
          config = creditCardConfig;
        }
        if (config) {
          return calculateBillingPeriod(expDate, config) === selectedMonth;
        }
        return false;
      }
      const date = parseLocalDate(e.expense_date);
      return date >= monthStart && date <= monthEnd;
    });
    const totalExpenses = periodExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalRecurringExpenses = recurringExpenses.
    filter((e) => e.is_active).
    reduce((sum, e) => sum + Number(e.amount), 0);

    // Receitas do período
    const periodIncomes = incomes.filter((i) => {
      const date = parseLocalDate(i.income_date);
      return date >= monthStart && date <= monthEnd;
    });
    const totalIncomes = periodIncomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const totalRecurringIncomes = recurringIncomes.
    filter((i) => i.is_active).
    reduce((sum, i) => sum + Number(i.amount), 0);

    return {
      totalIncome: totalIncomes + totalRecurringIncomes,
      totalExpense: totalExpenses + totalRecurringExpenses
    };
  }, [expenses, recurringExpenses, incomes, recurringIncomes, filters.startDate, filters.endDate, viewMode, currentMonth, cardsConfigMap, creditCardConfig, billingCardId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>);

  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Product Tour */}
      <ProductTour />

      {/* App Header */}
      <AppHeader
        recurringExpenses={recurringExpenses}
        onSignOut={handleSignOut} />


      <div className="container mx-auto px-4 py-4 max-w-6xl" data-tour="welcome">

        {/* Context Selector */}
        <ContextSelector />

        {/* Navegador de Mês */}
        <div data-tour="month-navigator">
          <MonthNavigator
            currentDate={currentMonth}
            onMonthChange={handleMonthChange}
            suffix={viewMode === "billing" ? "• Fatura" : undefined} />
        </div>

        {/* Toggle Calendário / Fatura */}
        <div data-tour="view-mode-toggle" className="flex items-center justify-center gap-1.5 mb-3">
          <button
            onClick={() => setViewMode("calendar")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
              viewMode === "calendar"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Calendário
          </button>
          <button
            onClick={() => setViewMode("billing")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
              viewMode === "billing"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
            )}
          >
            <Receipt className="h-3.5 w-3.5" />
            Fatura
          </button>
        </div>

        {/* Card selector for billing mode */}
        {viewMode === "billing" && (
          <div className="mb-3">
            {creditCards.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted text-muted-foreground text-xs">
                <CreditCard className="h-3.5 w-3.5" />
                Cadastre um cartão de crédito para usar o modo Fatura
              </div>
            ) : creditCards.length >= 2 ? (
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {creditCards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => setBillingCardId(card.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                      billingCardId === card.id
                        ? "bg-accent text-accent-foreground border-accent"
                        : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                    )}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color || "#FFA500" }} />
                    {card.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <div className="mb-3">
          <BalanceSummary
            totalIncome={monthlyTotals.totalIncome}
            totalExpense={monthlyTotals.totalExpense} />
        </div>

        {/* Upsell Banner */}
        <UpsellBanner expenseCount={expenses.length} />

        {/* Group Member Summary - only in group context */}
        {currentContext.type === 'group' &&
        <GroupMemberSummary
          expenses={filteredExpenses}
          recurringExpenses={filteredRecurringExpenses}
          groupMembers={groupMembers} />

        }

        {/* Summary Cards */}
        <div className="mb-4" data-tour="expense-summary">
          <ExpenseSummary
            expenses={displayedExpenses}
            recurringExpenses={displayedRecurringExpenses}
            billingPeriod={filters.billingPeriod}
            startDate={filters.startDate}
            endDate={filters.endDate}
            creditCardConfig={creditCardConfig || undefined}
            onPaymentMethodClick={handlePaymentMethodFilter}
            activePaymentMethod={filters.paymentMethod}
            budgetGoals={budgetGoals.filter((g) => g.type === "monthly_total" || g.type === "category")}
            onNavigateToGoals={() => setActiveTab("goals")}
            onCardClick={handleCardFilter}
            activeCardName={activeCardFilter?.cardName} />

        </div>

        {/* Budget Alert Banner */}
        <BudgetAlertBanner
          goalsAtRisk={goalsAtRisk}
          onNavigateToGoals={() => setActiveTab("goals")} />


        {/* Income Goal Celebration Banner */}
        <IncomeGoalBanner
          budgetGoals={budgetGoals}
          incomes={incomes}
          recurringIncomes={recurringIncomes}
          selectedMonth={currentMonth}
          onNavigateToGoals={() => setActiveTab("goals")} />


        {/* Balance Goal Celebration Banner */}
        <BalanceGoalBanner
          budgetGoals={budgetGoals}
          incomes={incomes}
          recurringIncomes={recurringIncomes}
          expenses={expenses}
          recurringExpenses={recurringExpenses}
          selectedMonth={currentMonth}
          onNavigateToGoals={() => setActiveTab("goals")} />


        {/* Compact Filter Bar */}
        <div className="mb-4">
          <CompactFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            billingPeriods={billingPeriods}
            expenses={expenses}
            creditCardConfig={creditCardConfig}
            cardsConfigMap={cardsConfigMap}
            activeTab={activeTab as "expenses" | "incomes" | "goals"}
            monthStartDate={startOfMonth(currentMonth)}
            monthEndDate={endOfMonth(currentMonth)}
            viewMode={viewMode} />

        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" data-tour="tabs">
          <TabsList className="grid w-full grid-cols-3 mb-3 bg-muted/50">
            <TabsTrigger value="expenses" data-tour="tab-expenses" className="data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400">Despesas</TabsTrigger>
            <TabsTrigger value="incomes" data-tour="tab-incomes" className="data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400">Entradas</TabsTrigger>
            <TabsTrigger value="goals" data-tour="tab-goals" className="relative data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400">
              Metas
              {goalsAtRisk.length > 0 &&
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {goalsAtRisk.length}
                </span>
              }
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses">
            {/* Category insight card */}
            <div className="mb-4" data-tour="category-summary">
              <CategoryInsightCard
                expenses={filteredExpenses}
                recurringExpenses={filteredRecurringExpenses}
                billingPeriod={filters.billingPeriod}
                startDate={filters.startDate}
                endDate={filters.endDate}
                creditCardConfig={creditCardConfig || undefined}
                onCategoryClick={handleCategoryFilter}
                activeCategory={activeCategoryFilter || undefined} />

            </div>

            {/* Sub-tab chips: Do Mês / Fixas */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">
                {expenseSubTab === "monthly" ? "Despesas do Mês" : "Despesas Fixas"}
              </h3>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setExpenseSubTab("monthly")}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                    expenseSubTab === "monthly" ?
                    "bg-red-500 text-white border-red-500" :
                    "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                  )}>

                  Do Mês
                </button>
                <button
                  onClick={() => setExpenseSubTab("recurring")}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                    expenseSubTab === "recurring" ?
                    "bg-red-500 text-white border-red-500" :
                    "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                  )}>

                  Fixas
                </button>
              </div>
            </div>

            {/* Content based on sub-tab */}
            <div className="space-y-4">
              {hasActiveFilters &&
              <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground">
                    <FilterX className="h-3 w-3 mr-1" />
                    Limpar filtros
                  </Button>
                </div>
              }
              {expenseSubTab === "monthly" ?
              <ExpenseList
                expenses={displayedExpenses}
                onDeleteExpense={deleteExpense}
                onEditExpense={handleEditExpense}
                onDuplicateExpense={handleDuplicateExpense}
                onSendToCalculator={handleSendToCalculator}
                groupMembers={groupMembers}
                isGroupContext={currentContext.type === 'group'} /> :


              <RecurringExpenseList
              expenses={displayedRecurringExpenses}
              onDeleteExpense={deleteRecurringExpense}
              onToggleActive={toggleRecurringExpenseActive}
              onEditRecurringExpense={handleEditRecurringExpense}
              onSendToCalculator={handleSendToCalculator}
              groupMembers={groupMembers}
              isGroupContext={currentContext.type === 'group'} />

              }
            </div>
          </TabsContent>

          <TabsContent value="incomes">
            {/* Income category insight card */}
            <div className="mb-4">
              <IncomeCategoryInsightCard
                incomes={incomes}
                recurringIncomes={recurringIncomes}
                startDate={filters.startDate}
                endDate={filters.endDate}
                onCategoryClick={handleIncomeCategoryFilter}
                activeCategory={activeIncomeCategoryFilter || undefined} />

            </div>

            {/* Sub-tab chips: Do Mês / Fixas */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">
                {incomeSubTab === "monthly" ? "Entradas do Mês" : "Entradas Fixas"}
              </h3>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setIncomeSubTab("monthly")}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                    incomeSubTab === "monthly" ?
                    "bg-green-500 text-white border-green-500" :
                    "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                  )}>

                  Do Mês
                </button>
                <button
                  onClick={() => setIncomeSubTab("recurring")}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                    incomeSubTab === "recurring" ?
                    "bg-green-500 text-white border-green-500" :
                    "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                  )}>

                  Fixas
                </button>
              </div>
            </div>

            {/* Content based on sub-tab */}
            <div className="space-y-4">
              {activeIncomeCategoryFilter &&
              <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setActiveIncomeCategoryFilter(null)} className="text-xs text-muted-foreground hover:text-foreground">
                    <FilterX className="h-3 w-3 mr-1" />
                    Limpar filtro de categoria
                  </Button>
                </div>
              }
              {incomeSubTab === "monthly" ?
              <IncomeList
                incomes={displayedIncomes}
                onDelete={deleteIncome}
                onEdit={handleEditIncome}
                onDuplicate={handleDuplicateIncome}
                groupMembers={groupMembers}
                isGroupContext={currentContext.type === 'group'} /> :


              <RecurringIncomeList
                incomes={displayedRecurringIncomes}
                onDelete={deleteRecurringIncome}
                onToggleActive={toggleRecurringIncomeActive}
                onEdit={handleEditRecurringIncome}
                groupMembers={groupMembers}
                isGroupContext={currentContext.type === 'group'} />

              }
            </div>
          </TabsContent>

          <TabsContent value="goals">
            <div className="space-y-6">
              {/* Limites de Despesas */}
              {budgetGoals.some((g) => g.type === "monthly_total" || g.type === "category") &&
              <div>
                  <h3 className="text-sm font-semibold text-destructive mb-3">Limites de Despesas</h3>
                  <BudgetProgress
                  goals={budgetGoals.filter((g) => g.type === "monthly_total" || g.type === "category")}
                  expenses={expenses}
                  recurringExpenses={recurringExpenses}
                  incomes={incomes}
                  recurringIncomes={recurringIncomes}
                  selectedMonth={currentMonth}
                  onDelete={deleteBudgetGoal}
                  onEdit={handleEditBudgetGoal}
                  descriptionFilter={filters.description}
                  minAmountFilter={filters.minAmount}
                  maxAmountFilter={filters.maxAmount} />

                </div>
              }

              {/* Metas de Entradas */}
              {budgetGoals.some((g) => g.type === "income_monthly_total" || g.type === "income_category") &&
              <div>
                  {budgetGoals.some((g) => g.type === "monthly_total" || g.type === "category") && <Separator className="mb-4" />}
                  <h3 className="text-sm font-semibold text-green-600 dark:text-green-400 mb-3">Metas de Entradas</h3>
                  <BudgetProgress
                  goals={budgetGoals.filter((g) => g.type === "income_monthly_total" || g.type === "income_category")}
                  expenses={expenses}
                  recurringExpenses={recurringExpenses}
                  incomes={incomes}
                  recurringIncomes={recurringIncomes}
                  selectedMonth={currentMonth}
                  onDelete={deleteBudgetGoal}
                  onEdit={handleEditBudgetGoal}
                  descriptionFilter={filters.description}
                  minAmountFilter={filters.minAmount}
                  maxAmountFilter={filters.maxAmount} />

                </div>
              }

              {/* Metas de Saldo */}
              {budgetGoals.some((g) => g.type === "balance_target") &&
              <div>
                  {budgetGoals.some((g) => g.type !== "balance_target") && <Separator className="mb-4" />}
                  <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3">Metas de Saldo</h3>
                  <BudgetProgress
                  goals={budgetGoals.filter((g) => g.type === "balance_target")}
                  expenses={expenses}
                  recurringExpenses={recurringExpenses}
                  incomes={incomes}
                  recurringIncomes={recurringIncomes}
                  selectedMonth={currentMonth}
                  onDelete={deleteBudgetGoal}
                  onEdit={handleEditBudgetGoal}
                  descriptionFilter={filters.description}
                  minAmountFilter={filters.minAmount}
                  maxAmountFilter={filters.maxAmount} />

                </div>
              }

              {/* Empty state */}
              {budgetGoals.length === 0 &&
              <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma meta cadastrada. Use o botão + para criar uma.
                </div>
              }
            </div>
          </TabsContent>
        </Tabs>

        {/* Floating Action Button */}
        <FloatingActionButton
          onExpenseClick={() => setExpenseSheetOpen(true)}
          onGoalClick={() => setBudgetGoalSheetOpen(true)}
          onCalculatorClick={() => setCalculatorOpen(true)}
          onIncomeClick={() => setIncomeSheetOpen(true)} />


        {/* Calculadora */}
        <CalculatorDrawer
          open={calculatorOpen}
          onOpenChange={(open) => {
            setCalculatorOpen(open);
            if (!open) setCalculatorInitialValue(undefined);
          }}
          initialValue={calculatorInitialValue}
          onCreateExpense={handleCreateExpenseFromCalculator} />


        {/* Sheet de Despesa Unificado */}
        <UnifiedExpenseFormSheet
          open={expenseSheetOpen}
          onOpenChange={(open) => {
            setExpenseSheetOpen(open);
            if (!open) {
              setExpenseDefaultAmount(undefined);
              setExpenseInitialData(undefined);
            }
          }}
          onAddExpense={addExpense}
          onAddRecurringExpense={addRecurringExpense}
          budgetGoals={budgetGoals}
          expenses={expenses}
          recurringExpenses={recurringExpenses}
          defaultAmount={expenseDefaultAmount}
          initialData={expenseInitialData} />


        <BudgetGoalFormSheet
          open={budgetGoalSheetOpen}
          onOpenChange={setBudgetGoalSheetOpen}
          onSubmit={addBudgetGoal}
          currentGoalsCount={budgetGoals.length} />


        {/* Sheet de Entrada Unificado */}
        <UnifiedIncomeFormSheet
          open={incomeSheetOpen}
          onOpenChange={(open) => {
            setIncomeSheetOpen(open);
            if (!open) setIncomeInitialData(undefined);
          }}
          onSuccess={() => {
            loadIncomes();
            loadRecurringIncomes();
          }}
          initialData={incomeInitialData} />


        {/* Modais de Edição */}
        <ExpenseEditDialog
          expense={editingExpense}
          open={expenseDialogOpen}
          onOpenChange={setExpenseDialogOpen}
          onSave={updateExpense} />


        <RecurringExpenseEditDialog
          expense={editingRecurringExpense}
          open={recurringExpenseDialogOpen}
          onOpenChange={setRecurringExpenseDialogOpen}
          onSave={updateRecurringExpense} />


        <BudgetGoalEditDialog
          goal={editingBudgetGoal}
          open={budgetGoalDialogOpen}
          onOpenChange={setBudgetGoalDialogOpen}
          onSave={updateBudgetGoal} />


        <IncomeEditDialog
          income={editingIncome}
          open={incomeDialogOpen}
          onOpenChange={setIncomeDialogOpen}
          onSave={updateIncome} />


        <RecurringIncomeEditDialog
          income={editingRecurringIncome}
          open={recurringIncomeDialogOpen}
          onOpenChange={setRecurringIncomeDialogOpen}
          onSave={updateRecurringIncome} />

      </div>
      <Footer />
    </div>);

}