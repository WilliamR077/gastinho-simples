import { useState, useEffect, useCallback } from "react";

const TOUR_STORAGE_KEY = "gastinho_tour_completed";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right";
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
    target: "[data-tour='fab-button']",
    title: "Adicione gastos rapidamente ➕",
    description: "Toque no + para adicionar despesas, despesas fixas ou metas de gastos!",
    placement: "top",
  },
];

export function useProductTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [showPremiumCta, setShowPremiumCta] = useState(false);

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
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
    setShowPremiumCta(false);
    setCurrentStep(0);
  }, []);

  const closePremiumCta = useCallback(() => {
    setShowPremiumCta(false);
    setIsOpen(false);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  }, [currentStep, completeTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    closeTour();
  }, [closeTour]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setCurrentStep(0);
    setShowPremiumCta(false);
    setIsOpen(true);
  }, []);

  return {
    isOpen,
    currentStep,
    totalSteps: tourSteps.length,
    currentStepData: tourSteps[currentStep],
    showPremiumCta,
    nextStep,
    prevStep,
    skipTour,
    closeTour,
    resetTour,
    closePremiumCta,
  };
}
