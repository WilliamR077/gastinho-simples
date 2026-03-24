import { useEffect, useState, useCallback, useRef } from "react";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface OnboardingOverlayProps {
  targetSelector?: string;
  isVisible: boolean;
  padding?: number;
  onTargetRect?: (rect: TargetRect | null) => void;
}

export function OnboardingOverlay({
  targetSelector,
  isVisible,
  padding = 8,
  onTargetRect,
}: OnboardingOverlayProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const rafRef = useRef<number>(0);

  const updateRect = useCallback(() => {
    if (!targetSelector) {
      setTargetRect(null);
      onTargetRect?.(null);
      return;
    }

    const el = document.querySelector(
      `[data-onboarding="${targetSelector}"]`
    ) as HTMLElement | null;

    if (el) {
      const rect = el.getBoundingClientRect();
      const newRect = {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
      setTargetRect(newRect);
      onTargetRect?.(newRect);
    } else {
      setTargetRect(null);
      onTargetRect?.(null);
    }
  }, [targetSelector, onTargetRect]);

  // Body scroll lock removed — the 4-panel interaction mask already blocks
  // clicks outside the spotlight, and locking body overflow conflicts with
  // Sheet/Dialog containers that manage their own scroll.

  // Continuous position tracking via rAF
  useEffect(() => {
    if (!isVisible) {
      setTargetRect(null);
      return;
    }

    let running = true;
    const loop = () => {
      if (!running) return;
      updateRect();
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [isVisible, updateRect]);

  if (!isVisible) return null;

  // Spotlight hole coordinates (with padding)
  const hole = targetRect
    ? {
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
        bottom: targetRect.top + targetRect.height + padding,
        right: targetRect.left + targetRect.width + padding,
      }
    : null;

  return (
    <div className="fixed inset-0 z-[55] pointer-events-none">
      {/* Visual dark overlay with SVG mask — no pointer events */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="onboarding-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {hole && (
              <rect
                x={hole.left}
                y={hole.top}
                width={hole.width}
                height={hole.height}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#onboarding-spotlight-mask)"
        />
      </svg>

      {/* 4 blocking panels around the spotlight hole — these capture clicks outside */}
      {hole ? (
        <>
          {/* Top panel */}
          <div
            className="fixed left-0 right-0 top-0 pointer-events-auto"
            style={{ height: Math.max(0, hole.top) }}
          />
          {/* Bottom panel */}
          <div
            className="fixed left-0 right-0 bottom-0 pointer-events-auto"
            style={{ top: hole.bottom }}
          />
          {/* Left panel */}
          <div
            className="fixed left-0 pointer-events-auto"
            style={{
              top: hole.top,
              width: Math.max(0, hole.left),
              height: hole.height,
            }}
          />
          {/* Right panel */}
          <div
            className="fixed right-0 pointer-events-auto"
            style={{
              top: hole.top,
              left: hole.right,
              height: hole.height,
            }}
          />
        </>
      ) : (
        /* No target — block entire screen */
        <div className="fixed inset-0 pointer-events-auto" />
      )}

      {/* Highlight border */}
      {hole && (
        <div
          className="absolute border-2 border-primary rounded-xl animate-pulse pointer-events-none"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow:
              "0 0 0 4px hsl(var(--primary) / 0.3), 0 0 20px hsl(var(--primary) / 0.2)",
          }}
        />
      )}
    </div>
  );
}
