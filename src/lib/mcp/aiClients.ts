export type AiClientCategory = "consumer" | "advanced";

export type AiClientStatus =
  | "tested"
  | "supported"
  | "restricted"
  | "unavailable"
  | "advanced";

export type AiBrandIconId =
  | "claude"
  | "perplexity"
  | "chatgpt"
  | "gemini"
  | "microsoft-copilot"
  | "deepseek";

export type AiAdvancedIconId = "cursor" | "github";

export type AiClientIcon = AiBrandIconId | AiAdvancedIconId;

const aiBrandIconIds = new Set<AiClientIcon>([
  "claude",
  "perplexity",
  "chatgpt",
  "gemini",
  "microsoft-copilot",
  "deepseek",
]);

export function isAiBrandIcon(icon: AiClientIcon): icon is AiBrandIconId {
  return aiBrandIconIds.has(icon);
}

export type AiClientInstructionsDisplay = "list" | "collapsible";

export type AiClientExample = "mcp-server-json";

export interface AiClient {
  id: string;
  name: string;
  panelTitle: string;
  shortDescription: string;
  category: AiClientCategory;
  status: AiClientStatus;
  statusLabel: string;
  panelStatusLabel: string;
  availability: string;
  instructions: string[];
  instructionsDisplay?: AiClientInstructionsDisplay;
  instructionsTitle?: string;
  instructionsIntro?: string;
  notes: string[];
  example?: AiClientExample;
  icon: AiClientIcon;
}

export const AI_CLIENTS: AiClient[] = [
  {
    id: "claude",
    name: "Claude",
    panelTitle: "Como conectar ao Claude",
    shortDescription: "Conector remoto validado pelo Gastinho.",
    category: "consumer",
    status: "tested",
    statusLabel: "Disponível · Testado",
    panelStatusLabel: "Disponível — testado pelo Gastinho",
    availability:
      "A conexão com o Claude foi validada pelo Gastinho Simples. O Claude permite conectores MCP remotos nos planos Free, Pro, Max, Team e Enterprise. O plano gratuito pode ter limite de um conector personalizado.",
    instructions: [
      "Abra o Claude.",
      "Entre em Configurações.",
      "Abra Personalizar e depois Conectores.",
      "Selecione adicionar um conector personalizado.",
      "Use o nome “Gastinho Simples”.",
      "Cole o link MCP copiado nesta página.",
      "Clique em adicionar.",
      "Selecione Vincular ou Conectar.",
      "Entre na conta correta do Gastinho.",
      "Confira a tela de autorização.",
      "Clique em Aprovar.",
      "Abra uma nova conversa e habilite o conector Gastinho Simples.",
    ],
    notes: [
      "Esta integração já foi testada com consultas e criação de receitas e despesas.",
    ],
    icon: "claude",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    panelTitle: "Como conectar ao Perplexity",
    shortDescription: "Suporte remoto com OAuth, aguardando validação.",
    category: "consumer",
    status: "supported",
    statusLabel: "Disponível · Não testado",
    panelStatusLabel: "Disponível — ainda não testado pelo Gastinho",
    availability:
      "O Perplexity informa suporte a conectores MCP remotos com OAuth. A integração específica com o Gastinho ainda precisa ser validada.",
    instructions: [
      "Abra as configurações da sua conta no Perplexity.",
      "Entre em Connectors.",
      "Selecione “+ Custom connector”.",
      "Escolha Remote.",
      "Use o nome “Gastinho Simples”.",
      "Cole o link MCP desta página.",
      "Em autenticação, selecione OAuth.",
      "Em transporte, selecione Streamable HTTP.",
      "Confirme o aviso de segurança.",
      "Clique em Add.",
      "Abra o card do conector para iniciar a autenticação.",
      "Entre na conta correta do Gastinho e aprove o acesso.",
      "Abra uma nova conversa e habilite o conector.",
    ],
    notes: [
      "A disponibilidade pode depender do plano do Perplexity. Consulte as condições do seu plano antes de configurar.",
    ],
    icon: "perplexity",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    panelTitle: "Conectar ao ChatGPT",
    shortDescription: "Disponível somente em workspaces elegíveis.",
    category: "consumer",
    status: "restricted",
    statusLabel: "Planos empresariais",
    panelStatusLabel: "Somente planos empresariais",
    availability:
      "Atualmente, aplicativos MCP personalizados estão disponíveis no ChatGPT web para workspaces Business e Enterprise/Edu. Contas individuais Free, Plus ou Pro não conseguem adicionar diretamente este conector personalizado.",
    instructions: [
      "Um administrador ou proprietário do workspace deve habilitar o modo de desenvolvedor.",
      "Abra as configurações do workspace.",
      "Entre em Apps e selecione Create.",
      "Informe o nome “Gastinho Simples”.",
      "Cole o link MCP.",
      "Selecione OAuth quando solicitado.",
      "Use Scan Tools.",
      "Faça login no Gastinho e aprove o acesso.",
      "Conclua a criação e liberação do aplicativo no workspace.",
      "Em uma nova conversa, habilite o aplicativo Gastinho Simples.",
    ],
    notes: [
      "O procedimento e a disponibilidade podem ser controlados pelo administrador da organização.",
    ],
    icon: "chatgpt",
  },
  {
    id: "gemini",
    name: "Gemini",
    panelTitle: "Gemini",
    shortDescription: "Sem conexão direta no aplicativo comum.",
    category: "consumer",
    status: "unavailable",
    statusLabel: "Ainda não disponível",
    panelStatusLabel: "Ainda não disponível no aplicativo",
    availability:
      "O Google oferece suporte a servidores MCP remotos em APIs voltadas a desenvolvedores, mas o aplicativo comum do Gemini ainda não oferece uma opção simples para o usuário colar e conectar o link do Gastinho.",
    instructions: [],
    notes: [
      "Quando houver suporte direto para usuários comuns, esta página poderá ser atualizada.",
    ],
    icon: "gemini",
  },
  {
    id: "microsoft-copilot",
    name: "Microsoft Copilot",
    panelTitle: "Microsoft Copilot",
    shortDescription: "Uso empresarial por meio do Copilot Studio.",
    category: "consumer",
    status: "restricted",
    statusLabel: "Opção empresarial",
    panelStatusLabel: "Opção empresarial",
    availability:
      "O aplicativo pessoal do Microsoft Copilot não oferece atualmente um fluxo simples para colar este link. Empresas e desenvolvedores podem integrar servidores MCP por meio do Copilot Studio.",
    instructions: [
      "Abra o agente no Copilot Studio.",
      "Entre em Tools.",
      "Selecione Add a tool.",
      "Escolha New tool.",
      "Selecione Model Context Protocol.",
      "Informe nome, descrição e a URL do servidor.",
      "Em autenticação, escolha OAuth 2.0.",
      "Selecione Dynamic discovery.",
      "Crie a conexão e autentique na conta do Gastinho.",
      "Adicione a ferramenta ao agente.",
    ],
    instructionsDisplay: "collapsible",
    instructionsTitle: "Usar com Copilot Studio",
    instructionsIntro: "Configuração avançada para ambientes empresariais.",
    notes: [],
    icon: "microsoft-copilot",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    panelTitle: "DeepSeek",
    shortDescription: "Sem suporte direto no aplicativo comum.",
    category: "consumer",
    status: "unavailable",
    statusLabel: "Ainda não disponível",
    panelStatusLabel: "Ainda não disponível",
    availability:
      "O aplicativo comum do DeepSeek não oferece atualmente uma interface oficial para adicionar diretamente um servidor MCP remoto como o Gastinho.",
    instructions: [],
    notes: [
      "Modelos DeepSeek podem ser usados dentro de outras ferramentas de agentes compatíveis com MCP, mas isso não representa uma conexão direta no aplicativo DeepSeek.",
    ],
    icon: "deepseek",
  },
  {
    id: "cursor",
    name: "Cursor",
    panelTitle: "Cursor",
    shortDescription: "Configuração MCP remota para usuários técnicos.",
    category: "advanced",
    status: "advanced",
    statusLabel: "Uso avançado",
    panelStatusLabel: "Uso avançado",
    availability:
      "O Cursor aceita servidores MCP remotos e autenticação OAuth.",
    instructions: [
      "Use Configurações → Tools & MCP para adicionar o servidor pela interface.",
      "Como alternativa, use a configuração global em ~/.cursor/mcp.json.",
    ],
    example: "mcp-server-json",
    notes: ["Opção destinada a usuários técnicos."],
    icon: "cursor",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot / Visual Studio Code",
    panelTitle: "GitHub Copilot / Visual Studio Code",
    shortDescription: "Servidor MCP remoto no modo Agent.",
    category: "advanced",
    status: "advanced",
    statusLabel: "Uso avançado",
    panelStatusLabel: "Uso avançado",
    availability:
      "VS Code e GitHub Copilot aceitam servidores MCP locais e remotos.",
    instructions: [
      "Abra a Command Palette.",
      "Execute “MCP: Add Server”.",
      "Escolha HTTP.",
      "Cole o link MCP.",
      "Escolha configuração global ou do usuário.",
      "Faça a autenticação OAuth quando solicitada.",
      "Abra o Copilot Chat em modo Agent.",
      "Confira e habilite as ferramentas do Gastinho.",
    ],
    notes: [
      "Esta é uma opção para desenvolvedores, não a experiência recomendada para o público geral.",
    ],
    icon: "github",
  },
];

export const CONSUMER_AI_CLIENTS = AI_CLIENTS.filter(
  (client) => client.category === "consumer",
);

export const ADVANCED_AI_CLIENTS = AI_CLIENTS.filter(
  (client) => client.category === "advanced",
);
