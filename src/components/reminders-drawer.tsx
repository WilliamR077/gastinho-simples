import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Bell, Calendar, AlertCircle, X, Check } from "lucide-react";
import { categoryLabels, categoryIcons } from "@/types/expense";
import { Reminder } from "./reminders-button";

interface RemindersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminders: Reminder[];
  dismissedIds: Set<string>;
  onDismiss: (expenseId: string) => void;
}

export function RemindersDrawer({ 
  open, 
  onOpenChange, 
  reminders, 
  dismissedIds, 
  onDismiss 
}: RemindersDrawerProps) {
  const activeReminders = reminders.filter(r => !dismissedIds.has(r.expense.id));
  const dismissedReminders = reminders.filter(r => dismissedIds.has(r.expense.id));

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <DrawerTitle>Lembretes</DrawerTitle>
            {activeReminders.length > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {activeReminders.length} pendente{activeReminders.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <DrawerDescription>
            Despesas fixas próximas do vencimento
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {reminders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum lembrete no momento</p>
              <p className="text-sm mt-1">Você será notificado quando houver despesas próximas do vencimento</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Lembretes ativos */}
              {activeReminders.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Pendentes</h4>
                  {activeReminders.map((reminder) => (
                    <Alert
                      key={reminder.expense.id}
                      variant={reminder.isOverdue ? "destructive" : "default"}
                      className="py-3"
                    >
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between gap-2 ml-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-lg flex-shrink-0">
                            {categoryIcons[reminder.expense.category]}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{reminder.expense.description}</div>
                            <div className="text-sm text-muted-foreground">
                              R$ {Number(reminder.expense.amount).toFixed(2)} • {categoryLabels[reminder.expense.category]}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex items-center gap-1 text-xs whitespace-nowrap">
                            <Calendar className="h-3 w-3" />
                            {reminder.isOverdue ? (
                              <span className="font-medium">Venceu ontem</span>
                            ) : reminder.daysUntil === 0 ? (
                              <span className="font-medium">Hoje!</span>
                            ) : reminder.daysUntil === 1 ? (
                              <span>Amanhã</span>
                            ) : (
                              <span>{reminder.daysUntil}d</span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onDismiss(reminder.expense.id)}
                            title="Dispensar por 24h"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {/* Lembretes dispensados */}
              {dismissedReminders.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Check className="h-3 w-3" />
                    Dispensados (voltam em 24h)
                  </h4>
                  {dismissedReminders.map((reminder) => (
                    <Alert
                      key={reminder.expense.id}
                      className="py-2 opacity-60"
                    >
                      <AlertDescription className="flex items-center justify-between gap-2 ml-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-base flex-shrink-0">
                            {categoryIcons[reminder.expense.category]}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm truncate">{reminder.expense.description}</div>
                            <div className="text-xs text-muted-foreground">
                              R$ {Number(reminder.expense.amount).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
