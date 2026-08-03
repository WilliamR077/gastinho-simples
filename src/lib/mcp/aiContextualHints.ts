/**
 * Prompts de ajuda contextual com IA.
 *
 * Os textos ficam centralizados e tipados aqui para que as páginas nunca
 * dupliquem prompts. Nenhum dado financeiro, ID ou informação privada deve
 * ser incluído nestes textos: a IA conectada consulta os dados pelas tools
 * MCP do Gastinho Simples.
 */

export interface AiContextualHint {
  title: string;
  description: string;
  prompt: string;
  ariaLabel: string;
}

export type AiContextualHintKey = "reports" | "expenseCategories";

/** URL pública do Claude usada pelo botão "Abrir o Claude". Sem query strings. */
export const CLAUDE_WEB_URL = "https://claude.ai/new";

export const AI_CONTEXTUAL_HINTS: Record<AiContextualHintKey, AiContextualHint> = {
  reports: {
    title: "Analise seus relatórios com a IA",
    description:
      "Use este comando para entender tendências, variações e oportunidades de melhoria.",
    prompt:
      "Analise minhas receitas e despesas do período atual. Destaque as categorias que mais cresceram, os maiores gastos e três ações práticas para melhorar meu resultado financeiro.",
    ariaLabel: "Ajuda com IA sobre relatórios",
  },
  expenseCategories: {
    title: "Organize suas categorias com a IA",
    description:
      "Use este comando para encontrar categorias parecidas, duplicadas ou pouco utilizadas.",
    prompt:
      "Liste minhas categorias de despesas, identifique categorias duplicadas, parecidas ou pouco utilizadas e sugira uma organização mais simples. Não altere nada sem minha confirmação.",
    ariaLabel: "Ajuda com IA sobre categorias de despesas",
  },
};

/**
 * Monta o prompt de relatórios trocando "do período atual" pelo nome textual
 * do período selecionado na página. Apenas o rótulo do período é usado.
 */
export function buildReportsPrompt(periodLabel?: string): string {
  const base = AI_CONTEXTUAL_HINTS.reports.prompt;
  const label = periodLabel?.trim();
  if (!label) return base;
  return base.replace("do período atual", `de ${label}`);
}
