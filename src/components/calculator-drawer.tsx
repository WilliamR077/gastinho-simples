import { useState, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Delete, Plus, History, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

interface HistoryItem {
  expression: string;
  result: string;
}

const HISTORY_STORAGE_KEY = "calculator-history";
const MAX_HISTORY_ITEMS = 10;

interface CalculatorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue?: number;
  onCreateExpense?: (value: number) => void;
}

export function CalculatorDrawer({
  open,
  onOpenChange,
  initialValue,
  onCreateExpense,
}: CalculatorDrawerProps) {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Carregar histórico do localStorage na montagem
  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        setHistory([]);
      }
    }
  }, []);

  // Salvar histórico no localStorage quando mudar
  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  // Quando abrir com valor inicial de uma despesa
  // Usar ref para detectar quando initialValue realmente muda
  const lastProcessedValue = useState<{ value: number | undefined; timestamp: number }>({ value: undefined, timestamp: 0 })[0];
  
  useEffect(() => {
    if (open && initialValue !== undefined) {
      // Só processa se o valor realmente mudou (evita reprocessar ao abrir/fechar)
      const now = Date.now();
      if (lastProcessedValue.value === initialValue && now - lastProcessedValue.timestamp < 500) {
        return;
      }
      lastProcessedValue.value = initialValue;
      lastProcessedValue.timestamp = now;
      
      const formattedValue = formatNumber(initialValue);
      
      if (operation !== null && waitingForNewValue) {
        // Há operação pendente aguardando segundo operando - adiciona como segundo valor
        setDisplay(formattedValue);
        setWaitingForNewValue(false);
      } else if (operation !== null && !waitingForNewValue) {
        // Há operação em andamento mas já tem segundo operando - calcula e começa nova operação de soma
        const currentValue = parseDisplay(display);
        const result = calculate(previousValue!, currentValue, operation);
        setPreviousValue(result);
        setOperation("+");
        setDisplay(formattedValue);
        setWaitingForNewValue(false);
      } else {
        // Sem operação pendente - comportamento normal
        setDisplay(formattedValue);
        setPreviousValue(null);
        setOperation(null);
        setWaitingForNewValue(false);
      }
    }
    // NÃO reseta quando abre sem valor - mantém o estado anterior
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
    const resultFormatted = formatNumber(result);

    // Adicionar ao histórico
    const expression = `${formatNumber(previousValue)} ${operation} ${display}`;
    const newHistoryItem: HistoryItem = {
      expression,
      result: resultFormatted,
    };
    setHistory((prev) => [newHistoryItem, ...prev].slice(0, MAX_HISTORY_ITEMS));

    setDisplay(resultFormatted);
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(true);
  };

  const handleHistoryItemClick = (item: HistoryItem) => {
    setDisplay(item.result);
    setPreviousValue(null);
    setOperation(null);
    setWaitingForNewValue(true);
  };

  const handleCreateExpense = () => {
    const value = parseDisplay(display);
    if (value > 0 && onCreateExpense) {
      onCreateExpense(value);
    }
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
          {/* Histórico */}
          {history.length > 0 && (
            <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-muted-foreground hover:text-foreground"
                >
                  <span className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Histórico ({history.length})
                  </span>
                  {historyOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="h-32 rounded-lg bg-muted/50 mt-2">
                  <div className="p-2 space-y-1">
                    {history.map((item, index) => (
                      <button
                        key={index}
                        onClick={() => handleHistoryItemClick(item)}
                        className="w-full text-right p-2 rounded-md hover:bg-muted transition-colors"
                      >
                        <span className="text-xs text-muted-foreground block">
                          {item.expression} =
                        </span>
                        <span className="text-sm font-medium">{item.result}</span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
          )}

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

          {/* Botão Criar Despesa */}
          {onCreateExpense && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleCreateExpense}
              disabled={parseDisplay(display) <= 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar despesa com R$ {display}
            </Button>
          )}

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
