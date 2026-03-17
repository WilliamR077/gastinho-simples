import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale } from "lucide-react";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { Expense } from "@/types/expense";
import { SharedGroupMember } from "@/types/shared-group";
import { getMemberColor } from "@/components/group-member-summary";

interface GroupBalanceSummaryProps {
  expenses: Expense[];
  groupMembers: SharedGroupMember[];
}

export function GroupBalanceSummary({ expenses, groupMembers }: GroupBalanceSummaryProps) {
  const { isHidden } = useValuesVisibility();

  const balances = useMemo(() => {
    const paid: Record<string, number> = {};
    const owed: Record<string, number> = {};

    for (const exp of expenses) {
      if (!exp.is_shared || !exp.splits?.length) continue;

      // Quem pagou
      const payerId = exp.paid_by || exp.user_id;
      paid[payerId] = (paid[payerId] || 0) + Number(exp.amount);

      // Quanto cada participante deve
      for (const split of exp.splits) {
        owed[split.user_id] = (owed[split.user_id] || 0) + Number(split.share_amount);
      }
    }

    return groupMembers
      .map(m => {
        const totalPaid = paid[m.user_id] || 0;
        const totalOwed = owed[m.user_id] || 0;
        const balance = totalPaid - totalOwed;
        return {
          userId: m.user_id,
          email: m.user_email || 'Sem email',
          totalPaid,
          totalOwed,
          balance,
          color: getMemberColor(m.user_id, groupMembers),
        };
      })
      .filter(m => m.totalPaid > 0 || m.totalOwed > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [expenses, groupMembers]);

  const formatCurrency = (val: number) => {
    if (isHidden) return "R$ ••••";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  if (balances.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <Scale className="h-4 w-4" />
          Acerto entre Membros
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="space-y-2">
          {balances.map(m => (
            <div key={m.userId} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: m.color }}
                />
                <span className="text-sm truncate max-w-[140px]">
                  {m.email.split('@')[0]}
                </span>
              </div>
              <span
                className={`text-sm font-semibold whitespace-nowrap ${
                  m.balance > 0.01
                    ? 'text-green-600 dark:text-green-400'
                    : m.balance < -0.01
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-muted-foreground'
                }`}
              >
                {m.balance > 0.01 && '+'}
                {formatCurrency(m.balance)}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Positivo = tem a receber · Negativo = deve pagar
        </p>
      </CardContent>
    </Card>
  );
}
