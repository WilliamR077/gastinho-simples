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
  // Auto-advance: when true, selecting a value in the target select/combobox
  // automatically advances to the next substep after a short delay (no "Próximo" button shown)
  autoAdvanceOnSelect?: boolean;
  skipLabel?: string;
  focusTarget?: boolean;
  scrollToTarget?: boolean;
  // For navigate substeps
  navigateTo?: string;
  navigateLabel?: string;
  // For completion substeps
  repeatLabel?: string;
  proceedLabel?: string;
  // When true, the spotlight overlay places a transparent click-blocking layer
  // over the highlighted target so the user can't interact with it. Used in
  // info substeps that *describe* an option without allowing selection yet.
  lockTarget?: boolean;
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
    // Auto-advance: ao selecionar o tipo, avança automaticamente sem botão "Próximo"
    autoAdvanceOnSelect: true,
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
    description:
      "Se quiser, informe o limite do cartão para o app acompanhar quanto dele já foi usado nas suas compras.\n\nAssim, você consegue ver o consumo do limite e evitar gastos acima do valor disponível.",
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
  // P0 fix: navigate to home first so FAB is available before highlighting
  {
    id: "expense-go-home",
    actionType: "navigate",
    title: "Registre seu Primeiro Gasto",
    description: "Vamos voltar para a tela inicial para registrar sua primeira despesa.",
    emoji: "💸",
    navigateTo: "/",
    autoAdvanceOnRoute: "/",
    navigateLabel: "Ir para início",
  },
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
    actionType: "info",
    targetSelector: "expense-date",
    title: "Data do Gasto",
    description:
      "Se essa despesa aconteceu em outro dia, abra o calendário e escolha a data certa. Se foi hoje, pode manter como está.",
    emoji: "📅",
    scrollToTarget: true,
    placement: "above",
  },
  {
    id: "expense-category",
    actionType: "click",
    targetSelector: "expense-category-field",
    title: "Escolha a Categoria",
    description:
      "Abra a lista e escolha uma categoria. Para criar ou editar, toque em 'Gerenciar categorias'.",
    emoji: "📦",
    autoAdvanceOnEvent: ["expense-category-selected", "category-manager-opened"],
    scrollToTarget: true,
    placement: "below",
  },
  {
    id: "expense-category-manager-intro",
    actionType: "info",
    targetSelector: "category-manager-header",
    title: "Gerencie suas Categorias",
    description:
      "Aqui ficam as categorias padrão e as que você criar. Se quiser adaptar o app à sua realidade, este é o lugar certo.",
    emoji: "🛠️",
    scrollToTarget: true,
    placement: "above",
    condition: (ctx) => {
      return (
        !!ctx.seenEvents?.has("category-manager-opened") &&
        !ctx.seenEvents?.has("category-manager-closed")
      );
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
    condition: (ctx) => {
      return (
        !!ctx.seenEvents?.has("category-manager-opened") &&
        !ctx.seenEvents?.has("category-manager-closed")
      );
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
    condition: (ctx) => {
      return (
        !!ctx.seenEvents?.has("category-manager-opened") &&
        !ctx.seenEvents?.has("category-manager-closed")
      );
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
    condition: (ctx) => {
      return (
        !!ctx.seenEvents?.has("category-manager-opened") &&
        !ctx.seenEvents?.has("category-manager-closed")
      );
    },
  },
  {
    id: "expense-category-manager-outros",
    actionType: "info",
    targetSelector: "category-manager-outros-row",
    title: 'Categoria "Outros"',
    description:
      'A categoria "Outros" é fixa. Ela não pode ser editada, ocultada ou excluída porque serve de destino seguro para despesas sem categoria.',
    emoji: "🔒",
    scrollToTarget: true,
    placement: "above",
    condition: (ctx) => {
      return (
        !!ctx.seenEvents?.has("category-manager-opened") &&
        !ctx.seenEvents?.has("category-manager-closed")
      );
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
    condition: (ctx) => {
      return (
        !!ctx.seenEvents?.has("category-manager-opened") &&
        !ctx.seenEvents?.has("category-manager-closed")
      );
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
    condition: (ctx) => {
      return (
        !!ctx.seenEvents?.has("category-manager-opened") &&
        !ctx.seenEvents?.has("category-manager-closed")
      );
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
      return !!ctx.seenEvents?.has("category-manager-closed");
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
    // Auto-advance: ao selecionar a forma de pagamento, avança automaticamente
    autoAdvanceOnSelect: true,
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
    // Auto-advance: ao selecionar o cartão, avança automaticamente
    autoAdvanceOnSelect: true,
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
  "setup-settings": "Configurações finalizadas",
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
    // P0 fix: navigate to home before starting expense step so FAB is available
    targetRoute: "/",
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
        title: "Cadastre sua Primeira Despesa Fixa",
        description:
          "Agora vamos cadastrar uma despesa fixa, ou seja, algo que você paga todo mês, como academia, aluguel ou internet.",
        emoji: "🔄",
        navigateLabel: "Continuar",
        skipLabel: "Não tenho despesa fixa",
      },
      {
        id: "recurring-click-fab",
        actionType: "click",
        targetSelector: "fab-main-button",
        title: "Registre uma Despesa Fixa",
        description: 'Toque no botão "+" para registrar uma despesa fixa.',
        emoji: "➕",
        autoAdvanceOnEvent: "fab-menu-opened",
        scrollToTarget: true,
        placement: "above",
      },
      {
        id: "recurring-click-btn",
        actionType: "click",
        targetSelector: "fab-expense-button",
        title: "Selecione Despesa",
        description: 'Agora toque em "Despesas" para abrir o formulário.',
        emoji: "📝",
        autoAdvanceOnEvent: "expense-form-opened",
        scrollToTarget: true,
        placement: "above",
      },
      {
        id: "recurring-type-info",
        actionType: "info",
        targetSelector: "expense-type-selector",
        title: "Tipo de Despesa",
        description:
          "Estamos adicionando uma despesa fixa, ou seja, uma cobrança recorrente que acontece todo mês.",
        emoji: "🔄",
        placement: "below",
      },
      {
        id: "recurring-description",
        actionType: "fill",
        targetSelector: "expense-description",
        title: "Descrição",
        description:
          "Qual o nome dessa despesa fixa? Exemplo: academia, aluguel, internet.",
        emoji: "📝",
        requiresValidation: true,
        focusTarget: true,
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "recurring-amount",
        actionType: "fill",
        targetSelector: "expense-amount",
        title: "Valor",
        description: "Agora informe o valor que você paga todo mês nessa despesa.",
        emoji: "💵",
        requiresValidation: true,
        focusTarget: true,
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "recurring-day",
        actionType: "select",
        targetSelector: "expense-day-of-month",
        title: "Dia da Cobrança",
        description:
          "Em que dia do mês essa despesa é cobrada ou costuma ser paga?",
        emoji: "📅",
        requiresValidation: true,
        scrollToTarget: true,
        placement: "above",
      },
      {
        id: "recurring-category",
        actionType: "click",
        targetSelector: "expense-category-field",
        title: "Escolha a Categoria",
        description:
          "Agora escolha a categoria que melhor representa essa despesa.",
        emoji: "📦",
        autoAdvanceOnEvent: ["expense-category-selected", "category-manager-opened"],
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "recurring-category-manager-intro",
        actionType: "info",
        targetSelector: "category-manager-sheet",
        title: "Gerencie suas Categorias",
        description:
          "Aqui ficam as categorias padrão e as que você criar. Se quiser adaptar o app à sua realidade, este é o lugar certo.",
        emoji: "🛠️",
        scrollToTarget: true,
        placement: "above",
        condition: (ctx) => {
          return (
            !!ctx.seenEvents?.has("category-manager-opened") &&
            !ctx.seenEvents?.has("category-manager-closed")
          );
        },
      },
      {
        id: "recurring-category-manager-close",
        actionType: "click",
        targetSelector: "category-manager-close-btn",
        title: "Volte ao Formulário",
        description:
          "Quando terminar de personalizar, toque aqui para voltar ao formulário e escolher a categoria.",
        emoji: "↩️",
        autoAdvanceOnEvent: "category-manager-closed",
        scrollToTarget: true,
        placement: "above",
        condition: (ctx) => {
          return (
            !!ctx.seenEvents?.has("category-manager-opened") &&
            !ctx.seenEvents?.has("category-manager-closed")
          );
        },
      },
      {
        id: "recurring-category-after-manager",
        actionType: "click",
        targetSelector: "expense-category-field",
        title: "Escolha a Categoria",
        description:
          "Agora escolha a categoria que vai ficar nesta despesa fixa.",
        emoji: "📦",
        autoAdvanceOnEvent: "expense-category-selected",
        scrollToTarget: true,
        placement: "below",
        condition: (ctx) => {
          return !!ctx.seenEvents?.has("category-manager-closed");
        },
      },
      {
        id: "recurring-payment",
        actionType: "select",
        targetSelector: "expense-payment",
        title: "Forma de Pagamento",
        description: "Agora escolha como essa despesa fixa é paga: Pix, débito ou crédito.",
        emoji: "💳",
        requiresValidation: true,
        // Auto-advance: ao selecionar a forma de pagamento, avança automaticamente
        autoAdvanceOnSelect: true,
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "recurring-card",
        actionType: "select",
        targetSelector: "expense-card-select",
        title: "Selecione o Cartão",
        description: "Selecione qual cartão é usado nessa despesa fixa.",
        emoji: "💳",
        requiresValidation: true,
        // Auto-advance: ao selecionar o cartão, avança automaticamente
        autoAdvanceOnSelect: true,
        scrollToTarget: true,
        placement: "below",
        condition: () => {
          return !!document.querySelector('[data-onboarding="expense-card-select"]');
        },
      },
      {
        id: "recurring-submit",
        actionType: "submit",
        targetSelector: "expense-submit-btn",
        title: "Salvar Despesa Fixa",
        description:
          'Perfeito! Agora clique em "Adicionar Despesa" para salvar sua primeira despesa fixa.',
        emoji: "✅",
        autoAdvanceOnEvent: "expense-submitted",
        scrollToTarget: true,
        placement: "above",
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
          "Você pode registrar 3 tipos de entrada:\n\n💰 Entrada do mês — freelance, venda ou bônus\n🔄 Entrada fixa — salário ou valor recorrente\n📑 Entrada parcelada — projetos/vendas em parcelas\n\nEscolha no formulário a opção que combina com esta entrada.",
        emoji: "💰",
        navigateLabel: "Continuar",
        skipLabel: "Pular esta etapa",
      },
      {
        id: "income-click-fab",
        actionType: "click",
        targetSelector: "fab-main-button",
        title: "Registre uma Entrada",
        description: 'Toque no botão "+" para registrar uma entrada.',
        emoji: "➕",
        autoAdvanceOnEvent: "fab-menu-opened",
        scrollToTarget: true,
        placement: "above",
      },
      {
        id: "income-click-btn",
        actionType: "click",
        targetSelector: "fab-income-button",
        title: "Selecione Entrada",
        description: 'Agora toque em "Entrada" para abrir o formulário.',
        emoji: "💵",
        autoAdvanceOnEvent: "income-form-opened",
        scrollToTarget: true,
        placement: "above",
      },
      {
        id: "income-type-info-monthly",
        actionType: "info",
        targetSelector: "income-type-monthly",
        title: "Entrada do Mês",
        description:
          "Use para ganhos pontuais recebidos neste mês — freelance, venda ou bônus.",
        emoji: "💰",
        scrollToTarget: true,
        placement: "below",
        lockTarget: true,
      },
      {
        id: "income-type-info-recurring",
        actionType: "info",
        targetSelector: "income-type-recurring",
        title: "Entrada Fixa",
        description:
          "Use para salário ou qualquer valor que entra todo mês.",
        emoji: "🔄",
        scrollToTarget: true,
        placement: "below",
        lockTarget: true,
      },
      {
        id: "income-type-info-installment",
        actionType: "info",
        targetSelector: "income-type-installment",
        title: "Entrada Parcelada",
        description:
          "Use para projetos ou vendas que você vai receber em parcelas.",
        emoji: "📑",
        scrollToTarget: true,
        placement: "below",
        lockTarget: true,
      },
      {
        id: "income-type-select",
        actionType: "select",
        targetSelector: "income-type-selector",
        title: "Escolha o Tipo de Entrada",
        description:
          "Agora escolha o tipo que melhor representa esta entrada.",
        emoji: "✅",
        requiresValidation: true,
        autoAdvanceOnSelect: true,
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "income-description",
        actionType: "fill",
        targetSelector: "income-description",
        title: "Descrição",
        description:
          "Descreva essa entrada. Exemplo: salário, freelance, venda, projeto.",
        emoji: "📝",
        requiresValidation: true,
        focusTarget: true,
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "income-amount",
        actionType: "fill",
        targetSelector: "income-amount",
        title: "Valor",
        description: "Agora informe o valor recebido.",
        emoji: "💵",
        requiresValidation: true,
        focusTarget: true,
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "income-category",
        actionType: "click",
        targetSelector: "income-category-field",
        title: "Escolha a Categoria",
        description:
          'Abra a lista e escolha uma categoria. Se quiser personalizar, toque em "Gerenciar categorias...".',
        emoji: "📦",
        autoAdvanceOnEvent: ["income-category-selected", "income-category-manager-opened"],
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "income-category-manager-intro",
        actionType: "info",
        targetSelector: "category-manager-sheet",
        title: "Gerencie suas Categorias de Entrada",
        description:
          "Aqui ficam as categorias de entrada. Personalize conforme sua realidade.",
        emoji: "🛠️",
        scrollToTarget: true,
        placement: "above",
        condition: (ctx) => {
          return (
            !!ctx.seenEvents?.has("income-category-manager-opened") &&
            !ctx.seenEvents?.has("income-category-manager-closed")
          );
        },
      },
      {
        id: "income-category-manager-close",
        actionType: "click",
        targetSelector: "category-manager-close-btn",
        title: "Volte ao Formulário",
        description:
          "Quando terminar de personalizar, toque aqui para voltar e escolher a categoria.",
        emoji: "↩️",
        autoAdvanceOnEvent: "income-category-manager-closed",
        scrollToTarget: true,
        placement: "above",
        condition: (ctx) => {
          return (
            !!ctx.seenEvents?.has("income-category-manager-opened") &&
            !ctx.seenEvents?.has("income-category-manager-closed")
          );
        },
      },
      {
        id: "income-category-after-manager",
        actionType: "click",
        targetSelector: "income-category-field",
        title: "Escolha a Categoria",
        description:
          "Agora escolha a categoria para esta entrada.",
        emoji: "📦",
        autoAdvanceOnEvent: "income-category-selected",
        scrollToTarget: true,
        placement: "below",
        condition: (ctx) => {
          return !!ctx.seenEvents?.has("income-category-manager-closed");
        },
      },
      {
        id: "income-date",
        actionType: "info",
        targetSelector: "income-date",
        title: "Data de Recebimento",
        description:
          "Se essa entrada aconteceu em outro dia, abra o calendário e escolha a data certa. Se foi hoje, pode manter como está.",
        emoji: "📅",
        scrollToTarget: true,
        placement: "above",
        condition: () => {
          return !!document.querySelector('[data-onboarding="income-date"]');
        },
      },
      {
        id: "income-day-of-month",
        actionType: "fill",
        targetSelector: "income-day-of-month",
        title: "Dia do Recebimento",
        description: "Em que dia do mês você costuma receber esse valor?",
        emoji: "📅",
        requiresValidation: true,
        focusTarget: true,
        scrollToTarget: true,
        placement: "above",
        condition: () => {
          return !!document.querySelector('[data-onboarding="income-day-of-month"]');
        },
      },
      {
        id: "income-installment-count",
        actionType: "fill",
        targetSelector: "income-installment-count",
        title: "Quantidade de Parcelas",
        description: "Informe em quantas parcelas você vai receber esse valor.",
        emoji: "🔢",
        requiresValidation: true,
        focusTarget: true,
        scrollToTarget: true,
        placement: "below",
        condition: () => {
          return !!document.querySelector('[data-onboarding="income-installment-count"]');
        },
      },
      {
        id: "income-installment-date",
        actionType: "info",
        targetSelector: "income-installment-date",
        title: "Primeira Data de Recebimento",
        description: "Selecione a data da primeira parcela.",
        emoji: "📅",
        scrollToTarget: true,
        placement: "above",
        condition: () => {
          return !!document.querySelector('[data-onboarding="income-installment-date"]');
        },
      },
      {
        id: "income-submit",
        actionType: "submit",
        targetSelector: "income-submit-btn",
        title: "Salvar Entrada",
        description: 'Perfeito! Agora clique para salvar sua entrada.',
        emoji: "✅",
        autoAdvanceOnEvent: "income-submitted",
        scrollToTarget: true,
        placement: "above",
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
          "Você pode criar 3 tipos de meta:\n\n📉 Meta de Despesa → para limitar seus gastos\n📈 Meta de Entrada → para acompanhar seus ganhos\n⚖️ Meta de Saldo → para manter um saldo mínimo desejado\n\nRecomendamos começar com uma Meta de Despesa.",
        emoji: "🎯",
        navigateLabel: "Continuar",
      },
      {
        id: "budget-click-fab",
        actionType: "click",
        targetSelector: "fab-main-button",
        title: "Abra o Menu",
        description: "Toque no botão '+' para abrir as opções.",
        emoji: "➕",
        autoAdvanceOnEvent: "fab-menu-opened",
        placement: "above",
      },
      {
        id: "budget-click-btn",
        actionType: "click",
        targetSelector: "fab-goal-button",
        title: "Criar Meta",
        description: "Agora toque em 'Meta' para abrir o formulário.",
        emoji: "🎯",
        autoAdvanceOnEvent: "goal-form-opened",
        placement: "above",
      },
      {
        id: "budget-scope-select",
        actionType: "click",
        targetSelector: "goal-scope-expense",
        title: "Escolha Meta de Despesa",
        description:
          "Neste tutorial, vamos criar uma Meta de Despesa, que ajuda você a limitar quanto quer gastar no mês.",
        emoji: "📉",
        autoAdvanceOnEvent: "goal-scope-selected",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "budget-type-info",
        actionType: "info",
        targetSelector: "goal-type-select",
        title: "Tipo de Limite",
        description:
          "Você pode criar:\n\n📊 Limite mensal total — controla os gastos do mês inteiro\n📦 Limite por categoria — controla uma categoria específica\n\nPara começar, vamos usar Limite Mensal Total, que é o mais simples.",
        emoji: "📊",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "budget-amount",
        actionType: "fill",
        targetSelector: "goal-amount-input",
        title: "Valor do Limite",
        description:
          "Agora informe qual o limite de gastos que você quer ter no mês.\n\nExemplo: se você ganha R$ 5.000 e quer gastar no máximo R$ 3.000, esse pode ser o valor da sua meta.",
        emoji: "💰",
        requiresValidation: true,
        focusTarget: true,
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "budget-submit",
        actionType: "submit",
        targetSelector: "goal-submit-btn",
        title: "Salvar Meta",
        description: "Perfeito! Agora clique em 'Adicionar Meta' para salvar sua primeira meta.",
        emoji: "✅",
        autoAdvanceOnEvent: "goal-submitted",
        scrollToTarget: true,
        placement: "above",
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
        id: "reports-nav",
        actionType: "click",
        targetSelector: "reports-nav-button",
        title: "Relatórios",
        description:
          "Aqui é onde você acompanha seus gastos, entradas e evolução financeira com mais clareza. Toque para abrir seus relatórios.",
        emoji: "📊",
        autoAdvanceOnRoute: "/reports",
        autoAdvanceOnClick: true,
        placement: "below",
      },
      {
        id: "reports-context",
        actionType: "info",
        targetSelector: "reports-context-selector",
        title: "Contexto dos Relatórios",
        description:
          "Aqui você alterna entre seus dados pessoais e os de um grupo compartilhado, se tiver um.",
        emoji: "👥",
        scrollToTarget: true,
        placement: "below",
        condition: () => !!document.querySelector('[data-onboarding="reports-context-selector"]'),
      },
      {
        id: "reports-period",
        actionType: "info",
        targetSelector: "reports-period-selector",
        title: "Tipo de Período",
        description:
          "Aqui você escolhe como visualizar seus relatórios: por mês, ano, trimestre ou período customizado. No plano gratuito, a visualização mensal fica disponível. As opções avançadas fazem parte do plano Premium.",
        emoji: "📅",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "reports-month-nav",
        actionType: "info",
        targetSelector: "reports-month-nav",
        title: "Navegação de Período",
        description:
          "Aqui você navega entre meses ou períodos anteriores e futuros. Use as setas para ver como foi cada período.",
        emoji: "🔄",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "reports-summary",
        actionType: "info",
        targetSelector: "reports-period-summary",
        title: "Resumo do Período",
        description:
          "Este card mostra suas entradas, saídas e saldo do período selecionado em uma visão rápida.",
        emoji: "💰",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "reports-smart-summary",
        actionType: "info",
        targetSelector: "reports-smart-summary",
        title: "Resumo Inteligente",
        description:
          "Este resumo ajuda você a entender rapidamente como foi seu período financeiro: quanto gastou, categoria principal e dia mais caro.",
        emoji: "✨",
        scrollToTarget: true,
        placement: "below",
        condition: () => !!document.querySelector('[data-onboarding="reports-smart-summary"]'),
      },
      {
        id: "reports-category",
        actionType: "info",
        targetSelector: "reports-category",
        title: "Gastos por Categoria",
        description:
          "Aqui você vê em quais categorias mais gastou no período selecionado.",
        emoji: "📊",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "reports-payment",
        actionType: "info",
        targetSelector: "reports-payment-method",
        title: "Forma de Pagamento",
        description:
          "Aqui você entende como seus gastos foram distribuídos entre Pix, débito e crédito.",
        emoji: "💳",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "reports-cards",
        actionType: "info",
        targetSelector: "reports-cards",
        title: "Gastos por Cartão",
        description:
          "Este gráfico mostra quanto foi gasto em cada cartão.",
        emoji: "💳",
        scrollToTarget: true,
        placement: "below",
        condition: () => !!document.querySelector('[data-onboarding="reports-cards"]'),
      },
      {
        id: "reports-cashflow",
        actionType: "info",
        targetSelector: "reports-cashflow",
        title: "Fluxo de Caixa",
        description:
          "Aqui você compara entradas e saídas ao longo do tempo. Identifique os dias em que mais gastou ou recebeu.",
        emoji: "📈",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "reports-evolution",
        actionType: "info",
        targetSelector: "reports-evolution",
        title: "Evolução dos Gastos",
        description:
          "Este relatório mostra como seus gastos evoluíram ao longo do tempo. Ajuda a identificar padrões e picos.",
        emoji: "📉",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "reports-top",
        actionType: "info",
        targetSelector: "reports-top-expenses",
        title: "Maiores Gastos",
        description:
          "Aqui aparecem os maiores gastos do período, ajudando você a identificar onde mais pesou no orçamento.",
        emoji: "🏆",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "reports-comparison",
        actionType: "info",
        targetSelector: "reports-comparison",
        title: "Comparação com Período Anterior",
        description:
          "Este bloco compara seus dados com o período anterior, para você saber se está gastando mais ou menos.",
        emoji: "🔄",
        scrollToTarget: true,
        placement: "below",
        condition: () => !!document.querySelector('[data-onboarding="reports-comparison"]'),
      },
      {
        id: "reports-savings",
        actionType: "info",
        targetSelector: "reports-savings-rate",
        title: "Taxa de Economia",
        description:
          "Este indicador mostra quanto você conseguiu economizar no período.",
        emoji: "💰",
        scrollToTarget: true,
        placement: "below",
        condition: () => !!document.querySelector('[data-onboarding="reports-savings-rate"]'),
      },
      {
        id: "reports-members",
        actionType: "info",
        targetSelector: "reports-members",
        title: "Gastos por Membro",
        description:
          "Em grupos compartilhados, este bloco mostra quanto cada membro gastou.",
        emoji: "👥",
        scrollToTarget: true,
        placement: "below",
        condition: () => !!document.querySelector('[data-onboarding="reports-members"]'),
      },
      {
        id: "reports-recurring",
        actionType: "info",
        targetSelector: "reports-recurring",
        title: "Despesas Fixas",
        description:
          "Aqui você acompanha suas despesas recorrentes e o impacto delas no mês.",
        emoji: "🔄",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "reports-export",
        actionType: "info",
        targetSelector: "reports-export-btn",
        title: "Exportar PDF",
        description:
          "Aqui você pode exportar seus relatórios em PDF. Esse recurso está disponível no plano Premium.",
        emoji: "📥",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "reports-done",
        actionType: "info",
        title: "Relatórios Prontos! 📊",
        description:
          "Agora você já sabe onde acompanhar seus relatórios e usar essas informações para tomar decisões melhores no seu controle financeiro.",
        emoji: "🎉",
      },
    ],
  },
  {
    id: "setup-settings",
    label: "Configurações",
    emoji: "⚙️",
    noDetection: true,
    substeps: [
      {
        id: "settings-intro",
        actionType: "navigate",
        title: "Vamos Finalizar sua Configuração",
        description:
          "Agora vamos concluir a configuração da sua conta na página de Configurações, incluindo segurança do app, importação de planilha e outros recursos importantes.",
        emoji: "⚙️",
        navigateLabel: "Continuar",
        navigateTo: "/settings",
        autoAdvanceOnRoute: "/settings",
      },
      {
        id: "settings-security-section",
        actionType: "info",
        targetSelector: "settings-security-card",
        title: "Segurança do App",
        description:
          "Como este é um aplicativo de controle financeiro, recomendamos fortemente ativar a segurança do app para proteger seus dados.",
        emoji: "🔐",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "settings-lock-toggle",
        actionType: "click",
        targetSelector: "settings-lock-toggle",
        title: "Ativar Bloqueio",
        description: "Toque aqui para ativar o bloqueio do app e proteger seus dados financeiros.",
        emoji: "🔒",
        autoAdvanceOnEvent: "security-lock-toggled",
        scrollToTarget: true,
        placement: "below",
        condition: () => !!document.querySelector('[data-onboarding="settings-lock-toggle"]'),
      },
      {
        id: "settings-pin-info",
        actionType: "info",
        targetSelector: "settings-pin-dialog",
        title: "PIN de Segurança",
        description: "Agora defina um PIN de 4 a 6 números para proteger o acesso ao app.",
        emoji: "🔑",
        autoAdvanceOnEvent: "security-pin-saved",
        scrollToTarget: true,
        placement: "below",
        condition: () => !!document.querySelector('[data-onboarding="settings-pin-dialog"]'),
      },
      {
        id: "settings-biometric",
        actionType: "info",
        targetSelector: "settings-biometric-toggle",
        title: "Biometria",
        description:
          "Se seu aparelho permitir, ative também a biometria para desbloquear o app de forma mais rápida e segura.",
        emoji: "👆",
        scrollToTarget: true,
        placement: "below",
        condition: () => !!document.querySelector('[data-onboarding="settings-biometric-toggle"]'),
      },
      {
        id: "settings-timeout",
        actionType: "info",
        targetSelector: "settings-lock-timeout",
        title: "Bloquear Após",
        description:
          "Aqui você define depois de quanto tempo o app volta a exigir desbloqueio: imediatamente, 1 min, 5 min, 15 min ou 30 min. Se quiser máxima segurança, use imediato.",
        emoji: "⏱️",
        scrollToTarget: true,
        placement: "below",
        condition: () => !!document.querySelector('[data-onboarding="settings-lock-timeout"]'),
      },
      {
        id: "settings-export",
        actionType: "info",
        targetSelector: "settings-export-card",
        title: "Exportar Dados",
        description:
          "Aqui você pode exportar seus dados para PDF ou Excel. Esse recurso está disponível para usuários Premium e é útil para levar seus relatórios para fora do app.",
        emoji: "📁",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "settings-import",
        actionType: "info",
        targetSelector: "settings-import-card",
        title: "Importar Planilha",
        description:
          "Se você já usa uma planilha para controlar suas finanças, pode importar seus dados automaticamente para o app.",
        emoji: "📊",
        scrollToTarget: true,
        placement: "below",
        navigateLabel: "Quero importar",
        skipLabel: "Não tenho",
      },
      {
        id: "settings-import-open",
        actionType: "click",
        targetSelector: "settings-import-btn",
        title: "Importar Planilha",
        description: "Selecione sua planilha para começar a importação. Associe as colunas da sua planilha com os campos do sistema.",
        emoji: "📂",
        autoAdvanceOnEvent: "import-sheet-opened",
        scrollToTarget: true,
        placement: "below",
        condition: (ctx) => !ctx.seenEvents?.has("settings-import-skipped"),
      },
      {
        id: "settings-import-done",
        actionType: "info",
        title: "Importação",
        description: "Pronto! Agora você sabe como importar seus dados. Pode fazer isso quando quiser.",
        emoji: "✅",
        condition: (ctx) => !ctx.seenEvents?.has("settings-import-skipped"),
      },
      {
        id: "settings-tutorial",
        actionType: "info",
        targetSelector: "settings-tutorial-card",
        title: "Tutorial e Ajuda",
        description:
          "Se quiser rever orientações ou receber ajuda para configurar sua conta novamente, você pode usar este botão a qualquer momento.",
        emoji: "🎓",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "settings-notifications",
        actionType: "info",
        targetSelector: "settings-notifications-card",
        title: "Notificações",
        description:
          "Aqui você escolhe se deseja receber notificações do app, como lembretes e avisos importantes.",
        emoji: "🔔",
        scrollToTarget: true,
        placement: "below",
      },
      {
        id: "settings-done",
        actionType: "info",
        title: "Conta Configurada! 🎉",
        description:
          "Perfeito! Agora sua conta está configurada e você já conhece os principais recursos do app. Aproveite o Gastinho Simples!",
        emoji: "🎉",
      },
    ],
  },
];

