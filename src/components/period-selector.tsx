import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Lock } from "lucide-react";
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
import { UpgradeDialog } from "@/components/upgrade-dialog";
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
        <div className="overflow-x-auto -mx-1 px-1">
          <ToggleGroup
            type="single"
            value={periodType}
            onValueChange={handlePeriodTypeChange}
            className="bg-muted rounded-lg p-1 w-full justify-center min-w-0"
          >
            <ToggleGroupItem value="month" className="text-[11px] sm:text-xs flex-1 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md px-2 sm:px-3 whitespace-nowrap">
              Mês
            </ToggleGroupItem>
            <ToggleGroupItem value="year" className="text-[11px] sm:text-xs flex-1 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md gap-0.5 px-2 sm:px-3 whitespace-nowrap">
              Ano
              {!hasAdvancedReports && <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground" />}
            </ToggleGroupItem>
            <ToggleGroupItem value="quarter" className="text-[11px] sm:text-xs flex-1 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md gap-0.5 px-2 sm:px-3 whitespace-nowrap">
              Trim.
              {!hasAdvancedReports && <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground" />}
            </ToggleGroupItem>
            <ToggleGroupItem value="custom" className="text-[11px] sm:text-xs flex-1 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md gap-0.5 px-2 sm:px-3 whitespace-nowrap">
              Custom
              {!hasAdvancedReports && <Lock className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground" />}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

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

      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        title="Disponível no Premium"
        description="Veja relatórios por trimestre, ano e períodos personalizados."
        features={[
          "Ver relatórios do ano inteiro",
          "Analisar por trimestre",
          "Definir período personalizado",
          "Ver todo o histórico",
          "Exportar para PDF",
        ]}
      />
    </>
  );
}
