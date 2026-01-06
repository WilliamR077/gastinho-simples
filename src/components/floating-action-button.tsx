import { useState } from "react";
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

      <div className="fixed bottom-20 right-6 z-50 flex flex-col items-end gap-3">
        {/* Menu Options - appear ABOVE the button */}
        <div
          className={cn(
            "flex flex-col gap-2 transition-all duration-300",
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          )}
        >
          <Button
            onClick={() => handleOptionClick(onGoalClick)}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-lg rounded-full px-4 py-2 h-auto"
          >
            <Target className="h-5 w-5" />
            <span>Meta</span>
          </Button>

          <Button
            onClick={() => handleOptionClick(onIncomeClick)}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white shadow-lg rounded-full px-4 py-2 h-auto"
          >
            <TrendingUp className="h-5 w-5" />
            <span>Entrada</span>
          </Button>
          
          <Button
            onClick={() => handleOptionClick(onExpenseClick)}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white shadow-lg rounded-full px-4 py-2 h-auto"
          >
            <Receipt className="h-5 w-5" />
            <span>Despesa</span>
          </Button>
        </div>

        {/* Calculator Button - always visible */}
        <Button
          data-tour="calculator-button"
          onClick={onCalculatorClick}
          variant="secondary"
          className="h-10 w-10 rounded-full shadow-lg"
        >
          <Calculator className="h-5 w-5" />
        </Button>

        {/* Main FAB Button */}
        <Button
          data-tour="fab-main-button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "h-14 w-14 rounded-full shadow-xl transition-all duration-300",
            isOpen
              ? "bg-destructive hover:bg-destructive/90 rotate-45"
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
