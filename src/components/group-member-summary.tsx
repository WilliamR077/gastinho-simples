import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { SharedGroupMember } from "@/types/shared-group";

// Paleta com bom contraste em tema escuro
const MEMBER_COLORS = [
  "#22d3ee", // cyan
  "#a78bfa", // violet
  "#fbbf24", // amber
  "#34d399", // emerald
  "#fb923c", // orange
  "#f472b6", // pink
  "#60a5fa", // blue
  "#e879f9", // fuchsia
];

/**
 * Retorna a cor de um membro de forma determinística baseada na ordem de joined_at.
 * Estável para todos os membros do grupo, independente de quem visualiza.
 */
export function getMemberColor(userId: string, groupMembers: SharedGroupMember[]): string {
  // Ordena por joined_at (ordem estável de entrada no grupo)
  const sorted = [...groupMembers].sort(
    (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
  );
  const index = sorted.findIndex(m => m.user_id === userId);
  if (index < 0) return MEMBER_COLORS[0];
  return MEMBER_COLORS[index % MEMBER_COLORS.length];
}

interface GroupMemberSummaryProps {
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  groupMembers: SharedGroupMember[];
}

export function GroupMemberSummary({ expenses, recurringExpenses, groupMembers }: GroupMemberSummaryProps) {
  const { isHidden } = useValuesVisibility();

  const memberTotals = useMemo(() => {
    const totals: Record<string, number> = {};

    for (const exp of expenses) {
      totals[exp.user_id] = (totals[exp.user_id] || 0) + Number(exp.amount);
    }

    for (const rec of recurringExpenses) {
      if (rec.is_active) {
        totals[rec.user_id] = (totals[rec.user_id] || 0) + Number(rec.amount);
      }
    }

    return groupMembers
      .map((member) => ({
        userId: member.user_id,
        email: member.user_email || "Sem email",
        total: totals[member.user_id] || 0,
        color: getMemberColor(member.user_id, groupMembers),
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, recurringExpenses, groupMembers]);

  const formatCurrency = (amount: number) => {
    if (isHidden) return "R$ ••••";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(amount);
  };

  if (groupMembers.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <Users className="h-4 w-4" />
          Gastos por Membro
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <div className="space-y-2">
          {memberTotals.map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: member.color }}
                />
                <span className="text-sm truncate max-w-[180px]">
                  {member.email}
                </span>
              </div>
              <span className="text-sm font-semibold whitespace-nowrap">
                {formatCurrency(member.total)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
