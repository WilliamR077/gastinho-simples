export const REPORT_TIME_ZONE = "America/Sao_Paulo";

export type ReportPeriodRelation = "historical" | "current" | "future" | "mixed";

export interface RecurringTemplateLike {
  id: string;
  amount: number;
  day_of_month: number;
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
}

export interface RecurringProjection<T extends RecurringTemplateLike> {
  template: T;
  occurrences: Date[];
  occurrenceCount: number;
  projectedTotal: number;
  statusLabel: "Pendente de lançamento" | "Sem confirmação de lançamento" | "Prevista";
  dueLabel: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function localDate(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function datePartsInReportZone(date: Date): { year: number; month: number; day: number } {
  const parts = dateFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

/**
 * Converte DATEs como datas civis e TIMESTAMPTZs para o dia civil de São Paulo.
 * O meio-dia local evita que operações de calendário recuem o dia em fusos negativos.
 */
export function parseReportDate(value: string): Date {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (dateOnly) {
    return localDate(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`Data inválida no relatório: ${value}`);
  }
  const { year, month, day } = datePartsInReportZone(instant);
  return localDate(year, month - 1, day);
}

export function reportDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function isWithinReportPeriod(date: Date, startDate: Date, endDate: Date): boolean {
  return reportDateKey(date) >= reportDateKey(startDate)
    && reportDateKey(date) <= reportDateKey(endDate);
}

export function classifyReportPeriod(
  startDate: Date,
  endDate: Date,
  now: Date = new Date(),
): ReportPeriodRelation {
  const todayParts = datePartsInReportZone(now);
  const today = localDate(todayParts.year, todayParts.month - 1, todayParts.day);
  const currentMonthStart = localDate(today.getFullYear(), today.getMonth(), 1);
  const currentMonthEnd = localDate(today.getFullYear(), today.getMonth() + 1, 0);

  if (reportDateKey(endDate) < reportDateKey(currentMonthStart)) return "historical";
  if (reportDateKey(startDate) > reportDateKey(currentMonthEnd)) return "future";
  if (
    startDate.getFullYear() === today.getFullYear()
    && startDate.getMonth() === today.getMonth()
    && endDate.getFullYear() === today.getFullYear()
    && endDate.getMonth() === today.getMonth()
  ) return "current";
  return "mixed";
}

function formatCivilDate(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function calendarDaysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function recurringOccurrencesInPeriod<T extends RecurringTemplateLike>(
  template: T,
  startDate: Date,
  endDate: Date,
): Date[] {
  if (!template.is_active && !template.end_date) return [];

  const activeStart = parseReportDate(template.start_date || template.created_at);
  const activeEnd = template.end_date ? parseReportDate(template.end_date) : null;
  const occurrences: Date[] = [];

  for (
    let month = localDate(startDate.getFullYear(), startDate.getMonth(), 1);
    reportDateKey(month) <= reportDateKey(endDate);
    month = localDate(month.getFullYear(), month.getMonth() + 1, 1)
  ) {
    const lastDay = localDate(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const occurrence = localDate(
      month.getFullYear(),
      month.getMonth(),
      Math.min(Math.max(template.day_of_month, 1), lastDay),
    );
    if (!isWithinReportPeriod(occurrence, startDate, endDate)) continue;
    if (reportDateKey(occurrence) < reportDateKey(activeStart)) continue;
    if (activeEnd && reportDateKey(occurrence) > reportDateKey(activeEnd)) continue;
    occurrences.push(occurrence);
  }
  return occurrences;
}

export function buildRecurringProjections<T extends RecurringTemplateLike>(
  templates: T[],
  startDate: Date,
  endDate: Date,
  now: Date = new Date(),
  linkedTemplateIds: ReadonlySet<string> = new Set<string>(),
): RecurringProjection<T>[] {
  const relation = classifyReportPeriod(startDate, endDate, now);
  const nowParts = datePartsInReportZone(now);
  const today = localDate(nowParts.year, nowParts.month - 1, nowParts.day);

  return templates.flatMap((template) => {
    // Somente um identificador explícito e confiável pode retirar uma previsão.
    if (linkedTemplateIds.has(template.id)) return [];
    const occurrences = recurringOccurrencesInPeriod(template, startDate, endDate);
    if (occurrences.length === 0) return [];

    const onlyOccurrence = occurrences.length === 1 ? occurrences[0] : null;
    let statusLabel: RecurringProjection<T>["statusLabel"] = "Sem confirmação de lançamento";
    if (relation === "future") statusLabel = "Prevista";
    if (relation === "current" && onlyOccurrence && reportDateKey(onlyOccurrence) >= reportDateKey(today)) {
      statusLabel = "Pendente de lançamento";
    }

    let dueLabel = `${occurrences.length} ocorrências previstas no período`;
    if (onlyOccurrence) {
      dueLabel = `Prevista para ${formatCivilDate(onlyOccurrence)}`;
      if (relation === "current") {
        const daysUntil = calendarDaysBetween(today, onlyOccurrence);
        if (daysUntil === 0) dueLabel = "Prevista para hoje";
        else if (daysUntil > 0) dueLabel = `Vence em ${daysUntil} ${daysUntil === 1 ? "dia" : "dias"}`;
      }
    }

    return [{
      template,
      occurrences,
      occurrenceCount: occurrences.length,
      projectedTotal: Number((Number(template.amount) * occurrences.length).toFixed(2)),
      statusLabel,
      dueLabel,
    }];
  });
}

export function sumRealizedAmounts(rows: Array<{ amount: number }>): number {
  return Number(rows.reduce((sum, row) => sum + Number(row.amount), 0).toFixed(2));
}

export function calculatePercentageDelta(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

export function calculateRealizedSavingsRate(realizedIncomes: number, realizedExpenses: number): number {
  return realizedIncomes > 0 ? ((realizedIncomes - realizedExpenses) / realizedIncomes) * 100 : 0;
}
