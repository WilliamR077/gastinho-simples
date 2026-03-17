import { useState, useEffect, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SharedGroupMember } from "@/types/shared-group";
import { SplitType, SplitParticipant, calculateEqualSplit, splitTypeLabels } from "@/types/expense-split";
import { getMemberColor } from "@/components/group-member-summary";
import { Users, User, AlertTriangle } from "lucide-react";

interface ExpenseSplitSectionProps {
  amount: number;
  groupMembers: SharedGroupMember[];
  currentUserId: string;
  isShared: boolean;
  onIsSharedChange: (val: boolean) => void;
  paidBy: string;
  onPaidByChange: (val: string) => void;
  splitType: SplitType;
  onSplitTypeChange: (val: SplitType) => void;
  participants: SplitParticipant[];
  onParticipantsChange: (val: SplitParticipant[]) => void;
}

export function ExpenseSplitSection({
  amount,
  groupMembers,
  currentUserId,
  isShared,
  onIsSharedChange,
  paidBy,
  onPaidByChange,
  splitType,
  onSplitTypeChange,
  participants,
  onParticipantsChange,
}: ExpenseSplitSectionProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});
  const [manualPercentages, setManualPercentages] = useState<Record<string, string>>({});

  // When members are selected, rebuild participants
  useEffect(() => {
    if (!isShared || selectedUserIds.length === 0) {
      onParticipantsChange([]);
      return;
    }

    const members = groupMembers.filter(m => selectedUserIds.includes(m.user_id));

    if (splitType === 'equal') {
      const amounts = calculateEqualSplit(amount, members.length);
      onParticipantsChange(
        members.map((m, i) => ({
          userId: m.user_id,
          email: m.user_email || '',
          amount: amounts[i] || 0,
        }))
      );
    } else if (splitType === 'percentage') {
      onParticipantsChange(
        members.map(m => ({
          userId: m.user_id,
          email: m.user_email || '',
          percentage: parseFloat(manualPercentages[m.user_id] || '0'),
          amount: +(amount * (parseFloat(manualPercentages[m.user_id] || '0') / 100)).toFixed(2),
        }))
      );
    } else {
      onParticipantsChange(
        members.map(m => ({
          userId: m.user_id,
          email: m.user_email || '',
          amount: parseFloat(manualAmounts[m.user_id] || '0'),
        }))
      );
    }
  }, [isShared, selectedUserIds, splitType, amount, manualAmounts, manualPercentages, groupMembers]);

  const toggleMember = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const selectAllMembers = () => {
    if (selectedUserIds.length === groupMembers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(groupMembers.map(m => m.user_id));
    }
  };

  const totalManualAmounts = useMemo(() => {
    return Object.values(manualAmounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  }, [manualAmounts]);

  const totalPercentages = useMemo(() => {
    return Object.values(manualPercentages).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  }, [manualPercentages]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const getMemberName = (member: SharedGroupMember) =>
    member.user_email?.split('@')[0] || '?';

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border">
      <Label className="text-sm font-medium flex items-center gap-2">
        <Users className="h-4 w-4" />
        Rateio
      </Label>

      {/* Individual vs Compartilhada */}
      <RadioGroup
        value={isShared ? "shared" : "individual"}
        onValueChange={(v) => onIsSharedChange(v === "shared")}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="individual" id="split-individual" />
          <Label htmlFor="split-individual" className="cursor-pointer font-normal text-sm">
            Individual
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="shared" id="split-shared" />
          <Label htmlFor="split-shared" className="cursor-pointer font-normal text-sm">
            Compartilhada
          </Label>
        </div>
      </RadioGroup>

      {isShared && (
        <div className="space-y-3 mt-2">
          {/* Pago por */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Pago por</Label>
            <Select value={paidBy} onValueChange={onPaidByChange}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Quem pagou?" />
              </SelectTrigger>
              <SelectContent>
                {groupMembers.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: getMemberColor(m.user_id, groupMembers) }}
                      />
                      {getMemberName(m)}
                      {m.user_id === currentUserId && <span className="text-xs text-muted-foreground">(você)</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Participantes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Participantes</Label>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={selectAllMembers}
              >
                {selectedUserIds.length === groupMembers.length ? 'Desmarcar todos' : 'Todos'}
              </button>
            </div>
            <div className="space-y-1">
              {groupMembers.map(m => (
                <label
                  key={m.user_id}
                  className="flex items-center gap-2 py-1 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedUserIds.includes(m.user_id)}
                    onCheckedChange={() => toggleMember(m.user_id)}
                  />
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: getMemberColor(m.user_id, groupMembers) }}
                  />
                  <span className="text-sm">{getMemberName(m)}</span>
                  {m.user_id === currentUserId && <span className="text-xs text-muted-foreground">(você)</span>}
                </label>
              ))}
            </div>
          </div>

          {selectedUserIds.length > 0 && (
            <>
              {/* Tipo de divisão */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tipo de divisão</Label>
                <RadioGroup
                  value={splitType}
                  onValueChange={(v) => onSplitTypeChange(v as SplitType)}
                  className="flex gap-2 flex-wrap"
                >
                  {(['equal', 'percentage', 'manual'] as SplitType[]).map(type => (
                    <div key={type} className="flex items-center space-x-1.5">
                      <RadioGroupItem value={type} id={`split-type-${type}`} />
                      <Label htmlFor={`split-type-${type}`} className="cursor-pointer font-normal text-xs">
                        {splitTypeLabels[type]}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Preview da divisão */}
              <div className="bg-background rounded-md border border-border p-2.5 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {splitType === 'equal'
                    ? `${formatCurrency(amount)} ÷ ${selectedUserIds.length} = ${formatCurrency(amount / selectedUserIds.length)} por pessoa`
                    : `Total: ${formatCurrency(amount)}`}
                </p>

                {splitType === 'equal' && participants.map(p => (
                  <div key={p.userId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: getMemberColor(p.userId, groupMembers) }}
                      />
                      <span className="text-xs">{p.email.split('@')[0]}</span>
                    </div>
                    <span className="text-xs font-medium">{formatCurrency(p.amount)}</span>
                  </div>
                ))}

                {splitType === 'percentage' && (
                  <>
                    {groupMembers.filter(m => selectedUserIds.includes(m.user_id)).map(m => (
                      <div key={m.user_id} className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: getMemberColor(m.user_id, groupMembers) }}
                        />
                        <span className="text-xs min-w-[60px] truncate">{getMemberName(m)}</span>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className="h-7 text-xs w-20"
                          placeholder="%"
                          value={manualPercentages[m.user_id] || ''}
                          onChange={e => setManualPercentages(prev => ({ ...prev, [m.user_id]: e.target.value }))}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                        <span className="text-xs font-medium ml-auto">
                          {formatCurrency(amount * (parseFloat(manualPercentages[m.user_id] || '0') / 100))}
                        </span>
                      </div>
                    ))}
                    {totalPercentages !== 100 && totalPercentages > 0 && (
                      <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                        <AlertTriangle className="h-3 w-3" />
                        Soma: {totalPercentages.toFixed(1)}% (precisa ser 100%)
                      </div>
                    )}
                  </>
                )}

                {splitType === 'manual' && (
                  <>
                    {groupMembers.filter(m => selectedUserIds.includes(m.user_id)).map(m => (
                      <div key={m.user_id} className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: getMemberColor(m.user_id, groupMembers) }}
                        />
                        <span className="text-xs min-w-[60px] truncate">{getMemberName(m)}</span>
                        <span className="text-xs text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-7 text-xs w-24"
                          placeholder="0,00"
                          value={manualAmounts[m.user_id] || ''}
                          onChange={e => setManualAmounts(prev => ({ ...prev, [m.user_id]: e.target.value }))}
                        />
                      </div>
                    ))}
                    {Math.abs(totalManualAmounts - amount) > 0.01 && totalManualAmounts > 0 && (
                      <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                        <AlertTriangle className="h-3 w-3" />
                        Soma: {formatCurrency(totalManualAmounts)} (precisa ser {formatCurrency(amount)})
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
