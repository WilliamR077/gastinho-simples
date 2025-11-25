import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X, TrendingUp } from "lucide-react";
import { BudgetGoal } from "@/types/budget-goal";
import { categoryLabels } from "@/types/expense";

interface BudgetAlertBannerProps {
  goalsAtRisk: Array<{
    goal: BudgetGoal;
    percentage: number;
    remaining: number;
  }>;
  onNavigateToGoals: () => void;
}

export function BudgetAlertBanner({ goalsAtRisk, onNavigateToGoals }: BudgetAlertBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || goalsAtRisk.length === 0) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const criticalGoals = goalsAtRisk.filter(g => g.percentage >= 100);
  const warningGoals = goalsAtRisk.filter(g => g.percentage < 100);

  return (
    <Alert 
      className="mb-4 border-destructive/50 bg-destructive/10 cursor-pointer hover:bg-destructive/15 transition-colors"
      onClick={onNavigateToGoals}
    >
      <AlertTriangle className="h-4 w-4 text-destructive" />
      <div className="flex items-start justify-between flex-1">
        <div className="flex-1">
          <AlertDescription className="text-destructive font-medium">
            {criticalGoals.length > 0 && (
              <div className="mb-1">
                <strong>🚨 {criticalGoals.length} meta{criticalGoals.length > 1 ? 's' : ''} estourada{criticalGoals.length > 1 ? 's' : ''}!</strong>
                <div className="text-sm font-normal mt-1">
                  {criticalGoals.slice(0, 2).map(({ goal, remaining }) => (
                    <div key={goal.id}>
                      {goal.type === "category" && goal.category
                        ? categoryLabels[goal.category]
                        : "Limite Mensal"}: excedeu em {formatCurrency(Math.abs(remaining))}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {warningGoals.length > 0 && (
              <div>
                <strong>⚠️ {warningGoals.length} meta{warningGoals.length > 1 ? 's' : ''} precisando de atenção</strong>
                <div className="text-sm font-normal mt-1">
                  {warningGoals.slice(0, 2).map(({ goal, percentage, remaining }) => (
                    <div key={goal.id}>
                      {goal.type === "category" && goal.category
                        ? categoryLabels[goal.category]
                        : "Limite Mensal"}: {percentage.toFixed(0)}% usado ({formatCurrency(remaining)} restantes)
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="text-xs mt-2 flex items-center gap-1 text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Clique para ver detalhes e ajustar seus gastos
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
