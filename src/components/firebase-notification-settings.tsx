import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Smartphone } from "lucide-react";
import { firebaseNotificationService } from "@/services/firebase-notification-service";
import { Capacitor } from "@capacitor/core";

interface NotificationSettings {
  is_enabled: boolean;
  notify_3_days_before: boolean;
  notify_1_day_before: boolean;
  notify_on_day: boolean;
}

export function FirebaseNotificationSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>({
    is_enabled: true,
    notify_3_days_before: true,
    notify_1_day_before: true,
    notify_on_day: true,
  });
  const [hasPermission, setHasPermission] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadSettings();
      checkFirebaseStatus();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkFirebaseStatus = async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log("Não está em plataforma nativa");
      return;
    }

    try {
      const permission = await firebaseNotificationService.checkPermissions();
      setHasPermission(permission);

      const token = firebaseNotificationService.getCurrentToken();
      setFcmToken(token);

      console.log("Status Firebase:", { permission, token });
    } catch (error) {
      console.error("Erro ao verificar status Firebase:", error);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    try {
      const { error } = await supabase.from("notification_settings").upsert(
        {
          user_id: user!.id,
          ...newSettings,
        },
        {
          onConflict: "user_id",
        }
      );

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "Suas preferências de notificação foram atualizadas.",
      });
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    }
  };

  const handleToggle = (key: keyof NotificationSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleEnableNotifications = async () => {
    try {
      await firebaseNotificationService.initialize();
      await checkFirebaseStatus();

      toast({
        title: "Notificações ativadas",
        description: "Você receberá lembretes sobre suas despesas.",
      });
    } catch (error) {
      console.error("Erro ao ativar notificações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível ativar as notificações.",
        variant: "destructive",
      });
    }
  };

  const handleTestNotification = async () => {
    if (!user) return;

    try {
      toast({
        title: "Enviando notificação de teste...",
        description: "Aguarde alguns segundos.",
      });

      const { error } = await supabase.functions.invoke("send-notification", {
        body: {
          user_id: user.id,
          title: "Notificação de Teste 🎉",
          body: "Se você recebeu esta notificação, está tudo funcionando!",
          data: {
            type: "test",
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Notificação enviada",
        description: "Verifique se você recebeu a notificação no seu dispositivo.",
      });
    } catch (error) {
      console.error("Erro ao enviar notificação de teste:", error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a notificação de teste.",
        variant: "destructive",
      });
    }
  };

  if (!Capacitor.isNativePlatform()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Notificações Push Indisponíveis
          </CardTitle>
          <CardDescription>
            As notificações push estão disponíveis apenas no aplicativo Android/iOS.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Carregando configurações...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Configurações de Notificações
        </CardTitle>
        <CardDescription>
          Receba lembretes sobre suas despesas recorrentes via Firebase Cloud Messaging
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasPermission && (
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5" />
              <div>
                <p className="font-medium">Notificações Desativadas</p>
                <p className="text-sm text-muted-foreground">
                  Ative para receber lembretes
                </p>
              </div>
            </div>
            <Button onClick={handleEnableNotifications} size="sm">
              Ativar
            </Button>
          </div>
        )}

        {/* Configurações */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="is_enabled" className="cursor-pointer">
              Ativar Notificações
            </Label>
            <Switch
              id="is_enabled"
              checked={settings.is_enabled}
              onCheckedChange={() => handleToggle("is_enabled")}
              disabled={!hasPermission}
            />
          </div>

          {settings.is_enabled && (
            <>
              <div className="flex items-center justify-between pl-6">
                <Label htmlFor="notify_3_days_before" className="cursor-pointer">
                  3 dias antes
                </Label>
                <Switch
                  id="notify_3_days_before"
                  checked={settings.notify_3_days_before}
                  onCheckedChange={() => handleToggle("notify_3_days_before")}
                />
              </div>

              <div className="flex items-center justify-between pl-6">
                <Label htmlFor="notify_1_day_before" className="cursor-pointer">
                  1 dia antes
                </Label>
                <Switch
                  id="notify_1_day_before"
                  checked={settings.notify_1_day_before}
                  onCheckedChange={() => handleToggle("notify_1_day_before")}
                />
              </div>

              <div className="flex items-center justify-between pl-6">
                <Label htmlFor="notify_on_day" className="cursor-pointer">
                  No dia
                </Label>
                <Switch
                  id="notify_on_day"
                  checked={settings.notify_on_day}
                  onCheckedChange={() => handleToggle("notify_on_day")}
                />
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
