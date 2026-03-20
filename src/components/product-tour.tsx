import { TourOverlay } from "./tour-overlay";
import { TourStepTooltip } from "./tour-step";
import { TourPremiumCta } from "./tour-premium-cta";
import { useProductTour, tourSteps } from "@/hooks/use-product-tour";
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
import { Sparkles, BookOpen } from "lucide-react";

export function ProductTour() {
  const {
    isOpen,
    currentStep,
    totalSteps,
    currentStepData,
    showPremiumCta,
    showOnboardingPrompt,
    nextStep,
    prevStep,
    skipTour,
    closePremiumCta,
    closeOnboardingPrompt,
    showPremiumCtaAfterSkip,
  } = useProductTour();

  const { startOnboarding, isCompleted: onboardingCompleted } = useOnboardingTour();

  const handleStartOnboarding = () => {
    closeOnboardingPrompt();
    startOnboarding();
  };

  const handleSkipOnboarding = () => {
    // User skipped onboarding → show Premium CTA
    showPremiumCtaAfterSkip();
  };

  // Show onboarding prompt only if onboarding not yet completed
  const shouldShowOnboardingPrompt = showOnboardingPrompt && !onboardingCompleted;
  // If onboarding already completed, skip straight to premium CTA
  const shouldShowPremiumCta = showPremiumCta || (showOnboardingPrompt && onboardingCompleted);

  if (!isOpen && !shouldShowPremiumCta && !shouldShowOnboardingPrompt) return null;

  return (
    <>
      {/* Overlay com spotlight */}
      <TourOverlay
        targetSelector={currentStepData?.target || ""}
        isVisible={isOpen && !shouldShowPremiumCta && !shouldShowOnboardingPrompt}
      />

      {/* Tooltip do passo atual */}
      {currentStepData && (
        <TourStepTooltip
          step={currentStepData}
          currentStep={currentStep}
          totalSteps={totalSteps}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTour}
          isVisible={isOpen && !shouldShowPremiumCta && !shouldShowOnboardingPrompt}
        />
      )}

      {/* CTA Premium (after skipping onboarding or if onboarding already done) */}
      <TourPremiumCta isVisible={shouldShowPremiumCta} onClose={closePremiumCta} />

      {/* Pergunta sobre Onboarding (after tour ends, before premium CTA) */}
      <Dialog open={shouldShowOnboardingPrompt} onOpenChange={(open) => !open && handleSkipOnboarding()}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-purple-600 rounded-full flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <DialogTitle className="text-2xl">
              Quer ajuda para configurar sua conta?
            </DialogTitle>
            <DialogDescription className="text-base">
              Podemos te guiar passo a passo para configurar tudo: adicionar cartões,
              registrar despesas, definir metas e muito mais!
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button onClick={handleStartOnboarding} className="w-full" size="lg">
              <Sparkles className="w-4 h-4 mr-2" />
              Sim, me ajude!
            </Button>
            <Button
              variant="outline"
              onClick={handleSkipOnboarding}
              className="w-full"
            >
              Não, vou explorar sozinho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Exportar hook para uso externo
export { useProductTour } from "@/hooks/use-product-tour";
