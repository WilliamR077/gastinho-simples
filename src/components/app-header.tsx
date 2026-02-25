import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Eye, EyeOff, Menu } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useValuesVisibility } from "@/hooks/use-values-visibility";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppMenuDrawer } from "./app-menu-drawer";
import { RecurringExpense } from "@/types/recurring-expense";

interface AppHeaderProps {
  currentMonth: Date;
  recurringExpenses: RecurringExpense[];
  onSignOut: () => void;
}

export function AppHeader({ currentMonth, recurringExpenses, onSignOut }: AppHeaderProps) {
  const navigate = useNavigate();
  const { isHidden, toggleVisibility } = useValuesVisibility();
  const [menuOpen, setMenuOpen] = useState(false);

  const monthLabel = format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40">
      <div className="container mx-auto max-w-6xl px-4 flex items-center justify-between h-14 sm:h-16">
        {/* Left: Logo */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 touch-manipulation hover:opacity-80 transition-opacity"
          aria-label="Ir para a página inicial"
        >
          <img
            src="/lovable-uploads/06a1acc2-f553-41f0-8d87-32d25b4e425e.png"
            alt="Gastinho Simples"
            className="h-9 sm:h-10 w-auto"
          />
        </button>

        {/* Center: Month label */}
        <span className="text-sm sm:text-base font-medium text-foreground capitalize hidden xs:inline sm:inline">
          {monthLabel}
        </span>

        {/* Right: 3 icon buttons */}
        <div className="flex items-center gap-1">
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
