// Shared CORS allowlist for sensitive edge functions.
// Phase 1 hardening: replace wildcard origin with an explicit allowlist.

const ALLOWED_ORIGINS = new Set<string>([
  "https://gastinho-simples.lovable.app",
  "https://id-preview--a1f2a0b1-38be-4811-8b36-2e341ccca268.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
  "capacitor://localhost",
  "https://localhost",
]);

export function buildCorsHeaders(
  origin: string | null,
  extraAllowHeaders = ""
): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "";
  const baseHeaders = "authorization, x-client-info, apikey, content-type";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": extraAllowHeaders
      ? `${baseHeaders}, ${extraAllowHeaders}`
      : baseHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
