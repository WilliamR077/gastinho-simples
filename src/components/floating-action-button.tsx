import { useState, useEffect, useRef } from "react";
import { Plus, X, Receipt, Target, Calculator, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onExpenseClick: () => void;
  onGoalClick: () => void;
  onCalculatorClick: () => void;
  onIncomeClick: () => void;
}

export function FloatingActionButton({
  onExpenseClick,
  onGoalClick,
  onCalculatorClick,
  onIncomeClick,
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      setVisible(currentY < lastScrollY.current || currentY < 100);
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleOptionClick = (callback: () => void) => {
    setIsOpen(false);
    callback();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Container */}
      <div className={cn(
        "fixed bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] right-6 z-40 flex flex-col items-end gap-2 pointer-events-none transition-all duration-300",
        !visible && !isOpen && "translate-y-24 opacity-0"
      )}>
        {/* Menu Options */}
        {isOpen && (
          <div className="flex flex-col gap-2 pointer-events-auto">
            <Button
              onClick={() => handleOptionClick(onGoalClick)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-lg rounded-full px-4 py-2 h-auto min-h-[44px] touch-manipulation"
            >
              <Target className="h-5 w-5" />
              <span>Meta</span>
            </Button>

            <Button
              onClick={() => handleOptionClick(onIncomeClick)}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white shadow-lg rounded-full px-4 py-2 h-auto min-h-[44px] touch-manipulation"
            >
              <TrendingUp className="h-5 w-5" />
              <span>Entrada</span>
            </Button>

            <Button
              onClick={() => handleOptionClick(onExpenseClick)}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white shadow-lg rounded-full px-4 py-2 h-auto min-h-[44px] touch-manipulation"
            >
              <Receipt className="h-5 w-5" />
              <span>Despesa</span>
            </Button>

            <Button
              data-tour="calculator-button"
              onClick={() => handleOptionClick(onCalculatorClick)}
              variant="secondary"
              className="flex items-center gap-2 shadow-lg rounded-full px-4 py-2 h-auto min-h-[44px] touch-manipulation"
            >
              <Calculator className="h-5 w-5" />
              <span>Calculadora</span>
            </Button>
          </div>
        )}

        {/* Main FAB Button */}
        <Button
          data-tour="fab-main-button"
          data-onboarding="fab-main-button"
          onClick={() => {
            const willOpen = !isOpen;
            setIsOpen(willOpen);
            if (willOpen) {
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: "fab-menu-opened" }));
              }, 100);
            }
          }}
          className={cn(
            "h-14 w-14 min-h-[44px] min-w-[44px] rounded-full shadow-xl transition-all duration-300 pointer-events-auto touch-manipulation",
            isOpen
              ? "bg-muted-foreground hover:bg-muted-foreground/90"
              : "bg-primary hover:bg-primary/90"
          )}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Plus className="h-6 w-6" />
          )}
        </Button>
      </div>
    </>
  );
}
