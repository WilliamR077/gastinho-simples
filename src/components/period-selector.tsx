import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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

  const handlePeriodTypeChange = (type: string) => {
    if (!type) return;
    const t = type as PeriodType;
    if (isPremiumPeriod(t) && !hasAdvancedReports) {
      setShowUpgradeDialog(true);
      return;
    }
    
    setPeriodType(t);
    
    if (t === "month") {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      onPeriodChange(start, end, formatMonthLabel(currentDate), t);
    } else if (t === "year") {
      const start = startOfYear(currentDate);
      const end = endOfYear(currentDate);
      onPeriodChange(start, end, format(currentDate, "yyyy"), t);
    } else if (t === "quarter") {
      const start = startOfQuarter(currentDate);
      const end = endOfQuarter(currentDate);
      const quarter = getQuarter(currentDate);
      onPeriodChange(start, end, `${quarter}º Tri ${format(currentDate, "yyyy")}`, t);
    } else if (t === "all") {
      onPeriodChange(new Date(2000, 0, 1), new Date(2099, 11, 31), "Todo o histórico", t);
    }
  };

  const formatMonthLabel = (date: Date) => {
    const formatted = format(date, "MMMM 'de' yyyy", { locale: ptBR });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

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
  const handlePreviousQuarter = () => {
    const newDate = subQuarters(currentDate, 1);
    setCurrentDate(newDate);
    const quarter = getQuarter(newDate);
    onPeriodChange(startOfQuarter(newDate), endOfQuarter(newDate), `${quarter}º Tri ${format(newDate, "yyyy")}`, "quarter");
  };
  const handleNextQuarter = () => {
    const newDate = addQuarters(currentDate, 1);
    setCurrentDate(newDate);
    const quarter = getQuarter(newDate);
    onPeriodChange(startOfQuarter(newDate), endOfQuarter(newDate), `${quarter}º Tri ${format(newDate, "yyyy")}`, "quarter");
  };

  const handleCustomStartChange = (date: Date | undefined) => {
    setCustomStart(date);
    if (date && customEnd) {
      onPeriodChange(date, customEnd, `${format(date, "dd/MM/yyyy")} - ${format(customEnd, "dd/MM/yyyy")}`, "custom");
    }
  };
  const handleCustomEndChange = (date: Date | undefined) => {
    setCustomEnd(date);
    if (customStart && date) {
      onPeriodChange(customStart, date, `${format(customStart, "dd/MM/yyyy")} - ${format(date, "dd/MM/yyyy")}`, "custom");
    }
  };

  return (
    <>
      <div className="flex flex-col gap-3 py-4">
        {/* Segmented control */}
        <ToggleGroup
          type="single"
          value={periodType}
          onValueChange={handlePeriodTypeChange}
          className="bg-muted rounded-lg p-1 w-full justify-center"
        >
          <ToggleGroupItem value="month" className="text-xs flex-1 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md">
            Mês
          </ToggleGroupItem>
          <ToggleGroupItem value="year" className="text-xs flex-1 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md gap-1">
            Ano
            {!hasAdvancedReports && <Lock className="h-3 w-3 text-muted-foreground" />}
          </ToggleGroupItem>
          <ToggleGroupItem value="quarter" className="text-xs flex-1 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md gap-1">
            Tri
            {!hasAdvancedReports && <Lock className="h-3 w-3 text-muted-foreground" />}
          </ToggleGroupItem>
          <ToggleGroupItem value="custom" className="text-xs flex-1 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md gap-1">
            Custom
            {!hasAdvancedReports && <Lock className="h-3 w-3 text-muted-foreground" />}
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Month navigator */}
        {periodType === "month" && (
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" onClick={handlePreviousMonth} className="h-10 w-10 rounded-full hover:bg-muted">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-base font-semibold min-w-[180px] text-center">{formatMonthLabel(currentDate)}</span>
            <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-10 w-10 rounded-full hover:bg-muted">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        {periodType === "year" && (
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" onClick={handlePreviousYear} className="h-10 w-10 rounded-full hover:bg-muted">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-base font-semibold min-w-[80px] text-center">{format(currentDate, "yyyy")}</span>
            <Button variant="ghost" size="icon" onClick={handleNextYear} className="h-10 w-10 rounded-full hover:bg-muted">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        {periodType === "quarter" && (
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" onClick={handlePreviousQuarter} className="h-10 w-10 rounded-full hover:bg-muted">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-base font-semibold min-w-[120px] text-center">{`${getQuarter(currentDate)}º Tri ${format(currentDate, "yyyy")}`}</span>
            <Button variant="ghost" size="icon" onClick={handleNextQuarter} className="h-10 w-10 rounded-full hover:bg-muted">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        {periodType === "custom" && (
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal text-sm", !customStart && "text-muted-foreground")}>
                  <Calendar className="mr-2 h-3 w-3" />
                  {customStart ? format(customStart, "dd/MM/yyyy") : "Início"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={customStart} onSelect={handleCustomStartChange} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-sm">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[130px] justify-start text-left font-normal text-sm", !customEnd && "text-muted-foreground")}>
                  <Calendar className="mr-2 h-3 w-3" />
                  {customEnd ? format(customEnd, "dd/MM/yyyy") : "Fim"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent mode="single" selected={customEnd} onSelect={handleCustomEndChange} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {periodType === "all" && (
          <div className="flex items-center justify-center">
            <span className="text-base font-semibold text-muted-foreground">Todo o histórico</span>
          </div>
        )}
      </div>

      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Relatórios Avançados
            </DialogTitle>
            <DialogDescription className="text-left space-y-3 pt-2">
              <p>Que ótimo que você quer ver relatórios de períodos maiores!</p>
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
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)} className="w-full sm:w-auto">Cancelar</Button>
            <Button onClick={() => { setShowUpgradeDialog(false); navigate("/subscription"); }} className="w-full sm:w-auto">Ver Planos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
