import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface BalanceSummaryProps {
  totalIncome: number;
  totalExpense: number;
}

export function BalanceSummary({ totalIncome, totalExpense }: BalanceSummaryProps) {
  const { isHidden } = useValuesVisibility();
  const balance = totalIncome - totalExpense;

  const formatCurrency = (amount: number) => {
    if (isHidden) return "R$ ••••";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(amount);
  };

  return (
    <div className="rounded-lg border border-border/50 bg-card shadow-sm p-4">
      <h3 className="text-xs font-medium text-muted-foreground mb-3">Resumo do Mês</h3>
      <div className="grid grid-cols-3 gap-3 divide-x divide-border/30">
        {/* Entradas */}
        <div className="text-center bg-green-950 border-2 border-green-950 border-solid shadow-sm rounded-xl">
          <div className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400 mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Entradas</span>
          </div>
          <p className="text-sm font-bold text-green-600 dark:text-green-400 truncate">
            {formatCurrency(totalIncome)}
          </p>
        </div>

        {/* Saídas */}
        <div className="text-center bg-red-950 border-2 border-[#370606] border-solid shadow-sm rounded-xl">
          <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400 mb-1">
            <TrendingDown className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Saídas</span>
          </div>
          <p className="text-sm font-bold text-red-600 dark:text-red-400 truncate">
            {formatCurrency(totalExpense)}
          </p>
        </div>

        {/* Saldo */}
        <div className="text-center px-0 border-solid mx-0 border-2 bg-blue-950 border-[#0e1735] shadow-sm rounded-xl">
          <div className={`flex items-center justify-center gap-1 mb-1 ${balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
            <Wallet className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Saldo</span>
          </div>
          <p className={`text-sm font-bold truncate ${balance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
            {formatCurrency(balance)}
          </p>
        </div>
      </div>
    </div>);

}