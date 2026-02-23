import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BudgetGoal } from "@/types/budget-goal";
import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { Income, RecurringIncome, incomeCategoryLabels, incomeCategoryIcons } from "@/types/income";
import { useIncomeCategories } from "@/hooks/use-income-categories";
import { categoryLabels, categoryIcons } from "@/types/expense";
import { AlertTriangle, TrendingDown, TrendingUp, MoreVertical, Pencil, Trash2, AlertCircle, Check, PartyPopper, Star, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { parseLocalDate } from "@/lib/utils";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { useCategories } from "@/hooks/use-categories";

type AlertLevel = 'safe' | 'warning' | 'caution' | 'danger' | 'critical';

const getAlertLevel = (percentage: number): AlertLevel => {
  if (percentage >= 100) return 'critical';
  if (percentage >= 95) return 'danger';
  if (percentage >= 85) return 'caution';
  if (percentage >= 70) return 'warning';
  return 'safe';
};

const getIncomeAlertLevel = (percentage: number): 'low' | 'medium' | 'almost' | 'reached' | 'exceeded' => {
  if (percentage > 100) return 'exceeded';
  if (percentage >= 100) return 'reached';
  if (percentage >= 80) return 'almost';
  if (percentage >= 50) return 'medium';
  return 'low';
};

const alertConfig = {
  safe: {
    color: 'text-success',
    bgColor: 'bg-success/10',
    borderColor: 'border-success/30',
    progressColor: 'bg-success',
    icon: Check,
    message: 'Você está no controle! Continue assim.',
  },
  warning: {
    color: 'text-yellow-600 dark:text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    progressColor: 'bg-yellow-500',
    icon: AlertCircle,
    message: 'Atenção! Você já usou bastante do orçamento.',
  },
  caution: {
    color: 'text-orange-600 dark:text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/50',
    progressColor: 'bg-orange-500',
    icon: AlertTriangle,
    message: 'Cuidado! Você está perto do limite.',
  },
  danger: {
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/50',
    progressColor: 'bg-destructive',
    icon: AlertTriangle,
    message: 'Alerta! Você está quase estourando a meta.',
  },
  critical: {
    color: 'text-destructive',
    bgColor: 'bg-destructive/20',
    borderColor: 'border-destructive',
    progressColor: 'bg-destructive',
    icon: AlertTriangle,
    message: 'Meta estourada! Hora de economizar.',
  },
};

interface BudgetProgressProps {
  goals: BudgetGoal[];
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  incomes: Income[];
  recurringIncomes: RecurringIncome[];
  selectedMonth: Date;
  onDelete: (id: string) => void;
  onEdit: (goal: BudgetGoal) => void;
  descriptionFilter?: string;
  minAmountFilter?: number;
  maxAmountFilter?: number;
}

export function BudgetProgress({ goals, expenses, recurringExpenses, incomes, recurringIncomes, selectedMonth, onDelete, onEdit, descriptionFilter, minAmountFilter, maxAmountFilter }: BudgetProgressProps) {
  const { isHidden } = useValuesVisibility();
  const { categories: expenseCategories } = useCategories();
  const { categories: incomeCategoriesList } = useIncomeCategories();
  
  const formatCurrency = (value: number) => {
    if (isHidden) return "R$ ***,**";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const currentMonth = selectedMonth.getMonth();
  const currentYear = selectedMonth.getFullYear();

  const monthlyExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const expenseDate = parseLocalDate(expense.expense_date);
      return (
        expenseDate.getMonth() === currentMonth &&
        expenseDate.getFullYear() === currentYear
      );
    });
  }, [expenses, currentMonth, currentYear]);

  const monthlyIncomes = useMemo(() => {
    return incomes.filter((income) => {
      const incomeDate = parseLocalDate(income.income_date);
      return (
        incomeDate.getMonth() === currentMonth &&
        incomeDate.getFullYear() === currentYear
      );
    });
  }, [incomes, currentMonth, currentYear]);

  const activeRecurringExpenses = useMemo(() => {
    return recurringExpenses.filter((re) => re.is_active);
  }, [recurringExpenses]);

  const activeRecurringIncomes = useMemo(() => {
    return recurringIncomes.filter((ri) => ri.is_active);
  }, [recurringIncomes]);

  // Função para encontrar category_ids que correspondem a uma categoria do enum
  const getCategoryIdsForGoal = (goalCategory: string) => {
    const goalCategoryLabel = categoryLabels[goalCategory as keyof typeof categoryLabels];
    if (!goalCategoryLabel) return [];
    
    return expenseCategories
      .filter(c => c.name.toLowerCase() === goalCategoryLabel.toLowerCase())
      .map(c => c.id);
  };

  // Função para verificar se uma despesa corresponde à categoria da meta
  const expenseMatchesGoalCategory = (
    expCategory: string | undefined,
    expCategoryId: string | null | undefined,
    goalCategory: string
  ) => {
    if (expCategory === goalCategory) return true;
    if (expCategoryId) {
      const matchingIds = getCategoryIdsForGoal(goalCategory);
      return matchingIds.includes(expCategoryId);
    }
    return false;
  };

  const isIncomeGoal = (goalType: string) => goalType.startsWith('income_');
  const isBalanceGoal = (goalType: string) => goalType === 'balance_target';

  const calculateProgress = (goal: BudgetGoal) => {
    let totalValue = 0;
    const isIncome = isIncomeGoal(goal.type);
    const isBalance = isBalanceGoal(goal.type);

    if (isBalance) {
      // Balance goal: saldo = entradas - despesas
      const totalIncomeValue = monthlyIncomes.reduce((sum, inc) => sum + Number(inc.amount), 0)
        + activeRecurringIncomes.reduce((sum, ri) => sum + Number(ri.amount), 0);
      const totalExpenseValue = monthlyExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0)
        + activeRecurringExpenses.reduce((sum, re) => sum + Number(re.amount), 0);
      totalValue = totalIncomeValue - totalExpenseValue;
    } else if (isIncome) {
      // Income goals
      if (goal.type === "income_monthly_total") {
        totalValue = monthlyIncomes.reduce((sum, inc) => sum + Number(inc.amount), 0);
        totalValue += activeRecurringIncomes.reduce((sum, ri) => sum + Number(ri.amount), 0);
      } else if (goal.type === "income_category" && goal.category) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(goal.category);
        
        totalValue = monthlyIncomes
          .filter((inc) => {
            if (isUUID) return (inc as any).income_category_id === goal.category;
            return inc.category === goal.category;
          })
          .reduce((sum, inc) => sum + Number(inc.amount), 0);
        totalValue += activeRecurringIncomes
          .filter((ri) => {
            if (isUUID) return (ri as any).income_category_id === goal.category;
            return ri.category === goal.category;
          })
          .reduce((sum, ri) => sum + Number(ri.amount), 0);
      }
    } else {
      // Expense goals
      if (goal.type === "monthly_total") {
        totalValue = monthlyExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
        totalValue += activeRecurringExpenses.reduce((sum, re) => sum + Number(re.amount), 0);
      } else if (goal.type === "category" && goal.category) {
        totalValue = monthlyExpenses
          .filter((exp) => expenseMatchesGoalCategory(exp.category, exp.category_id, goal.category!))
          .reduce((sum, exp) => sum + Number(exp.amount), 0);
        totalValue += activeRecurringExpenses
          .filter((re) => expenseMatchesGoalCategory(re.category, re.category_id, goal.category!))
          .reduce((sum, re) => sum + Number(re.amount), 0);
      }
    }

    const limit = Number(goal.limit_amount);
    const percentage = isBalance ? (totalValue / limit) * 100 : (totalValue / limit) * 100;
    const remaining = limit - totalValue;
    const isOver = isBalance ? totalValue >= limit : totalValue > limit;

    return { totalValue, limit, percentage, remaining, isOver };
  };

  // Filtrar metas baseado nos filtros globais
  const filteredGoals = useMemo(() => {
    return goals.filter(goal => {
      // Filtro de descrição - buscar pelo nome da meta (tipo + categoria)
      if (descriptionFilter) {
        const goalName = goal.type === 'monthly_total' ? 'Limite Mensal Total'
          : goal.type === 'income_monthly_total' ? 'Meta Mensal de Entradas'
          : goal.type === 'balance_target' ? 'Meta de Saldo'
          : goal.category ? (isIncomeGoal(goal.type) 
            ? (incomeCategoriesList.find(c => c.id === goal.category)?.name || incomeCategoryLabels[goal.category as keyof typeof incomeCategoryLabels] || goal.category)
            : (categoryLabels[goal.category as keyof typeof categoryLabels] || goal.category))
          : '';
        if (!goalName.toLowerCase().includes(descriptionFilter.toLowerCase())) return false;
      }
      // Filtro de valor mínimo (limit_amount)
      if (minAmountFilter !== undefined && goal.limit_amount < minAmountFilter) return false;
      // Filtro de valor máximo (limit_amount)
      if (maxAmountFilter !== undefined && goal.limit_amount > maxAmountFilter) return false;
      return true;
    });
  }, [goals, descriptionFilter, minAmountFilter, maxAmountFilter]);

  if (filteredGoals.length === 0) {
    const hasFilters = !!(descriptionFilter || minAmountFilter !== undefined || maxAmountFilter !== undefined);
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            {hasFilters 
              ? "Nenhuma meta encontrada com os filtros aplicados."
              : "Nenhuma meta definida. Adicione uma meta para começar a acompanhar seus gastos ou ganhos."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderExpenseGoal = (goal: BudgetGoal) => {
    const { totalValue, limit, percentage, remaining, isOver } = calculateProgress(goal);
    const progressValue = Math.min(percentage, 100);
    const alertLevel = getAlertLevel(percentage);
    const config = alertConfig[alertLevel];
    const AlertIcon = config.icon;

    return (
      <Card 
        key={goal.id} 
        className={`transition-all ${config.borderColor} ${alertLevel !== 'safe' ? config.bgColor : ''}`}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {goal.type === "category" && goal.category && (
                  <span>{categoryIcons[goal.category]}</span>
                )}
                {goal.type === "monthly_total"
                  ? "Limite Mensal Total"
                  : goal.category
                  ? categoryLabels[goal.category]
                  : "Categoria"}
              </CardTitle>
              <CardDescription>
                Meta: {formatCurrency(limit)}
              </CardDescription>
            </div>
            {renderGoalMenu(goal)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Gasto: {formatCurrency(totalValue)}</span>
              <span className={isOver ? "text-destructive font-medium" : "text-muted-foreground"}>
                {percentage.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={progressValue} 
              className={`[&>div]:${config.progressColor}`}
            />
            <div className="flex items-center justify-between text-sm">
              {isOver ? (
                <div className="flex items-center gap-1 text-destructive font-medium">
                  <TrendingUp className="h-4 w-4" />
                  <span>Excedeu em {formatCurrency(Math.abs(remaining))}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <TrendingDown className="h-4 w-4" />
                  <span>Restam {formatCurrency(remaining)}</span>
                </div>
              )}
            </div>
          </div>

          {alertLevel !== 'safe' && (
            <Alert className={`${config.borderColor} ${config.bgColor}`}>
              <AlertIcon className={`h-4 w-4 ${config.color}`} />
              <AlertDescription className={config.color}>
                <strong>{config.message}</strong>
                {alertLevel === 'critical' && (
                  <span className="block mt-1 text-sm">
                    Você excedeu o orçamento em {formatCurrency(Math.abs(remaining))}.
                  </span>
                )}
                {alertLevel === 'danger' && (
                  <span className="block mt-1 text-sm">
                    Restam apenas {formatCurrency(remaining)} para não estourar.
                  </span>
                )}
                {alertLevel === 'caution' && (
                  <span className="block mt-1 text-sm">
                    Você ainda tem {formatCurrency(remaining)} disponíveis.
                  </span>
                )}
                {alertLevel === 'warning' && (
                  <span className="block mt-1 text-sm">
                    Tente economizar! Restam {formatCurrency(remaining)}.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderIncomeGoal = (goal: BudgetGoal) => {
    const { totalValue, limit, percentage, remaining, isOver } = calculateProgress(goal);
    const progressValue = Math.min(percentage, 100);
    const incomeLevel = getIncomeAlertLevel(percentage);
    const categoryKey = goal.category as keyof typeof incomeCategoryLabels;
    const isUUID = goal.category ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(goal.category) : false;
    const customIncomeCat = isUUID ? incomeCategoriesList.find(c => c.id === goal.category) : null;
    const incomeCatIcon = customIncomeCat?.icon || incomeCategoryIcons[categoryKey] || "📦";
    const incomeCatName = customIncomeCat?.name || incomeCategoryLabels[categoryKey] || goal.category;

    return (
      <Card 
        key={goal.id} 
        className={`transition-all ${
          incomeLevel === 'exceeded' ? 'border-green-500 bg-green-500/10' :
          incomeLevel === 'reached' ? 'border-green-500 bg-green-500/10' :
          incomeLevel === 'almost' ? 'border-green-400/50 bg-green-400/5' :
          ''
        }`}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {goal.type === "income_category" && goal.category && (
                  <span>{incomeCatIcon}</span>
                )}
                {goal.type === "income_monthly_total"
                  ? "🎯 Meta Mensal de Entradas"
                  : goal.category
                  ? incomeCatName
                  : "Categoria"}
              </CardTitle>
              <CardDescription>
                Meta: {formatCurrency(limit)}
              </CardDescription>
            </div>
            {renderGoalMenu(goal)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Ganho: {formatCurrency(totalValue)}</span>
              <span className={percentage >= 100 ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                {percentage.toFixed(1)}%
              </span>
            </div>
            <Progress 
              value={progressValue} 
              className="[&>div]:bg-green-500"
            />
            <div className="flex items-center justify-between text-sm">
              {isOver ? (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                  <TrendingUp className="h-4 w-4" />
                  <span>Superou em {formatCurrency(Math.abs(remaining))}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <TrendingDown className="h-4 w-4" />
                  <span>Faltam {formatCurrency(remaining)}</span>
                </div>
              )}
            </div>
          </div>

          {incomeLevel === 'exceeded' && (
            <Alert className="border-green-500 bg-green-500/10">
              <Star className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-600 dark:text-green-400">
                <strong>Incrível! Você superou sua meta em {formatCurrency(Math.abs(remaining))}! 🎉</strong>
              </AlertDescription>
            </Alert>
          )}

          {incomeLevel === 'reached' && (
            <Alert className="border-green-500 bg-green-500/10">
              <PartyPopper className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-600 dark:text-green-400">
                <strong>Parabéns! Você bateu sua meta de {formatCurrency(limit)}! 🎉</strong>
              </AlertDescription>
            </Alert>
          )}

          {incomeLevel === 'almost' && (
            <Alert className="border-green-400/50 bg-green-400/5">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-600 dark:text-green-400">
                <strong>Quase lá! Você já atingiu {percentage.toFixed(0)}% da sua meta! 💪</strong>
                <span className="block mt-1 text-sm">
                  Faltam apenas {formatCurrency(remaining)} para bater a meta.
                </span>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderGoalMenu = (goal: BudgetGoal) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-10 w-10 min-h-[44px] min-w-[44px] shrink-0 touch-manipulation"
          aria-label="Mais opções"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background">
        <DropdownMenuItem onClick={() => onEdit(goal)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(goal.id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Apagar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const expenseGoals = filteredGoals.filter(g => !isIncomeGoal(g.type) && !isBalanceGoal(g.type));
  const incomeGoals = filteredGoals.filter(g => isIncomeGoal(g.type));
  const balanceGoals = filteredGoals.filter(g => isBalanceGoal(g.type));

  const renderBalanceGoal = (goal: BudgetGoal) => {
    const { totalValue, limit, percentage, remaining, isOver } = calculateProgress(goal);
    const progressValue = Math.min(Math.max(percentage, 0), 100);
    const isPositive = totalValue >= 0;

    return (
      <Card
        key={goal.id}
        className={`transition-all ${
          isOver ? 'border-blue-500 bg-blue-500/10' :
          percentage >= 80 ? 'border-blue-400/50 bg-blue-400/5' :
          ''
        }`}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Meta de Saldo
              </CardTitle>
              <CardDescription>
                Meta: {formatCurrency(limit)}
              </CardDescription>
            </div>
            {renderGoalMenu(goal)}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Saldo atual: {formatCurrency(totalValue)}</span>
              <span className={isOver ? "text-blue-600 dark:text-blue-400 font-medium" : "text-muted-foreground"}>
                {percentage.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={progressValue}
              className="[&>div]:bg-blue-500"
            />
            <div className="flex items-center justify-between text-sm">
              {isOver ? (
                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                  <TrendingUp className="h-4 w-4" />
                  <span>Meta atingida! Saldo excede em {formatCurrency(Math.abs(remaining))}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <TrendingDown className="h-4 w-4" />
                  <span>Faltam {formatCurrency(remaining)} para a meta</span>
                </div>
              )}
            </div>
          </div>

          {isOver && (
            <Alert className="border-blue-500 bg-blue-500/10">
              <Star className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-600 dark:text-blue-400">
                <strong>Parabéns! Seu saldo está acima da meta! 🎯</strong>
              </AlertDescription>
            </Alert>
          )}

          {!isOver && percentage >= 80 && (
            <Alert className="border-blue-400/50 bg-blue-400/5">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-600 dark:text-blue-400">
                <strong>Quase lá! Você está a {formatCurrency(remaining)} da meta! 💪</strong>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {expenseGoals.map((goal) => renderExpenseGoal(goal))}
      {incomeGoals.map((goal) => renderIncomeGoal(goal))}
      {balanceGoals.map((goal) => renderBalanceGoal(goal))}
    </div>
  );
}
