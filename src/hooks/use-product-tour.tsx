import { useState, useEffect, useCallback } from "react";

const TOUR_STORAGE_KEY = "gastinho_tour_completed";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right";
  action?: "open-expense-form";
}

export const tourSteps: TourStep[] = [
  {
    target: "[data-tour='welcome']",
    title: "Bem-vindo ao Gastinho! 🎉",
    description: "Vamos te mostrar como controlar seus gastos de forma simples e prática!",
    placement: "bottom",
  },
  {
    target: "[data-tour='month-navigator']",
    title: "Navegue pelos meses",
    description: "Use as setas para ver gastos de meses anteriores ou futuros.",
    placement: "bottom",
  },
  {
    target: "[data-tour='expense-filters']",
    title: "Filtros poderosos",
    description: "Filtre por cartão, valor, descrição e período de fatura do cartão de crédito.",
    placement: "bottom",
  },
  {
    target: "[data-tour='category-summary']",
    title: "Suas categorias",
    description: "Veja quanto gastou em cada categoria. Toque em uma para filtrar os gastos!",
    placement: "bottom",
  },
  {
    target: "[data-tour='expense-summary']",
    title: "Resumo por forma de pagamento",
    description: "Acompanhe os totais por PIX, Débito e Crédito de forma rápida.",
    placement: "bottom",
  },
  {
    target: "[data-tour='tabs']",
    title: "Organize tudo",
    description: "Alterne entre Despesas, Despesas Fixas (recorrentes) e Metas de gastos.",
    placement: "top",
  },
  {
    target: "[data-tour='reports-button']",
    title: "Relatórios detalhados 📊",
    description: "Gráficos e análises completas dos seus gastos. Recurso Premium!",
    placement: "bottom",
  },
  {
    target: "[data-tour='cards-button']",
    title: "Gerencie seus cartões 💳",
    description: "Configure seus cartões de crédito e débito com datas de fechamento personalizadas.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings-button']",
    title: "Configurações ⚙️",
    description: "Acesse configurações do app, categorias personalizadas, notificações e muito mais.",
    placement: "bottom",
  },
  {
    target: "[data-tour='reminders-button']",
    title: "Lembretes de vencimento 🔔",
    description: "Veja despesas fixas próximas do vencimento. Configure alertas nas configurações!",
    placement: "bottom",
  },
  {
    target: "[data-tour='values-toggle']",
    title: "Mostrar/Esconder valores 👁️",
    description: "Se alguém estiver por perto, esconda seus valores com um toque! Sua privacidade é importante.",
    placement: "bottom",
  },
  {
    target: "[data-tour='theme-toggle']",
    title: "Tema claro/escuro 🌙",
    description: "Alterne entre tema claro e escuro conforme sua preferência.",
    placement: "bottom",
  },
  {
    target: "[data-tour='fab-main-button']",
    title: "Adicione gastos rapidamente ➕",
    description: "Toque no + para adicionar despesas, despesas fixas ou metas de gastos!",
    placement: "top",
    action: "open-expense-form",
  },
  // Passos do formulário de despesa
  {
    target: "[data-tour='form-description']",
    title: "Descrição do gasto ✏️",
    description: "Digite o que você comprou ou pagou. Ex: Almoço, Supermercado, Uber...",
    placement: "bottom",
  },
  {
    target: "[data-tour='form-amount']",
    title: "Valor em reais 💰",
    description: "Informe quanto custou. Use ponto ou vírgula para centavos.",
    placement: "bottom",
  },
  {
    target: "[data-tour='form-date']",
    title: "Data do gasto 📅",
    description: "Selecione quando o gasto aconteceu. Pode ser uma data passada!",
    placement: "bottom",
  },
  {
    target: "[data-tour='form-category']",
    title: "Categoria 🏷️",
    description: "Escolha uma categoria para organizar melhor seus gastos e ver relatórios detalhados.",
    placement: "bottom",
  },
  {
    target: "[data-tour='form-payment']",
    title: "Forma de pagamento 💳",
    description: "Escolha entre PIX, Débito ou Crédito. No crédito, você pode parcelar!",
    placement: "top",
  },
  {
    target: "[data-tour='form-submit']",
    title: "Pronto! ✅",
    description: "Clique aqui para salvar sua despesa. Simples assim!",
    placement: "top",
  },
];

export interface ProductTourCallbacks {
  onOpenExpenseForm?: () => void;
  onCloseExpenseForm?: () => void;
}

export function useProductTour(callbacks?: ProductTourCallbacks) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showPremiumCta, setShowPremiumCta] = useState(false);
  const [isInFormTour, setIsInFormTour] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!hasSeenTour) {
      // Delay para garantir que os elementos estejam renderizados
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setShowPremiumCta(true);
    setIsInFormTour(false);
    callbacks?.onCloseExpenseForm?.();
  }, [callbacks]);

  const closeTour = useCallback(() => {
    setIsOpen(false);
    setShowPremiumCta(false);
    setCurrentStep(0);
    setIsInFormTour(false);
    callbacks?.onCloseExpenseForm?.();
  }, [callbacks]);

  const closePremiumCta = useCallback(() => {
    setShowPremiumCta(false);
    setIsOpen(false);
  }, []);

  const nextStep = useCallback(() => {
    const currentStepData = tourSteps[currentStep];
    
    // Se o passo atual tem ação de abrir formulário
    if (currentStepData?.action === "open-expense-form") {
      callbacks?.onOpenExpenseForm?.();
      setIsInFormTour(true);
      // Delay para o formulário abrir antes de mudar o passo
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 500);
      return;
    }

    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  }, [currentStep, completeTour, callbacks]);

  const prevStep = useCallback(() => {
    const prevStepIndex = currentStep - 1;
    const prevStepData = tourSteps[prevStepIndex];
    
    // Se estava no formulário e volta para o passo do FAB, fecha o formulário
    if (isInFormTour && prevStepData?.action === "open-expense-form") {
      callbacks?.onCloseExpenseForm?.();
      setIsInFormTour(false);
    }

    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep, isInFormTour, callbacks]);

  const skipTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    closeTour();
  }, [closeTour]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setCurrentStep(0);
    setShowPremiumCta(false);
    setIsInFormTour(false);
    setIsOpen(true);
  }, []);

  return {
    isOpen,
    currentStep,
    totalSteps: tourSteps.length,
    currentStepData: tourSteps[currentStep],
    showPremiumCta,
    isInFormTour,
    nextStep,
    prevStep,
    skipTour,
    closeTour,
    resetTour,
    closePremiumCta,
  };
}
