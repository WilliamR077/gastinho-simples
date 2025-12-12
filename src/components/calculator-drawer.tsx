import { useState, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Delete } from "lucide-react";

interface CalculatorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: number;
}

export function CalculatorDrawer({
  open,
  onOpenChange,
  initialValue,
}: CalculatorDrawerProps) {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);

  // Quando abrir com valor inicial
  useEffect(() => {
    if (open && initialValue !== undefined) {
      setDisplay(formatNumber(initialValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForNewValue(false);
    } else if (open) {
      // Reset quando abrir sem valor
      setDisplay("0");
      setPreviousValue(null);
      setOperation(null);
      setWaitingForNewValue(false);
    }
  }, [open, initialValue]);

  const formatNumber = (num: number): string => {
    return num.toLocaleString("pt-BR", { 
      maximumFractionDigits: 10,
      useGrouping: false 
    });
  };

  const parseDisplay = (value: string): number => {
    return parseFloat(value.replace(",", "."));
  };

  const handleNumber = (num: string) => {
    if (waitingForNewValue) {
      setDisplay(num);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === "0" ? num : display + num);
    }
  };

  const handleDecimal = () => {
    if (waitingForNewValue) {
      setDisplay("0,");
      setWaitingForNewValue(false);
    } else if (!display.includes(",")) {
      setDisplay(display + ",");
    }
  };

  const handleOperation = (op: string) => {
    const currentValue = parseDisplay(display);

    if (previousValue !== null && operation && !waitingForNewValue) {
      const result = calculate(previousValue, currentValue, operation);
      setDisplay(formatNumber(result));
      setPreviousValue(result);
    } else {
      setPreviousValue(currentValue);
    }

    setOperation(op);
    setWaitingForNewValue(true);
  };

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "×":
        return a * b;
      case "÷":
        return b !== 0 ? a / b : 0;
      default:
        return b;
    }
  };

  const handleEquals = () => {
    if (previousValue === null || operation === null) return;

    const currentValue = parseDisplay(display);
    const result = calculate(previousValue, currentValue, operation);

    setDisplay(formatNumber(result));
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(true);
  };

  const handleClear = () => {
    setDisplay("0");
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(false);
  };

  const handleBackspace = () => {
    if (display.length === 1 || (display.length === 2 && display.startsWith("-"))) {
      setDisplay("0");
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const handlePercent = () => {
    const currentValue = parseDisplay(display);
    setDisplay(formatNumber(currentValue / 100));
  };

  const buttonClass = "h-14 text-xl font-medium rounded-xl transition-all active:scale-95";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-6">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-center">Calculadora</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 space-y-3">
          {/* Display */}
          <div className="bg-muted rounded-xl p-4 min-h-[80px] flex flex-col justify-end items-end">
            {previousValue !== null && operation && (
              <span className="text-sm text-muted-foreground">
                {formatNumber(previousValue)} {operation}
              </span>
            )}
            <span className="text-3xl font-bold break-all text-right">
              {display}
            </span>
          </div>

          {/* Teclado */}
          <div className="grid grid-cols-4 gap-2">
            {/* Linha 1 */}
            <Button
              variant="secondary"
              className={buttonClass}
              onClick={handleClear}
            >
              C
            </Button>
            <Button
              variant="secondary"
              className={buttonClass}
              onClick={handleBackspace}
            >
              <Delete className="h-5 w-5" />
            </Button>
            <Button
              variant="secondary"
              className={buttonClass}
              onClick={handlePercent}
            >
              %
            </Button>
            <Button
              variant="outline"
              className={`${buttonClass} bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-600 dark:text-amber-400`}
              onClick={() => handleOperation("÷")}
            >
              ÷
            </Button>

            {/* Linha 2 */}
            <Button variant="ghost" className={buttonClass} onClick={() => handleNumber("7")}>
              7
            </Button>
            <Button variant="ghost" className={buttonClass} onClick={() => handleNumber("8")}>
              8
            </Button>
            <Button variant="ghost" className={buttonClass} onClick={() => handleNumber("9")}>
              9
            </Button>
            <Button
              variant="outline"
              className={`${buttonClass} bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-600 dark:text-amber-400`}
              onClick={() => handleOperation("×")}
            >
              ×
            </Button>

            {/* Linha 3 */}
            <Button variant="ghost" className={buttonClass} onClick={() => handleNumber("4")}>
              4
            </Button>
            <Button variant="ghost" className={buttonClass} onClick={() => handleNumber("5")}>
              5
            </Button>
            <Button variant="ghost" className={buttonClass} onClick={() => handleNumber("6")}>
              6
            </Button>
            <Button
              variant="outline"
              className={`${buttonClass} bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-600 dark:text-amber-400`}
              onClick={() => handleOperation("-")}
            >
              −
            </Button>

            {/* Linha 4 */}
            <Button variant="ghost" className={buttonClass} onClick={() => handleNumber("1")}>
              1
            </Button>
            <Button variant="ghost" className={buttonClass} onClick={() => handleNumber("2")}>
              2
            </Button>
            <Button variant="ghost" className={buttonClass} onClick={() => handleNumber("3")}>
              3
            </Button>
            <Button
              variant="outline"
              className={`${buttonClass} bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-600 dark:text-amber-400`}
              onClick={() => handleOperation("+")}
            >
              +
            </Button>

            {/* Linha 5 */}
            <Button variant="ghost" className={`${buttonClass} col-span-2`} onClick={() => handleNumber("0")}>
              0
            </Button>
            <Button variant="ghost" className={buttonClass} onClick={handleDecimal}>
              ,
            </Button>
            <Button
              className={`${buttonClass} bg-primary hover:bg-primary/90`}
              onClick={handleEquals}
            >
              =
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
