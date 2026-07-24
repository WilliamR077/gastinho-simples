/**
 * Helpers de datas para tools MCP. Sempre em UTC/ISO YYYY-MM-DD.
 */

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(s: string | undefined | null): s is string {
  if (!s || !ISO_DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && s === d.toISOString().slice(0, 10);
}

export function currentMonthRange(now: Date = new Date()): { from: string; to: string } {
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
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
