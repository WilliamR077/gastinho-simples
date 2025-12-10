import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ExpenseSummary } from "@/components/expense-summary";
import { ExpenseList } from "@/components/expense-list";
import { ExpenseFilters, ExpenseFilters as ExpenseFiltersType } from "@/components/expense-filters";
import { CategorySummary } from "@/components/category-summary";
import { ExpenseEditDialog } from "@/components/expense-edit-dialog";
import { RecurringExpenseEditDialog } from "@/components/recurring-expense-edit-dialog";
import { BudgetGoalEditDialog } from "@/components/budget-goal-edit-dialog";
import { BudgetAlertBanner } from "@/components/budget-alert-banner";
import { MonthNavigator } from "@/components/month-navigator";
import { FloatingActionButton } from "@/components/floating-action-button";
import { ExpenseFormSheet } from "@/components/expense-form-sheet";
import { RecurringExpenseFormSheet } from "@/components/recurring-expense-form-sheet";
import { BudgetGoalFormSheet } from "@/components/budget-goal-form-sheet";
import { ContextSelector } from "@/components/context-selector";
import { useSharedGroups } from "@/hooks/use-shared-groups";

import { Expense, PaymentMethod, ExpenseFormData, ExpenseCategory, categoryLabels } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { SharedGroupMember } from "@/types/shared-group";
import { RecurringExpenseList } from "@/components/recurring-expense-list";
import { RecurringExpenseFormData } from "@/types/recurring-expense";
import { BudgetGoal } from "@/types/budget-goal";
import { BudgetProgress } from "@/components/budget-progress";
import { RemindersButton } from "@/components/reminders-button";
import { toast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { BarChart3, CreditCard, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, User } from "lucide-react";
import { generateBillingPeriods, filterExpensesByBillingPeriod } from "@/utils/billing-period";
import { NotificationService } from "@/services/notification-service";
import { App as CapacitorApp } from '@capacitor/app';
import { adMobService } from "@/services/admob-service";
import { startOfMonth, endOfMonth } from "date-fns";
import { parseLocalDate } from "@/lib/utils";

export default function Index() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [budgetGoals, setBudgetGoals] = useState<BudgetGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ExpenseFiltersType>(() => {
    const now = new Date();
    return {
      startDate: startOfMonth(now),
      endDate: endOfMonth(now),
    };
  });
  const [creditCardConfig, setCreditCardConfig] = useState<{ opening_day: number; closing_day: number } | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("expenses");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  // Estado para o mês atual da navegação
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Estados para os sheets de formulário
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [recurringExpenseSheetOpen, setRecurringExpenseSheetOpen] = useState(false);
  const [budgetGoalSheetOpen, setBudgetGoalSheetOpen] = useState(false);

  // Estados para os modais de edição
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingRecurringExpense, setEditingRecurringExpense] = useState<RecurringExpense | null>(null);
  const [recurringExpenseDialogOpen, setRecurringExpenseDialogOpen] = useState(false);
  const [editingBudgetGoal, setEditingBudgetGoal] = useState<BudgetGoal | null>(null);
  const [budgetGoalDialogOpen, setBudgetGoalDialogOpen] = useState(false);

  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { currentContext, groups, getGroupMembers } = useSharedGroups();
  const [groupMembers, setGroupMembers] = useState<SharedGroupMember[]>([]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Load group members when context changes to a group
  useEffect(() => {
    if (currentContext.type === 'group' && currentContext.groupId) {
      getGroupMembers(currentContext.groupId).then(members => {
        setGroupMembers(members);
      }).catch(err => {
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
      NotificationService.requestPermissions().then(granted => {
        if (granted) {
          NotificationService.rescheduleAllNotifications(
            recurringExpenses.filter(e => e.is_active),
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
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setNotificationSettings(data);
      } else {
        // Configurações padrão
        setNotificationSettings({
          is_enabled: true,
          notify_3_days_before: true,
          notify_1_day_before: true,
          notify_on_day: true,
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
        description: "Verifique suas despesas fixas",
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
                recurringExpenses.filter(e => e.is_active),
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
    }
  }, [user, currentContext]);

  const loadExpenses = async () => {
    try {
      let query = supabase
        .from("expenses")
        .select(`
          *,
          card:cards(id, name, color, card_type),
          shared_group:shared_groups(id, name, color)
        `)
        .order("created_at", { ascending: false });

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
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRecurringExpenses = async () => {
    try {
      let query = supabase
        .from("recurring_expenses")
        .select(`
          *,
          card:cards(id, name, color, card_type),
          shared_group:shared_groups(id, name, color)
        `)
        .order("day_of_month", { ascending: true });

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
        variant: "destructive",
      });
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

  const loadBudgetGoals = async () => {
    try {
      let query = supabase
        .from("budget_goals")
        .select("*")
        .order("created_at", { ascending: false });

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
        variant: "destructive",
      });
    }
  };

  // Handler para navegação por mês
  const handleMonthChange = (startDate: Date, endDate: Date) => {
    setCurrentMonth(startDate);
    setFilters(prev => ({
      ...prev,
      startDate,
      endDate,
    }));
  };

  const addExpense = async (data: ExpenseFormData) => {
    if (!user) return;

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

      if (installments === 1) {
        // Single expense
      const { data: insertedData, error } = await supabase
        .from("expenses")
        .insert({
          description,
          amount,
          payment_method: paymentMethod,
          user_id: user.id,
          expense_date: formatDateLocal(expenseDate),
          total_installments: 1,
          installment_number: 1,
          ...(categoryId && { category_id: categoryId }),
          ...(cardId && { card_id: cardId }),
          ...(groupId && { shared_group_id: groupId }),
        })
        .select(`
          *,
          card:cards(id, name, color, card_type),
          shared_group:shared_groups(id, name, color)
        `)
        .single();

        if (error) throw error;
        setExpenses(prev => [insertedData, ...prev]);
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
            ...(categoryId && { category_id: categoryId }),
            ...(cardId && { card_id: cardId }),
            ...(groupId && { shared_group_id: groupId }),
          });
        }

      const { data: insertedData, error } = await supabase
        .from("expenses")
        .insert(expensesToInsert)
        .select(`
          *,
          card:cards(id, name, color, card_type),
          shared_group:shared_groups(id, name, color)
        `);

        if (error) throw error;
        setExpenses(prev => [...(insertedData || []), ...prev]);
      }

      // Determinar label do contexto baseado no grupo selecionado no formulário
      const selectedGroup = groupId ? groups.find(g => g.id === groupId) : null;
      const contextLabel = selectedGroup ? ` (${selectedGroup.name})` : '';
      toast({
        title: installments === 1 ? "Gasto adicionado!" : "Gasto parcelado adicionado!",
        description: installments === 1
          ? `${description} - R$ ${amount.toFixed(2)}${contextLabel}`
          : `${description} - ${installments}x de R$ ${(amount / installments).toFixed(2)}${contextLabel}`,
      });

      // Incrementar contador de despesas para controlar exibição de anúncios
      adMobService.incrementExpenseCount();
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

  const addRecurringExpense = async (data: RecurringExpenseFormData) => {
    if (!user) return;

    // Usar sharedGroupId do formulário (permite escolher destino diferente do contexto atual)
    const groupId = data.sharedGroupId || null;

    try {
    const { data: insertedData, error } = await supabase
      .from("recurring_expenses")
      .insert({
        description: data.description,
        amount: data.amount,
        payment_method: data.paymentMethod,
        day_of_month: data.dayOfMonth,
        user_id: user.id,
        ...(data.categoryId && { category_id: data.categoryId }),
        ...(data.cardId && { card_id: data.cardId }),
        ...(groupId && { shared_group_id: groupId }),
      })
      .select(`
        *,
        card:cards(id, name, color, card_type),
        shared_group:shared_groups(id, name, color)
      `)
      .single();

      if (error) throw error;
      setRecurringExpenses(prev => [...prev, insertedData].sort((a, b) => a.day_of_month - b.day_of_month));

      // Agendar notificações para a nova despesa
      await NotificationService.scheduleNotificationsForExpense(insertedData, notificationSettings);

      // Determinar label do contexto baseado no grupo selecionado no formulário
      const selectedGroup = groupId ? groups.find(g => g.id === groupId) : null;
      const contextLabel = selectedGroup ? ` (${selectedGroup.name})` : '';
      toast({
        title: "Despesa fixa adicionada!",
        description: `${data.description} - R$ ${data.amount.toFixed(2)} (Dia ${data.dayOfMonth})${contextLabel}`,
      });
    } catch (error) {
      console.error("Error adding recurring expense:", error);
      toast({
        title: "Erro ao adicionar despesa fixa",
        description: "Não foi possível adicionar a despesa fixa.",
        variant: "destructive",
      });
    }
  };

  const deleteRecurringExpense = async (id: string) => {
    try {
      // Cancelar notificações antes de deletar
      await NotificationService.cancelNotificationsForExpense(id);

      const { error } = await supabase
        .from("recurring_expenses")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setRecurringExpenses(prev => prev.filter(expense => expense.id !== id));

      toast({
        title: "Despesa fixa removida",
        description: "A despesa fixa foi excluída com sucesso.",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error deleting recurring expense:", error);
      toast({
        title: "Erro ao remover despesa fixa",
        description: "Não foi possível remover a despesa fixa.",
        variant: "destructive",
      });
    }
  };

  const toggleRecurringExpenseActive = async (id: string, isActive: boolean) => {
    try {
      // Se desativando, definir end_date; se ativando, limpar end_date
      const updateData = isActive 
        ? { is_active: isActive, end_date: null }
        : { is_active: isActive, end_date: new Date().toISOString().split('T')[0] };
      
      const { error } = await supabase
        .from("recurring_expenses")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      const updatedExpense = recurringExpenses.find(e => e.id === id);

      setRecurringExpenses(prev =>
        prev.map(expense =>
          expense.id === id 
            ? { ...expense, is_active: isActive, end_date: isActive ? null : new Date().toISOString().split('T')[0] } 
            : expense
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
        description: isActive
          ? "A despesa fixa foi ativada e será considerada nos cálculos."
          : "A despesa fixa foi desativada e não será mais considerada.",
      });
    } catch (error) {
      console.error("Error toggling recurring expense:", error);
      toast({
        title: "Erro ao atualizar despesa fixa",
        description: "Não foi possível atualizar a despesa fixa.",
        variant: "destructive",
      });
    }
  };

  const addBudgetGoal = async (data: { type: string; category?: string; limitAmount: number; sharedGroupId?: string }) => {
    if (!user) return;

    // Usar sharedGroupId do formulário ou do contexto atual
    const groupId = data.sharedGroupId || (currentContext.type === 'group' ? currentContext.groupId : null);

    try {
      const { data: insertedData, error } = await supabase
        .from("budget_goals")
        .insert([{
          user_id: user.id,
          type: data.type as any,
          category: data.category as any || null,
          limit_amount: data.limitAmount,
          ...(groupId && { shared_group_id: groupId }),
        }])
        .select()
        .single();

      if (error) throw error;

      setBudgetGoals(prev => [insertedData, ...prev]);

      const contextLabel = currentContext.type === 'group' && currentContext.groupName 
        ? ` (${currentContext.groupName})` 
        : '';
      toast({
        title: "Meta adicionada!",
        description: `Sua meta de gastos foi criada com sucesso${contextLabel}.`,
      });
    } catch (error) {
      console.error("Error adding budget goal:", error);
      toast({
        title: "Erro ao adicionar meta",
        description: "Não foi possível adicionar a meta de gastos.",
        variant: "destructive",
      });
    }
  };

  const deleteBudgetGoal = async (id: string) => {
    try {
      const { error } = await supabase
        .from("budget_goals")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setBudgetGoals(prev => prev.filter(goal => goal.id !== id));

      toast({
        title: "Meta removida",
        description: "A meta de gastos foi excluída com sucesso.",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error deleting budget goal:", error);
      toast({
        title: "Erro ao remover meta",
        description: "Não foi possível remover a meta de gastos.",
        variant: "destructive",
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

      const { data: updatedData, error } = await supabase
        .from("expenses")
        .update({
          description: data.description,
          amount: data.amount,
          payment_method: data.paymentMethod,
          expense_date: formatDateLocal(data.expenseDate),
          ...(data.categoryId && { category_id: data.categoryId }),
          ...(data.cardId && { card_id: data.cardId }),
        })
        .eq("id", id)
        .select(`
          *,
          card:cards(id, name, color, card_type)
        `)
        .single();

      if (error) throw error;

      if (updatedData) {
        setExpenses(prev => prev.map(e =>
          e.id === id ? updatedData : e
        ));
      }

      setExpenseDialogOpen(false);
      setEditingExpense(null);

      toast({
        title: "Despesa atualizada!",
        description: "As alterações foram salvas com sucesso.",
      });
    } catch (error) {
      console.error("Error updating expense:", error);
      toast({
        title: "Erro ao atualizar despesa",
        description: "Não foi possível atualizar a despesa.",
        variant: "destructive",
      });
    }
  };

  const handleEditRecurringExpense = (expense: RecurringExpense) => {
    setEditingRecurringExpense(expense);
    setRecurringExpenseDialogOpen(true);
  };

  const updateRecurringExpense = async (id: string, data: RecurringExpenseFormData) => {
    try {
      const { data: updatedData, error } = await supabase
        .from("recurring_expenses")
        .update({
          description: data.description,
          amount: data.amount,
          payment_method: data.paymentMethod,
          day_of_month: data.dayOfMonth,
          ...(data.categoryId && { category_id: data.categoryId }),
          ...(data.cardId && { card_id: data.cardId }),
        })
        .eq("id", id)
        .select(`
          *,
          card:cards(id, name, color, card_type)
        `)
        .single();

      if (error) throw error;

      if (updatedData) {
        setRecurringExpenses(prev =>
          prev.map(e => e.id === id ? updatedData : e).sort((a, b) => a.day_of_month - b.day_of_month)
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
        description: "As alterações foram salvas com sucesso.",
      });
    } catch (error) {
      console.error("Error updating recurring expense:", error);
      toast({
        title: "Erro ao atualizar despesa fixa",
        description: "Não foi possível atualizar a despesa fixa.",
        variant: "destructive",
      });
    }
  };

  const handleEditBudgetGoal = (goal: BudgetGoal) => {
    setEditingBudgetGoal(goal);
    setBudgetGoalDialogOpen(true);
  };

  const updateBudgetGoal = async (id: string, data: { type: string; category?: string; limitAmount: number }) => {
    try {
      const { error } = await supabase
        .from("budget_goals")
        .update({
          type: data.type as "monthly_total" | "category",
          category: (data.category as any) || null,
          limit_amount: data.limitAmount,
        })
        .eq("id", id);

      if (error) throw error;

      setBudgetGoals(prev => prev.map(g => {
        if (g.id === id) {
          return {
            ...g,
            type: data.type as "monthly_total" | "category",
            category: (data.category as any) || null,
            limit_amount: data.limitAmount
          };
        }
        return g;
      }));

      setBudgetGoalDialogOpen(false);
      setEditingBudgetGoal(null);

      toast({
        title: "Meta atualizada!",
        description: "As alterações foram salvas com sucesso.",
      });
    } catch (error) {
      console.error("Error updating budget goal:", error);
      toast({
        title: "Erro ao atualizar meta",
        description: "Não foi possível atualizar a meta.",
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
        const expenseDate = parseLocalDate(expense.expense_date);
        if (expenseDate < filters.startDate) return false;
      }

      // Filtro de data fim
      if (filters.endDate) {
        const expenseDate = parseLocalDate(expense.expense_date);
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

      // Filtro de cartão
      if (filters.cardId && expense.card_id !== filters.cardId) {
        return false;
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

  const handlePaymentMethodFilter = (method: PaymentMethod) => {
    setFilters(prev => {
      const isActive = prev.paymentMethod === method;
      if (isActive) {
        const { paymentMethod, ...rest } = prev;
        toast({
          title: "Filtro removido",
          description: "Exibindo todas as formas de pagamento",
        });
        return rest;
      } else {
        toast({
          title: "Filtro aplicado",
          description: `Exibindo apenas ${method === 'pix' ? 'PIX' : method === 'debit' ? 'Débito' : 'Crédito'}`,
        });
        return { ...prev, paymentMethod: method };
      }
    });
  };

  const handleCategoryFilter = (categoryId: string) => {
    setActiveCategoryFilter(prev => {
      if (prev === categoryId) {
        toast({
          title: "Filtro removido",
          description: "Exibindo todas as categorias",
        });
        return null;
      } else {
        toast({
          title: "Filtro aplicado",
          description: "Filtrando por categoria selecionada",
        });
        return categoryId;
      }
    });
  };

  // Despesas filtradas por categoria
  const displayedExpenses = useMemo(() => {
    if (!activeCategoryFilter) return filteredExpenses;
    return filteredExpenses.filter(e => 
      e.category_id === activeCategoryFilter || e.category === activeCategoryFilter
    );
  }, [filteredExpenses, activeCategoryFilter]);

  // Calcular metas em risco
  const goalsAtRisk = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyExpenses = expenses.filter((expense) => {
      const expenseDate = parseLocalDate(expense.expense_date);
      return (
        expenseDate.getMonth() === currentMonth &&
        expenseDate.getFullYear() === currentYear
      );
    });

    const activeRecurring = recurringExpenses.filter((re) => re.is_active);

    return budgetGoals
      .map((goal) => {
        let totalSpent = 0;

        if (goal.type === "monthly_total") {
          totalSpent = monthlyExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
          totalSpent += activeRecurring.reduce((sum, re) => sum + Number(re.amount), 0);
        } else if (goal.type === "category" && goal.category) {
          totalSpent = monthlyExpenses
            .filter((exp) => exp.category === goal.category)
            .reduce((sum, exp) => sum + Number(exp.amount), 0);
          totalSpent += activeRecurring
            .filter((re) => re.category === goal.category)
            .reduce((sum, re) => sum + Number(re.amount), 0);
        }

        const limit = Number(goal.limit_amount);
        const percentage = (totalSpent / limit) * 100;
        const remaining = limit - totalSpent;

        return { goal, totalSpent, limit, percentage, remaining };
      })
      .filter((item) => item.percentage >= 80);
  }, [budgetGoals, expenses, recurringExpenses]);


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
    <div className="min-h-screen bg-background pb-24">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <img
              src="/lovable-uploads/06a1acc2-f553-41f0-8d87-32d25b4e425e.png"
              alt="Gastinho Simples - Controle de Gastos"
              className="h-20 w-auto cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate("/")}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/reports")}
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/cards")}
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <CreditCard className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Cartões</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/settings")}
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Configurações</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/account")}
              className="flex items-center gap-2 text-xs sm:text-sm"
            >
              <User className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Conta</span>
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
            <RemindersButton recurringExpenses={recurringExpenses} />
            <ThemeToggle />
          </div>
        </div>

        {/* Context Selector */}
        <ContextSelector />

        {/* Navegador de Mês */}
        <MonthNavigator
          currentDate={currentMonth}
          onMonthChange={handleMonthChange}
        />

        {/* Filtros */}
        <div className="mb-8">
          <ExpenseFilters
            filters={filters}
            onFiltersChange={setFilters}
            billingPeriods={billingPeriods}
          />
        </div>

        {/* Category Summary */}
        <div className="mb-8">
          <CategorySummary
            expenses={filteredExpenses}
            recurringExpenses={recurringExpenses}
            billingPeriod={filters.billingPeriod}
            startDate={filters.startDate}
            endDate={filters.endDate}
            creditCardConfig={creditCardConfig || undefined}
            onCategoryClick={handleCategoryFilter}
            activeCategory={activeCategoryFilter || undefined}
          />
        </div>

        {/* Summary Cards */}
        <div className="mb-8">
          <ExpenseSummary
            expenses={filteredExpenses}
            recurringExpenses={recurringExpenses}
            billingPeriod={filters.billingPeriod}
            startDate={filters.startDate}
            endDate={filters.endDate}
            creditCardConfig={creditCardConfig || undefined}
            onPaymentMethodClick={handlePaymentMethodFilter}
            activePaymentMethod={filters.paymentMethod}
            budgetGoals={budgetGoals}
          />
        </div>

        {/* Budget Alert Banner */}
        <BudgetAlertBanner
          goalsAtRisk={goalsAtRisk}
          onNavigateToGoals={() => setActiveTab("goals")}
        />

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="expenses">Despesas</TabsTrigger>
            <TabsTrigger value="recurring">Despesas Fixas</TabsTrigger>
            <TabsTrigger value="goals" className="relative">
              Metas
              {goalsAtRisk.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {goalsAtRisk.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses">
            <ExpenseList
              expenses={displayedExpenses}
              onDeleteExpense={deleteExpense}
              onEditExpense={handleEditExpense}
              groupMembers={groupMembers}
              isGroupContext={currentContext.type === 'group'}
            />
          </TabsContent>

          <TabsContent value="recurring">
            <RecurringExpenseList
              expenses={recurringExpenses}
              onDeleteExpense={deleteRecurringExpense}
              onToggleActive={toggleRecurringExpenseActive}
              onEditRecurringExpense={handleEditRecurringExpense}
            />
          </TabsContent>

          <TabsContent value="goals">
            <BudgetProgress
              goals={budgetGoals}
              expenses={expenses}
              recurringExpenses={recurringExpenses}
              onDelete={deleteBudgetGoal}
              onEdit={handleEditBudgetGoal}
            />
          </TabsContent>
        </Tabs>

        {/* Floating Action Button */}
        <FloatingActionButton
          onExpenseClick={() => setExpenseSheetOpen(true)}
          onRecurringClick={() => setRecurringExpenseSheetOpen(true)}
          onGoalClick={() => setBudgetGoalSheetOpen(true)}
        />

        {/* Sheets de Formulário */}
        <ExpenseFormSheet
          open={expenseSheetOpen}
          onOpenChange={setExpenseSheetOpen}
          onAddExpense={addExpense}
          budgetGoals={budgetGoals}
          expenses={expenses}
          recurringExpenses={recurringExpenses}
        />

        <RecurringExpenseFormSheet
          open={recurringExpenseSheetOpen}
          onOpenChange={setRecurringExpenseSheetOpen}
          onAddRecurringExpense={addRecurringExpense}
        />

        <BudgetGoalFormSheet
          open={budgetGoalSheetOpen}
          onOpenChange={setBudgetGoalSheetOpen}
          onSubmit={addBudgetGoal}
          currentGoalsCount={budgetGoals.length}
        />

        {/* Modais de Edição */}
        <ExpenseEditDialog
          expense={editingExpense}
          open={expenseDialogOpen}
          onOpenChange={setExpenseDialogOpen}
          onSave={updateExpense}
        />

        <RecurringExpenseEditDialog
          expense={editingRecurringExpense}
          open={recurringExpenseDialogOpen}
          onOpenChange={setRecurringExpenseDialogOpen}
          onSave={updateRecurringExpense}
        />

        <BudgetGoalEditDialog
          goal={editingBudgetGoal}
          open={budgetGoalDialogOpen}
          onOpenChange={setBudgetGoalDialogOpen}
          onSave={updateBudgetGoal}
        />
      </div>
    </div>
  );
}
