import { useNavigate } from "react-router-dom";
import { CreditCard, Settings, User, Bell, LogOut, Moon, Sun } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/hooks/use-theme";
import { RecurringExpense } from "@/types/recurring-expense";
import { useState, useEffect } from "react";
import { RemindersDrawer } from "./reminders-drawer";
import { Reminder } from "./reminders-button";
import { adMobService } from "@/services/admob-service";

const DISMISSED_REMINDERS_KEY = 'gastinho_dismissed_reminders';

interface AppMenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
  recurringExpenses: RecurringExpense[];
}

export function AppMenuDrawer({ open, onOpenChange, onSignOut, recurringExpenses }: AppMenuDrawerProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Remove ad banner when drawer opens, restore when closed
  useEffect(() => {
    if (open) {
      adMobService.removeBanner();
    } else {
      adMobService.showBanner();
    }
  }, [open]);

  // Load dismissed reminders
  useEffect(() => {
    const stored = localStorage.getItem(DISMISSED_REMINDERS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { id: string; dismissedAt: number }[];
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        const validDismissed = parsed.filter(item => (now - item.dismissedAt) < twentyFourHours);
        setDismissedIds(new Set(validDismissed.map(item => item.id)));
        localStorage.setItem(DISMISSED_REMINDERS_KEY, JSON.stringify(validDismissed));
      } catch {
        // ignore
      }
    }
  }, []);

  // Calculate reminders
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
        const thisMonthDue = new Date(currentYear, currentMonth, dueDay);
        const daysDiff = Math.ceil((thisMonthDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff >= -1 && daysDiff <= 3) {
          upcomingReminders.push({ expense, daysUntil: daysDiff, isOverdue: daysDiff < 0 });
        }
      });

    upcomingReminders.sort((a, b) => a.daysUntil - b.daysUntil);
    setReminders(upcomingReminders);
  }, [recurringExpenses]);

  const activeReminders = reminders.filter(r => !dismissedIds.has(r.expense.id));
  const reminderCount = activeReminders.length;

  const handleDismiss = (expenseId: string) => {
    const newDismissedIds = new Set(dismissedIds);
    newDismissedIds.add(expenseId);
    setDismissedIds(newDismissedIds);
    const stored = localStorage.getItem(DISMISSED_REMINDERS_KEY);
    let dismissedList: { id: string; dismissedAt: number }[] = [];
    if (stored) {
      try { dismissedList = JSON.parse(stored); } catch { /* ignore */ }
    }
    dismissedList.push({ id: expenseId, dismissedAt: Date.now() });
    localStorage.setItem(DISMISSED_REMINDERS_KEY, JSON.stringify(dismissedList));
  };

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const menuItems = [
    { icon: CreditCard, label: "Cartões", onClick: () => handleNavigate("/cards"), dataTour: "cards-button" },
    { icon: Settings, label: "Configurações", onClick: () => handleNavigate("/settings"), dataTour: "settings-button" },
    { icon: User, label: "Conta", onClick: () => handleNavigate("/account") },
    {
      icon: Bell,
      label: "Lembretes",
      onClick: () => { onOpenChange(false); setRemindersOpen(true); },
      badge: reminderCount > 0 ? reminderCount : undefined,
      dataTour: "reminders-button",
    },
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex flex-col w-72 sm:w-80">
          {/* HEADER AJUSTADO */}
          <SheetHeader className="py-6 flex flex-col items-center justify-center text-center">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">Menu de navegação</SheetDescription>

            <img
              src="/lovable-uploads/06a1acc2-f553-41f0-8d87-32d25b4e425e.png"
              alt="Gastinho Simples"
              className="mx-auto block !h-20 sm:!h-24 w-auto !max-w-[260px] object-contain"
            />
          </SheetHeader>

          <nav className="flex flex-col gap-1 flex-1">
            {menuItems.map((item) => (
              <button
                key={item.label}
                data-tour={item.dataTour}
                onClick={item.onClick}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors touch-manipulation relative"
              >
                <item.icon className="h-5 w-5 text-muted-foreground" />
                {item.label}
                {item.badge && (
                  <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}

            {/* Theme toggle */}
            <div className="flex items-center gap-3 px-3 py-3 rounded-lg">
              {theme === "dark" ? (
                <Moon className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Sun className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="text-sm font-medium text-foreground flex-1">
                {theme === "dark" ? "Tema Escuro" : "Tema Claro"}
              </span>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                data-tour="theme-toggle"
              />
            </div>
          </nav>

          {/* Sign out - fixed at bottom */}
          <div className="mt-auto pt-2">
            <Separator className="mb-2" />
            <button
              onClick={() => {
                onOpenChange(false);
                onSignOut();
              }}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors touch-manipulation"
            >
              <LogOut className="h-5 w-5" />
              Sair
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <RemindersDrawer
        open={remindersOpen}
        onOpenChange={setRemindersOpen}
        reminders={reminders}
        dismissedIds={dismissedIds}
        onDismiss={handleDismiss}
      />
    </>
  );
}
