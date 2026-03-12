import { useEffect, useState, useCallback, useRef } from "react";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface OnboardingOverlayProps {
  targetSelector?: string; // data-onboarding value
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
  const prevElRef = useRef<HTMLElement | null>(null);

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

      // Elevate target above overlay
      if (prevElRef.current && prevElRef.current !== el) {
        prevElRef.current.style.position = "";
        prevElRef.current.style.zIndex = "";
      }
      el.style.position = "relative";
      el.style.zIndex = "60";
      prevElRef.current = el;
    } else {
      setTargetRect(null);
      onTargetRect?.(null);
    }
  }, [targetSelector, onTargetRect]);

  // Lock body scroll while overlay is visible
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isVisible]);

  // Continuous position tracking via rAF
  useEffect(() => {
    if (!isVisible) {
      // Cleanup elevated element
      if (prevElRef.current) {
        prevElRef.current.style.position = "";
        prevElRef.current.style.zIndex = "";
        prevElRef.current = null;
      }
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
      if (prevElRef.current) {
        prevElRef.current.style.position = "";
        prevElRef.current.style.zIndex = "";
        prevElRef.current = null;
      }
    };
  }, [isVisible, updateRect]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[55] pointer-events-auto">
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="onboarding-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
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

      {/* Highlight border */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-xl animate-pulse pointer-events-none"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            boxShadow:
              "0 0 0 4px hsl(var(--primary) / 0.3), 0 0 20px hsl(var(--primary) / 0.2)",
          }}
        />
      )}
    </div>
  );
}
