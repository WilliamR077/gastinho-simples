import { useMemo, useState } from "react";
import { Expense } from "@/types/expense";
import { SharedGroupMember } from "@/types/shared-group";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { getMemberColor } from "@/components/group-member-summary";
import { TransactionDetailSheet } from "@/components/transaction-detail-sheet";
import { ArrowRight, Share2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";

interface Transfer {
  from: string;
  fromEmail: string;
  to: string;
  toEmail: string;
  amount: number;
}

interface MemberBreakdown {
  userId: string;
  email: string;
  totalPaid: number;
  totalOwed: number;
  balance: number;
  expenses: Array<{
    expense: Expense;
    paid: number;
    owed: number;
    net: number;
  }>;
}

interface GroupSettlementDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenses: Expense[];
  groupMembers: SharedGroupMember[];
  groupName?: string;
  currentUserId?: string;
}

export function GroupSettlementDetail({
  open,
  onOpenChange,
  expenses,
  groupMembers,
  groupName = "Grupo",
  currentUserId,
}: GroupSettlementDetailProps) {
  const { isHidden } = useValuesVisibility();
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const formatCurrency = (val: number) => {
    if (isHidden) return "R$ ••••";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const getName = (userId: string) => {
    const member = groupMembers.find(m => m.user_id === userId);
    return member?.user_email?.split("@")[0] || "?";
  };

  const { transfers, breakdowns, totalToSettle } = useMemo(() => {
    const sharedExpenses = expenses.filter(e => e.is_shared && e.splits && e.splits.length > 0);

    // Build per-member breakdown
    const memberMap: Record<string, MemberBreakdown> = {};

    const ensureMember = (userId: string) => {
      if (!memberMap[userId]) {
        memberMap[userId] = {
          userId,
          email: getName(userId),
          totalPaid: 0,
          totalOwed: 0,
          balance: 0,
          expenses: [],
        };
      }
    };

    for (const exp of sharedExpenses) {
      const payerId = exp.paid_by || exp.user_id;
      ensureMember(payerId);
      memberMap[payerId].totalPaid += Number(exp.amount);

      for (const split of exp.splits!) {
        ensureMember(split.user_id);
        memberMap[split.user_id].totalOwed += Number(split.share_amount);

        // Per-expense breakdown
        const paidInThis = split.user_id === payerId ? Number(exp.amount) : 0;
        const owedInThis = Number(split.share_amount);
        memberMap[split.user_id].expenses.push({
          expense: exp,
          paid: paidInThis,
          owed: owedInThis,
          net: paidInThis - owedInThis,
        });
      }

      // If payer is not in splits, add their paid entry
      if (!exp.splits!.some(s => s.user_id === payerId)) {
        memberMap[payerId].expenses.push({
          expense: exp,
          paid: Number(exp.amount),
          owed: 0,
          net: Number(exp.amount),
        });
      }
    }

    // Calculate balances
    for (const m of Object.values(memberMap)) {
      m.balance = m.totalPaid - m.totalOwed;
    }

    // Greedy algorithm to minimize transfers
    const debtors = Object.values(memberMap)
      .filter(m => m.balance < -0.01)
      .map(m => ({ ...m, remaining: Math.abs(m.balance) }))
      .sort((a, b) => b.remaining - a.remaining);

    const creditors = Object.values(memberMap)
      .filter(m => m.balance > 0.01)
      .map(m => ({ ...m, remaining: m.balance }))
      .sort((a, b) => b.remaining - a.remaining);

    const transfers: Transfer[] = [];

    let di = 0, ci = 0;
    while (di < debtors.length && ci < creditors.length) {
      const debtor = debtors[di];
      const creditor = creditors[ci];
      const amount = Math.min(debtor.remaining, creditor.remaining);
      if (amount > 0.01) {
        transfers.push({
          from: debtor.userId,
          fromEmail: debtor.email,
          to: creditor.userId,
          toEmail: creditor.email,
          amount: +amount.toFixed(2),
        });
      }
      debtor.remaining -= amount;
      creditor.remaining -= amount;
      if (debtor.remaining < 0.01) di++;
      if (creditor.remaining < 0.01) ci++;
    }

    const totalToSettle = transfers.reduce((s, t) => s + t.amount, 0);

    return {
      transfers,
      breakdowns: Object.values(memberMap).filter(m => m.totalPaid > 0 || m.totalOwed > 0).sort((a, b) => b.balance - a.balance),
      totalToSettle,
    };
  }, [expenses, groupMembers]);

  const handleShare = async () => {
    const lines = [
      `📊 Acerto — Grupo: ${groupName}`,
      "",
      "💸 Transferências:",
      ...transfers.map(t => `• ${t.fromEmail} paga ${formatCurrency(t.amount)} para ${t.toEmail}`),
      "",
      `Gerado em ${new Date().toLocaleDateString("pt-BR")} pelo Gastinho Simples`,
    ];
    const text = lines.join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: "Copiado!", description: "Resumo copiado para a área de transferência." });
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: "Copiado!", description: "Resumo copiado para a área de transferência." });
      } catch {
        toast({ title: "Erro", description: "Não foi possível compartilhar.", variant: "destructive" });
      }
    }
  };

  if (breakdowns.length === 0) return null;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle className="text-base">Acerto — {groupName}</DrawerTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span>Total a acertar: <strong className="text-foreground">{formatCurrency(totalToSettle)}</strong></span>
              <span>•</span>
              <span>{transfers.length} transferência{transfers.length !== 1 ? "s" : ""}</span>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-4 overflow-y-auto space-y-4">
            {/* Section: Quem paga para quem */}
            {transfers.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quem paga para quem</h3>
                <div className="space-y-2">
                  {transfers.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getMemberColor(t.from, groupMembers) }} />
                        <span className="text-sm font-medium truncate">{t.fromEmail}</span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getMemberColor(t.to, groupMembers) }} />
                        <span className="text-sm font-medium truncate">{t.toEmail}</span>
                      </div>
                      <span className="text-sm font-bold text-foreground ml-auto whitespace-nowrap">
                        {formatCurrency(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Section: Composição do saldo por membro */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Composição por membro</h3>
              <div className="space-y-1">
                {breakdowns.map(m => {
                  const isExpanded = expandedMember === m.userId;
                  return (
                    <div key={m.userId} className="rounded-lg border border-border overflow-hidden">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedMember(isExpanded ? null : m.userId)}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: getMemberColor(m.userId, groupMembers) }} />
                          <span className="text-sm font-medium">{m.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${
                            m.balance > 0.01 ? 'text-green-600 dark:text-green-400' :
                            m.balance < -0.01 ? 'text-red-500 dark:text-red-400' :
                            'text-muted-foreground'
                          }`}>
                            {m.balance > 0.01 && '+'}{formatCurrency(m.balance)}
                          </span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-2 space-y-1 border-t border-border pt-2">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Pagou: {formatCurrency(m.totalPaid)}</span>
                            <span>Deve: {formatCurrency(m.totalOwed)}</span>
                          </div>
                          {m.expenses.map((entry, i) => (
                            <button
                              key={`${entry.expense.id}-${i}`}
                              type="button"
                              className="w-full flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-muted/50 transition-colors"
                              onClick={() => {
                                setSelectedExpense(entry.expense);
                              }}
                            >
                              <span className="truncate text-left flex-1 text-foreground">{entry.expense.description}</span>
                              <span className={`ml-2 font-medium whitespace-nowrap ${
                                entry.net > 0.01 ? 'text-green-600 dark:text-green-400' :
                                entry.net < -0.01 ? 'text-red-500 dark:text-red-400' :
                                'text-muted-foreground'
                              }`}>
                                {entry.net > 0.01 && '+'}{formatCurrency(entry.net)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DrawerFooter className="pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleShare}
            >
              <Share2 className="h-4 w-4" />
              Compartilhar resumo
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Detail sheet for clicked expense */}
      <TransactionDetailSheet
        expense={selectedExpense}
        open={!!selectedExpense}
        onOpenChange={(o) => { if (!o) setSelectedExpense(null); }}
        onEdit={() => {}}
        onDelete={() => {}}
        groupMembers={groupMembers}
        isGroupContext={true}
      />
    </>
  );
}
