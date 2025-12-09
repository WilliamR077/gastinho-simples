import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  format,
  addMonths,
  subMonths,
  addYears,
  subYears,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfQuarter,
  endOfQuarter,
  addQuarters,
  subQuarters,
  getQuarter,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSubscription } from "@/hooks/use-subscription";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PeriodType = "month" | "year" | "quarter" | "custom" | "all";

interface PeriodSelectorProps {
  onPeriodChange: (startDate: Date, endDate: Date, periodLabel: string, periodType: PeriodType) => void;
}

const PREMIUM_PERIODS: PeriodType[] = ["year", "quarter", "custom", "all"];

export function PeriodSelector({ onPeriodChange }: PeriodSelectorProps) {
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  
  const { hasAdvancedReports } = useSubscription();
  const navigate = useNavigate();

  const isPremiumPeriod = (type: PeriodType) => PREMIUM_PERIODS.includes(type);

  const handlePeriodTypeChange = (type: PeriodType) => {
    // Verificar se é período premium e usuário não tem acesso
    if (isPremiumPeriod(type) && !hasAdvancedReports) {
      setShowUpgradeDialog(true);
      return;
    }
    
    setPeriodType(type);
    
    if (type === "month") {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const label = formatMonthLabel(currentDate);
      onPeriodChange(start, end, label, type);
    } else if (type === "year") {
      const start = startOfYear(currentDate);
      const end = endOfYear(currentDate);
      const label = format(currentDate, "yyyy");
      onPeriodChange(start, end, label, type);
    } else if (type === "quarter") {
      const start = startOfQuarter(currentDate);
      const end = endOfQuarter(currentDate);
      const quarter = getQuarter(currentDate);
      const label = `${quarter}º Trimestre de ${format(currentDate, "yyyy")}`;
      onPeriodChange(start, end, label, type);
    } else if (type === "all") {
      const start = new Date(2000, 0, 1);
      const end = new Date(2099, 11, 31);
      onPeriodChange(start, end, "Todo o histórico", type);
    }
  };

  const formatMonthLabel = (date: Date) => {
    const formatted = format(date, "MMMM 'de' yyyy", { locale: ptBR });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  // Month navigation
  const handlePreviousMonth = () => {
    const newDate = subMonths(currentDate, 1);
    setCurrentDate(newDate);
    onPeriodChange(startOfMonth(newDate), endOfMonth(newDate), formatMonthLabel(newDate), "month");
  };

  const handleNextMonth = () => {
    const newDate = addMonths(currentDate, 1);
    setCurrentDate(newDate);
    onPeriodChange(startOfMonth(newDate), endOfMonth(newDate), formatMonthLabel(newDate), "month");
  };

  // Year navigation
  const handlePreviousYear = () => {
    const newDate = subYears(currentDate, 1);
    setCurrentDate(newDate);
    onPeriodChange(startOfYear(newDate), endOfYear(newDate), format(newDate, "yyyy"), "year");
  };

  const handleNextYear = () => {
    const newDate = addYears(currentDate, 1);
    setCurrentDate(newDate);
    onPeriodChange(startOfYear(newDate), endOfYear(newDate), format(newDate, "yyyy"), "year");
  };

  // Quarter navigation
  const handlePreviousQuarter = () => {
    const newDate = subQuarters(currentDate, 1);
    setCurrentDate(newDate);
    const quarter = getQuarter(newDate);
    const label = `${quarter}º Trimestre de ${format(newDate, "yyyy")}`;
    onPeriodChange(startOfQuarter(newDate), endOfQuarter(newDate), label, "quarter");
  };

  const handleNextQuarter = () => {
    const newDate = addQuarters(currentDate, 1);
    setCurrentDate(newDate);
    const quarter = getQuarter(newDate);
    const label = `${quarter}º Trimestre de ${format(newDate, "yyyy")}`;
    onPeriodChange(startOfQuarter(newDate), endOfQuarter(newDate), label, "quarter");
  };

  // Custom date selection
  const handleCustomStartChange = (date: Date | undefined) => {
    setCustomStart(date);
    if (date && customEnd) {
      const label = `${format(date, "dd/MM/yyyy")} - ${format(customEnd, "dd/MM/yyyy")}`;
      onPeriodChange(date, customEnd, label, "custom");
    }
  };

  const handleCustomEndChange = (date: Date | undefined) => {
    setCustomEnd(date);
    if (customStart && date) {
      const label = `${format(customStart, "dd/MM/yyyy")} - ${format(date, "dd/MM/yyyy")}`;
      onPeriodChange(customStart, date, label, "custom");
    }
  };

  const getQuarterLabel = () => {
    const quarter = getQuarter(currentDate);
    return `${quarter}º Tri ${format(currentDate, "yyyy")}`;
  };

  return (
    <>
      <div className="flex flex-col gap-3 py-4">
        {/* Period type selector */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">Período:</span>
          <Select value={periodType} onValueChange={(v) => handlePeriodTypeChange(v as PeriodType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="year" className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Ano
                  {!hasAdvancedReports && <Lock className="h-3 w-3 text-muted-foreground" />}
                </span>
              </SelectItem>
              <SelectItem value="quarter">
                <span className="flex items-center gap-2">
                  Trimestre
                  {!hasAdvancedReports && <Lock className="h-3 w-3 text-muted-foreground" />}
                </span>
              </SelectItem>
              <SelectItem value="custom">
                <span className="flex items-center gap-2">
                  Personalizado
                  {!hasAdvancedReports && <Lock className="h-3 w-3 text-muted-foreground" />}
                </span>
              </SelectItem>
              <SelectItem value="all">
                <span className="flex items-center gap-2">
                  Todo histórico
                  {!hasAdvancedReports && <Lock className="h-3 w-3 text-muted-foreground" />}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

      {/* Month navigator */}
      {periodType === "month" && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePreviousMonth}
            className="h-10 w-10 rounded-full hover:bg-primary/10"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <span className="text-lg font-semibold min-w-[200px] text-center">
            {formatMonthLabel(currentDate)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextMonth}
            className="h-10 w-10 rounded-full hover:bg-primary/10"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Year navigator */}
      {periodType === "year" && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePreviousYear}
            className="h-10 w-10 rounded-full hover:bg-primary/10"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <span className="text-lg font-semibold min-w-[100px] text-center">
            {format(currentDate, "yyyy")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextYear}
            className="h-10 w-10 rounded-full hover:bg-primary/10"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Quarter navigator */}
      {periodType === "quarter" && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePreviousQuarter}
            className="h-10 w-10 rounded-full hover:bg-primary/10"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <span className="text-lg font-semibold min-w-[150px] text-center">
            {getQuarterLabel()}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextQuarter}
            className="h-10 w-10 rounded-full hover:bg-primary/10"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Custom date pickers */}
      {periodType === "custom" && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[140px] justify-start text-left font-normal",
                  !customStart && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {customStart ? format(customStart, "dd/MM/yyyy") : "Início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={customStart}
                onSelect={handleCustomStartChange}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground">até</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[140px] justify-start text-left font-normal",
                  !customEnd && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {customEnd ? format(customEnd, "dd/MM/yyyy") : "Fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={customEnd}
                onSelect={handleCustomEndChange}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* All history label */}
      {periodType === "all" && (
        <div className="flex items-center justify-center">
          <span className="text-lg font-semibold text-center text-muted-foreground">
            Todo o histórico
          </span>
        </div>
      )}
    </div>

    {/* Dialog de Upgrade */}
    <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Relatórios Avançados
          </DialogTitle>
          <DialogDescription className="text-left space-y-3 pt-2">
            <p>
              Que ótimo que você quer ver relatórios de períodos maiores!
            </p>
            <p className="font-medium">Com o Premium você pode:</p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Ver relatórios do ano inteiro</li>
              <li>Analisar por trimestre</li>
              <li>Definir período personalizado</li>
              <li>Ver todo o histórico</li>
              <li>Exportar para PDF</li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowUpgradeDialog(false)}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              setShowUpgradeDialog(false);
              navigate("/subscription");
            }}
            className="w-full sm:w-auto"
          >
            Ver Planos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
