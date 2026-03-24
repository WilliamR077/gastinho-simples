import {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { Capacitor } from "@capacitor/core";
import {
  ONBOARDING_STEPS,
  type OnboardingStepConfig,
  type OnboardingSubstep,
} from "@/lib/onboarding/onboarding-steps";

// ─── Context ──────────────────────────────────────────────────
interface SetupProgressResult {
  completed: number;
  total: number;
  percentage: number;
  completedSteps: string[];
  pendingSteps: { id: string; label: string; emoji: string }[];
}

interface OnboardingContextType {
  isOpen: boolean;
  currentStep: OnboardingStepConfig | null;
  currentSubstep: OnboardingSubstep | null;
  currentStepIndex: number;
  currentSubstepIndex: number;
  totalSteps: number;
  totalSubsteps: number;
  progress: number;
  isCompleted: boolean;
  showCompletionDialog: boolean;
  completedSteps: Set<string>;
  isExpenseFormGuidedFlow: boolean;

  startOnboarding: () => void;
  skipOnboarding: () => void;
  skipCurrentStep: () => void;
  advanceSubstep: () => void;
  repeatStep: () => void;
  proceedToNextStep: () => void;
  notifyEvent: (eventName: string) => void;
  closeCompletionDialog: () => void;
  isCurrentTargetValid: () => boolean;
  getSetupProgress: () => Promise<SetupProgressResult>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined
);

const STORAGE_KEY = "gastinho_onboarding_completed";
const PROGRESS_KEY = "gastinho_onboarding_progress";

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [substepIndex, setSubstepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);

  // Filter mobile-only steps
  const availableSteps = ONBOARDING_STEPS.filter(
    (s) => !s.mobileOnly || Capacitor.isNativePlatform()
  );

  const currentStep = availableSteps[stepIndex] || null;
  const currentSubstep = currentStep?.substeps[substepIndex] || null;
  const totalSteps = availableSteps.length;
  const totalSubsteps = currentStep?.substeps.length || 0;
  const progress = (completedSteps.size / totalSteps) * 100;
  const isCompleted = localStorage.getItem(STORAGE_KEY) === "true";

  // Ref to avoid stale closure in notifyEvent
  const stateRef = useRef({ stepIndex, substepIndex, isOpen });
  useEffect(() => {
    stateRef.current = { stepIndex, substepIndex, isOpen };
  }, [stepIndex, substepIndex, isOpen]);

  // ─── Route-based auto-advance ─────────────────────────────
  useEffect(() => {
    if (!isOpen || !currentSubstep?.autoAdvanceOnRoute) return;
    if (location.pathname === currentSubstep.autoAdvanceOnRoute) {
      // Already on the right route, advance
      advanceSubstepInternal();
    }
  }, [location.pathname, isOpen, currentSubstep?.id]);

  // ─── MutationObserver: wait for target to appear ──────────
  useEffect(() => {
    if (!isOpen || !currentSubstep?.targetSelector) return;

    const selector = `[data-onboarding="${currentSubstep.targetSelector}"]`;

    // Check if already in DOM
    const existing = document.querySelector(selector);
    if (existing) {
      handleTargetAppeared(existing as HTMLElement);
      return;
    }

    // Watch for it
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        handleTargetAppeared(el as HTMLElement);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Timeout fallback — don't crash if element never appears
    const timeout = setTimeout(() => {
      observer.disconnect();
    }, 10000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [isOpen, currentSubstep?.id, currentSubstep?.targetSelector]);

  // ─── Condition check: skip substep if condition fails ─────
  useEffect(() => {
    if (!isOpen || !currentSubstep?.condition) return;

    // Small delay to let DOM settle
    const timer = setTimeout(() => {
      if (currentSubstep.condition && !currentSubstep.condition({})) {
        advanceSubstepInternal();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, currentSubstep?.id]);

  // ─── Listen for custom events (from category-selector etc) ─
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string" && currentSubstep?.autoAdvanceOnEvent === detail) {
        advanceSubstepInternal();
      }
    };

    window.addEventListener("gastinho-onboarding-event", handler);
    return () => window.removeEventListener("gastinho-onboarding-event", handler);
  }, [isOpen, currentSubstep?.id, currentSubstep?.autoAdvanceOnEvent]);

  // ─── Load saved progress ─────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(PROGRESS_KEY);
    if (saved) {
      try {
        const { stepIdx, substepIdx, completed } = JSON.parse(saved);
        setStepIndex(stepIdx);
        setSubstepIndex(substepIdx);
        setCompletedSteps(new Set(completed));
      } catch {}
    }
  }, []);

  // ─── Save progress ───────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      localStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify({
          stepIdx: stepIndex,
          substepIdx: substepIndex,
          completed: Array.from(completedSteps),
        })
      );
    }
  }, [stepIndex, substepIndex, completedSteps, isOpen]);

  // ─── Supabase Realtime detection (backup) ─────────────────
  useEffect(() => {
    if (!user || !isOpen || !currentStep?.detectionTable) return;

    const channel = supabase
      .channel(`onboarding-${currentStep.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: currentStep.detectionTable,
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Only use as fallback — primary is notifyEvent
          // Go to completion substep if exists
          const completionIdx = currentStep.substeps.findIndex(
            (s) => s.actionType === "completion"
          );
          if (completionIdx >= 0) {
            setSubstepIndex(completionIdx);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, isOpen, currentStep?.id]);

  // ─── PIN detection for security step ──────────────────────
  useEffect(() => {
    if (!isOpen || currentStep?.id !== "setup-security") return;
    const interval = setInterval(() => {
      if (localStorage.getItem("gastinho_app_lock_pin")) {
        completeCurrentStep();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, currentStep?.id]);

  // ─── Helpers ──────────────────────────────────────────────

  function handleTargetAppeared(el: HTMLElement) {
    if (!currentSubstep) return;

    if (currentSubstep.scrollToTarget) {
      // Find the nearest scrollable container (Sheet, dialog, scroll area)
      const scrollContainer = el.closest(
        '[data-radix-scroll-area-viewport], [role="dialog"], .overflow-y-auto, .overflow-auto'
      ) as HTMLElement | null;

      if (scrollContainer) {
        // Scroll within the container, not the page
        const containerRect = scrollContainer.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const relativeTop = elRect.top - containerRect.top + scrollContainer.scrollTop;
        const targetScroll = relativeTop - containerRect.height / 3;

        scrollContainer.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: "smooth",
        });
      } else {
        // No scrollable container — use scrollIntoView with "nearest" to minimize movement
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    if (currentSubstep.focusTarget) {
      setTimeout(() => {
        const input =
          el.tagName === "INPUT" || el.tagName === "TEXTAREA"
            ? el
            : el.querySelector("input, textarea, select");
        if (input) (input as HTMLElement).focus();
      }, 400);
    }
  }

  function advanceSubstepInternal() {
    if (!currentStep) return;

    let nextIdx = substepIndex + 1;

    // Skip substeps whose condition is false
    while (nextIdx < currentStep.substeps.length) {
      const next = currentStep.substeps[nextIdx];
      if (next.condition && !next.condition({})) {
        nextIdx++;
      } else {
        break;
      }
    }

    if (nextIdx < currentStep.substeps.length) {
      setSubstepIndex(nextIdx);
    } else {
      // Step complete, go to next step
      completeCurrentStep();
    }
  }

  function completeCurrentStep() {
    if (!currentStep) return;
    setCompletedSteps((prev) => new Set([...prev, currentStep.id]));

    const nextStepIdx = stepIndex + 1;
    if (nextStepIdx >= availableSteps.length) {
      setIsOpen(false);
      setShowCompletionDialog(true);
      localStorage.setItem(STORAGE_KEY, "true");
      localStorage.removeItem(PROGRESS_KEY);
    } else {
      setStepIndex(nextStepIdx);
      setSubstepIndex(0);
      // Navigate if needed
      const nextStep = availableSteps[nextStepIdx];
      if (nextStep.targetRoute && nextStep.targetRoute !== location.pathname) {
        navigate(nextStep.targetRoute);
      }
    }
  }

  const checkExistingData = async (
    userId: string
  ): Promise<Set<string>> => {
    const completed = new Set<string>();

    const [cards, expenses, recurring, incomes, goals] =
      await Promise.all([
        supabase.from("cards").select("id").eq("user_id", userId).limit(1),
        supabase.from("expenses").select("id").eq("user_id", userId).limit(1),
        supabase
          .from("recurring_expenses")
          .select("id")
          .eq("user_id", userId)
          .limit(1),
        supabase.from("incomes").select("id").eq("user_id", userId).limit(1),
        supabase
          .from("budget_goals")
          .select("id")
          .eq("user_id", userId)
          .limit(1),
      ]);

    if (cards.data?.length) completed.add("add-card");
    if (expenses.data?.length) completed.add("add-expense");
    if (recurring.data?.length) completed.add("add-recurring-expense");
    if (incomes.data?.length) completed.add("add-income");
    if (goals.data?.length) completed.add("add-budget-goal");
    if (localStorage.getItem("gastinho_app_lock_pin"))
      completed.add("setup-security");
    completed.add("import-spreadsheet");

    // view-reports has no DB table — check localStorage progress or onboarding completed
    const savedProgress = localStorage.getItem(PROGRESS_KEY);
    if (savedProgress) {
      try {
        const { completed: savedCompleted } = JSON.parse(savedProgress);
        if (Array.isArray(savedCompleted) && savedCompleted.includes("view-reports")) {
          completed.add("view-reports");
        }
      } catch {}
    }
    if (localStorage.getItem(STORAGE_KEY) === "true") {
      completed.add("view-reports");
    }

    return completed;
  };

  // ─── Public API ───────────────────────────────────────────

  const startOnboarding = useCallback(async () => {
    let preCompleted = new Set<string>();
    if (user) {
      preCompleted = await checkExistingData(user.id);
    }

    const firstPendingIdx = availableSteps.findIndex(
      (s) => !preCompleted.has(s.id)
    );

    if (firstPendingIdx === -1) {
      // All done — show completion with real data
      setCompletedSteps(preCompleted);
      setShowCompletionDialog(true);
      localStorage.setItem(STORAGE_KEY, "true");
      localStorage.removeItem(PROGRESS_KEY);
      return;
    }

    setCompletedSteps(preCompleted);
    setStepIndex(firstPendingIdx);
    setSubstepIndex(0);
    setIsOpen(true);
    localStorage.removeItem(PROGRESS_KEY);
  }, [user, availableSteps]);

  const skipOnboarding = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, "true");
    localStorage.removeItem(PROGRESS_KEY);
  }, []);

  const skipCurrentStep = useCallback(() => {
    completeCurrentStep();
  }, [currentStep, stepIndex]);

  const advanceSubstep = useCallback(() => {
    advanceSubstepInternal();
  }, [currentStep, substepIndex]);

  const repeatStep = useCallback(() => {
    // Go back to substep 1 (skip navigate)
    if (!currentStep) return;
    const clickIdx = currentStep.substeps.findIndex(
      (s) => s.actionType === "click"
    );
    setSubstepIndex(clickIdx >= 0 ? clickIdx : 0);
  }, [currentStep]);

  const proceedToNextStep = useCallback(() => {
    completeCurrentStep();
  }, [currentStep, stepIndex]);

  const notifyEvent = useCallback(
    (eventName: string) => {
      if (!isOpen || !currentSubstep) return;

      if (currentSubstep.autoAdvanceOnEvent === eventName) {
        advanceSubstepInternal();
      }
    },
    [isOpen, currentSubstep?.id, currentStep, substepIndex]
  );

  const isCurrentTargetValid = useCallback((): boolean => {
    if (!currentSubstep?.targetSelector) return false;

    const el = document.querySelector(
      `[data-onboarding="${currentSubstep.targetSelector}"]`
    ) as HTMLElement | null;

    if (!el) return false;

    if (currentSubstep.actionType === "fill") {
      const input =
        el.tagName === "INPUT"
          ? (el as HTMLInputElement)
          : el.querySelector("input");
      if (input) {
        const val = (input as HTMLInputElement).value.trim();
        return val.length > 0;
      }
      return false;
    }

    if (currentSubstep.actionType === "select") {
      // Select always has a value (default), so always valid
      return true;
    }

    return true;
  }, [currentSubstep?.id, currentSubstep?.targetSelector]);

  const closeCompletionDialog = useCallback(() => {
    setShowCompletionDialog(false);
  }, []);

  const getSetupProgress = useCallback(async (): Promise<SetupProgressResult> => {
    // Steps that count for progress (exclude optional like import-spreadsheet)
    const progressSteps = availableSteps.filter((s) => !s.optional);
    const total = progressSteps.length;

    let existingData = new Set<string>();
    if (user) {
      existingData = await checkExistingData(user.id);
    }

    const completedIds = progressSteps.filter((s) => existingData.has(s.id)).map((s) => s.id);
    const pendingSteps = progressSteps
      .filter((s) => !existingData.has(s.id))
      .map((s) => ({ id: s.id, label: s.label, emoji: s.emoji }));

    const completed = completedIds.length;
    const percentage = total > 0 ? (completed / total) * 100 : 100;

    return { completed, total, percentage, completedSteps: completedIds, pendingSteps };
  }, [user, availableSteps]);

  return (
    <OnboardingContext.Provider
      value={{
        isOpen,
        currentStep,
        currentSubstep,
        currentStepIndex: stepIndex,
        currentSubstepIndex: substepIndex,
        totalSteps,
        totalSubsteps,
        progress,
        isCompleted,
        showCompletionDialog,
        completedSteps,
        startOnboarding,
        skipOnboarding,
        skipCurrentStep,
        advanceSubstep,
        repeatStep,
        proceedToNextStep,
        notifyEvent,
        closeCompletionDialog,
        isCurrentTargetValid,
        getSetupProgress,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboardingTour() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboardingTour must be used within OnboardingProvider");
  }
  return context;
}
