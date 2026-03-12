import { useState, useEffect, useCallback } from "react";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";
import { useNavigate } from "react-router-dom";
import { OnboardingOverlay } from "@/components/onboarding/onboarding-overlay";
import { OnboardingTooltip } from "@/components/onboarding/onboarding-tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Crown, Users, FileText, Download } from "lucide-react";

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
    skipOnboarding,
    skipCurrentStep,
    advanceSubstep,
    repeatStep,
    proceedToNextStep,
    closeCompletionDialog,
    isCurrentTargetValid,
  } = useOnboardingTour();

  const navigate = useNavigate();
  const [validationTick, setValidationTick] = useState(0);

  // Poll validation state for fill/select substeps
  useEffect(() => {
    if (!isOpen || !currentSubstep?.requiresValidation) return;
    const interval = setInterval(() => {
      setValidationTick((t) => t + 1);
    }, 300);
    return () => clearInterval(interval);
  }, [isOpen, currentSubstep?.id]);

  const isValid = currentSubstep?.requiresValidation
    ? isCurrentTargetValid()
    : true;

  const handleNavigateNext = useCallback(() => {
    if (!currentSubstep) return;

    if (currentSubstep.actionType === "navigate" && currentSubstep.navigateTo) {
      navigate(currentSubstep.navigateTo);
      // The route-based auto-advance in the engine will handle the rest
      return;
    }

    advanceSubstep();
  }, [currentSubstep, navigate, advanceSubstep]);

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
              Você configurou sua conta com sucesso! Agora está tudo pronto para
              ter controle total das suas finanças.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {["Cartões configurados", "Primeira despesa registrada", "Metas definidas"].map((text) => (
              <div key={text} className="flex items-center gap-3 text-sm">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-green-500" />
                </div>
                <span>{text}</span>
              </div>
            ))}
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
  const hasTarget = !!currentSubstep.targetSelector;
  const isNavigateWithoutTarget =
    currentSubstep.actionType === "navigate" && !currentSubstep.targetSelector;
  const isCompletion = currentSubstep.actionType === "completion";

  // ─── Navigate / Completion: use centered dialog ───────────
  if (isNavigateWithoutTarget || isCompletion) {
    return (
      <>
        {/* Light overlay for navigate/completion */}
        <div className="fixed inset-0 z-[55] bg-black/60" />
        <OnboardingTooltip
          substep={currentSubstep}
          stepIndex={currentStepIndex}
          totalSteps={totalSteps}
          substepIndex={currentSubstepIndex}
          totalSubsteps={totalSubsteps}
          progress={progress}
          isValid={isValid}
          onNext={handleNavigateNext}
          onSkipStep={skipCurrentStep}
          onClose={skipOnboarding}
          onRepeat={isCompletion ? repeatStep : undefined}
          onProceed={isCompletion ? proceedToNextStep : undefined}
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
        substep={currentSubstep}
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
        onSkipSubstep={currentSubstep.skipLabel ? advanceSubstep : undefined}
      />
    </>
  );
}
