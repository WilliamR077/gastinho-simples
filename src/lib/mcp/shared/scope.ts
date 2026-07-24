/**
 * Fundação do tipo de escopo para tools MCP.
 *
 * IMPORTANTE (Fase 1.1A): este helper NÃO é aplicado silenciosamente às
 * tools existentes. A estratégia definitiva de consulta para `all_accessible`
 * ainda está sendo desenhada — ver docs/mcp/phase-1.1a-notes.md, seção
 * "Escopo". Antes de qualquer tool pública passar a usar `all_accessible`
 * ou `shared`, precisamos decidir entre:
 *
 *   1. Uma consulta única sob RLS, sem filtro de user_id (RLS filtra tanto
 *      linhas do próprio user quanto linhas de grupos que ele participa).
 *      Requer verificar que as políticas atuais realmente cobrem os dois
 *      caminhos com um único SELECT.
 *   2. Duas consultas (pessoal + compartilhada) e união em memória com
 *      dedup por id. Custa mais round-trips mas é explícito.
 *   3. Uma RPC dedicada (SECURITY INVOKER) que faz a união em SQL.
 *
 * Nenhuma dessas opções deve usar service_role.
 */

export type McpScope = "personal" | "shared" | "all_accessible";

export const DEFAULT_SCOPE: McpScope = "personal";

export function isScope(v: unknown): v is McpScope {
  return v === "personal" || v === "shared" || v === "all_accessible";
}
