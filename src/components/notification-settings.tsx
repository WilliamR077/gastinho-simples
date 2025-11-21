import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bell, TestTube, AlertTriangle } from "lucide-react";
import { NotificationService } from "@/services/notification-service";
import { LocalNotifications } from "@capacitor/local-notifications";

interface NotificationSettings {
  id?: string;
  user_id: string;
  is_enabled: boolean;
  notify_3_days_before: boolean;
  notify_1_day_before: boolean;
  notify_on_day: boolean;
}

export function NotificationSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    user_id: user?.id || "",
    is_enabled: true,
    notify_3_days_before: true,
    notify_1_day_before: true,
    notify_on_day: true,
  });

  useEffect(() => {
    if (user?.id) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
      }
    } catch (error: any) {
      console.error("Error loading notification settings:", error);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    setLoading(true);
    try {
      if (!user?.id) return;

      const { error } = await supabase
        .from("notification_settings")
        .upsert({
          user_id: user.id,
          is_enabled: newSettings.is_enabled,
          notify_3_days_before: newSettings.notify_3_days_before,
          notify_1_day_before: newSettings.notify_1_day_before,
          notify_on_day: newSettings.notify_on_day,
        });

      if (error) throw error;

      toast({
        title: "Configurações salvas!",
        description: "Suas preferências de notificação foram atualizadas.",
      });

      // Reschedule notifications with new settings
      const { data: recurringExpenses } = await supabase
        .from("recurring_expenses")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (recurringExpenses) {
        await NotificationService.rescheduleAllNotifications(recurringExpenses, newSettings);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao salvar configurações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (field: keyof NotificationSettings, value: boolean) => {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleTestNotification = async () => {
    try {
      const granted = await NotificationService.requestPermissions();
      
      if (!granted) {
        toast({
          title: "Permissão negada",
          description: "Você precisa permitir notificações nas configurações do dispositivo.",
          variant: "destructive",
        });
        return;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            title: "🔔 Teste de Notificação",
            body: "As notificações estão funcionando perfeitamente!",
            id: 99999,
            schedule: { at: new Date(Date.now() + 3000) }, // 3 seconds from now
          },
        ],
      });

      toast({
        title: "Notificação de teste agendada!",
        description: "Você receberá uma notificação em 3 segundos.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao testar notificação",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Configurações de Notificações
        </CardTitle>
        <CardDescription>
          Gerencie como e quando você deseja receber lembretes de despesas fixas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Migration Alert */}
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>⚠️ Sistema Antigo</AlertTitle>
          <AlertDescription>
            Este painel usa notificações locais (Capacitor). 
            Migre para o novo sistema Firebase em Configurações.
          </AlertDescription>
        </Alert>

        {/* Master switch */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
          <div className="space-y-0.5">
            <Label htmlFor="notifications-enabled" className="text-base font-semibold">
              Ativar Notificações
            </Label>
            <p className="text-sm text-muted-foreground">
              Receber lembretes sobre despesas fixas
            </p>
          </div>
          <Switch
            id="notifications-enabled"
            checked={settings.is_enabled}
            onCheckedChange={(checked) => handleToggle("is_enabled", checked)}
            disabled={loading}
          />
        </div>

        {/* Individual notification preferences */}
        {settings.is_enabled && (
          <div className="space-y-4 pl-4 border-l-2 border-primary/20">
            <p className="text-sm font-medium text-muted-foreground">
              Quando receber notificações:
            </p>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-3days" className="text-sm">
                  3 dias antes do vencimento
                </Label>
                <p className="text-xs text-muted-foreground">
                  Lembrete antecipado às 9h
                </p>
              </div>
              <Switch
                id="notify-3days"
                checked={settings.notify_3_days_before}
                onCheckedChange={(checked) => handleToggle("notify_3_days_before", checked)}
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-1day" className="text-sm">
                  1 dia antes do vencimento
                </Label>
                <p className="text-xs text-muted-foreground">
                  Lembrete às 18h
                </p>
              </div>
              <Switch
                id="notify-1day"
                checked={settings.notify_1_day_before}
                onCheckedChange={(checked) => handleToggle("notify_1_day_before", checked)}
                disabled={loading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-today" className="text-sm">
                  No dia do vencimento
                </Label>
                <p className="text-xs text-muted-foreground">
                  Lembrete às 8h
                </p>
              </div>
              <Switch
                id="notify-today"
                checked={settings.notify_on_day}
                onCheckedChange={(checked) => handleToggle("notify_on_day", checked)}
                disabled={loading}
              />
            </div>
          </div>
        )}

        {/* Test button */}
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleTestNotification}
            className="flex items-center gap-2 w-full"
          >
            <TestTube className="w-4 h-4" />
            Testar Notificação
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Envia uma notificação de teste em 3 segundos
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
