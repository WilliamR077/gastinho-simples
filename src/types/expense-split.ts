export type SplitType = 'equal' | 'percentage' | 'manual';

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  share_amount: number;
  share_percentage?: number | null;
  user_email?: string | null;
  created_at: string;
}

export interface SplitParticipant {
  userId: string;
  email: string;
  amount: number;
  percentage?: number;
}

export const splitTypeLabels: Record<SplitType, string> = {
  equal: 'Igualitária',
  percentage: 'Por porcentagem',
  manual: 'Por valor',
};

/**
 * Distribui centavos restantes ao primeiro participante.
 * Exemplo: R$100/3 → R$33,34 + R$33,33 + R$33,33
 */
export function calculateEqualSplit(total: number, participantCount: number): number[] {
  if (participantCount <= 0) return [];
  const base = Math.floor((total * 100) / participantCount) / 100;
  const remainder = Math.round((total - base * participantCount) * 100);
  return Array.from({ length: participantCount }, (_, i) =>
    i < remainder ? +(base + 0.01).toFixed(2) : +base.toFixed(2)
  );
}
