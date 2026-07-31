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

export const AI_COMMAND_EXAMPLES: AiCommandExample[] = [
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
  // Comandos já existentes na página anterior, preservados.
  { text: "Gastei R$ 35 de gasolina hoje.", category: "registrar" },
  { text: "Adicione uma receita de R$ 500 recebida hoje.", category: "registrar" },
  { text: "Liste minhas despesas dos últimos sete dias.", category: "consultar" },
  { text: "Mostre meu resumo financeiro deste mês.", category: "analisar" },
];

export const AI_COMMAND_NOTE =
  "O assistente pode solicitar dados ausentes, como forma de pagamento, categoria ou cartão utilizado.";

export const FEATURED_AI_COMMANDS = AI_COMMAND_EXAMPLES.filter(
  (example) => example.featured,
).slice(0, 3);
