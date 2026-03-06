import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Eye, EyeOff, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { useSubscription } from "@/hooks/use-subscription";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppMenuDrawer } from "./app-menu-drawer";
import { RecurringExpense } from "@/types/recurring-expense";

interface AppHeaderProps {
  recurringExpenses: RecurringExpense[];
  onSignOut: () => void;
}

export function AppHeader({ recurringExpenses, onSignOut }: AppHeaderProps) {
  const navigate = useNavigate();
  const { isHidden, toggleVisibility } = useValuesVisibility();
  const { tier } = useSubscription();
  const [menuOpen, setMenuOpen] = useState(false);

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

        {/* Right: 3 icon buttons */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/reports")}
                className="h-11 w-11 touch-manipulation"
                data-tour="reports-button"
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
