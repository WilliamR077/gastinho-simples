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
  currentInvoice: number;
  futureInstallments: number;
  committedLimit: number;
  available: number;
  percentage: number;
  currentBillingMonth: string;
}

/**
 * Calcula o breakdown de uso do limite de um cartão de crédito.
 *
 * - currentInvoice: soma das despesas na fatura aberta projetada
 * - futureInstallments: saldo comprometido de parcelas futuras (após a fatura atual)
 * - committedLimit: currentInvoice + futureInstallments
 * - available: max(0, cardLimit - committedLimit)
 * - percentage: min(100, committedLimit / cardLimit * 100)
 *
 * Regras:
 * 1. Usa parseLocalDate() para todas as datas (fix timezone)
 * 2. Fatura atual = despesas cujo calculateBillingPeriod === currentBillingMonth
 * 3. Para cada installment_group_id, encontra a parcela que cai na fatura atual (N/T),
 *    calcula futureInstallments += amount × (T - N). Se o grupo não tem parcela na
 *    fatura atual, ignora.
 * 4. NÃO inclui templates de recurring_expenses (apenas lançamentos reais em expenses)
 */
export function calculateCardLimitBreakdown(
  allExpenses: CardExpenseRecord[],
  cardId: string,
  config: CreditCardConfig,
  cardLimit: number
): CardLimitBreakdown {
  const billing = getNextBillingDates(config, new Date());
  const currentBillingMonth = billing.billingMonth;

  const cardExpenses = allExpenses.filter(e => e.card_id === cardId);

  // 1. Fatura aberta projetada: despesas cujo billing period = mês atual
  let currentInvoice = 0;
  // Track which installment groups have a parcel in the current invoice
  const currentMonthInstallments = new Map<string, CardExpenseRecord>();

  cardExpenses.forEach(exp => {
    const expDate = parseLocalDate(exp.expense_date);
    const period = calculateBillingPeriod(expDate, config);

    if (period === currentBillingMonth) {
      currentInvoice += Number(exp.amount);

      // Se é parcelada, registra a parcela do mês atual
      if (exp.installment_group_id && exp.total_installments && exp.total_installments > 1) {
        currentMonthInstallments.set(exp.installment_group_id, exp);
      }
    }
  });

  // 2. Saldo futuro comprometido: para cada grupo parcelado que tem parcela na fatura atual,
  //    calcular amount × (total - parcela_atual)
  let futureInstallments = 0;

  currentMonthInstallments.forEach(exp => {
    const num = exp.installment_number || 1;
    const total = exp.total_installments || 1;
    const remaining = total - num;
    if (remaining > 0) {
      futureInstallments += Number(exp.amount) * remaining;
    }
  });

  const committedLimit = currentInvoice + futureInstallments;
  const available = Math.max(0, cardLimit - committedLimit);
  const percentage = cardLimit > 0 ? Math.min(100, (committedLimit / cardLimit) * 100) : 0;

  return {
    currentInvoice,
    futureInstallments,
    committedLimit,
    available,
    percentage,
    currentBillingMonth,
  };
}
