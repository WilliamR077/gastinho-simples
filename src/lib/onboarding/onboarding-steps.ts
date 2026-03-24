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
  autoAdvanceOnEvent?: string | string[]; // advance when notifyEvent(name) is called
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
  condition?: (ctx: { formElement?: HTMLElement; seenEvents?: Set<string> }) => boolean;
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
      return !!document.querySelector('[data-onboarding="card-due-day-input"]');
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
      return !!document.querySelector('[data-onboarding="card-close-days-input"]');
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

const EXPENSE_SUBSTEPS: OnboardingSubstep[] = [
  {
    id: "expense-click-fab",
    actionType: "click",
    targetSelector: "fab-main-button",
    title: "Registre seu Primeiro Gasto",
    description:
      'Qual foi a última coisa que você comprou? Toque no botão "+" para registrar a última despesa que você lembra ter feito.',
    emoji: "💸",
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
    description:
      "Estamos adicionando uma despesa do mês. No próximo passo você aprenderá sobre despesas fixas (recorrentes).",
    emoji: "📋",
    placement: "below",
  },
  {
    id: "expense-description",
    actionType: "fill",
    targetSelector: "expense-description",
    title: "Descrição",
    description:
      "Qual foi a última coisa que você comprou? Digite a última despesa que você lembra ter tido, como almoço, Uber ou mercado.",
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
    description:
      "Se essa despesa aconteceu em outro dia, abra o calendário e escolha a data certa. Se foi hoje, pode manter como está.",
    emoji: "📅",
    skipLabel: "Manter hoje",
    scrollToTarget: true,
    placement: "below",
  },
  {
    id: "expense-category",
    actionType: "click",
    targetSelector: "expense-category-field",
    title: "Escolha a Categoria",
    description:
      'Abra a lista e escolha uma categoria padrão. Se quiser personalizar, toque em "Gerenciar categorias..." para editar, ocultar, excluir ou criar uma nova.',
    emoji: "📦",
    autoAdvanceOnEvent: ["expense-category-selected", "category-manager-opened"],
    scrollToTarget: true,
    placement: "below",
  },
  {
    id: "expense-category-manager-intro",
    actionType: "info",
    targetSelector: "category-manager-sheet",
    title: "Gerencie suas Categorias",
    description:
      "Aqui você pode personalizar suas categorias antes de terminar a despesa. O spotlight vai acompanhar esse fluxo.",
    emoji: "🛠️",
    scrollToTarget: true,
    placement: "above",
    condition: () => {
      return !!document.querySelector('[data-onboarding="category-manager-sheet"]');
    },
  },
  {
    id: "expense-category-manager-edit",
    actionType: "info",
    targetSelector: "category-manager-edit-btn",
    title: "Editar Categoria",
    description:
      'Use este botão para trocar o nome e o ícone de uma categoria. Por exemplo, você pode renomear "Vestuário" para "Roupas".',
    emoji: "✏️",
    scrollToTarget: true,
    placement: "above",
    condition: () => {
      return !!document.querySelector('[data-onboarding="category-manager-edit-btn"]');
    },
  },
  {
    id: "expense-category-manager-hide",
    actionType: "info",
    targetSelector: "category-manager-hide-btn",
    title: "Ocultar Categoria",
    description:
      "Se uma categoria não fizer sentido para você agora, este botão a esconde do seletor sem apagar despesas antigas.",
    emoji: "👁️",
    scrollToTarget: true,
    placement: "above",
    condition: () => {
      return !!document.querySelector('[data-onboarding="category-manager-hide-btn"]');
    },
  },
  {
    id: "expense-category-manager-delete",
    actionType: "info",
    targetSelector: "category-manager-delete-btn",
    title: "Excluir Categoria",
    description:
      'Use excluir apenas quando quiser remover a categoria de vez. As despesas vinculadas são movidas para "Outros".',
    emoji: "🗑️",
    scrollToTarget: true,
    placement: "above",
    condition: () => {
      return !!document.querySelector('[data-onboarding="category-manager-delete-btn"]');
    },
  },
  {
    id: "expense-category-manager-add",
    actionType: "info",
    targetSelector: "category-manager-add-btn",
    title: "Adicionar Categoria",
    description:
      'Se estiver faltando algo como "Viagem", toque aqui para criar uma categoria nova com o nome e ícone que você quiser.',
    emoji: "➕",
    scrollToTarget: true,
    placement: "above",
    condition: () => {
      return !!document.querySelector('[data-onboarding="category-manager-add-btn"]');
    },
  },
  {
    id: "expense-category-manager-close",
    actionType: "click",
    targetSelector: "category-manager-close-btn",
    title: "Volte ao Formulário",
    description:
      "Quando terminar de personalizar, toque aqui para voltar ao formulário e escolher a categoria final deste gasto.",
    emoji: "↩️",
    autoAdvanceOnEvent: "category-manager-closed",
    scrollToTarget: true,
    placement: "above",
    condition: () => {
      return !!document.querySelector('[data-onboarding="category-manager-close-btn"]');
    },
  },
  {
    id: "expense-category-after-manager",
    actionType: "click",
    targetSelector: "expense-category-field",
    title: "Escolha a Categoria do Gasto",
    description:
      "Agora escolha a categoria que vai ficar neste lançamento. Pode ser uma categoria padrão ou uma que você acabou de personalizar.",
    emoji: "📦",
    autoAdvanceOnEvent: "expense-category-selected",
    scrollToTarget: true,
    placement: "below",
    condition: (ctx) => {
      return (
        !!ctx.seenEvents?.has("category-manager-opened") &&
        !document.querySelector('[data-onboarding="category-manager-sheet"]')
      );
    },
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

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: "add-card",
    label: "Cartões",
    emoji: "🏦",
    detectionTable: "cards",
    targetRoute: "/cards",
    substeps: CARDS_SUBSTEPS,
  },
  {
    id: "add-expense",
    label: "Despesas",
    emoji: "💸",
    detectionTable: "expenses",
    substeps: EXPENSE_SUBSTEPS,
  },
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
        description:
          "Pense em algo que você paga todo mês: aluguel, academia, internet, streaming... Cadastre para o app lançar automaticamente!",
        emoji: "🔄",
        navigateLabel: "Continuar",
        skipLabel: "Pular esta etapa",
      },
    ],
  },
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
        description:
          "Você pode registrar 3 tipos de entrada:\n\n💰 Entrada do mês — freelance, venda, bônus\n🔄 Entrada fixa — salário mensal\n📑 Entrada parcelada — projeto/venda parcelada\n\nEscolha o tipo que mais combina com você no formulário.",
        emoji: "💰",
        navigateLabel: "Continuar",
        skipLabel: "Pular esta etapa",
      },
    ],
  },
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
        description:
          "Defina um limite de gastos para o mês! Você pode criar uma meta geral ou por categoria. Recomendamos começar com um limite mensal total.",
        emoji: "🎯",
        navigateLabel: "Continuar",
        skipLabel: "Pular esta etapa",
      },
    ],
  },
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
        description:
          "Aqui você acompanha sua vida financeira com clareza: gastos por categoria, fluxo de caixa, evolução dos gastos e muito mais.",
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
        description:
          "Recomendamos fortemente ativar a segurança! Configure um PIN de 4 a 6 dígitos ou use biometria para proteger seus dados financeiros.",
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
