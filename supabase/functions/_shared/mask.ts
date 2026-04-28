/**
 * Mask sensitive tokens/strings for logs.
 * Returns only the last 4 chars (preceded by '***') and never logs the full value.
 */
export function maskToken(value: string | null | undefined): string {
  if (!value) return '<empty>';
  const s = String(value);
  if (s.length <= 4) return '***';
  return `***${s.slice(-4)}`;
}

/**
 * Mask an email address: keeps the first char of local part and the domain.
 * e.g. "vitor.romao0442@gmail.com" -> "v***@gmail.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '<empty>';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.charAt(0)}***@${domain}`;
}
