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
import { Check, Sparkles, Crown, Users, FileText, Download, Circle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdBannerLock } from "@/services/admob-visibility-coordinator";

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

type CompletionPhase = "success" | "premium";

// IDs whose tooltip should render in compact mode (when shown inside the
// category manager sheet so it doesn't dominate the screen).
const COMPACT_SUBSTEP_PREFIXES = [
  "expense-category-manager-",
  "recurring-category-manager-",
  "income-category-manager-",
  // Budget/meta substeps render compact so the tooltip doesn't dominate the
  // form sheet and overlap highlighted fields on small viewports.
  "budget-",
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
    goBackSubstep,
    canGoBack,
    repeatStep,
    proceedToNextStep,
    closeCompletionDialog,
    isCurrentTargetValid,
  } = useOnboardingTour();

  const navigate = useNavigate();
  const { features } = useSubscription();
  const [validationTick, setValidationTick] = useState(0);
  const [cardCount, setCardCount] = useState(0);
  const [completionPhase, setCompletionPhase] = useState<CompletionPhase>("success");

  // Reset completion phase whenever the dialog opens fresh.
  useEffect(() => {
    if (showCompletionDialog) setCompletionPhase("success");
  }, [showCompletionDialog]);

  // Hide AdMob banner while completion dialog is open so nothing covers buttons.
  useAdBannerLock("onboarding-completion", showCompletionDialog);

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
    const skipEvent = `${currentSubstep.id}-skipped`;
    window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: skipEvent }));
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

  // ─── Completion dialog (2 phases: success → premium) ──────
  if (showCompletionDialog) {
    return (
      <Dialog open onOpenChange={closeCompletionDialog}>
        <DialogContent className="max-w-md">
          {completionPhase === "success" ? (
            <>
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

              <DialogFooter
                className="flex-col sm:flex-col gap-2"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              >
                <Button
                  onClick={() => setCompletionPhase("premium")}
                  className="w-full h-12 text-base font-medium"
                >
                  Continuar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-purple-500 rounded-full flex items-center justify-center">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <DialogTitle className="text-2xl">
                  Quer ainda mais recursos?
                </DialogTitle>
                <DialogDescription className="text-base">
                  Com o <strong>Premium</strong> você desbloqueia:
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <span>Grupos compartilhados</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <span>Relatórios avançados</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4 text-primary" />
                  </div>
                  <span>Exportação em PDF/Excel</span>
                </div>
              </div>

              <DialogFooter
                className="flex-col sm:flex-col gap-2"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              >
                <Button
                  onClick={() => {
                    closeCompletionDialog();
                    navigate("/subscription");
                  }}
                  className="w-full h-12 text-base font-medium"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Conhecer Premium
                </Button>
                <Button
                  variant="outline"
                  onClick={closeCompletionDialog}
                  className="w-full h-12 text-base font-medium"
                >
                  Talvez depois
                </Button>
              </DialogFooter>
            </>
          )}
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

  const isCompactSubstep = COMPACT_SUBSTEP_PREFIXES.some((p) =>
    currentSubstep.id.startsWith(p)
  );

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
          onBack={canGoBack ? goBackSubstep : undefined}
          compact={isCompactSubstep}
        />
      </>
    );
  }

  // ─── Interactive substep with target: overlay + tooltip ───
  // When `noSpotlight` is true, render only the tooltip anchored to the
  // target — no dark overlay, no spotlight, full screen interactive.
  if (currentSubstep.noSpotlight) {
    return (
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
        onBack={canGoBack ? goBackSubstep : undefined}
        compact={isCompactSubstep}
      />
    );
  }

  return (
    <>
      <OnboardingOverlay
        targetSelector={currentSubstep.targetSelector}
        isVisible={true}
        lockTarget={currentSubstep.lockTarget}
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
        onBack={canGoBack ? goBackSubstep : undefined}
        compact={isCompactSubstep}
      />
    </>
  );
}
