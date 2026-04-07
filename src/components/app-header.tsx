import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Eye, EyeOff, Menu, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { useSubscription } from "@/hooks/use-subscription";
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppMenuDrawer } from "./app-menu-drawer";
import { RecurringExpense } from "@/types/recurring-expense";

interface AppHeaderProps {
  recurringExpenses: RecurringExpense[];
  onSignOut: () => void;
}

interface SetupProgress {
  completed: number;
  total: number;
  percentage: number;
  pendingSteps: { id: string; label: string; emoji: string }[];
}

export function AppHeader({ recurringExpenses, onSignOut }: AppHeaderProps) {
  const navigate = useNavigate();
  const { isHidden, toggleVisibility } = useValuesVisibility();
  const { tier } = useSubscription();
  const { user } = useAuth();
  const { isOpen, startOnboarding, getSetupProgress } = useOnboardingTour();
  const [menuOpen, setMenuOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [progress, setProgress] = useState<SetupProgress | null>(null);

  // Carrega progresso de configuração da conta uma vez ao montar
  useEffect(() => {
    if (!user) return;
    getSetupProgress().then(setProgress);
  }, [user, getSetupProgress]);

  // Indicador visível apenas quando há pendências e onboarding não está ativo
  const showIndicator = progress && progress.percentage < 100 && !isOpen;

  const handleContinueSetup = () => {
    setPopoverOpen(false);
    startOnboarding();
  };

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
      <div className="container mx-auto max-w-6xl px-2 sm:px-4 flex items-center justify-between h-14 sm:h-16">
        {/* Left: Logo */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 touch-manipulation hover:opacity-80 transition-opacity"
          aria-label="Ir para a página inicial"
        >
          <img
            src="/lovable-uploads/06a1acc2-f553-41f0-8d87-32d25b4e425e.png"
            alt="Gastinho Simples"
            className="h-11 sm:h-12 w-auto"
          />
          {tier === "premium" || tier === "premium_plus" ? (
            <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-1.5 py-0">⭐ Premium</Badge>
          ) : tier === "no_ads" ? (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Sem anúncios</Badge>
          ) : null}
        </button>

        {/* Right: action buttons */}
        <div className="flex items-center gap-0.5">
          {/* Indicador compacto de configuração pendente */}
          {showIndicator && (
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-11 w-11 touch-manipulation relative ${popoverOpen ? "bg-primary/10" : ""}`}
                  aria-label="Configuração da conta"
                >
                  <Sparkles className="h-5 w-5 text-primary" />
                  {/* Dot pulsante indicando pendência */}
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0 rounded-xl border-border bg-card shadow-lg">
                <div className="p-4 space-y-3">
                  {/* Título e percentual */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Configure sua conta</span>
                    <span className="text-xs text-muted-foreground">{Math.round(progress.percentage)}%</span>
                  </div>

                  {/* Barra de progresso */}
                  <Progress value={progress.percentage} className="h-1.5" />

                  {/* Lista de pendências — máximo 4 */}
                  {progress.pendingSteps.length > 0 && (
                    <ul className="space-y-1.5 pt-1">
                      {progress.pendingSteps.slice(0, 4).map((step) => (
                        <li key={step.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{step.emoji}</span>
                          <span>{step.label}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* CTA principal */}
                  <Button
                    size="sm"
                    onClick={handleContinueSetup}
                    className="w-full gap-2 mt-1"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Continuar configuração
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/reports")}
                className="h-11 w-11 touch-manipulation"
                data-tour="reports-button"
                data-onboarding="reports-nav-button"
                aria-label="Relatórios"
              >
                <BarChart3 className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Relatórios</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleVisibility}
                className="h-11 w-11 touch-manipulation"
                data-tour="values-toggle"
                aria-label={isHidden ? "Mostrar valores" : "Ocultar valores"}
              >
                {isHidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isHidden ? "Mostrar valores" : "Ocultar valores"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMenuOpen(true)}
                className="h-11 w-11 touch-manipulation"
                aria-label="Menu"
                data-tour="menu-button"
                data-onboarding="settings-menu-button"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Menu</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <AppMenuDrawer
        open={menuOpen}
        onOpenChange={setMenuOpen}
        onSignOut={onSignOut}
        recurringExpenses={recurringExpenses}
      />
    </header>
  );
}
