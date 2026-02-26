import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PartyPopper, Scale, X, ChevronRight } from "lucide-react";
import { BudgetGoal } from "@/types/budget-goal";
import { Income, RecurringIncome } from "@/types/income";
import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { parseLocalDate } from "@/lib/utils";

interface BalanceGoalBannerProps {
  budgetGoals: BudgetGoal[];
  incomes: Income[];
  recurringIncomes: RecurringIncome[];
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  selectedMonth: Date;
  onNavigateToGoals: () => void;
}

export function BalanceGoalBanner({
  budgetGoals,
  incomes,
  recurringIncomes,
  expenses,
  recurringExpenses,
  selectedMonth,
  onNavigateToGoals,
}: BalanceGoalBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const balanceGoalsProgress = useMemo(() => {
    const currentMonth = selectedMonth.getMonth();
    const currentYear = selectedMonth.getFullYear();
    const monthlyIncomes = incomes.filter((inc) => {
      const date = parseLocalDate(inc.income_date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    const monthlyExpenses = expenses.filter((exp) => {
      const date = parseLocalDate(exp.expense_date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    const activeRecurringIncomes = recurringIncomes.filter((ri) => ri.is_active);
    const activeRecurringExpenses = recurringExpenses.filter((re) => re.is_active);
    const totalIncome =
      monthlyIncomes.reduce((sum, inc) => sum + Number(inc.amount), 0) +
      activeRecurringIncomes.reduce((sum, ri) => sum + Number(ri.amount), 0);
    const totalExpense =
      monthlyExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0) +
      activeRecurringExpenses.reduce((sum, re) => sum + Number(re.amount), 0);
    const balance = totalIncome - totalExpense;

    return budgetGoals
      .filter((g) => g.type === "balance_target")
      .map((goal) => {
        const limit = Number(goal.limit_amount);
        const percentage = (balance / limit) * 100;
        const remaining = limit - balance;
        return { goal, balance, limit, percentage, remaining };
      })
      .filter((item) => item.percentage >= 80);
  }, [budgetGoals, incomes, recurringIncomes, expenses, recurringExpenses, selectedMonth]);

  if (isDismissed || balanceGoalsProgress.length === 0) return null;

  const achieved = balanceGoalsProgress.filter((g) => g.percentage >= 100);
  const almostThere = balanceGoalsProgress.filter((g) => g.percentage < 100);

  const message = achieved.length > 0
    ? "🌟 Meta de saldo atingida!"
    : "💪 Quase lá! Meta de saldo a caminho";

  const IconComp = achieved.length > 0 ? PartyPopper : Scale;

  return (
    <div
      className="mb-3 flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-2 cursor-pointer hover:bg-blue-500/10 transition-colors"
      onClick={onNavigateToGoals}
    >
      <IconComp className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
      <span className="text-xs font-medium text-blue-700 dark:text-blue-300 flex-1 truncate">{message}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-blue-700 dark:text-blue-300 hover:text-blue-800 shrink-0"
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