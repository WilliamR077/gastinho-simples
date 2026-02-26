import { useState } from "react";
import { TrendingUp, ChevronRight } from "lucide-react";
import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { isWithinInterval } from "date-fns";
import { useCategories } from "@/hooks/use-categories";
import { useValuesVisibility } from "@/hooks/use-values-visibility";

interface CategoryInsightCardProps {
  expenses: Expense[];
  recurringExpenses?: RecurringExpense[];
  startDate?: Date;
  endDate?: Date;
  billingPeriod?: string;
  creditCardConfig?: { opening_day: number; closing_day: number };
  onCategoryClick?: (categoryId: string) => void;
  activeCategory?: string;
}

export function CategoryInsightCard({
  expenses,
  recurringExpenses = [],
  startDate,
  endDate,
  billingPeriod,
  creditCardConfig,
  onCategoryClick,
  activeCategory,
}: CategoryInsightCardProps) {
  const [showAll, setShowAll] = useState(false);
  const { categories } = useCategories();
  const { isHidden } = useValuesVisibility();

  const getCategoryInfo = (categoryId: string | null, categoryEnum: string) => {
    if (categoryId) {
      const uc = categories.find(c => c.id === categoryId);
      if (uc) return { id: uc.id, name: uc.name, icon: uc.icon };
    }
    const fb = categories.find(c => c.name.toLowerCase() === categoryEnum.toLowerCase());
    if (fb) return { id: fb.id, name: fb.name, icon: fb.icon };
    return { id: categoryEnum, name: categoryEnum, icon: "📦" };
  };

  const categoryTotals: Record<string, { total: number; name: string; icon: string }> = {};

  expenses.forEach(exp => {
    const cat = getCategoryInfo(exp.category_id, exp.category);
    if (!categoryTotals[cat.id]) categoryTotals[cat.id] = { total: 0, name: cat.name, icon: cat.icon };
    categoryTotals[cat.id].total += Number(exp.amount);
  });

  recurringExpenses.forEach(exp => {
    if (!exp.is_active) return;
    let shouldInclude = false;
    if (billingPeriod && creditCardConfig) {
      const [year, month] = billingPeriod.split('-').map(Number);
      const od = creditCardConfig.opening_day, cd = creditCardConfig.closing_day;
      let ps: Date, pe: Date;
      if (cd >= od) { ps = new Date(year, month - 1, od); pe = new Date(year, month - 1, cd); }
      else { ps = new Date(year, month - 1, od); pe = new Date(year, month, cd); }
      shouldInclude = isWithinInterval(new Date(year, month - 1, exp.day_of_month), { start: ps, end: pe });
    } else if (startDate && endDate) {
      const d = new Date(startDate);
      while (d <= endDate) {
        const ed = new Date(d.getFullYear(), d.getMonth(), exp.day_of_month);
        if (isWithinInterval(ed, { start: startDate, end: endDate })) { shouldInclude = true; break; }
        d.setMonth(d.getMonth() + 1);
      }
    } else {
      shouldInclude = true;
    }
    if (shouldInclude) {
      const cat = getCategoryInfo(exp.category_id, exp.category);
      if (!categoryTotals[cat.id]) categoryTotals[cat.id] = { total: 0, name: cat.name, icon: cat.icon };
      categoryTotals[cat.id].total += Number(exp.amount);
    }
  });

  const sorted = Object.entries(categoryTotals)
    .filter(([_, d]) => d.total > 0)
    .sort(([, a], [, b]) => b.total - a.total);

  const totalAmount = sorted.reduce((s, [_, d]) => s + d.total, 0);

  const fmt = (v: number) => {
    if (isHidden) return "R$ ***,**";
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-border/40 bg-card shadow-sm p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-red-500 dark:text-red-400 mb-2">
          <TrendingUp className="h-4 w-4" />
          Gastos por Categoria
        </div>
        <p className="text-muted-foreground text-center text-sm py-4">Nenhuma despesa neste período</p>
      </div>
    );
  }

  const display = showAll ? sorted : sorted.slice(0, 3);
  const hasMore = sorted.length > 3;

  return (
    <div className="rounded-lg border border-border/40 bg-card shadow-sm p-4" data-tour="category-summary">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-red-500 dark:text-red-400">
          <TrendingUp className="h-4 w-4" />
          Gastos por Categoria
        </div>
        <span className="text-sm font-bold text-red-500 dark:text-red-400">{fmt(totalAmount)}</span>
      </div>

      <div className="space-y-2.5">
        {display.map(([catId, data]) => {
          const pct = totalAmount > 0 ? (data.total / totalAmount) * 100 : 0;
          return (
            <button
              key={catId}
              className={`w-full flex items-center gap-3 rounded-md p-2 -mx-1 transition-colors hover:bg-muted/50 text-left ${activeCategory === catId ? 'bg-muted ring-1 ring-primary' : ''}`}
              onClick={() => onCategoryClick?.(catId)}
            >
              <span className="text-lg flex-shrink-0">{data.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground truncate">{data.name}</span>
                  <span className="text-sm font-semibold text-red-500 dark:text-red-400 ml-2">{fmt(data.total)}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className="text-xs text-muted-foreground w-10 text-right flex-shrink-0">{pct.toFixed(0)}%</span>
            </button>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {showAll ? 'Mostrar menos' : `Ver todas (${sorted.length})`}
          <ChevronRight className={`h-3 w-3 transition-transform ${showAll ? 'rotate-90' : ''}`} />
        </button>
      )}
    </div>
  );
}
