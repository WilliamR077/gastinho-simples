import {
  calculateBillingPeriod,
  getClosingDateForBillingMonth,
  type CreditCardConfig,
} from "@/utils/billing-period";

export const CARD_SUMMARY_WARNINGS = [
  "INACTIVE_CARD",
  "INVALID_CARD_CONFIGURATION",
  "CREDIT_EXPENSE_WITHOUT_EXPECTED_METADATA",
  "BILLING_TOTAL_IS_CALCULATED",
  "PAYMENT_STATUS_NOT_AVAILABLE",
] as const;

export type BillingCalculationMode = "due_date" | "legacy_opening_closing";

export interface CardBillingConfig {
  opening_day: number | null;
  closing_day: number | null;
  due_day: number | null;
  days_before_due: number | null;
}

export interface ResolvedCardBillingPeriod {
  billing_month: string;
  start_date: string;
  end_date: string;
  closing_date: string | null;
  due_date: string | null;
  calculation_mode: BillingCalculationMode;
  configuration_warning: boolean;
}

const BILLING_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function isValidDay(value: number | null): value is number {
  return Number.isInteger(value) && value !== null && value >= 1 && value <= 31;
}

function isValidDaysBeforeDue(value: number | null): value is number {
  return Number.isInteger(value) && value !== null && value >= 1 && value <= 31;
}

function localIso(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addLocalDays(date: Date, days: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

function legacyPeriod(
  billingMonth: string,
  openingDay: number,
  closingDay: number,
): Pick<ResolvedCardBillingPeriod, "start_date" | "end_date"> | null {
  const [year, month] = billingMonth.split("-").map(Number);
  const anchor = new Date(year, month - 1, 1);
  const config: CreditCardConfig = {
    opening_day: openingDay,
    closing_day: closingDay,
  };
  const matchingDates: Date[] = [];

  // A janela cobre integralmente os meses adjacentes. A classificação em si
  // permanece a do helper usado pela interface.
  for (let offset = -62; offset <= 62; offset += 1) {
    const candidate = addLocalDays(anchor, offset);
    if (calculateBillingPeriod(candidate, config) === billingMonth) {
      matchingDates.push(candidate);
    }
  }
  if (matchingDates.length === 0) return null;
  for (let index = 1; index < matchingDates.length; index += 1) {
    if (
      localIso(addLocalDays(matchingDates[index - 1], 1)) !==
      localIso(matchingDates[index])
    ) {
      return null;
    }
  }
  return {
    start_date: localIso(matchingDates[0]),
    end_date: localIso(matchingDates.at(-1)!),
  };
}

/**
 * Resolve o intervalo conforme a mesma semântica de calculateBillingPeriod.
 * billing_month é o mês de referência da fatura calculada pelo aplicativo.
 */
export function resolveCardBillingPeriod(
  billingMonth: string,
  config: CardBillingConfig,
): ResolvedCardBillingPeriod | null {
  if (!BILLING_MONTH_RE.test(billingMonth)) return null;
  const [year, month] = billingMonth.split("-").map(Number);
  const zeroBasedMonth = month - 1;
  const modernValid =
    isValidDay(config.due_day) &&
    isValidDaysBeforeDue(config.days_before_due);

  if (modernValid) {
    const current = getClosingDateForBillingMonth(
      year,
      zeroBasedMonth,
      config.due_day,
      config.days_before_due,
    );
    const previousMonth = zeroBasedMonth === 0 ? 11 : zeroBasedMonth - 1;
    const previousYear = zeroBasedMonth === 0 ? year - 1 : year;
    const previous = getClosingDateForBillingMonth(
      previousYear,
      previousMonth,
      config.due_day,
      config.days_before_due,
    );
    return {
      billing_month: billingMonth,
      start_date: localIso(addLocalDays(previous.closingDate, 1)),
      end_date: localIso(current.closingDate),
      closing_date: localIso(current.closingDate),
      due_date: localIso(current.dueDate),
      calculation_mode: "due_date",
      configuration_warning: false,
    };
  }

  if (!isValidDay(config.opening_day) || !isValidDay(config.closing_day)) {
    return null;
  }
  const period = legacyPeriod(
    billingMonth,
    config.opening_day,
    config.closing_day,
  );
  if (!period) return null;
  return {
    billing_month: billingMonth,
    ...period,
    closing_date: period.end_date,
    due_date: null,
    calculation_mode: "legacy_opening_closing",
    configuration_warning: true,
  };
}
