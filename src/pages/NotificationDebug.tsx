import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { firebaseNotificationService } from "@/services/firebase-notification-service";
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
  const [hasPermission, setHasPermission] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    checkFCMStatus();
  }, []);

  const checkFCMStatus = async () => {
    const permission = await firebaseNotificationService.checkPermissions();
    const token = firebaseNotificationService.getCurrentToken();
    setHasPermission(permission);
    setFcmToken(token);
    setPlatform("Firebase Cloud Messaging");
    console.log("FCM Status:", { permission, token });
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      // Buscar estatísticas de notificações do Firebase
      const { data: tokens } = await supabase
        .from("user_fcm_tokens")
        .select("*")
        .eq("user_id", user?.id);
      
      setStats({
        total: tokens?.length || 0,
        tokens: tokens || []
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResync = async () => {
    setLoading(true);
    try {
      await firebaseNotificationService.initialize();
      await checkFCMStatus();
      await loadStats();
      
      toast({
        title: "✅ Firebase reinicializado",
        description: "Serviço de notificações foi reinicializado com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao reinicializar",
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
      if (fcmToken) {
        await firebaseNotificationService.removeFCMToken();
        await loadStats();
        
        toast({
          title: "🗑️ Token removido",
          description: "Token FCM foi removido do banco de dados",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao remover token",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleListInConsole = async () => {
    console.log("=== FCM Debug Info ===");
    console.log("Platform:", platform);
    console.log("Has Permission:", hasPermission);
    console.log("FCM Token:", fcmToken);
    console.log("Stats:", stats);
    
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
          <AlertTitle>Sistema de Notificações</AlertTitle>
          <AlertDescription>
            Sistema: <strong>{platform}</strong>
            <span className="block mt-2 text-sm">
              {hasPermission ? "✅ Permissões concedidas" : "❌ Permissões negadas"}
            </span>
          </AlertDescription>
        </Alert>

        {/* Firebase Status Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Firebase Cloud Messaging (FCM)
            </CardTitle>
            <CardDescription>
              Status da conexão e informações do token
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>Status:</strong> {hasPermission ? "✅ Ativo" : "❌ Inativo"}</p>
            <p><strong>FCM Token:</strong> {fcmToken ? `${fcmToken.substring(0, 30)}...` : "Não disponível"}</p>
            <p><strong>Dispositivos registrados:</strong> {stats?.total || 0}</p>
            <Button onClick={() => firebaseNotificationService.initialize()} className="mt-4">
              Reinicializar Firebase
            </Button>
          </CardContent>
        </Card>

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
                      <AlertTitle>Nenhum dispositivo registrado</AlertTitle>
                      <AlertDescription>
                        Ative as notificações nas configurações para começar a receber lembretes
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="border-green-500/50">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertTitle>Firebase Ativo</AlertTitle>
                      <AlertDescription>
                        {stats.total} dispositivo(s) registrado(s) e pronto para receber notificações
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
              Reinicializar Firebase
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
              Remover Token FCM
            </Button>

            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Use "Reinicializar Firebase" para reconectar ao serviço de notificações se houver problemas.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
