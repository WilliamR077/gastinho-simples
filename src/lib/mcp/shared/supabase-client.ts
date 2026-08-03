import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Constrói um cliente Supabase por requisição, autenticado com o bearer
 * do contexto MCP. Nunca compartilhe o cliente entre requisições e nunca
 * use SERVICE_ROLE — RLS é a fonte de verdade do isolamento entre contas.
 */
export function supabaseForUser(ctx: ToolContext): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("SUPABASE_URL/PUBLISHABLE_KEY não configurados");
  }
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Forma mínima de um query builder do PostgREST usada pelas tools MCP.
 * Evita instanciações de tipo excessivamente profundas (TS2589) em selects
 * longos, mantendo os métodos realmente utilizados tipados.
 */
export type McpQueryResult = { data: unknown[] | null; error: unknown };

export type McpQueryLike = PromiseLike<McpQueryResult> & {
  eq(column: string, value: string | number | boolean): McpQueryLike;
  neq(column: string, value: string | number | boolean): McpQueryLike;
  not(column: string, operator: string, value: null): McpQueryLike;
  is(column: string, value: null): McpQueryLike;
  or(filter: string): McpQueryLike;
  gt(column: string, value: string | number): McpQueryLike;
  gte(column: string, value: string | number): McpQueryLike;
  lt(column: string, value: string | number): McpQueryLike;
  lte(column: string, value: string | number): McpQueryLike;
  in(column: string, values: readonly (string | number)[]): McpQueryLike;
  order(column: string, options?: { ascending?: boolean }): McpQueryLike;
  limit(count: number): McpQueryLike;
  range(from: number, to: number): McpQueryLike;
};
