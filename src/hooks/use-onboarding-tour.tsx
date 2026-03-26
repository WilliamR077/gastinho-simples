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
import {
  findReadyOnboardingTarget,
  isOnboardingTargetReady,
} from "@/lib/onboarding/target-utils";

// ─── Context ──────────────────────────────────────────────────
interface SetupProgressResult {
  completed: number;
  total: number;
  percentage: number;
  completedSteps: string[];
  pendingSteps: { id: string; label: string; emoji: string }[];
}

interface PendingAdvanceState {
  fromSubstepIndex: number;
  toSubstepIndex: number;
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
const SKIPPED_STEPS_KEY = "gastinho_skipped_steps";

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [substepIndex, setSubstepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [pendingAdvance, setPendingAdvance] = useState<PendingAdvanceState | null>(null);
  const seenEventsRef = useRef<Set<string>>(new Set());

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

  const createConditionContext = useCallback(() => {
    return {
      formElement: findReadyOnboardingTarget("expense-type-selector") ?? undefined,
      seenEvents: seenEventsRef.current,
    };
  }, []);

  const matchesAutoAdvanceEvent = useCallback(
    (substep: OnboardingSubstep | null, eventName: string) => {
      if (!substep?.autoAdvanceOnEvent) return false;
      return Array.isArray(substep.autoAdvanceOnEvent)
        ? substep.autoAdvanceOnEvent.includes(eventName)
        : substep.autoAdvanceOnEvent === eventName;
    },
    []
  );

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

    const existing = getReadyTargetElement(currentSubstep.targetSelector);
    if (existing) {
      handleTargetAppeared(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = getReadyTargetElement(currentSubstep.targetSelector);
      if (el) {
        observer.disconnect();
        handleTargetAppeared(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "data-state", "aria-hidden"],
    });

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
    if (!isOpen || !currentStep || !pendingAdvance) return;

    if (substepIndex !== pendingAdvance.fromSubstepIndex) {
      setPendingAdvance(null);
      return;
    }

    const pendingSubstep = currentStep.substeps[pendingAdvance.toSubstepIndex];
    if (!pendingSubstep) {
      setPendingAdvance(null);
      return;
    }

    if (!pendingSubstep.targetSelector) {
      setSubstepIndex(pendingAdvance.toSubstepIndex);
      setPendingAdvance(null);
      return;
    }

    const readyTarget = getReadyTargetElement(pendingSubstep.targetSelector);
    if (readyTarget) {
      setSubstepIndex(pendingAdvance.toSubstepIndex);
      setPendingAdvance(null);
      return;
    }

    const observer = new MutationObserver(() => {
      const nextReadyTarget = getReadyTargetElement(pendingSubstep.targetSelector);
      if (nextReadyTarget) {
        observer.disconnect();
        setSubstepIndex(pendingAdvance.toSubstepIndex);
        setPendingAdvance(null);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "data-state", "aria-hidden"],
    });

    const timeout = setTimeout(() => {
      observer.disconnect();
    }, 10000);

    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [isOpen, currentStep, pendingAdvance, substepIndex]);

  useEffect(() => {
    if (!isOpen || !currentSubstep?.condition) return;

    // Small delay to let DOM settle
    const timer = setTimeout(() => {
      if (currentSubstep.condition && !currentSubstep.condition(createConditionContext())) {
        advanceSubstepInternal();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, currentSubstep?.id, createConditionContext]);

  // ─── Listen for custom events (from category-selector etc) ─
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail !== "string") return;

      seenEventsRef.current.add(detail);

      if (
        detail === "category-manager-closed" &&
        (currentStep?.id === "add-expense" || currentStep?.id === "add-recurring-expense") &&
        (currentSubstep?.id.startsWith("expense-category-manager-") || currentSubstep?.id.startsWith("recurring-category-manager-"))
      ) {
        advanceSubstepInternal();
        return;
      }

      if (matchesAutoAdvanceEvent(currentSubstep, detail)) {
        advanceSubstepInternal();
      }
    };

    window.addEventListener("gastinho-onboarding-event", handler);
    return () => window.removeEventListener("gastinho-onboarding-event", handler);
  }, [isOpen, currentStep?.id, currentSubstep?.id, matchesAutoAdvanceEvent]);

  // ─── Load saved progress ─────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(PROGRESS_KEY);
    if (saved) {
      try {
        const { stepIdx, substepIdx, completed } = JSON.parse(saved);
        setStepIndex(stepIdx);
        setSubstepIndex(substepIdx);
        setCompletedSteps(new Set(completed));
      } catch {
        void 0;
      }
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

  useEffect(() => {
    if (!isOpen) {
      setPendingAdvance(null);
      seenEventsRef.current.clear();
    }
  }, [isOpen]);

  useEffect(() => {
    seenEventsRef.current.clear();
  }, [stepIndex]);

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

  function getReadyTargetElement(targetSelector?: string): HTMLElement | null {
    return findReadyOnboardingTarget(targetSelector);
  }

  function queuePendingAdvance(nextIdx: number) {
    setPendingAdvance((prev) => {
      if (prev?.fromSubstepIndex === substepIndex && prev.toSubstepIndex === nextIdx) {
        return prev;
      }

      return {
        fromSubstepIndex: substepIndex,
        toSubstepIndex: nextIdx,
      };
    });
  }

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

  // Determine if we're in a guided form flow (expense or recurring expense).
  const FORM_SUBSTEP_START = (() => {
    if (currentStep?.id === "add-expense") {
      return Math.max(currentStep.substeps.findIndex((s) => s.id === "expense-type-info"), 0);
    }
    if (currentStep?.id === "add-recurring-expense") {
      return Math.max(currentStep.substeps.findIndex((s) => s.id === "recurring-type-info"), 0);
    }
    return Number.POSITIVE_INFINITY;
  })();
  const isExpenseFormGuidedFlow =
    isOpen &&
    (currentStep?.id === "add-expense" || currentStep?.id === "add-recurring-expense") &&
    substepIndex >= FORM_SUBSTEP_START;

  function isExpenseFormReady() {
    return !!getReadyTargetElement("expense-type-selector");
  }

  function advanceSubstepInternal() {
    if (!currentStep) return;

    let nextIdx = substepIndex + 1;

    // Skip substeps whose condition is false
    while (nextIdx < currentStep.substeps.length) {
      const next = currentStep.substeps[nextIdx];
      if (next.condition && !next.condition(createConditionContext())) {
        nextIdx++;
      } else {
        break;
      }
    }

    if (nextIdx < currentStep.substeps.length) {
      const nextSubstep = currentStep.substeps[nextIdx];

      // Guard: if the next substep requires a target inside the expense form,
      // verify the form context is still present before advancing
      if (
        (currentStep.id === "add-expense" || currentStep.id === "add-recurring-expense") &&
        nextIdx >= FORM_SUBSTEP_START &&
        !isExpenseFormReady()
      ) {
        console.warn("[Onboarding] Expense form not ready yet, waiting before advancing...");
        queuePendingAdvance(nextIdx);
        return;
      }

      if (nextSubstep.targetSelector && !getReadyTargetElement(nextSubstep.targetSelector)) {
        queuePendingAdvance(nextIdx);
        return;
      }

      setPendingAdvance(null);
      setSubstepIndex(nextIdx);
    } else {
      // Step complete, go to next step
      setPendingAdvance(null);
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
      } catch {
        void 0;
      }
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
    setPendingAdvance(null);
    seenEventsRef.current.clear();
    setStepIndex(firstPendingIdx);
    setSubstepIndex(0);
    setIsOpen(true);
    localStorage.removeItem(PROGRESS_KEY);
  }, [user, availableSteps]);

  const skipOnboarding = useCallback(() => {
    setPendingAdvance(null);
    seenEventsRef.current.clear();
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
    setPendingAdvance(null);
    seenEventsRef.current.clear();
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

      seenEventsRef.current.add(eventName);

      if (matchesAutoAdvanceEvent(currentSubstep, eventName)) {
        advanceSubstepInternal();
      }
    },
    [isOpen, currentSubstep?.id, currentStep, substepIndex, matchesAutoAdvanceEvent]
  );

  const isCurrentTargetValid = useCallback((): boolean => {
    if (!currentSubstep?.targetSelector) return false;

    const el = getReadyTargetElement(currentSubstep.targetSelector);

    if (!el) return false;

    if (currentSubstep.actionType === "fill") {
      const input =
        el.tagName === "INPUT"
          ? (el as HTMLInputElement)
          : el.querySelector("input, textarea");
      if (input) {
        const val = (input as HTMLInputElement | HTMLTextAreaElement).value.trim();
        return val.length > 0;
      }
      return false;
    }

    if (currentSubstep.actionType === "select") {
      return isOnboardingTargetReady(el);
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
        isExpenseFormGuidedFlow,
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
