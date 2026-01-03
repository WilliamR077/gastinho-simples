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
      currency: "BRL",
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Entradas */}
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 mb-1">
          <TrendingUp className="h-4 w-4" />
          <span className="text-xs font-medium">Entradas</span>
        </div>
        <p className="text-sm font-bold text-green-600 dark:text-green-400 truncate">
          {formatCurrency(totalIncome)}
        </p>
      </div>

      {/* Saídas */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-1">
          <TrendingDown className="h-4 w-4" />
          <span className="text-xs font-medium">Saídas</span>
        </div>
        <p className="text-sm font-bold text-red-600 dark:text-red-400 truncate">
          {formatCurrency(totalExpense)}
        </p>
      </div>

      {/* Saldo */}
      <div className={`${balance >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-orange-500/10 border-orange-500/20'} border rounded-lg p-3`}>
        <div className={`flex items-center gap-1.5 ${balance >= 0 ? 'text-primary' : 'text-orange-600 dark:text-orange-400'} mb-1`}>
          <Wallet className="h-4 w-4" />
          <span className="text-xs font-medium">Saldo</span>
        </div>
        <p className={`text-sm font-bold truncate ${balance >= 0 ? 'text-primary' : 'text-orange-600 dark:text-orange-400'}`}>
          {formatCurrency(balance)}
        </p>
      </div>
    </div>
  );
}
