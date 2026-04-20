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
  /**
   * Compact mode: smaller card, smaller text, hides "Pular etapa" — used when
   * the tooltip is rendered inside a sheet (e.g. category manager) so it
   * doesn't overlap the highlighted area.
   */
  compact?: boolean;
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
  compact = false,
}: OnboardingTooltipProps) {
  const [pos, setPos] = useState<{ top: number; left: number; placement: "above" | "below" | "left" | "right" } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const maxTooltipWidth = compact ? 280 : 320;

  // Budget substeps tend to render inside form sheets on small viewports, so
  // we allow a larger gap between the tooltip and the highlighted target and
  // enable a horizontal (left/right) fallback when above/below would overlap.
  const isBudgetSubstep = substep.id?.startsWith("budget-");

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
    const tooltipWidth = Math.min(maxTooltipWidth, window.innerWidth - 32);
    const gap = isBudgetSubstep ? 24 : 16;
    const padding = 8;

    const clampLeft = (left: number) =>
      Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    const clampTop = (top: number) =>
      Math.max(8, Math.min(top, window.innerHeight - tooltipHeight - 8));

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const getOverlapArea = (top: number, left: number) => {
      const tooltipBottom = top + tooltipHeight;
      const tooltipRight = left + tooltipWidth;
      const overlapWidth = Math.max(0, Math.min(tooltipRight, rect.right) - Math.max(left, rect.left));
      const overlapHeight = Math.max(0, Math.min(tooltipBottom, rect.bottom) - Math.max(top, rect.top));
      return overlapWidth * overlapHeight;
    };

    const verticalLeft = clampLeft(centerX - tooltipWidth / 2);

    const preferredPlacements: Array<"above" | "below"> =
      substep.placement === "above"
        ? ["above", "below"]
        : substep.placement === "below"
          ? ["below", "above"]
          : [
              window.innerHeight - rect.bottom >= rect.top ? "below" : "above",
              window.innerHeight - rect.bottom >= rect.top ? "above" : "below",
            ];

    type Candidate = {
      placement: "above" | "below" | "left" | "right";
      top: number;
      left: number;
      overlapArea: number;
    };

    const candidates: Candidate[] = preferredPlacements.map((placement) => {
      const initialTop =
        placement === "above"
          ? rect.top - padding - gap - tooltipHeight
          : rect.bottom + padding + gap;
      const top = clampTop(initialTop);
      return {
        placement,
        top,
        left: verticalLeft,
        overlapArea: getOverlapArea(top, verticalLeft),
      };
    });

    // Horizontal fallback for budget substeps: try placing the tooltip to the
    // left/right of the target when above/below still overlap the highlight.
    if (isBudgetSubstep) {
      const horizontalTop = clampTop(centerY - tooltipHeight / 2);
      const leftCandidateLeft = clampLeft(rect.left - padding - gap - tooltipWidth);
      const rightCandidateLeft = clampLeft(rect.right + padding + gap);

      candidates.push({
        placement: "left",
        top: horizontalTop,
        left: leftCandidateLeft,
        overlapArea: getOverlapArea(horizontalTop, leftCandidateLeft),
      });
      candidates.push({
        placement: "right",
        top: horizontalTop,
        left: rightCandidateLeft,
        overlapArea: getOverlapArea(horizontalTop, rightCandidateLeft),
      });
    }

    const bestCandidate =
      candidates.find((candidate) => candidate.overlapArea === 0) ??
      candidates.sort((a, b) => a.overlapArea - b.overlapArea)[0];

    setPos({ top: bestCandidate.top, left: bestCandidate.left, placement: bestCandidate.placement });
  }, [targetSelector, substep.placement, maxTooltipWidth, isBudgetSubstep]);

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

  // Mobile-friendly button defaults: stacked, ample touch area, safe area aware.
  const PRIMARY_BTN_CLS = compact
    ? "w-full h-10 text-sm font-medium"
    : "w-full h-12 text-base font-medium";
  const SECONDARY_BTN_CLS = PRIMARY_BTN_CLS;
  const ACTION_STACK_CLS = compact ? "flex flex-col gap-2 mt-3" : "flex flex-col gap-3 mt-3";

  const tooltipContent = (
    <div
      ref={tooltipRef}
      className={`bg-card border border-border rounded-xl shadow-2xl ${compact ? "p-3" : "p-4"}`}
      style={{
        maxWidth: `min(${maxTooltipWidth}px, calc(100vw - 32px))`,
        paddingBottom: `calc(${compact ? "0.75rem" : "1rem"} + env(safe-area-inset-bottom))`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={compact ? "text-xl" : "text-2xl"}>{substep.emoji}</span>
          <span className="text-xs text-muted-foreground font-medium">
            Passo {stepIndex + 1} de {totalSteps}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!compact && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkipStep}
              className="text-xs h-7 px-2"
            >
              <SkipForward className="h-3 w-3 mr-1" />
              Pular etapa
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-1 mb-3">
        <h3 className={compact ? "font-semibold text-sm" : "font-semibold text-base"}>
          {substep.title}
        </h3>
        <p
          className={`${compact ? "text-xs" : "text-sm"} text-muted-foreground leading-relaxed whitespace-pre-line`}
        >
          {substep.description}
        </p>
      </div>

      {/* Action buttons based on type */}
      {substep.actionType === "fill" && substep.requiresValidation && (
        <div className={ACTION_STACK_CLS}>
          <Button
            onClick={onNext}
            disabled={!isValid}
            className={PRIMARY_BTN_CLS}
          >
            Próximo
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          {onBack && (
            <Button variant="outline" onClick={onBack} className={SECONDARY_BTN_CLS}>
              Voltar
            </Button>
          )}
        </div>
      )}

      {/* Auto-advance selects: no "Próximo" button, user just selects and it advances */}
      {substep.actionType === "select" && substep.requiresValidation && !substep.autoAdvanceOnSelect && (
        <div className={ACTION_STACK_CLS}>
          <Button
            onClick={onNext}
            disabled={!isValid}
            className={PRIMARY_BTN_CLS}
          >
            Próximo
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          {onBack && (
            <Button variant="outline" onClick={onBack} className={SECONDARY_BTN_CLS}>
              Voltar
            </Button>
          )}
        </div>
      )}

      {substep.actionType === "optional-group" && (
        <div className={ACTION_STACK_CLS}>
          <Button onClick={onNext} className={PRIMARY_BTN_CLS}>
            Continuar
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          <Button
            variant="outline"
            onClick={onSkipSubstep || onNext}
            className={SECONDARY_BTN_CLS}
          >
            {substep.skipLabel || "Pular"}
          </Button>
          {onBack && (
            <Button variant="outline" onClick={onBack} className={SECONDARY_BTN_CLS}>
              Voltar
            </Button>
          )}
        </div>
      )}

      {substep.actionType === "navigate" && substep.navigateLabel && (
        <div className={ACTION_STACK_CLS}>
          <Button onClick={onNext} className={PRIMARY_BTN_CLS}>
            {substep.navigateLabel}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {substep.actionType === "info" && (
        <div className={ACTION_STACK_CLS}>
          <Button onClick={onNext} className={PRIMARY_BTN_CLS}>
            {substep.navigateLabel || "Continuar"}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          {substep.skipLabel && onSkipSubstep && (
            <Button variant="outline" onClick={onSkipSubstep} className={SECONDARY_BTN_CLS}>
              {substep.skipLabel}
            </Button>
          )}
          {onBack && !substep.skipLabel && (
            <Button variant="outline" onClick={onBack} className={SECONDARY_BTN_CLS}>
              Voltar
            </Button>
          )}
        </div>
      )}

      {substep.actionType === "completion" && (
        <div className={ACTION_STACK_CLS}>
          {onProceed && (
            <Button onClick={onProceed} className={PRIMARY_BTN_CLS}>
              <ArrowRight className="h-4 w-4 mr-1" />
              {substep.proceedLabel || "Prosseguir"}
            </Button>
          )}
          {onRepeat && (
            <Button variant="outline" onClick={onRepeat} className={SECONDARY_BTN_CLS}>
              <Plus className="h-4 w-4 mr-1" />
              {substep.repeatLabel || "Adicionar outro"}
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
        width: Math.min(maxTooltipWidth, window.innerWidth - 32),
      }}
    >
      <div className="pointer-events-auto relative">
        {tooltipContent}
      </div>
    </div>
  );
}
