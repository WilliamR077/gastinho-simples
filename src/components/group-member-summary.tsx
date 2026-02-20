import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { Expense } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { SharedGroupMember } from "@/types/shared-group";

interface GroupMemberSummaryProps {
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  groupMembers: SharedGroupMember[];
}

const MEMBER_COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(195, 85%, 45%)",
  "hsl(350, 80%, 55%)",
];

export function GroupMemberSummary({ expenses, recurringExpenses, groupMembers }: GroupMemberSummaryProps) {
  const { isHidden } = useValuesVisibility();

  const memberTotals = useMemo(() => {
    const totals: Record<string, number> = {};

    // Sum expenses per user
    for (const exp of expenses) {
      totals[exp.user_id] = (totals[exp.user_id] || 0) + Number(exp.amount);
    }

    // Sum active recurring expenses per user
    for (const rec of recurringExpenses) {
      if (rec.is_active) {
        totals[rec.user_id] = (totals[rec.user_id] || 0) + Number(rec.amount);
      }
    }

    // Map to members with email, sorted by total desc
    return groupMembers
      .map((member, index) => ({
        userId: member.user_id,
        email: member.user_email || "Sem email",
        total: totals[member.user_id] || 0,
        color: MEMBER_COLORS[index % MEMBER_COLORS.length],
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
