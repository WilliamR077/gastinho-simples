import { Button } from "@/components/ui/button";
import { cn, formatCurrencyLocaleWithVisibility } from "@/lib/utils";
import {
  getCardLimitBarClass,
  getCardLimitTextClass,
  type CardLimitSummary as CardLimitSummaryData,
} from "@/utils/card-limit-view-model";
import { useValuesVisibility } from "@/hooks/use-values-visibility";

interface CardLimitSummaryProps {
  summary: CardLimitSummaryData;
  variant?: "form" | "home";
  onDetailsClick?: () => void;
}

export function CardLimitSummary({
  summary,
  variant = "form",
  onDetailsClick,
}: CardLimitSummaryProps) {
  const { isHidden } = useValuesVisibility();
  const barClass = getCardLimitBarClass(summary.status);
  const textClass = getCardLimitTextClass(summary.status);
  const percentage = Math.round(summary.percentage);
  const formatCurrency = (value: number) => formatCurrencyLocaleWithVisibility(value, isHidden);

  if (variant === "home") {
    return (
      <div className="mt-1.5 w-full max-w-[220px] space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-1.5 min-w-[96px] flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full rounded-full transition-all", barClass)}
              style={{ width: `${Math.min(100, summary.percentage)}%` }}
            />
          </div>
          <span className={cn("text-[11px] font-medium tabular-nums", textClass)}>
            {percentage}%
          </span>
        </div>
        {onDetailsClick && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onDetailsClick();
            }}
          >
            Ver detalhes
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 text-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{summary.cardName}</p>
          <p className="text-xs text-muted-foreground">Uso do limite</p>
        </div>
        <span className={cn("text-sm font-semibold tabular-nums", textClass)}>
          {percentage}%
        </span>
      </div>

      <div className="mb-2 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", barClass)}
          style={{ width: `${Math.min(100, summary.percentage)}%` }}
        />
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Limite comprometido</span>
          <span className="font-medium text-foreground">
            {formatCurrency(summary.committedLimit)} de {formatCurrency(summary.limit)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">
            {summary.exceeded > 0 ? "Limite ultrapassado" : "Disponível estimado"}
          </span>
          <span className={cn("font-medium", summary.exceeded > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
            {summary.exceeded > 0
              ? `Ultrapassado em ${formatCurrency(summary.exceeded)}`
              : formatCurrency(summary.available)}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5 text-[11px] text-muted-foreground">
          <span>Gasto atual: {formatCurrency(summary.currentSpend)}</span>
          {summary.futureInstallments > 0 && (
            <span>Parceladas futuras: {formatCurrency(summary.futureInstallments)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
