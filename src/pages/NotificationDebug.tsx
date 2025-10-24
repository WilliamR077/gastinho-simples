import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { NotificationService } from "@/services/notification-service";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  RefreshCw, 
  Trash2, 
  Bell, 
  Clock,
  Calendar,
  Info,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function NotificationDebug() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState("");

  useEffect(() => {
    loadStats();
    setPlatform(NotificationService.isIOS() ? "iOS" : "Android/Web");
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const data = await NotificationService.getNotificationStats();
      setStats(data);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResync = async () => {
    setLoading(true);
    try {
      const { data: expenses } = await supabase
        .from("recurring_expenses")
        .select("*")
        .eq("user_id", user?.id)
        .eq("is_active", true);

      const { data: settings } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (expenses) {
        await NotificationService.syncNotifications(expenses, settings || undefined);
        await loadStats();
        
        toast({
          title: "✅ Sincronização completa",
          description: "Notificações foram atualizadas com sucesso",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao sincronizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    setLoading(true);
    try {
      const pending = await NotificationService.getNotificationStats();
      
      if (pending.pending.length > 0) {
        await NotificationService.rescheduleAllNotifications([], {
          is_enabled: false,
          notify_3_days_before: false,
          notify_1_day_before: false,
          notify_on_day: false,
        });
        
        await loadStats();
        
        toast({
          title: "🗑️ Todas notificações removidas",
          description: `${pending.total} notificações foram canceladas`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao limpar notificações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleListInConsole = async () => {
    await NotificationService.listPendingNotifications();
    toast({
      title: "📋 Logs disponíveis",
      description: "Verifique o console do navegador para detalhes",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/account")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Debug de Notificações</h1>
            <p className="text-muted-foreground">
              Visualize e gerencie notificações agendadas
            </p>
          </div>
        </div>

        {/* Platform Info */}
        <Alert className="mb-6">
          <Info className="h-4 w-4" />
          <AlertTitle>Plataforma Detectada</AlertTitle>
          <AlertDescription>
            Executando em: <strong>{platform}</strong>
            {NotificationService.isIOS() && (
              <span className="block mt-2 text-sm">
                ⚠️ Limite iOS: máximo de 64 notificações simultâneas (≈21 despesas fixas)
              </span>
            )}
          </AlertDescription>
        </Alert>

        {/* Stats Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Estatísticas de Notificações
            </CardTitle>
            <CardDescription>
              Resumo das notificações agendadas atualmente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin" />
              </div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Total */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Agendadas</p>
                      <p className="text-2xl font-bold">{stats.total}</p>
                    </div>
                  </div>
                  <Badge variant={stats.total > 0 ? "default" : "secondary"}>
                    {stats.total > 0 ? "Ativas" : "Nenhuma"}
                  </Badge>
                </div>

                {/* Por Tipo */}
                {Object.keys(stats.byType).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Por Tipo
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(stats.byType).map(([type, count]: [string, any]) => (
                          <div key={type} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                            <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                            <Badge variant="outline">{count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Status */}
                <Separator />
                <div className="space-y-2">
                  {stats.total === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Nenhuma notificação agendada</AlertTitle>
                      <AlertDescription>
                        Adicione despesas fixas para receber lembretes automáticos
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="border-green-500/50">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertTitle>Sistema Ativo</AlertTitle>
                      <AlertDescription>
                        {stats.total} notificação(ões) agendada(s) e funcionando corretamente
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Carregando estatísticas...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações de Debug</CardTitle>
            <CardDescription>
              Ferramentas para gerenciar e testar notificações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={handleResync}
              disabled={loading}
              className="w-full"
              variant="default"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Forçar Ressincronização
            </Button>

            <Button
              onClick={handleListInConsole}
              disabled={loading}
              className="w-full"
              variant="outline"
            >
              <Info className="w-4 h-4 mr-2" />
              Listar no Console
            </Button>

            <Button
              onClick={handleClearAll}
              disabled={loading}
              className="w-full"
              variant="destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Cancelar Todas Notificações
            </Button>

            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Use "Forçar Ressincronização" se perceber inconsistências entre as despesas cadastradas e as notificações recebidas.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
