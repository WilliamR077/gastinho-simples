/**
 * Sanitiza um path de redirect pós-login para evitar open redirect.
 * Aceita SOMENTE paths internos começando com "/" e que NÃO sejam
 * protocol-relative ("//...") nem URLs absolutas (http/https/etc).
 * Qualquer entrada inválida cai no fallback "/".
 */
export function safeInternalPath(input: unknown, fallback = "/"): string {
  if (typeof input !== "string") return fallback;
  const path = input.trim();
  if (path.length === 0) return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//")) return fallback;
  if (path.startsWith("/\\")) return fallback;
  // Rejeita qualquer URL absoluta acidentalmente serializada.
  if (/^https?:\/\//i.test(path)) return fallback;
  if (path.includes("\n") || path.includes("\r")) return fallback;
  return path;
}
