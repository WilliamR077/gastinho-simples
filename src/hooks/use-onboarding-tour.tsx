import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { Capacitor } from "@capacitor/core";

export type OnboardingSubPhase = "navigate" | "arrived" | "form-open" | "completed";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  emoji: string;
  action: "navigate" | "wait";
  targetRoute?: string;
  detectionTable?: string;
  optional?: boolean;
  mobileOnly?: boolean;
  exampleText?: string;
  arrivedTitle?: string;
  arrivedDescription?: string;
  formOpenTitle?: string;
  formOpenDescription?: string;
  completedTitle?: string;
  completedDescription?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "add-card",
    title: "Configure seu Primeiro Cartão",
    description: "Vamos cadastrar seu primeiro cartão! Pode ser de crédito ou débito. Isso vai te ajudar a acompanhar seus gastos.",
    emoji: "🏦",
    action: "navigate",
    targetRoute: "/cards",
    detectionTable: "cards",
    arrivedTitle: "Ótimo! Agora adicione seu cartão",
    arrivedDescription: "Clique no botão '+' ou 'Adicionar Cartão' para cadastrar seu primeiro cartão.",
    formOpenTitle: "Preencha os dados do cartão",
    formOpenDescription: "Digite o nome do cartão (ex: Nubank), escolha o tipo e preencha os campos. Depois clique em 'Adicionar'.",
    completedTitle: "Cartão cadastrado! 🎉",
    completedDescription: "Seu cartão foi adicionado com sucesso! Deseja adicionar outro ou prosseguir?",
  },
  {
    id: "add-category",
    title: "Personalize suas Categorias",
    description: "Adicione categorias que fazem sentido para você, como 'Academia', 'Pets' ou 'Streaming'. Ou pule se preferir usar as categorias padrão.",
    emoji: "📦",
    action: "wait",
    detectionTable: "user_categories",
    optional: true,
  },
  {
    id: "add-expense",
    title: "Registre seu Primeiro Gasto",
    description: "Agora vamos registrar uma despesa! Toque no botão '+' e preencha os dados de um gasto recente.",
    emoji: "💸",
    action: "wait",
    detectionTable: "expenses",
  },
  {
    id: "add-recurring-expense",
    title: "Adicione Despesas Fixas",
    description: "Cadastre suas contas mensais fixas (luz, internet, Netflix...). O app vai lançar automaticamente todo mês!",
    emoji: "🔄",
    action: "wait",
    detectionTable: "recurring_expenses",
    exampleText: "Exemplo: Netflix - R$ 29,90",
  },
  {
    id: "add-income",
    title: "Registre sua Primeira Entrada",
    description: "Registre uma receita! Pode ser salário, freelance, venda ou qualquer entrada de dinheiro.",
    emoji: "💰",
    action: "wait",
    detectionTable: "incomes",
  },
  {
    id: "add-budget-goal",
    title: "Defina uma Meta de Gastos",
    description: "Estabeleça um limite de gastos para o mês! Isso te ajuda a não estourar o orçamento e ter controle financeiro.",
    emoji: "🎯",
    action: "wait",
    detectionTable: "budget_goals",
  },
  {
    id: "setup-security",
    title: "Configure Segurança com PIN",
    description: "Proteja seus dados! Configure um PIN para bloquear o app quando ele estiver em segundo plano.",
    emoji: "🔐",
    action: "navigate",
    targetRoute: "/settings",
    mobileOnly: true,
  },
  {
    id: "import-spreadsheet",
    title: "Importar Planilha (Opcional)",
    description: "Se você já tem seus gastos em uma planilha, pode importar aqui! Caso contrário, pode pular esta etapa.",
    emoji: "📊",
    action: "navigate",
    targetRoute: "/settings",
    optional: true,
  },
];

interface OnboardingContextType {
  isOpen: boolean;
  currentStepIndex: number;
  currentStep: OnboardingStep | null;
  totalSteps: number;
  progress: number;
  isCompleted: boolean;
  showCompletionDialog: boolean;
  subPhase: OnboardingSubPhase;
  startOnboarding: () => void;
  skipOnboarding: () => void;
  skipCurrentStep: () => void;
  completeStep: (stepId: string) => void;
  closeCompletionDialog: () => void;
  navigateToStep: () => void;
  setSubPhase: (phase: OnboardingSubPhase) => void;
  addAnotherItem: () => void;
  proceedToNextStep: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const STORAGE_KEY = "gastinho_onboarding_completed";
const PROGRESS_KEY = "gastinho_onboarding_progress";

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [subPhase, setSubPhase] = useState<OnboardingSubPhase>("navigate");

  // Filtrar steps mobile-only se não estiver em plataforma nativa
  const availableSteps = ONBOARDING_STEPS.filter(
    (step) => !step.mobileOnly || Capacitor.isNativePlatform()
  );

  const currentStep = availableSteps[currentStepIndex] || null;
  const totalSteps = availableSteps.length;
  const progress = (completedSteps.size / totalSteps) * 100;
  const isCompleted = localStorage.getItem(STORAGE_KEY) === "true";

  // Detectar mudança de rota para avançar subPhase
  useEffect(() => {
    if (!isOpen || !currentStep?.targetRoute) return;
    
    if (location.pathname === currentStep.targetRoute && subPhase === "navigate") {
      setSubPhase("arrived");
    }
  }, [location.pathname, isOpen, currentStep, subPhase]);

  // Carregar progresso salvo
  useEffect(() => {
    const savedProgress = localStorage.getItem(PROGRESS_KEY);
    if (savedProgress) {
      try {
        const { stepIndex, completed } = JSON.parse(savedProgress);
        setCurrentStepIndex(stepIndex);
        setCompletedSteps(new Set(completed));
      } catch (e) {
        console.error("Erro ao carregar progresso do onboarding:", e);
      }
    }
  }, []);

  // Salvar progresso
  useEffect(() => {
    if (isOpen) {
      localStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify({
          stepIndex: currentStepIndex,
          completed: Array.from(completedSteps),
        })
      );
    }
  }, [currentStepIndex, completedSteps, isOpen]);

  // Detectar conclusão de steps via Supabase Realtime
  useEffect(() => {
    if (!user || !isOpen || !currentStep?.detectionTable) return;

    const channel = supabase
      .channel(`onboarding-${currentStep.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: currentStep.detectionTable,
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Quando detecta INSERT, mudar para fase "completed" em vez de avançar direto
          if (currentStep.targetRoute) {
            setSubPhase("completed");
          } else {
            completeStep(currentStep.id);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, isOpen, currentStep]);

  // Detectar PIN configurado (step de segurança)
  useEffect(() => {
    if (!isOpen || currentStep?.id !== "setup-security") return;

    const checkPIN = setInterval(() => {
      const pinExists = localStorage.getItem("gastinho_app_lock_pin");
      if (pinExists) {
        completeStep("setup-security");
      }
    }, 1000);

    return () => clearInterval(checkPIN);
  }, [isOpen, currentStep]);

  const checkExistingData = async (userId: string): Promise<Set<string>> => {
    const completed = new Set<string>();

    const [cards, categories, expenses, recurring, incomes, goals] = await Promise.all([
      supabase.from("cards").select("id").eq("user_id", userId).limit(1),
      supabase.from("user_categories").select("id").eq("user_id", userId).eq("is_default", false).limit(1),
      supabase.from("expenses").select("id").eq("user_id", userId).limit(1),
      supabase.from("recurring_expenses").select("id").eq("user_id", userId).limit(1),
      supabase.from("incomes").select("id").eq("user_id", userId).limit(1),
      supabase.from("budget_goals").select("id").eq("user_id", userId).limit(1),
    ]);

    if (cards.data && cards.data.length > 0) completed.add("add-card");
    if (categories.data && categories.data.length > 0) completed.add("add-category");
    if (expenses.data && expenses.data.length > 0) completed.add("add-expense");
    if (recurring.data && recurring.data.length > 0) completed.add("add-recurring-expense");
    if (incomes.data && incomes.data.length > 0) completed.add("add-income");
    if (goals.data && goals.data.length > 0) completed.add("add-budget-goal");

    if (localStorage.getItem("gastinho_app_lock_pin")) completed.add("setup-security");
    // import-spreadsheet is always optional, skip it
    completed.add("import-spreadsheet");

    return completed;
  };

  const startOnboarding = async () => {
    let preCompleted = new Set<string>();
    if (user) {
      preCompleted = await checkExistingData(user.id);
    }

    // Find first incomplete step
    const firstPendingIndex = availableSteps.findIndex(
      (step) => !preCompleted.has(step.id)
    );

    if (firstPendingIndex === -1) {
      // All steps already done
      setShowCompletionDialog(true);
      localStorage.setItem(STORAGE_KEY, "true");
      localStorage.removeItem(PROGRESS_KEY);
      return;
    }

    setCompletedSteps(preCompleted);
    setCurrentStepIndex(firstPendingIndex);
    setSubPhase("navigate");
    setIsOpen(true);
    localStorage.removeItem(PROGRESS_KEY);
  };

  const addAnotherItem = () => {
    // Resetar para fase "arrived" para adicionar outro item
    setSubPhase("arrived");
  };

  const proceedToNextStep = () => {
    // Marcar step atual como completo e avançar
    if (currentStep) {
      completeStep(currentStep.id);
    }
  };

  const skipOnboarding = () => {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, "true");
    localStorage.removeItem(PROGRESS_KEY);
  };

  const skipCurrentStep = () => {
    if (currentStep?.optional) {
      completeStep(currentStep.id);
    }
  };

  const completeStep = (stepId: string) => {
    setCompletedSteps((prev) => new Set([...prev, stepId]));

    // Avançar para próximo step
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= availableSteps.length) {
      // Tour completo!
      setIsOpen(false);
      setShowCompletionDialog(true);
      localStorage.setItem(STORAGE_KEY, "true");
      localStorage.removeItem(PROGRESS_KEY);
    } else {
      setCurrentStepIndex(nextIndex);
      setSubPhase("navigate"); // Resetar subPhase para o novo step
      // Se próximo step requer navegação e não estamos lá, navegar
      const nextStep = availableSteps[nextIndex];
      if (nextStep?.targetRoute && nextStep.targetRoute !== location.pathname) {
        navigate(nextStep.targetRoute);
      } else if (nextStep?.targetRoute && nextStep.targetRoute === location.pathname) {
        // Já estamos na rota correta, avançar para "arrived"
        setSubPhase("arrived");
      }
    }
  };

  const closeCompletionDialog = () => {
    setShowCompletionDialog(false);
  };

  const navigateToStep = () => {
    if (currentStep?.targetRoute) {
      navigate(currentStep.targetRoute);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        isOpen,
        currentStepIndex,
        currentStep,
        totalSteps,
        progress,
        isCompleted,
        showCompletionDialog,
        subPhase,
        startOnboarding,
        skipOnboarding,
        skipCurrentStep,
        completeStep,
        closeCompletionDialog,
        navigateToStep,
        setSubPhase,
        addAnotherItem,
        proceedToNextStep,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingTour() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboardingTour must be used within OnboardingProvider");
  }
  return context;
}
