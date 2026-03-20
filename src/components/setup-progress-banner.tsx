import { useState, useEffect } from "react";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, Sparkles } from "lucide-react";

const DISMISS_KEY = "gastinho_setup_banner_dismissed";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

interface SetupProgress {
  completed: number;
  total: number;
  percentage: number;
  pendingSteps: { id: string; label: string; emoji: string }[];
}

export function SetupProgressBanner() {
  const { user } = useAuth();
  const { isOpen, startOnboarding, getSetupProgress } = useOnboardingTour();
  const [progress, setProgress] = useState<SetupProgress | null>(null);
  const [dismissed, setDismissed] = useState(true);

  // Check dismiss state
  useEffect(() => {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) {
      try {
        const { timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp < SEVEN_DAYS) {
          setDismissed(true);
          return;
        }
      } catch {}
    }
    setDismissed(false);
  }, []);

  // Load progress
  useEffect(() => {
    if (!user || dismissed) return;
    getSetupProgress().then(setProgress);
  }, [user, dismissed, getSetupProgress]);

  // Don't show if: no user, onboarding running, dismissed, no progress data, or 100%
  if (!user || isOpen || dismissed || !progress || progress.percentage >= 100) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, JSON.stringify({ timestamp: Date.now() }));
    setDismissed(true);
  };

  // Show max 3 pending items
  const displayPending = progress.pendingSteps.slice(0, 3);

  return (
    <div className="relative rounded-lg border border-primary/20 bg-primary/5 p-4 mb-4">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Dispensar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="space-y-3 pr-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            Sua conta está {Math.round(progress.percentage)}% configurada
          </span>
        </div>

        <Progress value={progress.percentage} className="h-2" />

        {displayPending.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Faltam: {displayPending.map((s) => `${s.emoji} ${s.label}`).join(", ")}
          </p>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={startOnboarding}
          className="w-full gap-2"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Continuar configuração
        </Button>
      </div>
    </div>
  );
}
