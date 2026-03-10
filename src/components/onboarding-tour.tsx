import { useEffect, useRef } from "react";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Sparkles, Crown, Users, FileText, Download, Plus, ArrowRight, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function OnboardingTour() {
  const {
    isOpen,
    currentStep,
    currentStepIndex,
    totalSteps,
    progress,
    showCompletionDialog,
    subPhase,
    skipOnboarding,
    skipCurrentStep,
    navigateToStep,
    closeCompletionDialog,
    addAnotherItem,
    proceedToNextStep,
  } = useOnboardingTour();

  const navigate = useNavigate();
  const spotlightCleanupRef = useRef<(() => void) | null>(null);

  // Spotlight effect: highlight target element when in "arrived" phase
  useEffect(() => {
    // Clean up previous spotlight
    if (spotlightCleanupRef.current) {
      spotlightCleanupRef.current();
      spotlightCleanupRef.current = null;
    }

    if (!isOpen || subPhase !== "arrived" || !currentStep?.onboardingTarget) return;

    const applySpotlight = () => {
      const target = document.querySelector(`[data-onboarding="${currentStep.onboardingTarget}"]`) as HTMLElement;
      if (!target) return;

      // Add spotlight classes
      target.classList.add(
        "ring-4", "ring-primary", "animate-pulse", "relative", "z-[60]",
        "shadow-[0_0_20px_rgba(var(--primary),0.5)]"
      );
      target.style.setProperty("box-shadow", "0 0 0 4px hsl(var(--primary) / 0.3), 0 0 20px hsl(var(--primary) / 0.2)");

      spotlightCleanupRef.current = () => {
        target.classList.remove(
          "ring-4", "ring-primary", "animate-pulse", "relative", "z-[60]",
          "shadow-[0_0_20px_rgba(var(--primary),0.5)]"
        );
        target.style.removeProperty("box-shadow");
      };
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(applySpotlight, 300);
    return () => {
      clearTimeout(timer);
      if (spotlightCleanupRef.current) {
        spotlightCleanupRef.current();
        spotlightCleanupRef.current = null;
      }
    };
  }, [isOpen, subPhase, currentStep?.onboardingTarget]);

  // Get step content based on subPhase
  const getStepContent = () => {
    if (!currentStep) return { title: "", description: "", emoji: "" };

    switch (subPhase) {
      case "arrived":
        return {
          title: currentStep.arrivedTitle || currentStep.title,
          description: currentStep.arrivedDescription || currentStep.description,
          emoji: "👆",
        };
      case "form-open":
        return {
          title: currentStep.formOpenTitle || currentStep.title,
          description: currentStep.formOpenDescription || currentStep.description,
          emoji: "📝",
        };
      case "completed":
        return {
          title: currentStep.completedTitle || "Concluído!",
          description: currentStep.completedDescription || "Item adicionado com sucesso!",
          emoji: "🎉",
        };
      default:
        return {
          title: currentStep.title,
          description: currentStep.description,
          emoji: currentStep.emoji,
        };
    }
  };

  const stepContent = getStepContent();

  if (!isOpen && !showCompletionDialog) return null;

  // Completion dialog
  if (showCompletionDialog) {
    return (
      <Dialog open={showCompletionDialog} onOpenChange={closeCompletionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-white" />
            </div>
            <DialogTitle className="text-2xl">
              Parabéns! Você está pronto! 🎉
            </DialogTitle>
            <DialogDescription className="text-base">
              Você configurou sua conta com sucesso! Agora está tudo pronto para você
              ter controle total das suas finanças.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-green-500" />
              </div>
              <span>Cartões configurados</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-green-500" />
              </div>
              <span>Primeira despesa registrada</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-4 h-4 text-green-500" />
              </div>
              <span>Metas definidas</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Quer ainda mais recursos?</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Com o <strong>Premium</strong> você ganha:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Grupos compartilhados
              </li>
              <li className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Relatórios avançados
              </li>
              <li className="flex items-center gap-2">
                <Download className="w-4 h-4 text-primary" />
                Exportação em PDF/Excel
              </li>
            </ul>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button
              onClick={() => {
                closeCompletionDialog();
                navigate("/subscription");
              }}
              className="w-full"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Conhecer Premium
            </Button>
            <Button
              variant="outline"
              onClick={closeCompletionDialog}
              className="w-full"
            >
              Começar a usar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!currentStep) return null;

  // For "arrived" and "form-open" phases: render a non-blocking floating banner
  const isInteractivePhase = subPhase === "arrived" || subPhase === "form-open";

  if (isInteractivePhase) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3 pointer-events-none">
        <div className="max-w-lg mx-auto bg-card border border-border rounded-xl shadow-2xl p-4 pointer-events-auto">
          {/* Progress */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{stepContent.emoji}</span>
              <span className="text-xs text-muted-foreground font-medium">
                Passo {currentStepIndex + 1} de {totalSteps}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {currentStep.optional && (
                <Button variant="ghost" size="sm" onClick={skipCurrentStep} className="text-xs h-7 px-2">
                  Pular
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={skipOnboarding} className="h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-1">
            <h3 className="font-semibold text-sm">{stepContent.title}</h3>
            <p className="text-xs text-muted-foreground">{stepContent.description}</p>
          </div>

          {/* Progress bar */}
          <Progress value={progress} className="h-1 mt-3" />
        </div>
      </div>
    );
  }

  // For "navigate" and "completed" phases: use Dialog modal
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Passo {currentStepIndex + 1} de {totalSteps}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="text-center space-y-3">
            <div className="text-5xl">{stepContent.emoji}</div>
            <DialogTitle className="text-xl">{stepContent.title}</DialogTitle>
            <DialogDescription className="text-base">
              {stepContent.description}
            </DialogDescription>
            {currentStep.exampleText && subPhase === "navigate" && (
              <p className="text-sm text-muted-foreground italic">
                {currentStep.exampleText}
              </p>
            )}
          </div>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          {/* navigate phase */}
          {subPhase === "navigate" && currentStep.action === "navigate" && (
            <Button onClick={navigateToStep} className="w-full" size="lg">
              {currentStep.targetRoute === "/cards"
                ? "Ir para Cartões"
                : currentStep.targetRoute === "/settings"
                ? "Ir para Configurações"
                : "Continuar"}
            </Button>
          )}

          {/* completed phase */}
          {subPhase === "completed" && (
            <div className="flex flex-col gap-2 w-full">
              <Button onClick={addAnotherItem} variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar outro
              </Button>
              <Button onClick={proceedToNextStep} className="w-full">
                <ArrowRight className="h-4 w-4 mr-2" />
                Prosseguir
              </Button>
            </div>
          )}

          {/* wait steps */}
          {currentStep.action === "wait" && subPhase === "navigate" && (
            <div className="w-full p-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
              Aguardando você completar esta ação...
            </div>
          )}

          {/* Secondary buttons */}
          <div className="flex gap-2 w-full">
            {currentStep.optional && subPhase !== "completed" && (
              <Button
                variant="outline"
                onClick={skipCurrentStep}
                className="flex-1"
              >
                Pular
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={skipOnboarding}
              className="flex-1"
              size="sm"
            >
              Sair do tutorial
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
