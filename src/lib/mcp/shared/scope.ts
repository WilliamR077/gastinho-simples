/**
 * Fundação do tipo de escopo para tools MCP.
 *
 * Fase 1.1B: as policies SELECT reais de expenses e incomes foram verificadas.
 * Elas permitem linhas próprias ou linhas cujo shared_group_id pertence a um
 * grupo acessível por is_group_member(...). Assim, shared/all_accessible podem
 * confiar adicionalmente na RLS usando o bearer do usuário; personal mantém o
 * filtro explícito por user_id. Nenhuma opção usa service_role.
 */

export type McpScope = "personal" | "shared" | "all_accessible";

export const DEFAULT_SCOPE: McpScope = "personal";

export function isScope(v: unknown): v is McpScope {
  return v === "personal" || v === "shared" || v === "all_accessible";
}
