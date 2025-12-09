import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MonthNavigatorProps {
  currentDate: Date;
  onMonthChange: (startDate: Date, endDate?: Date) => void;
}

export function MonthNavigator({ currentDate, onMonthChange }: MonthNavigatorProps) {
  const handlePreviousMonth = () => {
    const newDate = subMonths(currentDate, 1);
    onMonthChange(startOfMonth(newDate), endOfMonth(newDate));
  };

  const handleNextMonth = () => {
    const newDate = addMonths(currentDate, 1);
    onMonthChange(startOfMonth(newDate), endOfMonth(newDate));
  };

  const formattedMonth = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
  const capitalizedMonth = formattedMonth.charAt(0).toUpperCase() + formattedMonth.slice(1);

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePreviousMonth}
        className="h-10 w-10 rounded-full hover:bg-primary/10"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      
      <span className="text-lg font-semibold min-w-[200px] text-center">
        {capitalizedMonth}
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
  );
}
