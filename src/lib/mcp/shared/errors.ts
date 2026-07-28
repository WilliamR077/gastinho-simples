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
  INVALID_AMOUNT_RANGE: "INVALID_AMOUNT_RANGE",
  INVALID_CURSOR: "INVALID_CURSOR",
  INVALID_SCOPE: "INVALID_SCOPE",
  INVALID_TIME_SCOPE: "INVALID_TIME_SCOPE",
  INVALID_SORT: "INVALID_SORT",
  INVALID_TRANSACTION_TYPE: "INVALID_TRANSACTION_TYPE",
  INVALID_FILTER_COMBINATION: "INVALID_FILTER_COMBINATION",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  CONCURRENT_MODIFICATION: "CONCURRENT_MODIFICATION",
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_PATCH: "INVALID_PATCH",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
  CATEGORY_NOT_FOUND: "CATEGORY_NOT_FOUND",
  CARD_NOT_FOUND: "CARD_NOT_FOUND",
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  WRITE_FAILED: "WRITE_FAILED",
  INVALID_CARD_TYPE: "INVALID_CARD_TYPE",
  INVALID_DATA: "INVALID_DATA",
  DATE_RANGE_TOO_LARGE: "DATE_RANGE_TOO_LARGE",
  RESULT_SET_TOO_LARGE: "RESULT_SET_TOO_LARGE",
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
  INVALID_AMOUNT_RANGE: "Intervalo de valores inválido: min_amount deve ser <= max_amount.",
  INVALID_CURSOR: "Cursor inválido ou incompatível com a ordenação solicitada.",
  INVALID_SCOPE: "Escopo inválido. Use personal, shared ou all_accessible.",
  INVALID_TIME_SCOPE: "Escopo temporal inválido. Use occurred, future ou all.",
  INVALID_SORT: "Ordenação inválida.",
  INVALID_TRANSACTION_TYPE: "Tipo de transação inválido.",
  INVALID_FILTER_COMBINATION:
    "card_id e payment_method são exclusivos de despesas. Repita a consulta com transaction_type=expense.",
  RESOURCE_NOT_FOUND: "Recurso não encontrado para a conta autenticada.",
  CONCURRENT_MODIFICATION:
    "O lançamento foi alterado desde a leitura. Releia o registro antes de tentar novamente.",
  INVALID_INPUT: "Os parâmetros da atualização são inválidos.",
  INVALID_PATCH: "O conjunto de alterações é inválido ou está vazio.",
  CONFIRMATION_REQUIRED: "A operação exige confirmação explícita.",
  CATEGORY_NOT_FOUND: "Categoria não encontrada para a conta autenticada.",
  CARD_NOT_FOUND: "Cartão não encontrado para a conta autenticada.",
  BUSINESS_RULE_VIOLATION: "A alteração viola uma regra do lançamento.",
  WRITE_FAILED: "Não foi possível aplicar a atualização.",
  INVALID_CARD_TYPE: "Tipo de cartão inválido. Use credit, debit ou both.",
  INVALID_DATA: "Os dados informados são inválidos.",
  DATE_RANGE_TOO_LARGE: "Intervalo de datas excede o máximo permitido de 366 dias.",
  RESULT_SET_TOO_LARGE: "O conjunto de resultados excede o limite seguro. Reduza o intervalo ou refine os filtros.",
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
