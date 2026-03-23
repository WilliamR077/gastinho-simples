export type SubstepActionType =
  | "navigate"
  | "click"
  | "fill"
  | "select"
  | "optional-group"
  | "submit"
  | "completion"
  | "info";

export interface OnboardingSubstep {
  id: string;
  targetSelector?: string; // value for data-onboarding="..."
  actionType: SubstepActionType;
  title: string;
  description: string;
  emoji: string;
  placement?: "above" | "below" | "auto";
  // Completion rules
  autoAdvanceOnClick?: boolean;
  autoAdvanceOnRoute?: string;
  requiresValidation?: boolean;
  validationSelector?: string; // if different from targetSelector
  autoAdvanceOnEvent?: string; // advance when notifyEvent(name) is called
  skipLabel?: string;
  focusTarget?: boolean;
  scrollToTarget?: boolean;
  // For navigate substeps
  navigateTo?: string;
  navigateLabel?: string;
  // For completion substeps
  repeatLabel?: string;
  proceedLabel?: string;
  // Conditional: skip this substep if condition not met
  condition?: (ctx: { formElement?: HTMLElement }) => boolean;
}

export interface OnboardingStepConfig {
  id: string;
  label: string;
  emoji: string;
  detectionTable?: string;
  targetRoute?: string;
  optional?: boolean;
  mobileOnly?: boolean;
  noDetection?: boolean;
  substeps: OnboardingSubstep[];
}

// ─── Cards step substeps ──────────────────────────────────────
const CARDS_SUBSTEPS: OnboardingSubstep[] = [
  {
    id: "go-to-cards",
    actionType: "navigate",
    title: "Configure seu Primeiro Cartão",
    description: "Vamos cadastrar seu primeiro cartão! Pode ser de crédito ou débito.",
    emoji: "🏦",
    navigateTo: "/cards",
    navigateLabel: "Ir para Cartões",
    autoAdvanceOnRoute: "/cards",
  },
  {
    id: "click-add-card",
    actionType: "click",
    targetSelector: "cards-add-btn",
    title: "Adicione seu Cartão",
    description: "Clique aqui para adicionar seu primeiro cartão.",
    emoji: "👆",
    autoAdvanceOnEvent: "card-form-opened",
    scrollToTarget: true,
    placement: "below",
  },
  {
    id: "fill-card-name",
    actionType: "fill",
    targetSelector: "card-name-input",
    title: "Nome do Cartão",
    description: 'Digite o nome do seu cartão, por exemplo "Nubank" ou "Inter".',
    emoji: "📝",
    requiresValidation: true,
    focusTarget: true,
    scrollToTarget: true,
    placement: "below",
  },
  {
    id: "select-card-type",
    actionType: "select",
    targetSelector: "card-type-select",
    title: "Tipo do Cartão",
    description: "Escolha se o cartão é de crédito, débito ou ambos.",
    emoji: "💳",
    requiresValidation: true,
    scrollToTarget: true,
    placement: "below",
  },
  {
    id: "fill-due-day",
    actionType: "fill",
    targetSelector: "card-due-day-input",
    title: "Dia de Vencimento",
    description: "Informe o dia de vencimento da fatura (1 a 31).",
    emoji: "📅",
    requiresValidation: true,
    focusTarget: true,
    scrollToTarget: true,
    placement: "below",
    condition: () => {
      const el = document.querySelector('[data-onboarding="card-due-day-input"]');
      return !!el;
    },
  },
  {
    id: "fill-close-days",
    actionType: "fill",
    targetSelector: "card-close-days-input",
    title: "Dias Antes do Vencimento",
    description: "Quantos dias antes do vencimento a fatura fecha? Geralmente 7 a 12 dias.",
    emoji: "🔢",
    requiresValidation: true,
    focusTarget: true,
    scrollToTarget: true,
    placement: "below",
    condition: () => {
      const el = document.querySelector('[data-onboarding="card-close-days-input"]');
      return !!el;
    },
  },
  {
    id: "optional-limit",
    actionType: "optional-group",
    targetSelector: "card-limit-input",
    title: "Limite do Cartão (Opcional)",
    description: "Se quiser, defina o limite do cartão. Pode pular se preferir.",
    emoji: "💰",
    skipLabel: "Pular",
    scrollToTarget: true,
    placement: "below",
  },
  {
    id: "select-card-color",
    actionType: "optional-group",
    targetSelector: "card-color-picker",
    title: "Cor do Cartão",
    description: "Escolha uma cor para identificar seu cartão visualmente.",
    emoji: "🎨",
    scrollToTarget: true,
    placement: "below",
  },
  {
    id: "submit-card",
    actionType: "submit",
    targetSelector: "card-submit-btn",
    title: "Salvar Cartão",
    description: 'Agora clique em "Adicionar" para salvar seu cartão.',
    emoji: "✅",
    autoAdvanceOnEvent: "card-submitted",
    scrollToTarget: true,
    placement: "above",
  },
  {
    id: "card-created",
    actionType: "completion",
    title: "Cartão Criado! 🎉",
    description: "Seu cartão foi adicionado com sucesso! Deseja adicionar outro ou prosseguir?",
    emoji: "🎉",
    repeatLabel: "Adicionar outro",
    proceedLabel: "Prosseguir",
  },
];

// ─── Expense step substeps (field-by-field) ───────────────────
const EXPENSE_SUBSTEPS: OnboardingSubstep[] = [
  {
    id: "expense-intro",
    actionType: "info",
    title: "Registre seu Primeiro Gasto",
    description: "Qual foi a última coisa que você gastou? Vamos registrar sua primeira despesa. Clique no botão \"+\" para começar!",
    emoji: "💸",
  },
  {
    id: "expense-click-fab",
    actionType: "click",
    targetSelector: "fab-main-button",
    title: "Abra o Menu",
    description: 'Toque no botão "+" para abrir as opções.',
    emoji: "👆",
    autoAdvanceOnEvent: "fab-menu-opened",
    scrollToTarget: true,
    placement: "above",
  },
  {
    id: "expense-click-btn",
    actionType: "click",
    targetSelector: "fab-expense-button",
    title: "Selecione Despesa",
    description: 'Agora toque em "Despesa" para abrir o formulário.',
    emoji: "📝",
    autoAdvanceOnEvent: "expense-form-opened",
    scrollToTarget: true,
    placement: "above",
  },
  {
    id: "expense-type-info",
    actionType: "info",
    targetSelector: "expense-type-selector",
    title: "Tipo de Despesa",
    description: "Estamos adicionando uma Despesa do Mês. No próximo passo você aprenderá sobre Despesas Fixas (recorrentes).",
    emoji: "📋",
    scrollToTarget: true,
    placement: "below",
  },
  {
    id: "expense-description",
    actionType: "fill",
    targetSelector: "expense-description",
    title: "Descrição",
    description: "O que você comprou? Ex: Almoço, Uber, Mercado...",
    emoji: "📝",
    requiresValidation: true,
    focusTarget: true,
    scrollToTarget: true,
    placement: "below",
  },
  {
    id: "expense-amount",
    actionType: "fill",
    targetSelector: "expense-amount",
    title: "Valor",
    description: "Agora informe quanto você gastou.",
    emoji: "💵",
    requiresValidation: true,
    focusTarget: true,
    scrollToTarget: true,
    placement: "below",
  },
  {
    id: "expense-date",
    actionType: "optional-group",
    targetSelector: "expense-date",
    title: "Data do Gasto",
    description: "Selecione a data em que esse gasto aconteceu. A data de hoje já vem preenchida.",
    emoji: "📅",
    skipLabel: "Manter hoje",
    scrollToTarget: true,
    placement: "below",
  },
  {
    id: "expense-category",
    actionType: "select",
    targetSelector: "expense-category-field",
    title: "Escolha a Categoria",
    description: "Essas são as categorias padrão. Escolha uma ou, se quiser, gerencie suas categorias pelo botão no final da lista.",
    emoji: "📦",
    requiresValidation: true,
    scrollToTarget: true,
    placement: "below",
  },
  {
    id: "expense-payment",
    actionType: "select",
    targetSelector: "expense-payment",
    title: "Forma de Pagamento",
    description: "Agora escolha como esse gasto foi pago: PIX, débito ou crédito.",
    emoji: "💳",
    requiresValidation: true,
    scrollToTarget: true,
    placement: "below",
  },
  {
    id: "expense-card",
    actionType: "select",
    targetSelector: "expense-card-select",
    title: "Selecione o Cartão",
    description: "Escolha qual cartão você usou para esse gasto.",
    emoji: "💳",
    requiresValidation: true,
    scrollToTarget: true,
    placement: "below",
    condition: () => {
      return !!document.querySelector('[data-onboarding="expense-card-select"]');
    },
  },
  {
    id: "expense-installments",
    actionType: "select",
    targetSelector: "expense-installments",
    title: "Parcelas",
    description: "Escolha em quantas vezes esse gasto foi parcelado.",
    emoji: "🔢",
    requiresValidation: true,
    scrollToTarget: true,
    placement: "below",
    condition: () => {
      return !!document.querySelector('[data-onboarding="expense-installments"]');
    },
  },
  {
    id: "expense-submit",
    actionType: "submit",
    targetSelector: "expense-submit-btn",
    title: "Salvar Despesa",
    description: 'Perfeito! Agora clique em "Adicionar Despesa" para salvar seu primeiro gasto.',
    emoji: "✅",
    autoAdvanceOnEvent: "expense-submitted",
    scrollToTarget: true,
    placement: "above",
  },
  {
    id: "expense-done",
    actionType: "completion",
    title: "Despesa Registrada! 🎉",
    description: "Sua primeira despesa foi cadastrada com sucesso!",
    emoji: "🎉",
    proceedLabel: "Prosseguir",
  },
];

// ─── Step labels for completion dialog ────────────────────────
export const STEP_LABELS: Record<string, string> = {
  "add-card": "Cartões configurados",
  "add-expense": "Primeira despesa registrada",
  "add-recurring-expense": "Despesas fixas cadastradas",
  "add-income": "Primeira receita registrada",
  "add-budget-goal": "Meta de gastos definida",
  "view-reports": "Relatórios conhecidos",
  "setup-security": "Segurança configurada",
  "import-spreadsheet": "Planilha importada",
};

// ─── All onboarding steps ─────────────────────────────────────
export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  // ── PASSO 1: Cartão ─────────────────────────────────
  {
    id: "add-card",
    label: "Cartões",
    emoji: "🏦",
    detectionTable: "cards",
    targetRoute: "/cards",
    substeps: CARDS_SUBSTEPS,
  },
  // ── PASSO 2: Despesa do Mês (com categorias integradas) ──
  {
    id: "add-expense",
    label: "Despesas",
    emoji: "💸",
    detectionTable: "expenses",
    substeps: EXPENSE_SUBSTEPS,
  },
  // ── PASSO 3: Despesa Fixa ───────────────────────────
  {
    id: "add-recurring-expense",
    label: "Despesas Fixas",
    emoji: "🔄",
    detectionTable: "recurring_expenses",
    substeps: [
      {
        id: "recurring-intro",
        actionType: "info",
        title: "Cadastre uma Despesa Fixa",
        description: "Pense em algo que você paga todo mês: aluguel, academia, internet, streaming... Cadastre para o app lançar automaticamente!",
        emoji: "🔄",
        navigateLabel: "Continuar",
        skipLabel: "Pular esta etapa",
      },
    ],
  },
  // ── PASSO 4: Entradas (3 tipos) ─────────────────────
  {
    id: "add-income",
    label: "Entradas",
    emoji: "💰",
    detectionTable: "incomes",
    substeps: [
      {
        id: "income-intro",
        actionType: "info",
        title: "Como você recebe dinheiro?",
        description: "Você pode registrar 3 tipos de entrada:\n\n💰 Entrada do mês — freelance, venda, bônus\n🔄 Entrada fixa — salário mensal\n📑 Entrada parcelada — projeto/venda parcelada\n\nEscolha o tipo que mais combina com você no formulário.",
        emoji: "💰",
        navigateLabel: "Continuar",
        skipLabel: "Pular esta etapa",
      },
    ],
  },
  // ── PASSO 5: Metas ──────────────────────────────────
  {
    id: "add-budget-goal",
    label: "Metas",
    emoji: "🎯",
    detectionTable: "budget_goals",
    substeps: [
      {
        id: "budget-intro",
        actionType: "info",
        title: "Controle seus Gastos com Metas",
        description: "Defina um limite de gastos para o mês! Você pode criar uma meta geral ou por categoria. Recomendamos começar com um limite mensal total.",
        emoji: "🎯",
        navigateLabel: "Continuar",
        skipLabel: "Pular esta etapa",
      },
    ],
  },
  // ── PASSO 6: Relatórios (NOVO) ──────────────────────
  {
    id: "view-reports",
    label: "Relatórios",
    emoji: "📊",
    noDetection: true,
    substeps: [
      {
        id: "reports-intro",
        actionType: "info",
        title: "Conheça seus Relatórios",
        description: "Aqui você acompanha sua vida financeira com clareza: gastos por categoria, fluxo de caixa, evolução dos gastos e muito mais.",
        emoji: "📊",
      },
      {
        id: "reports-navigate",
        actionType: "navigate",
        title: "Vamos conhecer?",
        description: "Quer conhecer a página de relatórios ou prefere explorar sozinho depois?",
        emoji: "📊",
        navigateTo: "/reports",
        navigateLabel: "Conhecer Relatórios",
        skipLabel: "Explorar depois",
      },
    ],
  },
  // ── PASSO 7: Segurança (mobileOnly) ─────────────────
  {
    id: "setup-security",
    label: "Segurança",
    emoji: "🔐",
    mobileOnly: true,
    substeps: [
      {
        id: "security-intro",
        actionType: "info",
        title: "Proteja seu App",
        description: "Recomendamos fortemente ativar a segurança! Configure um PIN de 4 a 6 dígitos ou use biometria para proteger seus dados financeiros.",
        emoji: "🔐",
        skipLabel: "Ativar depois",
      },
      {
        id: "security-navigate",
        actionType: "navigate",
        title: "Vamos configurar?",
        description: "Acesse as configurações de segurança para proteger seu app.",
        emoji: "🔐",
        navigateTo: "/settings",
        navigateLabel: "Ir para Segurança",
        autoAdvanceOnRoute: "/settings",
      },
    ],
  },
  // ── OPCIONAL: Importar Planilha ──────────────────────
  {
    id: "import-spreadsheet",
    label: "Importar",
    emoji: "📊",
    optional: true,
    substeps: [
      {
        id: "import-intro",
        actionType: "info",
        title: "Importar Planilha (Opcional)",
        description: "Você já controla suas finanças em planilha? Podemos importar seus dados automaticamente!",
        emoji: "📊",
        navigateLabel: "Importar",
        skipLabel: "Não tenho planilha",
      },
    ],
  },
];
