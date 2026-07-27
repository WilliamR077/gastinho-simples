import {
  CURSOR_TTL_SECONDS,
  CURSOR_VERSION,
  canonicalJson,
  normalizeUuidFilter,
} from "./phase-1.1b-core";

export type ResourceSortOrder = "asc" | "desc";

export interface ResourceCursorPayload {
  version: 3;
  context: string;
  sort_by: string;
  sort_order: ResourceSortOrder;
  sort_value: string;
  id: string;
  filters_fingerprint: string;
  issued_at: number;
  expires_at: number;
}

export interface ResourceCursorExpectation {
  context: string;
  sort_by: string;
  sort_order: ResourceSortOrder;
  filters_fingerprint: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const CURSOR_KEYS = new Set([
  "version",
  "context",
  "sort_by",
  "sort_order",
  "sort_value",
  "id",
  "filters_fingerprint",
  "issued_at",
  "expires_at",
]);

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

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function encodeResourceCursor(
  payload: Omit<ResourceCursorPayload, "version" | "issued_at" | "expires_at">,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const complete: ResourceCursorPayload = {
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

export async function decodeResourceCursor(
  encoded: string | undefined,
  expected: ResourceCursorExpectation,
  secret: string,
  now: Date = new Date(),
): Promise<ResourceCursorPayload | null> {
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
      signatureBytes,
      payloadBytes,
    );
    if (!validSignature) return null;

    const parsed = JSON.parse(
      new TextDecoder().decode(payloadBytes),
    ) as Partial<ResourceCursorPayload>;
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Object.keys(parsed).some((key) => !CURSOR_KEYS.has(key)) ||
      parsed.version !== CURSOR_VERSION ||
      parsed.context !== expected.context ||
      parsed.sort_by !== expected.sort_by ||
      parsed.sort_order !== expected.sort_order ||
      parsed.filters_fingerprint !== expected.filters_fingerprint ||
      typeof parsed.filters_fingerprint !== "string" ||
      !SHA256_HEX_RE.test(parsed.filters_fingerprint) ||
      typeof parsed.sort_value !== "string" ||
      typeof parsed.id !== "string" ||
      !UUID_RE.test(parsed.id) ||
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
      ...(parsed as ResourceCursorPayload),
      id: String(normalizeUuidFilter(parsed.id)),
    };
  } catch {
    return null;
  }
}

function postgrestValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function resourceCursorFilterExpression(
  column: string,
  cursor: ResourceCursorPayload,
): string {
  const operator = cursor.sort_order === "asc" ? "gt" : "lt";
  const value = postgrestValue(cursor.sort_value);
  return `${column}.${operator}.${value},and(${column}.eq.${value},id.${operator}.${cursor.id})`;
}
