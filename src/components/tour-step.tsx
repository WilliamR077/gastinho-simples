import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TourStep as TourStepType } from "@/hooks/use-product-tour";

interface TourStepProps {
  step: TourStepType;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isVisible: boolean;
}

interface Position {
  top: number;
  left: number;
}

const TOOLTIP_WIDTH = 300;
const PADDING = 16;

export function TourStepTooltip({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  isVisible,
}: TourStepProps) {
  // Handlers com stopPropagation para evitar fechar o Sheet
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onNext();
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onPrev();
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSkip();
  };
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isVisible) return;

    const targetElement = document.querySelector(step.target);
    
    // Auto-scroll para o elemento alvo
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }

    const updatePosition = () => {
      const element = document.querySelector(step.target);
      const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
      const tooltipWidth = Math.min(TOOLTIP_WIDTH, window.innerWidth - PADDING * 2);
      
      if (!element) {
        // Se o elemento não existir, centraliza na tela
        setPosition({
          top: window.innerHeight / 2 - tooltipHeight / 2,
          left: window.innerWidth / 2 - tooltipWidth / 2,
        });
        setIsPositioned(true);
        return;
      }

      const rect = element.getBoundingClientRect();

      let top = 0;
      let left = 0;

      switch (step.placement) {
        case "top":
          top = rect.top - tooltipHeight - PADDING;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case "bottom":
          top = rect.bottom + PADDING;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case "left":
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - PADDING;
          break;
        case "right":
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + PADDING;
          break;
      }

      // Garantir que o tooltip não saia da tela horizontalmente
      if (left < PADDING) left = PADDING;
      if (left + tooltipWidth > window.innerWidth - PADDING) {
        left = window.innerWidth - tooltipWidth - PADDING;
      }
      
      // Garantir que o tooltip não saia da tela verticalmente
      if (top < PADDING) top = PADDING;
      if (top + tooltipHeight > window.innerHeight - PADDING) {
        top = window.innerHeight - tooltipHeight - PADDING;
      }

      setPosition({ top, left });
      setIsPositioned(true);
    };

    // Delay maior para o scroll completar antes de posicionar o tooltip
    const timer = setTimeout(updatePosition, 400);
    // Segundo update para pegar altura real do tooltip
    const timer2 = setTimeout(updatePosition, 500);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [step, isVisible]);

  if (!isVisible || !isPositioned) return null;

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div
      ref={tooltipRef}
      className={cn(
        "fixed z-[9999] w-[300px] max-w-[calc(100vw-32px)] bg-card border border-border rounded-xl shadow-2xl",
        "transform transition-all duration-300 ease-out",
        "animate-in fade-in-0 zoom-in-95"
      )}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <span className="text-sm font-medium text-muted-foreground">
          {currentStep + 1} de {totalSteps}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleSkip}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <h3 className="text-lg font-semibold">{step.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {step.description}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-3 border-t border-border bg-muted/30 rounded-b-xl gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePrev}
          disabled={isFirstStep}
          className="gap-1 px-2"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>

        <Button
          size="sm"
          onClick={handleNext}
          className="gap-1 px-2"
        >
          {isLastStep ? "Finalizar" : "Próximo"}
          {!isLastStep && <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
