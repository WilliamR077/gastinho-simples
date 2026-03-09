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
    target: "[data-tour='context-selector']",
    title: "Grupos compartilhados 👥",
    description: "Divida gastos com família, amigos ou em viagens! Todos podem participar. Criar grupo é Premium.",
    placement: "bottom",
  },
  {
    target: "[data-tour='month-navigator']",
    title: "Navegue pelos meses",
    description: "Use as setas para ver gastos de meses anteriores ou futuros.",
    placement: "bottom",
  },
  {
    target: "[data-tour='view-mode-toggle']",
    title: "Modo Fatura 💳",
    description: "Alterne entre Calendário e Fatura! No modo Fatura, você vê os gastos do cartão de crédito agrupados pelo período de cobrança.",
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
    target: "[data-tour='tab-expenses']",
    title: "Aba Despesas 💸",
    description: "Aqui ficam todas as suas despesas do mês. Você também pode ver e gerenciar suas Despesas Fixas (recorrentes).",
    placement: "top",
  },
  {
    target: "[data-tour='tab-incomes']",
    title: "Aba Entradas 💰",
    description: "Registre suas receitas mensais como salário, freelance ou vendas. Também tem Entradas Fixas para receitas recorrentes!",
    placement: "top",
  },
  {
    target: "[data-tour='tab-goals']",
    title: "Aba Metas 🎯",
    description: "Defina limites de gastos por categoria ou total do mês. Receba alertas quando estiver perto de estourar!",
    placement: "top",
  },
  {
    target: "[data-tour='reports-button']",
    title: "Relatórios detalhados 📊",
    description: "Gráficos e análises dos seus gastos. Períodos avançados (trimestre, ano) são Premium!",
    placement: "bottom",
  },
  {
    target: "[data-tour='values-toggle']",
    title: "Mostrar/Esconder valores 👁️",
    description: "Se alguém estiver por perto, esconda seus valores com um toque! Sua privacidade é importante.",
    placement: "bottom",
  },
  {
    target: "[data-tour='menu-button']",
    title: "Menu lateral ☰",
    description: "Aqui você acessa Cartões, Configurações, Lembretes, Conta e muito mais. Tudo organizado num só lugar!",
    placement: "bottom",
  },
  {
    target: "[data-tour='fab-main-button']",
    title: "Adicione gastos rapidamente ➕",
    description: "Toque no '+' para registrar despesas, receitas ou metas. Também tem calculadora integrada para fazer contas na hora!",
    placement: "top",
  },
  {
    target: "[data-tour='fab-main-button']",
    title: "Tudo pronto! 🎉",
    description: "Agora você sabe usar o Gastinho Simples! Comece adicionando seu primeiro gasto e veja suas finanças tomando forma.",
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
