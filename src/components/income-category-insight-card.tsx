import { useState } from "react";
import { TrendingUp, ChevronRight } from "lucide-react";
import { Income, RecurringIncome, incomeCategoryLabels, incomeCategoryIcons, IncomeCategory } from "@/types/income";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { useIncomeCategories } from "@/hooks/use-income-categories";
import { parseLocalDate } from "@/lib/utils";

interface IncomeCategoryInsightCardProps {
  incomes: Income[];
  recurringIncomes?: RecurringIncome[];
  startDate?: Date;
  endDate?: Date;
  onCategoryClick?: (category: string) => void;
  activeCategory?: string;
}

export function IncomeCategoryInsightCard({
  incomes,
  recurringIncomes = [],
  startDate,
  endDate,
  onCategoryClick,
  activeCategory,
}: IncomeCategoryInsightCardProps) {
  const [showAll, setShowAll] = useState(false);
  const { isHidden } = useValuesVisibility();
  const { categories: incomeCategories } = useIncomeCategories();

  const categoryTotals: Record<string, { total: number; name: string; icon: string }> = {};

  const getCategoryInfo = (income: { category: string; income_category_id?: string | null; category_name?: string | null; category_icon?: string | null }) => {
    const id = (income as any).income_category_id;
    if (id) {
      const cc = incomeCategories.find(c => c.id === id);
      if (cc) return { key: id, name: cc.name, icon: cc.icon };
      if ((income as any).category_name) return { key: id, name: (income as any).category_name, icon: (income as any).category_icon || "📦" };
    }
    const cat = income.category as IncomeCategory;
    return { key: cat, name: incomeCategoryLabels[cat] || cat, icon: incomeCategoryIcons[cat] || "📦" };
  };

  const filtered = incomes.filter(i => {
    if (!startDate || !endDate) return true;
    const d = parseLocalDate(i.income_date);
    return d >= startDate && d <= endDate;
  });

  filtered.forEach(i => {
    const { key, name, icon } = getCategoryInfo(i);
    if (!categoryTotals[key]) categoryTotals[key] = { total: 0, name, icon };
    categoryTotals[key].total += Number(i.amount);
  });

  recurringIncomes.forEach(i => {
    if (!i.is_active) return;
    const { key, name, icon } = getCategoryInfo(i as any);
    if (!categoryTotals[key]) categoryTotals[key] = { total: 0, name, icon };
    categoryTotals[key].total += Number(i.amount);
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
        <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400 mb-2">
          <TrendingUp className="h-4 w-4" />
          Entradas por Categoria
        </div>
        <p className="text-muted-foreground text-center text-sm py-4">Nenhuma entrada neste período</p>
      </div>
    );
  }

  const display = showAll ? sorted : sorted.slice(0, 3);
  const hasMore = sorted.length > 3;

  return (
    <div className="rounded-lg border border-border/40 bg-card shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
          <TrendingUp className="h-4 w-4" />
          Entradas por Categoria
        </div>
        <span className="text-sm font-bold text-green-600 dark:text-green-400">{fmt(totalAmount)}</span>
      </div>

      <div className="space-y-2.5">
        {display.map(([catKey, data]) => {
          const pct = totalAmount > 0 ? (data.total / totalAmount) * 100 : 0;
          return (
            <button
              key={catKey}
              className={`w-full flex items-center gap-3 rounded-md p-2 -mx-1 transition-colors hover:bg-muted/50 text-left ${activeCategory === catKey ? 'bg-muted ring-1 ring-green-500' : ''}`}
              onClick={() => onCategoryClick?.(catKey)}
            >
              <span className="text-lg flex-shrink-0">{data.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground truncate">{data.name}</span>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400 ml-2">{fmt(data.total)}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
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
