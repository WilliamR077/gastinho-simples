import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BudgetGoal } from "@/types/budget-goal";
import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { Income, RecurringIncome, incomeCategoryLabels, incomeCategoryIcons } from "@/types/income";
import { categoryLabels, categoryIcons } from "@/types/expense";
import { AlertTriangle, TrendingDown, TrendingUp, MoreVertical, Pencil, Trash2, AlertCircle, Check, PartyPopper, Star } from "lucide-react";
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
}

export function BudgetProgress({ goals, expenses, recurringExpenses, incomes, recurringIncomes, selectedMonth, onDelete, onEdit }: BudgetProgressProps) {
  const { isHidden } = useValuesVisibility();
  const { categories } = useCategories();
  
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
    
    return categories
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

  const calculateProgress = (goal: BudgetGoal) => {
    let totalValue = 0;
    const isIncome = isIncomeGoal(goal.type);

    if (isIncome) {
      // Income goals
      if (goal.type === "income_monthly_total") {
        totalValue = monthlyIncomes.reduce((sum, inc) => sum + Number(inc.amount), 0);
        totalValue += activeRecurringIncomes.reduce((sum, ri) => sum + Number(ri.amount), 0);
      } else if (goal.type === "income_category" && goal.category) {
        totalValue = monthlyIncomes
          .filter((inc) => inc.category === goal.category)
          .reduce((sum, inc) => sum + Number(inc.amount), 0);
        totalValue += activeRecurringIncomes
          .filter((ri) => ri.category === goal.category)
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
    const percentage = (totalValue / limit) * 100;
    const remaining = limit - totalValue;
    const isOver = totalValue > limit;

    return { totalValue, limit, percentage, remaining, isOver };
  };

  if (goals.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Nenhuma meta definida. Adicione uma meta para começar a acompanhar seus gastos ou ganhos.
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
                  <span>{incomeCategoryIcons[categoryKey] || "📦"}</span>
                )}
                {goal.type === "income_monthly_total"
                  ? "🎯 Meta Mensal de Entradas"
                  : goal.category
                  ? incomeCategoryLabels[categoryKey] || goal.category
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

  const expenseGoals = goals.filter(g => !isIncomeGoal(g.type));
  const incomeGoals = goals.filter(g => isIncomeGoal(g.type));

  return (
    <div className="space-y-6">
      {expenseGoals.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            Metas de Gastos
          </h3>
          {expenseGoals.map((goal) => renderExpenseGoal(goal))}
        </div>
      )}

      {incomeGoals.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            Metas de Entradas
          </h3>
          {incomeGoals.map((goal) => renderIncomeGoal(goal))}
        </div>
      )}
    </div>
  );
}
