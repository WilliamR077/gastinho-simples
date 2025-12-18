import { TourOverlay } from "./tour-overlay";
import { TourStepTooltip } from "./tour-step";
import { TourPremiumCta } from "./tour-premium-cta";
import { useProductTour, tourSteps, ProductTourCallbacks } from "@/hooks/use-product-tour";

interface ProductTourProps {
  callbacks?: ProductTourCallbacks;
}

export function ProductTour({ callbacks }: ProductTourProps) {
  const {
    isOpen,
    currentStep,
    totalSteps,
    currentStepData,
    showPremiumCta,
    isInFormTour,
    nextStep,
    prevStep,
    skipTour,
    closePremiumCta,
  } = useProductTour(callbacks);

  if (!isOpen && !showPremiumCta) return null;

  return (
    <>
      {/* Overlay com spotlight */}
      <TourOverlay
        targetSelector={currentStepData?.target || ""}
        isVisible={isOpen && !showPremiumCta}
        blockAllInteractions={isInFormTour}
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
          isVisible={isOpen && !showPremiumCta}
        />
      )}

      {/* CTA Premium no final */}
      <TourPremiumCta isVisible={showPremiumCta} onClose={closePremiumCta} />
    </>
  );
}

// Exportar hook para uso externo
export { useProductTour } from "@/hooks/use-product-tour";
