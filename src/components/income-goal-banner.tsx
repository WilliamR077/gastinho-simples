import { useState, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PartyPopper, TrendingUp, X } from "lucide-react";
import { BudgetGoal } from "@/types/budget-goal";
import { Income, RecurringIncome } from "@/types/income";
import { parseLocalDate } from "@/lib/utils";

interface IncomeGoalBannerProps {
  budgetGoals: BudgetGoal[];
  incomes: Income[];
  recurringIncomes: RecurringIncome[];
  selectedMonth: Date;
  onNavigateToGoals: () => void;
}

export function IncomeGoalBanner({ budgetGoals, incomes, recurringIncomes, selectedMonth, onNavigateToGoals }: IncomeGoalBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const incomeGoalsProgress = useMemo(() => {
    const currentMonth = selectedMonth.getMonth();
    const currentYear = selectedMonth.getFullYear();

    const monthlyIncomes = incomes.filter((inc) => {
      const date = parseLocalDate(inc.income_date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const activeRecurring = recurringIncomes.filter((ri) => ri.is_active);

    return budgetGoals
      .filter((g) => g.type === "income_monthly_total" || g.type === "income_category")
      .map((goal) => {
        let totalValue = 0;

        if (goal.type === "income_monthly_total") {
          totalValue = monthlyIncomes.reduce((sum, inc) => sum + Number(inc.amount), 0);
          totalValue += activeRecurring.reduce((sum, ri) => sum + Number(ri.amount), 0);
        } else if (goal.type === "income_category" && goal.category) {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(goal.category);
          totalValue = monthlyIncomes
            .filter((inc) => isUUID ? (inc as any).income_category_id === goal.category : inc.category === goal.category)
            .reduce((sum, inc) => sum + Number(inc.amount), 0);
          totalValue += activeRecurring
            .filter((ri) => isUUID ? (ri as any).income_category_id === goal.category : ri.category === goal.category)
            .reduce((sum, ri) => sum + Number(ri.amount), 0);
        }

        const limit = Number(goal.limit_amount);
        const percentage = (totalValue / limit) * 100;
        const remaining = limit - totalValue;

        return { goal, totalValue, limit, percentage, remaining };
      })
      .filter((item) => item.percentage >= 80);
  }, [budgetGoals, incomes, recurringIncomes, selectedMonth]);

  if (isDismissed || incomeGoalsProgress.length === 0) return null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const achieved = incomeGoalsProgress.filter((g) => g.percentage >= 100);
  const almostThere = incomeGoalsProgress.filter((g) => g.percentage < 100);

  return (
    <Alert
      className="mb-4 border-green-500/50 bg-green-500/10 cursor-pointer hover:bg-green-500/15 transition-colors"
      onClick={onNavigateToGoals}
    >
      {achieved.length > 0 ? (
        <PartyPopper className="h-4 w-4 text-green-600 dark:text-green-400" />
      ) : (
        <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
      )}
      <div className="flex items-start justify-between flex-1">
        <div className="flex-1">
          <AlertDescription className="text-green-700 dark:text-green-300 font-medium">
            {achieved.length > 0 && (
              <div className="mb-1">
                <strong>🎉 {achieved.length} meta{achieved.length > 1 ? "s" : ""} de entrada batida{achieved.length > 1 ? "s" : ""}!</strong>
                <div className="text-sm font-normal mt-1">
                  {achieved.slice(0, 2).map(({ goal, remaining }) => (
                    <div key={goal.id}>
                      {goal.type === "income_monthly_total" ? "Meta Mensal" : "Meta de Categoria"}: superou em {formatCurrency(Math.abs(remaining))}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {almostThere.length > 0 && (
              <div>
                <strong>💪 {almostThere.length} meta{almostThere.length > 1 ? "s" : ""} quase lá!</strong>
                <div className="text-sm font-normal mt-1">
                  {almostThere.slice(0, 2).map(({ goal, percentage, remaining }) => (
                    <div key={goal.id}>
                      {goal.type === "income_monthly_total" ? "Meta Mensal" : "Meta de Categoria"}: {percentage.toFixed(0)}% atingido (faltam {formatCurrency(remaining)})
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="text-xs mt-2 flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Clique para ver detalhes das suas metas
            </div>
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 ml-2"
          onClick={(e) => {
            e.stopPropagation();
            setIsDismissed(true);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
