import { parseLocalDate } from "@/lib/utils";
import { calculateBillingPeriod, getNextBillingDates, type CreditCardConfig } from "@/utils/billing-period";

export interface CardExpenseRecord {
  amount: number;
  expense_date: string;
  card_id: string;
  installment_group_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
}

export interface CardLimitBreakdown {
  currentSpend: number;
  futureInstallments: number;
  committedLimit: number;
  available: number;
  exceeded: number;
  percentage: number;
}

/**
 * Calcula o breakdown de uso do limite de um cartão de crédito.
 *
 * - currentSpend: gasto atual do cartão (= mesma lógica da home, recebido como parâmetro)
 * - futureInstallments: saldo comprometido de parcelas futuras (após a parcela da fatura atual)
 * - committedLimit: currentSpend + futureInstallments
 * - available: cardLimit - committedLimit (pode ser negativo)
 * - exceeded: max(0, committedLimit - cardLimit)
 * - percentage: min(100, committedLimit / cardLimit * 100)
 *
 * Regras para futureInstallments:
 * 1. Usa parseLocalDate() para todas as datas (fix timezone)
 * 2. Para cada installment_group_id, encontra a parcela que cai no billing period atual
 *    (via calculateBillingPeriod), calcula amount × (T - N)
 * 3. Se o grupo não tem parcela na fatura atual, ignora
 * 4. NÃO inclui templates de recurring_expenses (apenas lançamentos reais em expenses)
 */
export function calculateCardLimitBreakdown(
  currentCardSpend: number,
  allExpenses: CardExpenseRecord[],
  cardId: string,
  config: CreditCardConfig,
  cardLimit: number
): CardLimitBreakdown {
  const billing = getNextBillingDates(config, new Date());
  const currentBillingMonth = billing.billingMonth;

  const cardExpenses = allExpenses.filter(e => e.card_id === cardId);

  // Encontrar parcelas que caem no billing period atual
  const currentMonthInstallments = new Map<string, CardExpenseRecord>();

  cardExpenses.forEach(exp => {
    if (!exp.installment_group_id || !exp.total_installments || exp.total_installments <= 1) return;

    const expDate = parseLocalDate(exp.expense_date);
    const period = calculateBillingPeriod(expDate, config);

    if (period === currentBillingMonth) {
      currentMonthInstallments.set(exp.installment_group_id, exp);
    }
  });

  // Saldo futuro comprometido: para cada grupo parcelado com parcela na fatura atual,
  // calcular amount × (total - parcela_atual)
  let futureInstallments = 0;

  currentMonthInstallments.forEach(exp => {
    const num = exp.installment_number || 1;
    const total = exp.total_installments || 1;
    const remaining = total - num;
    if (remaining > 0) {
      futureInstallments += Number(exp.amount) * remaining;
    }
  });

  const currentSpend = currentCardSpend;
  const committedLimit = currentSpend + futureInstallments;
  const available = cardLimit - committedLimit;
  const exceeded = Math.max(0, -available);
  const percentage = cardLimit > 0 ? Math.min(100, (committedLimit / cardLimit) * 100) : 0;

  return {
    currentSpend,
    futureInstallments,
    committedLimit,
    available,
    exceeded,
    percentage,
  };
}
