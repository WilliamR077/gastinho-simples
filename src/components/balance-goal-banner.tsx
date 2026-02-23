import { useState, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PartyPopper, Scale, TrendingUp, X } from "lucide-react";
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const achieved = balanceGoalsProgress.filter((g) => g.percentage >= 100);
  const almostThere = balanceGoalsProgress.filter((g) => g.percentage < 100);

  return (
    <Alert
      className="mb-4 border-blue-500/50 bg-blue-500/10 cursor-pointer hover:bg-blue-500/15 transition-colors"
      onClick={onNavigateToGoals}
    >
      {achieved.length > 0 ? (
        <PartyPopper className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      ) : (
        <Scale className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      )}
      <div className="flex items-start justify-between flex-1">
        <div className="flex-1">
          <AlertDescription className="text-blue-700 dark:text-blue-300 font-medium">
            {achieved.length > 0 && (
              <div className="mb-1">
                <strong>🌟 Meta de saldo atingida!</strong>
                <div className="text-sm font-normal mt-1">
                  {achieved.slice(0, 2).map(({ goal, balance }) => (
                    <div key={goal.id}>
                      Incrível! Seu saldo está positivo em {formatCurrency(balance)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {almostThere.length > 0 && (
              <div>
                <strong>💪 Quase lá! Meta de saldo a caminho</strong>
                <div className="text-sm font-normal mt-1">
                  {almostThere.slice(0, 2).map(({ goal, percentage, remaining }) => (
                    <div key={goal.id}>
                      Você já está em {percentage.toFixed(0)}% da meta! Faltam {formatCurrency(remaining)}
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
