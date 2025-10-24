import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, Calendar, AlertCircle } from "lucide-react";
import { RecurringExpense } from "@/types/recurring-expense";
import { categoryLabels, categoryIcons } from "@/types/expense";

interface RemindersPanelProps {
  recurringExpenses: RecurringExpense[];
}

interface Reminder {
  expense: RecurringExpense;
  daysUntil: number;
  isOverdue: boolean;
}

export function RemindersPanel({ recurringExpenses }: RemindersPanelProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const upcomingReminders: Reminder[] = [];

    recurringExpenses
      .filter((expense) => expense.is_active)
      .forEach((expense) => {
        const dueDay = expense.day_of_month;
        
        // Calculate date of this month's charge
        const thisMonthDue = new Date(currentYear, currentMonth, dueDay);
        const daysDiff = Math.ceil((thisMonthDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Show if within 3 days before or 1 day after
        if (daysDiff >= -1 && daysDiff <= 3) {
          upcomingReminders.push({
            expense,
            daysUntil: daysDiff,
            isOverdue: daysDiff < 0,
          });
        }
      });

    // Sort by days until due
    upcomingReminders.sort((a, b) => a.daysUntil - b.daysUntil);
    setReminders(upcomingReminders);
  }, [recurringExpenses]);

  if (reminders.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 mb-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Lembretes</h3>
        <Badge variant="secondary" className="ml-auto">
          {reminders.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {reminders.map((reminder) => (
          <Alert
            key={reminder.expense.id}
            variant={reminder.isOverdue ? "destructive" : "default"}
            className="py-3"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-4 ml-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {categoryIcons[reminder.expense.category]}
                </span>
                <div>
                  <div className="font-medium">{reminder.expense.description}</div>
                  <div className="text-sm text-muted-foreground">
                    R$ {Number(reminder.expense.amount).toFixed(2)} • {categoryLabels[reminder.expense.category]}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm whitespace-nowrap">
                <Calendar className="h-4 w-4" />
                {reminder.isOverdue ? (
                  <span className="font-medium">Venceu ontem</span>
                ) : reminder.daysUntil === 0 ? (
                  <span className="font-medium">Vence hoje!</span>
                ) : reminder.daysUntil === 1 ? (
                  <span>Vence amanhã</span>
                ) : (
                  <span>Em {reminder.daysUntil} dias</span>
                )}
              </div>
            </AlertDescription>
          </Alert>
        ))}
      </div>
    </Card>
  );
}
