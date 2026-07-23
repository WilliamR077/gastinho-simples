/**
 * Retorna o nome de exibição preferencial para um membro/usuário.
 * Prioriza `display_name` salvo em `profiles`. Como fallback, usa o
 * prefixo do e-mail (parte antes do '@'). Nunca expõe o e-mail completo.
 */
export interface DisplayableMember {
  display_name?: string | null;
  user_email?: string | null;
  email?: string | null;
}

export function getMemberDisplayName(
  member: DisplayableMember | null | undefined,
  fallback = "Membro"
): string {
  if (!member) return fallback;
  const name = (member.display_name || "").trim();
  if (name) return name;
  const email = member.user_email || member.email || "";
  if (email) return email.split("@")[0];
  return fallback;
}
