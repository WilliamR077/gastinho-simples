import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, Search, UserCheck, UserX, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ADMIN_EMAIL = "gastinhosimples@gmail.com";

interface UserSubscriptionInfo {
  user_id: string;
  email: string;
  subscription: {
    tier: string;
    platform: string | null;
    is_active: boolean;
    expires_at: string | null;
    started_at: string;
  } | null;
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchEmail, setSearchEmail] = useState("");
  const [userInfo, setUserInfo] = useState<UserSubscriptionInfo | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>("premium");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  if (authLoading) return null;
  if (!user || user.email !== ADMIN_EMAIL) return <Navigate to="/" replace />;

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setLoading(true);
    setUserInfo(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("admin-subscriptions", {
        method: "GET",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: undefined,
      });

      // functions.invoke doesn't support GET with query params well, use fetch directly
      const url = `https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/admin-subscriptions?email=${encodeURIComponent(searchEmail.trim())}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb2xkYXF2YmRsbG93ZXB6d2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjQ2MTYsImV4cCI6MjA3MjQwMDYxNn0.-TthPn1c2qiSQjSd7igTien0_czmLbgKWwCpBvSPV84",
        },
      });
      const data = await response.json();
      if (!response.ok) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
      } else {
        setUserInfo(data);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGrant = async () => {
    if (!userInfo) return;
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        "https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/admin-subscriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb2xkYXF2YmRsbG93ZXB6d2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjQ2MTYsImV4cCI6MjA3MjQwMDYxNn0.-TthPn1c2qiSQjSd7igTien0_czmLbgKWwCpBvSPV84",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: userInfo.email, tier: selectedTier }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Sucesso! ✅", description: data.message });
        handleSearch(); // Refresh
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!userInfo) return;
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        "https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/admin-subscriptions",
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb2xkYXF2YmRsbG93ZXB6d2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjQ2MTYsImV4cCI6MjA3MjQwMDYxNn0.-TthPn1c2qiSQjSd7igTien0_czmLbgKWwCpBvSPV84",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: userInfo.email }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Sucesso! ✅", description: data.message });
        handleSearch();
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const getTierBadge = (tier: string | undefined, platform: string | null | undefined) => {
    if (!tier || tier === "free") return <Badge variant="secondary">Gratuito</Badge>;
    const label = tier === "premium" ? "Premium ⭐" : tier === "no_ads" ? "Sem Anúncios" : tier;
    const isManual = platform === "manual";
    return (
      <div className="flex items-center gap-2">
        <Badge className="bg-primary text-primary-foreground">{label}</Badge>
        {isManual && <Badge variant="outline">Manual</Badge>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Painel Admin</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gerenciar Assinaturas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Email do usuário..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {userInfo && (
              <Card className="border-muted">
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium text-foreground">{userInfo.email}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Plano Atual</p>
                    {getTierBadge(
                      userInfo.subscription?.tier,
                      userInfo.subscription?.platform
                    )}
                  </div>
                  {userInfo.subscription?.expires_at && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Expira em</p>
                      <p className="text-foreground">
                        {new Date(userInfo.subscription.expires_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  )}
                  {userInfo.subscription?.platform && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Plataforma</p>
                      <p className="text-foreground capitalize">{userInfo.subscription.platform}</p>
                    </div>
                  )}

                  <div className="border-t border-border pt-4 space-y-3">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <p className="text-sm text-muted-foreground">Conceder plano</p>
                        <Select value={selectedTier} onValueChange={setSelectedTier}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="premium">Premium ⭐</SelectItem>
                            <SelectItem value="no_ads">Sem Anúncios</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleGrant} disabled={actionLoading} className="gap-2">
                        {actionLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                        Conceder
                      </Button>
                    </div>

                    {userInfo.subscription?.is_active &&
                      userInfo.subscription?.platform === "manual" && (
                        <Button
                          variant="destructive"
                          onClick={handleRevoke}
                          disabled={actionLoading}
                          className="w-full gap-2"
                        >
                          {actionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserX className="h-4 w-4" />
                          )}
                          Revogar (Voltar ao Gratuito)
                        </Button>
                      )}
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
