/**
 * Helpers de datas civis para tools MCP.
 *
 * Datas financeiras são strings ISO YYYY-MM-DD. A escolha do dia/mês corrente
 * usa explicitamente o fuso do produto, sem depender do fuso UTC do runtime.
 */

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

export function isValidIsoDate(s: string | undefined | null): s is string {
  if (!s || !ISO_DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && s === d.toISOString().slice(0, 10);
}

function civilDateParts(
  now: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

export function todayIso(
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  const { year, month, day } = civilDateParts(now, timeZone);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function currentMonthRange(
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): { from: string; to: string } {
  const { year, month } = civilDateParts(now, timeZone);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prefix = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  return { from: `${prefix}-01`, to: `${prefix}-${String(lastDay).padStart(2, "0")}` };
}

export function validateOpenDateRange(
  start?: string,
  end?: string,
): { ok: true } | { ok: false; code: "INVALID_DATE" | "INVALID_DATE_RANGE" } {
  if (start !== undefined && !isValidIsoDate(start)) {
    return { ok: false, code: "INVALID_DATE" };
  }
  if (end !== undefined && !isValidIsoDate(end)) {
    return { ok: false, code: "INVALID_DATE" };
  }
  if (start !== undefined && end !== undefined && start > end) {
    return { ok: false, code: "INVALID_DATE_RANGE" };
  }
  return { ok: true };
}

/**
 * Valida um intervalo [start, end]. Se ambos ausentes, devolve o mês corrente.
 * Retorna null quando inválido para o caller mapear em MCP_ERROR_CODES.
 */
export function resolveDateRange(
  start?: string,
  end?: string,
): { ok: true; from: string; to: string } | { ok: false; code: "INVALID_DATE" | "INVALID_DATE_RANGE" } {
  if (start && !isValidIsoDate(start)) return { ok: false, code: "INVALID_DATE" };
  if (end && !isValidIsoDate(end)) return { ok: false, code: "INVALID_DATE" };
  const { from: defFrom, to: defTo } = currentMonthRange();
  const from = start ?? defFrom;
  const to = end ?? defTo;
  if (from > to) return { ok: false, code: "INVALID_DATE_RANGE" };
  return { ok: true, from, to };
}
