import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BudgetGoal } from "@/types/budget-goal";
import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { categoryLabels, categoryIcons } from "@/types/expense";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface BudgetProgressProps {
  goals: BudgetGoal[];
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  onDelete: (id: string) => void;
}

export function BudgetProgress({ goals, expenses, recurringExpenses, onDelete }: BudgetProgressProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const expenseDate = new Date(expense.expense_date);
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

        return (
          <Card key={goal.id} className={isOver ? "border-destructive" : ""}>
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
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(goal.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
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
                  className={isOver ? "[&>div]:bg-destructive" : ""}
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

              {isOver && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Você ultrapassou o limite desta meta!
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
