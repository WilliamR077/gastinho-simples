import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, ArrowRight, SkipForward, Plus } from "lucide-react";
import type { OnboardingSubstep } from "@/lib/onboarding/onboarding-steps";
import { findReadyOnboardingTarget } from "@/lib/onboarding/target-utils";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface OnboardingTooltipProps {
  substep: OnboardingSubstep;
  targetSelector?: string;
  stepIndex: number;
  totalSteps: number;
  substepIndex: number;
  totalSubsteps: number;
  progress: number;
  isValid: boolean;
  onNext: () => void;
  onSkipStep: () => void;
  onClose: () => void;
  onRepeat?: () => void;
  onProceed?: () => void;
  onSkipSubstep?: () => void;
  // P1: back button for guided form flows
  onBack?: () => void;
}

export function OnboardingTooltip({
  substep,
  targetSelector,
  stepIndex,
  totalSteps,
  substepIndex,
  totalSubsteps,
  progress,
  isValid,
  onNext,
  onSkipStep,
  onClose,
  onRepeat,
  onProceed,
  onSkipSubstep,
  onBack,
}: OnboardingTooltipProps) {
  const [pos, setPos] = useState<{ top: number; left: number; placement: "above" | "below" } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const updatePosition = useCallback(() => {
    if (!targetSelector) {
      setPos(null);
      return;
    }

    const el = findReadyOnboardingTarget(targetSelector);
    if (!el) {
      setPos(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    const tooltipHeight = tooltipRef.current?.offsetHeight || 180;
    const tooltipWidth = Math.min(320, window.innerWidth - 32);
    const gap = 16;
    const padding = 8;
    const centerX = rect.left + rect.width / 2;
    let left = centerX - tooltipWidth / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));

    const clampTop = (top: number) =>
      Math.max(8, Math.min(top, window.innerHeight - tooltipHeight - 8));

    const getOverlapArea = (top: number) => {
      const tooltipBottom = top + tooltipHeight;
      const tooltipRight = left + tooltipWidth;
      const overlapWidth = Math.max(0, Math.min(tooltipRight, rect.right) - Math.max(left, rect.left));
      const overlapHeight = Math.max(0, Math.min(tooltipBottom, rect.bottom) - Math.max(top, rect.top));
      return overlapWidth * overlapHeight;
    };

    const preferredPlacements: Array<"above" | "below"> =
      substep.placement === "above"
        ? ["above", "below"]
        : substep.placement === "below"
          ? ["below", "above"]
          : [window.innerHeight - rect.bottom >= rect.top ? "below" : "above", window.innerHeight - rect.bottom >= rect.top ? "above" : "below"];

    const candidates = preferredPlacements.map((placement) => {
      const initialTop =
        placement === "above"
          ? rect.top - padding - gap - tooltipHeight
          : rect.bottom + padding + gap;
      const top = clampTop(initialTop);

      return {
        placement,
        top,
        overlapArea: getOverlapArea(top),
      };
    });

    const bestCandidate =
      candidates.find((candidate) => candidate.overlapArea === 0) ??
      candidates.sort((a, b) => a.overlapArea - b.overlapArea)[0];

    setPos({ top: bestCandidate.top, left, placement: bestCandidate.placement });
  }, [targetSelector, substep.placement]);

  useEffect(() => {
    if (!targetSelector) {
      setPos(null);
      return;
    }

    let running = true;
    const loop = () => {
      if (!running) return;
      updatePosition();
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [targetSelector, updatePosition]);

  // For navigate/completion: center in screen
  const isCentered = !targetSelector;

  const tooltipContent = (
    <div
      ref={tooltipRef}
      className="bg-card border border-border rounded-xl shadow-2xl p-4"
      style={{ maxWidth: "min(320px, calc(100vw - 32px))" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{substep.emoji}</span>
          <span className="text-xs text-muted-foreground font-medium">
            Passo {stepIndex + 1} de {totalSteps}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkipStep}
            className="text-xs h-7 px-2"
          >
            <SkipForward className="h-3 w-3 mr-1" />
            Pular etapa
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-1 mb-3">
        <h3 className="font-semibold text-sm">{substep.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {substep.description}
        </p>
      </div>

      {/* Action buttons based on type */}
      {substep.actionType === "fill" && substep.requiresValidation && (
        <Button
          size="sm"
          onClick={onNext}
          disabled={!isValid}
          className="w-full mt-2"
        >
          Próximo
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      )}

      {substep.actionType === "select" && substep.requiresValidation && (
        <Button
          size="sm"
          onClick={onNext}
          disabled={!isValid}
          className="w-full mt-2"
        >
          Próximo
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      )}

      {substep.actionType === "optional-group" && (
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onSkipSubstep || onNext}
            className="flex-1"
          >
            {substep.skipLabel || "Pular"}
          </Button>
          <Button size="sm" onClick={onNext} className="flex-1">
            Continuar
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}

      {substep.actionType === "navigate" && substep.navigateLabel && (
        <Button size="sm" onClick={onNext} className="w-full mt-2">
          {substep.navigateLabel}
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      )}

      {substep.actionType === "info" && (
        <div className={`flex ${substep.skipLabel && onSkipSubstep ? "flex-col sm:flex-row gap-2" : ""} mt-2`}>
          {substep.skipLabel && onSkipSubstep && (
            <Button size="sm" variant="outline" onClick={onSkipSubstep} className="flex-1">
              {substep.skipLabel}
            </Button>
          )}
          <Button size="sm" onClick={onNext} className={substep.skipLabel && onSkipSubstep ? "flex-1" : "w-full"}>
            {substep.navigateLabel || "Continuar"}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}

      {substep.actionType === "completion" && (
        <div className="flex flex-col gap-2 mt-2">
          {onRepeat && (
            <Button size="sm" variant="outline" onClick={onRepeat} className="w-full">
              <Plus className="h-3 w-3 mr-1" />
              {substep.repeatLabel || "Adicionar outro"}
            </Button>
          )}
          {onProceed && (
            <Button size="sm" onClick={onProceed} className="w-full">
              <ArrowRight className="h-3 w-3 mr-1" />
              {substep.proceedLabel || "Prosseguir"}
            </Button>
          )}
        </div>
      )}

      {/* Progress bar */}
      <Progress value={progress} className="h-1 mt-3" />
    </div>
  );

  if (isCentered) {
    return (
      <div className="fixed inset-0 z-[65] flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto mx-4">{tooltipContent}</div>
      </div>
    );
  }

  if (!pos) {
    // Target not found yet — show centered fallback
    return (
      <div className="fixed inset-0 z-[65] flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto mx-4">{tooltipContent}</div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-[65] pointer-events-none"
      style={{
        top: pos.top,
        left: pos.left,
        width: Math.min(320, window.innerWidth - 32),
      }}
    >
      {/* Arrow */}
      <div className="pointer-events-auto relative">
        {tooltipContent}
      </div>
    </div>
  );
}
