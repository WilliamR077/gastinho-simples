import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BudgetGoal } from "@/types/budget-goal";
import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { categoryLabels, categoryIcons } from "@/types/expense";
import { AlertTriangle, TrendingDown, TrendingUp, MoreVertical, Pencil, Trash2, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { parseLocalDate } from "@/lib/utils";
import { useValuesVisibility } from "@/hooks/use-values-visibility";

type AlertLevel = 'safe' | 'warning' | 'caution' | 'danger' | 'critical';

const getAlertLevel = (percentage: number): AlertLevel => {
  if (percentage >= 100) return 'critical';
  if (percentage >= 95) return 'danger';
  if (percentage >= 85) return 'caution';
  if (percentage >= 70) return 'warning';
  return 'safe';
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
  onDelete: (id: string) => void;
  onEdit: (goal: BudgetGoal) => void;
}

export function BudgetProgress({ goals, expenses, recurringExpenses, onDelete, onEdit }: BudgetProgressProps) {
  const { isHidden } = useValuesVisibility();
  
  const formatCurrency = (value: number) => {
    if (isHidden) return "R$ ***,**";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const expenseDate = parseLocalDate(expense.expense_date);
      return (
        expenseDate.getMonth() === currentMonth &&
        expenseDate.getFullYear() === currentYear
      );
    });
  }, [expenses, currentMonth, currentYear]);

  const activeRecurringExpenses = useMemo(() => {
    return recurringExpenses.filter((re) => re.is_active);
  }, [recurringExpenses]);

  const calculateProgress = (goal: BudgetGoal) => {
    let totalSpent = 0;

    if (goal.type === "monthly_total") {
      totalSpent = monthlyExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
      totalSpent += activeRecurringExpenses.reduce((sum, re) => sum + Number(re.amount), 0);
    } else if (goal.type === "category" && goal.category) {
      totalSpent = monthlyExpenses
        .filter((exp) => exp.category === goal.category)
        .reduce((sum, exp) => sum + Number(exp.amount), 0);
      totalSpent += activeRecurringExpenses
        .filter((re) => re.category === goal.category)
        .reduce((sum, re) => sum + Number(re.amount), 0);
    }

    const limit = Number(goal.limit_amount);
    const percentage = (totalSpent / limit) * 100;
    const remaining = limit - totalSpent;
    const isOver = totalSpent > limit;

    return { totalSpent, limit, percentage, remaining, isOver };
  };

  if (goals.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Nenhuma meta definida. Adicione uma meta para começar a acompanhar seus gastos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {goals.map((goal) => {
        const { totalSpent, limit, percentage, remaining, isOver } = calculateProgress(goal);
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
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
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Gasto: {formatCurrency(totalSpent)}</span>
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
      })}
    </div>
  );
}
