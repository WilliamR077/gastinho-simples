import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PartyPopper, TrendingUp, X, ChevronRight } from "lucide-react";
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

  const achieved = incomeGoalsProgress.filter((g) => g.percentage >= 100);
  const almostThere = incomeGoalsProgress.filter((g) => g.percentage < 100);

  const message = achieved.length > 0
    ? `🎉 ${achieved.length} meta${achieved.length > 1 ? "s" : ""} de entrada batida${achieved.length > 1 ? "s" : ""}!`
    : `💪 ${almostThere.length} meta${almostThere.length > 1 ? "s" : ""} quase lá!`;

  const IconComp = achieved.length > 0 ? PartyPopper : TrendingUp;

  return (
    <div
      className="mb-3 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-2 cursor-pointer hover:bg-green-500/10 transition-colors"
      onClick={onNavigateToGoals}
    >
      <IconComp className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
      <span className="text-xs font-medium text-green-700 dark:text-green-300 flex-1 truncate">{message}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-green-700 dark:text-green-300 hover:text-green-800 shrink-0"
        onClick={(e) => { e.stopPropagation(); onNavigateToGoals(); }}
      >
        Ver <ChevronRight className="h-3 w-3 ml-0.5" />
      </Button>
      <button
        className="text-muted-foreground hover:text-foreground shrink-0"
        onClick={(e) => { e.stopPropagation(); setIsDismissed(true); }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}