import { CreditCard, Smartphone, TrendingUp, Target, Check, AlertTriangle, AlertCircle } from "lucide-react";
import { Expense, PaymentMethod, categoryLabels } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { BudgetGoal } from "@/types/budget-goal";
import { Progress } from "@/components/ui/progress";
import { useMemo } from "react";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { useCategories } from "@/hooks/use-categories";

interface ExpenseSummaryProps {
  expenses: Expense[];
  recurringExpenses?: RecurringExpense[];
  billingPeriod?: string;
  startDate?: Date;
  endDate?: Date;
  creditCardConfig?: {opening_day: number;closing_day: number;};
  onPaymentMethodClick?: (method: PaymentMethod) => void;
  activePaymentMethod?: PaymentMethod;
  budgetGoals?: BudgetGoal[];
  onNavigateToGoals?: () => void;
  onCardClick?: (cardName: string, method: PaymentMethod) => void;
  activeCardName?: string;
}

export function ExpenseSummary({
  expenses,
  recurringExpenses = [],
  billingPeriod,
  startDate,
  endDate,
  creditCardConfig,
  onPaymentMethodClick,
  activePaymentMethod,
  budgetGoals = [],
  onNavigateToGoals,
  onCardClick,
  activeCardName
}: ExpenseSummaryProps) {
  const totals = expenses.reduce(
    (acc, expense) => {
      acc[expense.payment_method] += expense.amount;
      acc.total += expense.amount;
      return acc;
    },
    { pix: 0, debit: 0, credit: 0, total: 0 }
  );

  // Filter and add active recurring expenses that apply to the current period
  const activeRecurringExpenses = recurringExpenses.filter((expense) => {
    if (!expense.is_active) return false;

    // If there's a billing period filter (for credit cards)
    if (billingPeriod && creditCardConfig) {
      const [year, month] = billingPeriod.split('-').map(Number);
      const { opening_day, closing_day } = creditCardConfig;

      // Calculate the date range for this billing period
      let periodStart: Date;
      let periodEnd: Date;

      if (closing_day >= opening_day) {
        periodStart = new Date(year, month - 1, opening_day);
        periodEnd = new Date(year, month - 1, closing_day);
      } else {
        periodStart = new Date(year, month - 1, opening_day);
        periodEnd = new Date(year, month, closing_day);
      }

      // Check if the recurring expense day falls within this period
      const expenseDay = expense.day_of_month;
      const startDay = periodStart.getDate();
      const endDay = periodEnd.getDate();

      if (closing_day >= opening_day) {
        return expenseDay >= startDay && expenseDay <= endDay;
      } else {
        return expenseDay >= startDay || expenseDay <= endDay;
      }
    }

    // If there are date filters
    if (startDate && endDate) {
      const currentYear = startDate.getFullYear();
      const currentMonth = startDate.getMonth();

      // Create a date for this recurring expense in the current filtered month
      const recurringDate = new Date(currentYear, currentMonth, expense.day_of_month);

      // Check if this date falls within the filter range
      return recurringDate >= startDate && recurringDate <= endDate;
    }

    // If no filters, include all active recurring expenses
    return true;
  });

  activeRecurringExpenses.forEach((expense) => {
    totals[expense.payment_method] += expense.amount;
    totals.total += expense.amount;
  });

  // Calcular totais por cartão para crédito
  const creditCardTotals = expenses.
  filter((e) => e.payment_method === 'credit').
  reduce((acc, expense) => {
    const cardName = expense.card?.name || expense.card_name || 'Sem cartão';
    const cardColor = expense.card?.color || expense.card_color || '#FFA500';
    if (!acc[cardName]) {
      acc[cardName] = { total: 0, color: cardColor };
    }
    acc[cardName].total += expense.amount;
    return acc;
  }, {} as Record<string, {total: number;color: string;}>);

  // Adicionar despesas fixas ativas de crédito aos totais por cartão
  activeRecurringExpenses.
  filter((e) => e.payment_method === 'credit').
  forEach((expense) => {
    const cardName = expense.card?.name || expense.card_name || 'Sem cartão';
    const cardColor = expense.card?.color || expense.card_color || '#FFA500';
    if (!creditCardTotals[cardName]) {
      creditCardTotals[cardName] = { total: 0, color: cardColor };
    }
    creditCardTotals[cardName].total += expense.amount;
  });

  // Calcular totais por cartão para débito
  const debitCardTotals = expenses.
  filter((e) => e.payment_method === 'debit').
  reduce((acc, expense) => {
    const cardName = expense.card?.name || expense.card_name || 'Sem cartão';
    const cardColor = expense.card?.color || expense.card_color || '#3B82F6';
    if (!acc[cardName]) {
      acc[cardName] = { total: 0, color: cardColor };
    }
    acc[cardName].total += expense.amount;
    return acc;
  }, {} as Record<string, {total: number;color: string;}>);

  // Adicionar despesas fixas ativas de débito aos totais por cartão
  activeRecurringExpenses.
  filter((e) => e.payment_method === 'debit').
  forEach((expense) => {
    const cardName = expense.card?.name || expense.card_name || 'Sem cartão';
    const cardColor = expense.card?.color || expense.card_color || '#3B82F6';
    if (!debitCardTotals[cardName]) {
      debitCardTotals[cardName] = { total: 0, color: cardColor };
    }
    debitCardTotals[cardName].total += expense.amount;
  });

  const { isHidden } = useValuesVisibility();
  const { categories: expenseCategories } = useCategories();

  // Match category by enum OR by category_id (UUID)
  const getCategoryIdsForGoal = (goalCategory: string) => {
    const goalCategoryLabel = categoryLabels[goalCategory as keyof typeof categoryLabels];
    if (!goalCategoryLabel) return [];
    return expenseCategories.
    filter((c) => c.name.toLowerCase() === goalCategoryLabel.toLowerCase()).
    map((c) => c.id);
  };

  const expenseMatchesGoalCategory = (
  expCategory: string | undefined,
  expCategoryId: string | null | undefined,
  goalCategory: string) =>
  {
    if (expCategory === goalCategory) return true;
    if (expCategoryId) {
      const matchingIds = getCategoryIdsForGoal(goalCategory);
      return matchingIds.includes(expCategoryId);
    }
    return false;
  };

  const formatCurrency = (value: number) =>
  isHidden ? "R$ ***,**" : `R$ ${value.toFixed(2).replace('.', ',')}`;

  const budgetProgress = useMemo(() => {
    return budgetGoals.map((goal) => {
      let totalSpent = 0;

      if (goal.type === "monthly_total") {
        totalSpent = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
        totalSpent += activeRecurringExpenses.reduce((sum, re) => sum + Number(re.amount), 0);
      } else if (goal.type === "category" && goal.category) {
        totalSpent = expenses.
        filter((exp) => expenseMatchesGoalCategory(exp.category, exp.category_id, goal.category!)).
        reduce((sum, exp) => sum + Number(exp.amount), 0);
        totalSpent += activeRecurringExpenses.
        filter((re) => expenseMatchesGoalCategory(re.category, re.category_id, goal.category!)).
        reduce((sum, re) => sum + Number(re.amount), 0);
      }

      const limit = Number(goal.limit_amount);
      const percentage = totalSpent / limit * 100;
      const remaining = limit - totalSpent;

      return { goal, totalSpent, limit, percentage, remaining };
    });
  }, [budgetGoals, expenses, activeRecurringExpenses]);

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100) return <AlertTriangle className="h-3 w-3 text-destructive" />;
    if (percentage >= 85) return <AlertCircle className="h-3 w-3 text-orange-500" />;
    if (percentage >= 70) return <AlertCircle className="h-3 w-3 text-yellow-500" />;
    return <Check className="h-3 w-3 text-success" />;
  };

  const getTransactionCount = (method: PaymentMethod) => {
    return expenses.filter((e) => e.payment_method === method).length +
    activeRecurringExpenses.filter((e) => e.payment_method === method).length;
  };

  const paymentMethods: {key: PaymentMethod;label: string;icon: React.ReactNode;colorClass: string;cardTotals: Record<string, {total: number;color: string;}>;}[] = [
  {
    key: 'pix',
    label: 'PIX',
    icon: <Smartphone className="h-4 w-4 text-emerald-500" />,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    cardTotals: {}
  },
  {
    key: 'debit',
    label: 'Débito',
    icon: <CreditCard className="h-4 w-4 text-blue-500" />,
    colorClass: 'text-blue-600 dark:text-blue-400',
    cardTotals: debitCardTotals
  },
  {
    key: 'credit',
    label: 'Crédito',
    icon: <CreditCard className="h-4 w-4 text-amber-500" />,
    colorClass: 'text-amber-600 dark:text-amber-400',
    cardTotals: creditCardTotals
  }];


  return (
    <div className="rounded-lg border border-border/50 bg-card shadow-sm p-4">
    {/* Header */}
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-medium text-muted-foreground">Gastos por Método</h3>
      <span className="text-sm font-bold text-foreground">{formatCurrency(totals.total)}</span>
    </div>

    {/* Payment method rows */}
    <div className="space-y-0">
      {paymentMethods.map(({ key, label, icon, colorClass, cardTotals }) => {
        const value = totals[key];
        const count = getTransactionCount(key);
        const isZero = value === 0;
        const isActive = activePaymentMethod === key;
        const hasCardDetails = Object.keys(cardTotals).length > 0 && !isZero;

        return (
          <div key={key}>
            <div
              onClick={() => onPaymentMethodClick?.(key)}
              className={`flex items-center justify-between py-2.5 cursor-pointer transition-colors ${
                isActive ? 'bg-muted/50 rounded-md -mx-2 px-2' : ''
              } ${isZero ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                {icon}
                <span className="text-sm font-medium text-foreground">{label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${colorClass}`}>
                  {formatCurrency(value)}
                </span>
                <span className="text-xs text-muted-foreground min-w-[60px] text-right">
                  {count} transaç{count !== 1 ? 'ões' : 'ão'}
                </span>
              </div>
            </div>

            {/* Card details */}
            {hasCardDetails && (
              <div className="pl-8 pb-2 flex flex-wrap gap-x-4 gap-y-1 px-0">
                {Object.entries(cardTotals).map(([cardName, data]) => {
                  const isCardActive = activeCardName === cardName;
                  return (
                    <div
                      key={cardName}
                      onClick={(e) => { e.stopPropagation(); onCardClick?.(cardName, key); }}
                      className={`flex items-center gap-1.5 text-xs cursor-pointer transition-colors rounded-md px-1.5 py-0.5 ${
                        isCardActive ? 'bg-muted/80 text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div
                        style={{ backgroundColor: data.color }}
                        className="w-2 h-2 rounded-full flex-shrink-0"
                      />
                      <span>{cardName}: {formatCurrency(data.total)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>

    {/* Total transactions summary */}
    <div className="pt-2 border-t border-border/50 flex-col flex items-end justify-between my-0 mb-0 mt-0 py-0">
      <span className="text-xs text-muted-foreground mb-[10px]">
        {expenses.length} despesa{expenses.length !== 1 ? 's' : ''}
        {activeRecurringExpenses.length > 0 && (
          <>
            {' '}
            + {activeRecurringExpenses.length} fixa{activeRecurringExpenses.length !== 1 ? 's' : ''}
          </>
        )}
      </span>
    </div>

      {/* Budget goals */}
      {budgetProgress.length > 0 &&
      <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
          <div className="gap-1 text-xs font-medium text-muted-foreground flex items-center justify-center">
            <Target className="h-3 w-3" />
            <span className="text-left mx-0 px-0 ml-0">Metas do Mês</span>
          </div>
        {budgetProgress.slice(0, 3).map(({ goal, percentage }) => {
          const progressValue = Math.min(percentage, 100);
          return (
            <div key={goal.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    {getStatusIcon(percentage)}
                    <span className="text-muted-foreground">
                      {goal.type === "category" && goal.category ?
                    categoryLabels[goal.category] :
                    "Limite de despesa Mensal"}
                    </span>
                  </div>
                  <span className={`font-medium ${percentage >= 100 ? 'text-destructive' : percentage >= 85 ? 'text-orange-500' : 'text-muted-foreground'}`}>
                    {percentage.toFixed(0)}%
                  </span>
                </div>
                <Progress
                value={progressValue}
                className={`h-1 ${
                percentage >= 100 ? '[&>div]:bg-destructive' :
                percentage >= 85 ? '[&>div]:bg-orange-500' :
                percentage >= 70 ? '[&>div]:bg-yellow-500' :
                '[&>div]:bg-success'}`
                } />

              </div>);

        })}
          {onNavigateToGoals && (
            <button
              onClick={onNavigateToGoals}
              className="w-full text-xs text-primary font-medium mt-2 py-1.5 hover:underline"
            >
              Ver mais
            </button>
          )}
        </div>
      }
    </div>);

}