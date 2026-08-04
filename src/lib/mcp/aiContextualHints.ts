/**
 * Prompts de ajuda contextual com IA.
 *
 * Os textos ficam centralizados e tipados aqui para que as páginas nunca
 * dupliquem prompts. Nenhum dado financeiro, ID ou informação privada deve
 * ser incluído nestes textos: a IA conectada consulta os dados pelas tools
 * MCP do Gastinho Simples.
 */

export type AiContextualHintKey = "reports" | "expenseCategories";

/** Um prompt único, sempre pertencente a um contexto e a uma categoria. */
export interface AiContextualPrompt {
  /** Contexto (tela) ao qual o prompt pertence. */
  context: AiContextualHintKey;
  /** Categoria exibida como chip horizontal no modal. */
  category: string;
  /** Identificador estável, único dentro do contexto. */
  id: string;
  /** Título curto exibido na lista compacta de seleção. */
  title: string;
  /** Prompt completo, sem dados financeiros, IDs ou dados privados. */
  prompt: string;
}

export interface AiContextualHint {
  title: string;
  description: string;
  ariaLabel: string;
  prompts: AiContextualPrompt[];
}

/** URL pública do Claude usada pelo botão "Copiar e abrir o Claude". */
export const CLAUDE_WEB_URL = "https://claude.ai/new";

const REPORTS_PROMPTS: AiContextualPrompt[] = [
  {
    context: "reports",
    category: "Resumo",
    id: "reports-full-analysis",
    title: "Análise completa",
    prompt:
      "Analise minhas finanças no Gastinho. Comece informando exatamente quais períodos você utilizou e se cada período está completo. Se o mês atual estiver em andamento, apresente separadamente o mês até hoje comparado ao mesmo número de dias do mês anterior e o último mês completo comparado ao mês completo anterior. Considere receitas e despesas registradas, recorrências, parcelas e cartões quando essas fontes estiverem disponíveis. Declare qualquer limitação. Mostre variações em reais e percentual, maiores gastos, compromissos futuros e três ações práticas. Não altere nada sem minha confirmação.",
  },
  {
    context: "reports",
    category: "Comparar",
    id: "reports-month-vs-month",
    title: "Mês contra mês",
    prompt:
      "Compare o mês atual até hoje com o mesmo número de dias do mês anterior. Mostre as diferenças em reais e percentual, destacando as variações com maior impacto financeiro. Não compare um mês parcial com um mês completo sem explicar.",
  },
  {
    context: "reports",
    category: "Comparar",
    id: "reports-year-vs-year",
    title: "Ano contra ano",
    prompt:
      "Compare este ano até hoje com o mesmo período do ano anterior. Destaque mudanças nas receitas registradas, despesas, saldo e principais categorias. Mostre valores absolutos e percentuais.",
  },
  {
    context: "reports",
    category: "Tendências",
    id: "reports-last-six-months",
    title: "Últimos seis meses",
    prompt:
      "Analise a evolução dos meus gastos nos últimos seis meses. Identifique tendências persistentes, gastos pontuais, categorias que cresceram e mudanças relevantes no saldo.",
  },
  {
    context: "reports",
    category: "Economizar",
    id: "reports-saving-opportunities",
    title: "Oportunidades",
    prompt:
      "Separe meus gastos entre recorrentes, parcelados e pontuais. Sugira três reduções realistas, priorizando despesas com maior impacto e menor prejuízo para minha rotina. Não altere nada sem minha confirmação.",
  },
  {
    context: "reports",
    category: "Planejar",
    id: "reports-next-months",
    title: "Próximos meses",
    prompt:
      "Considere minhas despesas recorrentes, parcelas e compromissos no cartão. Projete os próximos três meses e destaque períodos de maior aperto financeiro, riscos e ações preventivas.",
  },
];

const EXPENSE_CATEGORIES_PROMPTS: AiContextualPrompt[] = [
  {
    context: "expenseCategories",
    category: "Diagnóstico",
    id: "categories-full-usage",
    title: "Uso completo",
    prompt:
      "Analise minhas categorias de despesas considerando separadamente as transações efetivamente lançadas nos últimos 12 meses e as despesas recorrentes ou fixas ativas. Não classifique uma categoria como nunca usada antes de verificar as duas fontes. Declare qualquer limitação de consulta.",
  },
  {
    context: "expenseCategories",
    category: "Duplicidades",
    id: "categories-overlaps",
    title: "Sobreposições",
    prompt:
      "Liste minhas categorias de despesas e identifique nomes duplicados, categorias conceitualmente parecidas e categorias com finalidades sobrepostas. Sugira possíveis combinações, mas não altere nada sem minha confirmação.",
  },
  {
    context: "expenseCategories",
    category: "Pouco uso",
    id: "categories-real-usage",
    title: "Uso real",
    prompt:
      "Identifique categorias com poucos lançamentos, mas verifique também se elas possuem despesas recorrentes ou fixas ativas. Separe categorias realmente sem uso daquelas utilizadas somente em recorrências. Não altere nada.",
  },
  {
    context: "expenseCategories",
    category: "Simplificar",
    id: "categories-organization-plan",
    title: "Plano de organização",
    prompt:
      "Considere meus lançamentos e despesas recorrentes e proponha uma estrutura mais simples de categorias. Explique o que manter, combinar, renomear ou desativar. Não execute nenhuma mudança sem minha confirmação.",
  },
];

export const AI_CONTEXTUAL_HINTS: Record<AiContextualHintKey, AiContextualHint> = {
  reports: {
    title: "Analise seus relatórios com a IA",
    description:
      "Escolha um comando pronto e cole no seu assistente para entender tendências, variações e oportunidades.",
    ariaLabel: "Ajuda com IA sobre relatórios",
    prompts: REPORTS_PROMPTS,
  },
  expenseCategories: {
    title: "Organize suas categorias com a IA",
    description:
      "Escolha um comando pronto para encontrar categorias parecidas, duplicadas ou pouco utilizadas.",
    ariaLabel: "Ajuda com IA sobre categorias de despesas",
    prompts: EXPENSE_CATEGORIES_PROMPTS,
  },
};

/**
 * Aplica o rótulo textual do período selecionado aos prompts de relatórios.
 * Apenas o rótulo do período é usado — nenhum dado financeiro.
 */
export function buildReportsPrompts(periodLabel?: string): AiContextualPrompt[] {
  const label = periodLabel?.trim();
  if (!label) return REPORTS_PROMPTS;
  return REPORTS_PROMPTS.map((item) => ({
    ...item,
    prompt: item.prompt.replace("no Gastinho.", `no Gastinho, considerando ${label}.`),
  }));
}
