import {
  DEFAULT_TIME_ZONE,
  isValidIsoDate,
  todayIso,
} from "./dates";
import type { McpScope } from "./scope";

export type McpTimeScope = "occurred" | "future" | "all";
export type McpSortBy = "date" | "created_at" | "amount";
export type McpSortOrder = "asc" | "desc";
export type McpTransactionType = "expense" | "income";
export type McpQueryTransactionType = McpTransactionType | "all";

export { DEFAULT_TIME_ZONE, todayIso };
export const MAX_QUERY_DAYS = 366;
export const MAX_PAGE_SIZE = 100;
export const INTERNAL_RESULT_CAP = 10_000;
export const CURSOR_VERSION = 3;
export const CURSOR_TTL_SECONDS = 24 * 60 * 60;

export interface CursorPayload {
  version: 3;
  context: string;
  sort_by: McpSortBy;
  sort_order: McpSortOrder;
  sort_value: string | number;
  id: string;
  query_transaction_type: McpQueryTransactionType;
  last_item_type: McpTransactionType;
  filters_fingerprint: string;
  issued_at: number;
  expires_at: number;
}

export interface CursorExpectation {
  context: string;
  sort_by: McpSortBy;
  sort_order: McpSortOrder;
  query_transaction_type: McpQueryTransactionType;
  filters_fingerprint: string;
}

export interface SortableTransaction {
  id: string;
  date: string;
  created_at: string;
  amount: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const UUID_FILTER_KEYS = new Set([
  "category_id",
  "income_category_id",
  "card_id",
  "group_id",
]);
const CURSOR_KEYS = new Set([
  "version",
  "context",
  "sort_by",
  "sort_order",
  "sort_value",
  "id",
  "query_transaction_type",
  "last_item_type",
  "filters_fingerprint",
  "issued_at",
  "expires_at",
]);

export function isTimeScope(value: unknown): value is McpTimeScope {
  return value === "occurred" || value === "future" || value === "all";
}

export function isSortBy(value: unknown): value is McpSortBy {
  return value === "date" || value === "created_at" || value === "amount";
}

export function isSortOrder(value: unknown): value is McpSortOrder {
  return value === "asc" || value === "desc";
}

export function inclusiveDays(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return Math.floor((endMs - startMs) / 86_400_000) + 1;
}

export function validateBoundedDateRange(
  start: string,
  end: string,
  maxDays: number = MAX_QUERY_DAYS,
):
  | { ok: true; days: number }
  | { ok: false; code: "INVALID_DATE" | "INVALID_DATE_RANGE" | "DATE_RANGE_TOO_LARGE" } {
  if (!isValidIsoDate(start) || !isValidIsoDate(end)) {
    return { ok: false, code: "INVALID_DATE" };
  }
  if (start > end) return { ok: false, code: "INVALID_DATE_RANGE" };
  const days = inclusiveDays(start, end);
  if (days > maxDays) return { ok: false, code: "DATE_RANGE_TOO_LARGE" };
  return { ok: true, days };
}

export function previousPeriod(start: string, end: string): { start: string; end: string } {
  const days = inclusiveDays(start, end);
  const currentStart = Date.parse(`${start}T00:00:00Z`);
  const previousEnd = new Date(currentStart - 86_400_000);
  const previousStart = new Date(currentStart - days * 86_400_000);
  return {
    start: previousStart.toISOString().slice(0, 10),
    end: previousEnd.toISOString().slice(0, 10),
  };
}

export interface EffectiveDateRange {
  requested_period: { start_date: string; end_date: string };
  effective_period: { start_date: string; end_date: string; days: number } | null;
  coverage_warning: string | null;
}

export function addIsoDays(date: string, days: number): string {
  const value = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(value).toISOString().slice(0, 10);
}

export function effectiveDateRange(
  start: string,
  end: string,
  timeScope: McpTimeScope,
  today: string = todayIso(),
): EffectiveDateRange {
  const requested_period = { start_date: start, end_date: end };
  let effectiveStart = start;
  let effectiveEnd = end;

  if (timeScope === "occurred" && effectiveEnd > today) effectiveEnd = today;
  if (timeScope === "future") {
    const tomorrow = addIsoDays(today, 1);
    if (effectiveStart < tomorrow) effectiveStart = tomorrow;
  }

  if (effectiveStart > effectiveEnd) {
    return {
      requested_period,
      effective_period: null,
      coverage_warning:
        timeScope === "occurred"
          ? "O período solicitado não contém datas já ocorridas."
          : "O período solicitado não contém datas futuras.",
    };
  }

  const changed = effectiveStart !== start || effectiveEnd !== end;
  return {
    requested_period,
    effective_period: {
      start_date: effectiveStart,
      end_date: effectiveEnd,
      days: inclusiveDays(effectiveStart, effectiveEnd),
    },
    coverage_warning: changed
      ? `O período efetivo foi limitado por time_scope=${timeScope}.`
      : null,
  };
}

export function validateAmountRange(
  minAmount?: number,
  maxAmount?: number,
): boolean {
  return minAmount === undefined || maxAmount === undefined || minAmount <= maxAmount;
}

export function hasInvalidExpenseOnlyFilters(
  transactionType: "expense" | "income" | "all",
  cardId?: string,
  paymentMethod?: string,
): boolean {
  return (
    transactionType !== "expense" &&
    (cardId !== undefined || paymentMethod !== undefined)
  );
}

export function savingsRate(totalIncome: number, totalExpenses: number): number | null {
  if (totalIncome <= 0) return null;
  return ((totalIncome - totalExpenses) / totalIncome) * 100;
}

export function percentageChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return ((to - from) / Math.abs(from)) * 100;
}

export function roundFinancial(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function escapeIlikePattern(value: string): string {
  return value
    .trim()
    .slice(0, 100)
    .replace(/[\\%_]/g, "\\$&")
    .replace(/[^\p{L}\p{N}\s'’-]/gu, " ")
    .replace(/\s+/g, " ");
}

export function matchesScope(
  row: { user_id: string; shared_group_id: string | null },
  userId: string,
  scope: McpScope,
): boolean {
  if (scope === "personal") return row.user_id === userId;
  if (scope === "shared") return row.shared_group_id !== null;
  return true;
}

export function matchesTimeScope(
  date: string,
  timeScope: McpTimeScope,
  today: string,
): boolean {
  if (timeScope === "occurred") return date <= today;
  if (timeScope === "future") return date > today;
  return true;
}

function cursorValueIsValid(sortBy: McpSortBy, value: unknown): value is string | number {
  if (sortBy === "amount") {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
  }
  if (typeof value !== "string") return false;
  if (sortBy === "date") return isValidIsoDate(value);
  return ISO_TIMESTAMP_RE.test(value) && Number.isFinite(Date.parse(value));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!BASE64URL_RE.test(value)) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

export function normalizeUuidFilter(value: unknown): unknown {
  return typeof value === "string" && UUID_RE.test(value)
    ? value.toLowerCase()
    : value;
}

export function normalizeFingerprintFilters(
  filters: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [
      key,
      UUID_FILTER_KEYS.has(key) ? normalizeUuidFilter(value) : value,
    ]),
  );
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

export async function filtersFingerprint(
  context: string,
  filters: Record<string, unknown>,
): Promise<string> {
  const resolvedFilters = normalizeFingerprintFilters(filters);
  const normalized = {
    context,
    ...resolvedFilters,
    query:
      typeof resolvedFilters.query === "string"
        ? escapeIlikePattern(resolvedFilters.query).toLocaleLowerCase("pt-BR")
        : null,
  };
  return [...(await sha256Bytes(canonicalJson(normalized)))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getCursorSecret(): string | null {
  const value = process.env.MCP_CURSOR_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function encodeCursor(
  payload: Omit<CursorPayload, "version" | "issued_at" | "expires_at">,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const complete: CursorPayload = {
    version: CURSOR_VERSION,
    ...payload,
    id: String(normalizeUuidFilter(payload.id)),
    issued_at: issuedAt,
    expires_at: issuedAt + CURSOR_TTL_SECONDS,
  };
  const payloadBytes = new TextEncoder().encode(canonicalJson(complete));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), payloadBytes);
  return `${bytesToBase64Url(payloadBytes)}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function decodeCursor(
  encoded: string | undefined,
  expected: CursorExpectation,
  secret: string,
  now: Date = new Date(),
): Promise<CursorPayload | null> {
  if (!encoded) return null;
  try {
    const segments = encoded.split(".");
    if (segments.length !== 2) return null;
    const payloadBytes = base64UrlToBytes(segments[0]);
    const signatureBytes = base64UrlToBytes(segments[1]);
    if (!payloadBytes || !signatureBytes || signatureBytes.length !== 32) return null;
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      signatureBytes as unknown as ArrayBuffer,
      payloadBytes as unknown as ArrayBuffer,
    );
    if (!validSignature) return null;

    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as Partial<CursorPayload>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Object.keys(parsed).some((key) => !CURSOR_KEYS.has(key))
    ) {
      return null;
    }
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (
      parsed.version !== CURSOR_VERSION ||
      parsed.context !== expected.context ||
      parsed.sort_by !== expected.sort_by ||
      parsed.sort_order !== expected.sort_order ||
      (parsed.query_transaction_type !== "expense" &&
        parsed.query_transaction_type !== "income" &&
        parsed.query_transaction_type !== "all") ||
      parsed.query_transaction_type !== expected.query_transaction_type ||
      (parsed.last_item_type !== "expense" && parsed.last_item_type !== "income") ||
      (parsed.query_transaction_type === "expense" &&
        parsed.last_item_type !== "expense") ||
      (parsed.query_transaction_type === "income" &&
        parsed.last_item_type !== "income") ||
      parsed.filters_fingerprint !== expected.filters_fingerprint ||
      typeof parsed.filters_fingerprint !== "string" ||
      !SHA256_HEX_RE.test(parsed.filters_fingerprint) ||
      typeof parsed.id !== "string" ||
      !UUID_RE.test(parsed.id) ||
      !cursorValueIsValid(expected.sort_by, parsed.sort_value) ||
      typeof parsed.issued_at !== "number" ||
      !Number.isInteger(parsed.issued_at) ||
      typeof parsed.expires_at !== "number" ||
      !Number.isInteger(parsed.expires_at) ||
      parsed.expires_at <= parsed.issued_at ||
      parsed.issued_at > nowSeconds + 60 ||
      parsed.expires_at <= nowSeconds
    ) {
      return null;
    }
    return {
      ...(parsed as CursorPayload),
      id: String(normalizeUuidFilter(parsed.id)),
    };
  } catch {
    return null;
  }
}

export function sortValue(row: SortableTransaction, sortBy: McpSortBy): string | number {
  if (sortBy === "amount") return row.amount;
  if (sortBy === "created_at") return row.created_at;
  return row.date;
}

export function compareTransactions(
  left: SortableTransaction,
  right: SortableTransaction,
  sortBy: McpSortBy,
  sortOrder: McpSortOrder,
): number {
  const leftValue = sortValue(left, sortBy);
  const rightValue = sortValue(right, sortBy);
  const direction = sortOrder === "asc" ? 1 : -1;
  if (leftValue < rightValue) return -1 * direction;
  if (leftValue > rightValue) return 1 * direction;
  return left.id.localeCompare(right.id) * direction;
}

export function compareUnifiedTransactions(
  left: SortableTransaction & { transaction_type: McpTransactionType },
  right: SortableTransaction & { transaction_type: McpTransactionType },
  sortBy: McpSortBy,
  sortOrder: McpSortOrder,
): number {
  const leftValue = sortValue(left, sortBy);
  const rightValue = sortValue(right, sortBy);
  const direction = sortOrder === "asc" ? 1 : -1;
  if (leftValue < rightValue) return -1 * direction;
  if (leftValue > rightValue) return 1 * direction;

  // A ordem de tipo é fixa nos dois sentidos: expense antes de income.
  if (left.transaction_type !== right.transaction_type) {
    return left.transaction_type === "expense" ? -1 : 1;
  }
  return left.id.localeCompare(right.id) * direction;
}

export function unifiedCursorEqualValueMode(
  cursorType: McpTransactionType,
  rowType: McpTransactionType,
): "same_type" | "include_all_equal" | "exclude_all_equal" {
  if (cursorType === rowType) return "same_type";
  return cursorType === "expense" && rowType === "income"
    ? "include_all_equal"
    : "exclude_all_equal";
}

export function cursorForRow(
  row: SortableTransaction,
  context: string,
  sortBy: McpSortBy,
  sortOrder: McpSortOrder,
  filtersFingerprintValue: string,
  secret: string,
  queryTransactionType: McpQueryTransactionType,
  lastItemType: McpTransactionType,
): Promise<string> {
  return encodeCursor({
    context,
    sort_by: sortBy,
    sort_order: sortOrder,
    sort_value: sortValue(row, sortBy),
    id: row.id,
    query_transaction_type: queryTransactionType,
    last_item_type: lastItemType,
    filters_fingerprint: filtersFingerprintValue,
  }, secret);
}

export function cursorFilterExpression(
  column: string,
  cursor: CursorPayload,
): string {
  const operator = cursor.sort_order === "asc" ? "gt" : "lt";
  return `${column}.${operator}.${cursor.sort_value},and(${column}.eq.${cursor.sort_value},id.${operator}.${cursor.id})`;
}

export function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function isoWeekStart(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  const day = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() - day + 1);
  return parsed.toISOString().slice(0, 10);
}
