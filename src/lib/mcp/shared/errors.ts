/**
 * Códigos de erro estáveis retornados pelas tools MCP.
 * Não incluir stack trace, SQL, mensagens do Postgres cruas ou detalhes
 * internos no payload devolvido ao cliente MCP.
 */
export const MCP_ERROR_CODES = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_DATE: "INVALID_DATE",
  INVALID_DATE_RANGE: "INVALID_DATE_RANGE",
  INVALID_LIMIT: "INVALID_LIMIT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type McpErrorCode = keyof typeof MCP_ERROR_CODES;

export interface McpToolError {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
  structuredContent: { error: { code: McpErrorCode; message: string } };
}

const MESSAGES: Record<McpErrorCode, string> = {
  UNAUTHENTICATED: "Não autenticado. Conecte sua conta do Gastinho Simples.",
  FORBIDDEN: "Você não tem permissão para acessar este recurso.",
  INVALID_DATE: "Data inválida. Use o formato YYYY-MM-DD.",
  INVALID_DATE_RANGE: "Intervalo de datas inválido: start_date deve ser <= end_date.",
  INVALID_LIMIT: "Limite inválido.",
  INTERNAL_ERROR: "Erro interno ao processar a solicitação.",
};

export function mcpError(code: McpErrorCode, override?: string): McpToolError {
  const message = override ?? MESSAGES[code];
  return {
    isError: true,
    content: [{ type: "text", text: message }],
    structuredContent: { error: { code, message } },
  };
}
