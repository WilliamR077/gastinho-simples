import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { RecurringExpense } from "@/types/recurring-expense";
import { RemindersDrawer } from "./reminders-drawer";

interface RemindersButtonProps {
  recurringExpenses: RecurringExpense[];
}

export interface Reminder {
  expense: RecurringExpense;
  daysUntil: number;
  isOverdue: boolean;
}

const DISMISSED_REMINDERS_KEY = 'gastinho_dismissed_reminders';

export function RemindersButton({ recurringExpenses }: RemindersButtonProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Carregar lembretes dispensados do localStorage
  useEffect(() => {
    const stored = localStorage.getItem(DISMISSED_REMINDERS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { id: string; dismissedAt: number }[];
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        // Filtrar apenas os que ainda estão dentro das 24h
        const validDismissed = parsed.filter(item => (now - item.dismissedAt) < twentyFourHours);
        setDismissedIds(new Set(validDismissed.map(item => item.id)));
        
        // Atualizar localStorage removendo expirados
        localStorage.setItem(DISMISSED_REMINDERS_KEY, JSON.stringify(validDismissed));
      } catch {
        // Ignorar erro
      }
    }
  }, []);

  // Calcular lembretes
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

  // Filtrar lembretes não dispensados
  const activeReminders = reminders.filter(r => !dismissedIds.has(r.expense.id));
  const reminderCount = activeReminders.length;

  const handleDismiss = (expenseId: string) => {
    const newDismissedIds = new Set(dismissedIds);
    newDismissedIds.add(expenseId);
    setDismissedIds(newDismissedIds);
    
    // Salvar no localStorage
    const stored = localStorage.getItem(DISMISSED_REMINDERS_KEY);
    let dismissedList: { id: string; dismissedAt: number }[] = [];
    
    if (stored) {
      try {
        dismissedList = JSON.parse(stored);
      } catch {
        // Ignorar erro
      }
    }
    
    dismissedList.push({ id: expenseId, dismissedAt: Date.now() });
    localStorage.setItem(DISMISSED_REMINDERS_KEY, JSON.stringify(dismissedList));
  };

  return (
    <>
      <Button
        data-tour="reminders-button"
        variant="outline"
        size="sm"
        onClick={() => setDrawerOpen(true)}
        className="relative flex items-center gap-2 text-xs sm:text-sm"
      >
        <Bell className="w-3 h-3 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Lembretes</span>
        {reminderCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
            {reminderCount}
          </span>
        )}
      </Button>

      <RemindersDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        reminders={reminders}
        dismissedIds={dismissedIds}
        onDismiss={handleDismiss}
      />
    </>
  );
}
