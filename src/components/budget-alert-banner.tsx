import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X, ChevronRight } from "lucide-react";
import { BudgetGoal } from "@/types/budget-goal";

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

  const criticalGoals = goalsAtRisk.filter(g => g.percentage >= 100);
  const warningGoals = goalsAtRisk.filter(g => g.percentage < 100);

  const message = criticalGoals.length > 0
    ? `🚨 ${criticalGoals.length} meta${criticalGoals.length > 1 ? 's' : ''} estourada${criticalGoals.length > 1 ? 's' : ''}`
    : `⚠️ ${warningGoals.length} meta${warningGoals.length > 1 ? 's' : ''} precisando de atenção`;

  return (
    <div
      className="mb-3 flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 cursor-pointer hover:bg-destructive/10 transition-colors"
      onClick={onNavigateToGoals}
    >
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
      <span className="text-xs font-medium text-destructive flex-1 truncate">{message}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-destructive hover:text-destructive shrink-0"
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