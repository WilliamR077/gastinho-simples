import { useState, useEffect, useCallback } from "react";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/use-subscription";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";
import { OnboardingTooltip } from "@/components/onboarding/onboarding-tooltip";
import { STEP_LABELS } from "@/lib/onboarding/onboarding-steps";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Crown, Users, FileText, Download, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Map step IDs to completion labels
const ALL_STEP_IDS = [
  "add-card",
  "add-expense",
  "add-recurring-expense",
  "add-income",
  "add-budget-goal",
  "view-reports",
  "setup-settings",
];

export function OnboardingTour() {
  const {
    isOpen,
    currentStep,
    currentSubstep,
    currentStepIndex,
    currentSubstepIndex,
    totalSteps,
    totalSubsteps,
    progress,
    showCompletionDialog,
    completedSteps,
    skipOnboarding,
    skipCurrentStep,
    advanceSubstep,
    repeatStep,
    proceedToNextStep,
    closeCompletionDialog,
    isCurrentTargetValid,
  } = useOnboardingTour();

  const navigate = useNavigate();
  const { features } = useSubscription();
  const [validationTick, setValidationTick] = useState(0);
  const [cardCount, setCardCount] = useState(0);

  // Poll validation state for fill/select substeps
  useEffect(() => {
    if (!isOpen || !currentSubstep?.requiresValidation) return;
    const interval = setInterval(() => {
      setValidationTick((t) => t + 1);
    }, 300);
    return () => clearInterval(interval);
  }, [isOpen, currentSubstep?.id]);

  // Load card count for smart completion message
  useEffect(() => {
    if (!isOpen || currentStep?.id !== "add-card") return;
    const loadCount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { count } = await supabase
        .from("cards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);
      setCardCount(count || 0);
    };
    loadCount();
  }, [isOpen, currentStep?.id, currentSubstep?.id]);

  const isValid = currentSubstep?.requiresValidation
    ? isCurrentTargetValid()
    : true;

  const handleNavigateNext = useCallback(() => {
    if (!currentSubstep) return;

    if (currentSubstep.actionType === "navigate" && currentSubstep.navigateTo) {
      navigate(currentSubstep.navigateTo);
      // If has autoAdvanceOnRoute, the engine handles it. Otherwise advance now.
      if (!currentSubstep.autoAdvanceOnRoute) {
        advanceSubstep();
      }
      return;
    }

    // For "info" substeps, just advance
    advanceSubstep();
  }, [currentSubstep, navigate, advanceSubstep]);

  // Handle skip for info substeps: advance past (not skip entire step)
  // and fire a skip event so conditional substeps can be skipped
  const handleSkipSubstep = useCallback(() => {
    if (!currentSubstep) return;
    // Dispatch a skip event based on the substep id (e.g. "settings-import" → "settings-import-skipped")
    const skipEvent = `${currentSubstep.id}-skipped`;
    window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: skipEvent }));
    // For intro substeps that skip the entire step (like recurring-intro, income-intro)
    // check if this is the first substep — if so, skip the whole step
    if (currentSubstepIndex === 0) {
      skipCurrentStep();
    } else {
      advanceSubstep();
    }
  }, [currentSubstep, currentSubstepIndex, skipCurrentStep, advanceSubstep]);

  // ─── Dynamic card completion description ──────────────
  const getCardCompletionDescription = () => {
    const maxCards = features.cards;
    const remaining = maxCards - cardCount;
    if (remaining <= 0) {
      return `Seu cartão foi adicionado! Você atingiu o limite de ${maxCards} cartões do plano gratuito. Faça upgrade para adicionar mais!`;
    }
    if (remaining === 1) {
      return `Seu cartão foi adicionado! Você ainda pode adicionar mais 1 cartão no plano gratuito.`;
    }
    return `Seu cartão foi adicionado com sucesso! Deseja adicionar outro ou prosseguir?`;
  };

  // ─── Completion dialog ──────────────────────────────────
  if (showCompletionDialog) {
    return (
      <Dialog open onOpenChange={closeCompletionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-white" />
            </div>
            <DialogTitle className="text-2xl">
              Parabéns! Você está pronto! 🎉
            </DialogTitle>
            <DialogDescription className="text-base">
              Veja o que você configurou na sua conta:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {ALL_STEP_IDS.map((id) => {
              const isCompleted = completedSteps.has(id);
              const label = STEP_LABELS[id] || id;
              return (
                <div key={id} className="flex items-center gap-3 text-sm">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isCompleted ? "bg-green-500/20" : "bg-muted"
                  }`}>
                    {isCompleted ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Circle className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <span className={isCompleted ? "" : "text-muted-foreground"}>
                    {label}
                  </span>
                </div>
              );
            })}
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
            <Button variant="outline" onClick={closeCompletionDialog} className="w-full">
              Começar a usar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (!isOpen || !currentStep || !currentSubstep) return null;

  // ─── Determine if this substep uses overlay (has a target) ─
  const isNavigateWithoutTarget =
    currentSubstep.actionType === "navigate" && !currentSubstep.targetSelector;
  const isInfoWithoutTarget =
    currentSubstep.actionType === "info" && !currentSubstep.targetSelector;
  const isCompletion = currentSubstep.actionType === "completion";

  // ─── Override description for card completion ─────────────
  const effectiveSubstep = { ...currentSubstep };
  if (isCompletion && currentStep.id === "add-card") {
    effectiveSubstep.description = getCardCompletionDescription();
    // Hide "Adicionar outro" if at card limit
    const maxCards = features.cards;
    if (cardCount >= maxCards) {
      effectiveSubstep.repeatLabel = undefined;
    }
  }

  // ─── Navigate / Info / Completion: use centered dialog ────
  if (isNavigateWithoutTarget || isInfoWithoutTarget || isCompletion) {
    return (
      <>
        {/* Light overlay for navigate/info/completion */}
        <div className="fixed inset-0 z-[55] bg-black/60" />
        <OnboardingTooltip
          substep={effectiveSubstep}
          stepIndex={currentStepIndex}
          totalSteps={totalSteps}
          substepIndex={currentSubstepIndex}
          totalSubsteps={totalSubsteps}
          progress={progress}
          isValid={isValid}
          onNext={handleNavigateNext}
          onSkipStep={skipCurrentStep}
          onClose={skipOnboarding}
          onRepeat={isCompletion && effectiveSubstep.repeatLabel ? repeatStep : undefined}
          onProceed={isCompletion ? proceedToNextStep : undefined}
          onSkipSubstep={effectiveSubstep.skipLabel ? handleSkipSubstep : undefined}
        />
      </>
    );
  }

  // ─── Interactive substep with target: overlay + tooltip ───
  return (
    <>
      <OnboardingOverlay
        targetSelector={currentSubstep.targetSelector}
        isVisible={true}
      />
      <OnboardingTooltip
        substep={effectiveSubstep}
        targetSelector={currentSubstep.targetSelector}
        stepIndex={currentStepIndex}
        totalSteps={totalSteps}
        substepIndex={currentSubstepIndex}
        totalSubsteps={totalSubsteps}
        progress={progress}
        isValid={isValid}
        onNext={advanceSubstep}
        onSkipStep={skipCurrentStep}
        onClose={skipOnboarding}
        onSkipSubstep={currentSubstep.skipLabel ? handleSkipSubstep : undefined}
      />
    </>
  );
}
