import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/use-subscription";

const UPSELL_LAST_SHOWN_KEY = "gastinho_upsell_last_shown";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const UPSELL_COPIES = [
  "Desbloqueie relatórios por ano/trimestre + exportação PDF/Excel",
  "Quer organizar tudo? Vire Premium e libere cartões e metas ilimitadas",
];

interface UpsellBannerProps {
  expenseCount: number;
}

export function UpsellBanner({ expenseCount }: UpsellBannerProps) {
  const { tier } = useSubscription();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (tier === "premium" || tier === "premium_plus") return;
    if (expenseCount < 10) return;

    const lastShown = localStorage.getItem(UPSELL_LAST_SHOWN_KEY);
    if (lastShown && Date.now() - Number(lastShown) < SEVEN_DAYS_MS) return;

    setVisible(true);
  }, [tier, expenseCount]);

  if (!visible) return null;

  const copy = UPSELL_COPIES[Math.floor(Date.now() / 86400000) % UPSELL_COPIES.length];

  const handleDismiss = () => {
    localStorage.setItem(UPSELL_LAST_SHOWN_KEY, String(Date.now()));
    setVisible(false);
  };

  return (
    <div className="relative bg-primary/10 border border-primary/20 rounded-lg p-3 mb-3">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-2 pr-6">
        <Crown className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-foreground">{copy}</p>
          <Button
            variant="link"
            size="sm"
            className="p-0 h-auto text-primary font-semibold text-sm"
            onClick={() => {
              handleDismiss();
              navigate("/subscription");
            }}
          >
            Ver Premium
          </Button>
        </div>
      </div>
    </div>
  );
}
