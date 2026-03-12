export type SubstepActionType =
  | "navigate"
  | "click"
  | "fill"
  | "select"
  | "optional-group"
  | "submit"
  | "completion";

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
    // Only show for credit/both
    condition: () => {
      const el = document.querySelector('[data-onboarding="card-due-day-input"]');
      // If the element exists in DOM, the card type is credit/both
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
    id: "optional-limit-color",
    actionType: "optional-group",
    targetSelector: "card-optional-section",
    title: "Limite e Cor (Opcional)",
    description: "Se quiser, defina o limite do cartão e escolha uma cor. Pode pular se preferir.",
    emoji: "🎨",
    skipLabel: "Pular",
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

// ─── All onboarding steps ─────────────────────────────────────
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
    id: "add-category",
    label: "Categorias",
    emoji: "📦",
    detectionTable: "user_categories",
    optional: true,
    substeps: [
      {
        id: "category-intro",
        actionType: "navigate",
        title: "Personalize suas Categorias",
        description:
          'Adicione categorias personalizadas como "Academia", "Pets" ou "Streaming". Ou pule se preferir usar as padrão.',
        emoji: "📦",
        navigateTo: "/",
        navigateLabel: "Continuar",
        autoAdvanceOnRoute: "/",
      },
    ],
  },
  {
    id: "add-expense",
    label: "Despesas",
    emoji: "💸",
    detectionTable: "expenses",
    substeps: [
      {
        id: "expense-intro",
        actionType: "navigate",
        title: "Registre seu Primeiro Gasto",
        description: 'Agora vamos registrar uma despesa! Toque no botão "+" e preencha os dados.',
        emoji: "💸",
        navigateTo: "/",
        navigateLabel: "Continuar",
        autoAdvanceOnRoute: "/",
      },
    ],
  },
  {
    id: "add-recurring-expense",
    label: "Despesas Fixas",
    emoji: "🔄",
    detectionTable: "recurring_expenses",
    substeps: [
      {
        id: "recurring-intro",
        actionType: "navigate",
        title: "Adicione Despesas Fixas",
        description: "Cadastre suas contas mensais fixas (luz, internet, Netflix...). O app vai lançar automaticamente!",
        emoji: "🔄",
        navigateTo: "/",
        navigateLabel: "Continuar",
        autoAdvanceOnRoute: "/",
      },
    ],
  },
  {
    id: "add-income",
    label: "Receitas",
    emoji: "💰",
    detectionTable: "incomes",
    substeps: [
      {
        id: "income-intro",
        actionType: "navigate",
        title: "Registre sua Primeira Entrada",
        description: "Registre uma receita! Pode ser salário, freelance, venda ou qualquer entrada de dinheiro.",
        emoji: "💰",
        navigateTo: "/",
        navigateLabel: "Continuar",
        autoAdvanceOnRoute: "/",
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
        actionType: "navigate",
        title: "Defina uma Meta de Gastos",
        description: "Estabeleça um limite de gastos para o mês! Isso te ajuda a não estourar o orçamento.",
        emoji: "🎯",
        navigateTo: "/",
        navigateLabel: "Continuar",
        autoAdvanceOnRoute: "/",
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
        actionType: "navigate",
        title: "Configure Segurança com PIN",
        description: "Proteja seus dados! Configure um PIN para bloquear o app.",
        emoji: "🔐",
        navigateTo: "/settings",
        navigateLabel: "Ir para Configurações",
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
        actionType: "navigate",
        title: "Importar Planilha (Opcional)",
        description: "Se você já tem seus gastos em uma planilha, pode importar aqui!",
        emoji: "📊",
        navigateTo: "/settings",
        navigateLabel: "Ir para Configurações",
        autoAdvanceOnRoute: "/settings",
      },
    ],
  },
];
