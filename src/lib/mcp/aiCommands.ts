export type AiCommandCategory =
  | "registrar"
  | "consultar"
  | "analisar"
  | "organizar";

export interface AiCommandCategoryOption {
  id: AiCommandCategory;
  label: string;
}

export const AI_COMMAND_CATEGORIES: AiCommandCategoryOption[] = [
  { id: "registrar", label: "Registrar" },
  { id: "consultar", label: "Consultar" },
  { id: "analisar", label: "Analisar" },
  { id: "organizar", label: "Organizar" },
];

export interface AiCommandExample {
  text: string;
  category: AiCommandCategory;
  /** Destacado na página principal (máximo de três). */
  featured?: boolean;
}

/**
 * Todos os exemplos abaixo correspondem a ferramentas realmente existentes no
 * servidor MCP do Gastinho (src/lib/mcp/tools). Nenhum texto cita nomes de
 * ferramentas, parâmetros ou JSON.
 */
export const AI_COMMAND_EXAMPLES: AiCommandExample[] = [
  // ————— Destaques —————
  {
    text: "Adicione uma despesa de R$ 48,90 em supermercado hoje.",
    category: "registrar",
    featured: true,
  },
  {
    text: "Quanto gastei com alimentação este mês?",
    category: "consultar",
    featured: true,
  },
  {
    text: "Mostre minhas categorias e sugira uma organização mais simples.",
    category: "organizar",
    featured: true,
  },

  // ————— Registrar —————
  { text: "Gastei R$ 35 de gasolina hoje.", category: "registrar" },
  {
    text: "Adicione uma receita de R$ 500 recebida hoje.",
    category: "registrar",
  },
  {
    text: "Registre uma compra de R$ 320 no meu cartão de crédito.",
    category: "registrar",
  },
  {
    text: "Lance uma compra de R$ 1.200 em 6 parcelas no cartão.",
    category: "registrar",
  },
  {
    text: "Crie uma despesa recorrente de R$ 120 de internet todo dia 10.",
    category: "registrar",
  },
  {
    text: "Cadastre meu salário como receita recorrente todo dia 5.",
    category: "registrar",
  },
  {
    text: "Corrija o valor da última despesa que eu registrei para R$ 52,00.",
    category: "registrar",
  },
  {
    text: "Apague a despesa duplicada de mercado de ontem.",
    category: "registrar",
  },

  // ————— Consultar —————
  {
    text: "Liste minhas despesas dos últimos sete dias.",
    category: "consultar",
  },
  {
    text: "Quais foram minhas receitas deste mês?",
    category: "consultar",
  },
  {
    text: "Mostre meus cartões cadastrados e o uso do limite de cada um.",
    category: "consultar",
  },
  {
    text: "Quais parcelas vão cair na fatura do próximo mês?",
    category: "consultar",
  },
  {
    text: "Como estão minhas metas e quanto falta para cada uma?",
    category: "consultar",
  },
  {
    text: "Quais lançamentos recorrentes eu tenho ativos?",
    category: "consultar",
  },
  {
    text: "Quanto devo pagar de contas recorrentes nos próximos 30 dias?",
    category: "consultar",
  },
  {
    text: "Liste meus grupos compartilhados e quem participa deles.",
    category: "consultar",
  },
  {
    text: "Como está o acerto de contas do meu grupo da casa?",
    category: "consultar",
  },
  {
    text: "Procure todas as transações com “farmácia” nos últimos três meses.",
    category: "consultar",
  },
  {
    text: "Como foi dividida a despesa do jantar do grupo?",
    category: "consultar",
  },

  // ————— Analisar —————
  {
    text: "Mostre meu resumo financeiro deste mês.",
    category: "analisar",
  },
  {
    text: "Compare meus gastos deste mês com o mês passado.",
    category: "analisar",
  },
  {
    text: "Quais foram minhas cinco maiores despesas do mês?",
    category: "analisar",
  },
  {
    text: "Como minhas categorias evoluíram nos últimos três meses?",
    category: "analisar",
  },
  {
    text: "Sobrou ou faltou dinheiro no meu mês? Explique o resultado.",
    category: "analisar",
  },
  {
    text: "Qual foi minha taxa de economia nos últimos seis meses?",
    category: "analisar",
  },
  {
    text: "Mostre a distribuição dos meus gastos por categoria neste mês.",
    category: "analisar",
  },
  {
    text: "Faça uma projeção do meu saldo para os próximos meses.",
    category: "analisar",
  },
  {
    text: "Quanto cada pessoa gastou e deve receber no grupo este mês?",
    category: "analisar",
  },

  // ————— Organizar —————
  {
    text: "Crie uma categoria de despesa chamada Educação.",
    category: "organizar",
  },
  {
    text: "Renomeie a categoria Lazer para Diversão.",
    category: "organizar",
  },
  {
    text: "Quais categorias eu quase não uso? Sugira o que remover.",
    category: "organizar",
  },
  {
    text: "Cadastre um cartão novo com limite de R$ 3.000 e vencimento dia 15.",
    category: "organizar",
  },
  {
    text: "Atualize o limite do meu cartão principal para R$ 5.000.",
    category: "organizar",
  },
  {
    text: "Pause a despesa recorrente da academia.",
    category: "organizar",
  },
  {
    text: "Crie uma meta de gastar no máximo R$ 600 com alimentação por mês.",
    category: "organizar",
  },
  {
    text: "Ajuste minha meta de economia para R$ 1.000 por mês.",
    category: "organizar",
  },
  {
    text: "Renomeie meu grupo compartilhado para Casa 2026.",
    category: "organizar",
  },
  {
    text: "Mostre minhas preferências de notificação e desative os alertas de metas.",
    category: "organizar",
  },
  {
    text: "Atualize meu nome de exibição no perfil.",
    category: "organizar",
  },
];

export const AI_COMMAND_NOTE =
  "O assistente pode solicitar dados ausentes, como forma de pagamento, categoria ou cartão utilizado.";

export const FEATURED_AI_COMMANDS = AI_COMMAND_EXAMPLES.filter(
  (example) => example.featured,
).slice(0, 3);
