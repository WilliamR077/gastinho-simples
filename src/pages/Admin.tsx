import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Shield, Search, UserCheck, UserX, Loader2, Users, TrendingUp, DollarSign, UserPlus, Activity, CreditCard, BarChart3, ClipboardList, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ADMIN_EMAIL = "gastinhosimples@gmail.com";
const SUBS_API = `https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/admin-subscriptions`;
const DASH_API = `https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/admin-dashboard`;
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb2xkYXF2YmRsbG93ZXB6d2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjQ2MTYsImV4cCI6MjA3MjQwMDYxNn0.-TthPn1c2qiSQjSd7igTien0_czmLbgKWwCpBvSPV84";

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
    apikey: API_KEY,
    "Content-Type": "application/json",
  };
}

// ── Shared Components ──

function TierBadge({ tier, platform }: { tier?: string; platform?: string | null }) {
  if (!tier || tier === "free") return <Badge variant="secondary">Gratuito</Badge>;
  const label = tier === "premium" ? "Premium ⭐" : tier === "no_ads" ? "Sem Anúncios" : tier;
  return (
    <div className="flex items-center gap-2">
      <Badge className="bg-primary text-primary-foreground">{label}</Badge>
      {platform === "manual" && <Badge variant="outline">Manual</Badge>}
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, subtitle, color = "text-primary" }: {
  title: string; value: string | number; icon: React.ElementType; subtitle?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`rounded-lg p-2 bg-muted ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{title}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Tab 1: Dashboard Overview ──

interface DashboardData {
  overview: {
    total_users: number;
    active_subscribers: number;
    revenue_estimate: { total_mrr: number; premium?: number; no_ads?: number };
    new_users_30d: number;
    new_users_7d: number;
  };
  subscription_breakdown: { tier: string; platform: string; count: number }[];
  recent_signups: { email: string; created_at: string }[];
  activity_stats: {
    total_expenses: number; total_incomes: number;
    total_groups: number; total_cards: number;
    expenses_30d: number; incomes_30d: number;
  };
  audit_logs: AuditLog[];
}

function OverviewTab({ data, loading }: { data: DashboardData | null; loading: boolean }) {
  if (loading) return <LoadingSpinner />;
  if (!data) return <p className="text-sm text-muted-foreground text-center py-8">Erro ao carregar dados</p>;

  const { overview, subscription_breakdown, recent_signups, activity_stats } = data;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users} title="Total de Usuários" value={overview.total_users} subtitle={`+${overview.new_users_7d} esta semana`} color="text-blue-500" />
        <KpiCard icon={TrendingUp} title="Assinantes Ativos" value={overview.active_subscribers} color="text-green-500" />
        <KpiCard icon={DollarSign} title="MRR Estimado" value={`R$ ${overview.revenue_estimate.total_mrr.toFixed(2)}`} color="text-yellow-500" />
        <KpiCard icon={UserPlus} title="Novos (30 dias)" value={overview.new_users_30d} color="text-purple-500" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Subscription Breakdown */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Distribuição de Planos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {subscription_breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados</p>
            ) : subscription_breakdown.map((item, i) => {
              const total = subscription_breakdown.reduce((s, x) => s + x.count, 0);
              const pct = total > 0 ? (item.count / total * 100).toFixed(0) : 0;
              const tierLabel = item.tier === "premium" ? "Premium" : item.tier === "no_ads" ? "Sem Anúncios" : item.tier === "free" ? "Gratuito" : item.tier;
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-28 truncate text-foreground">{tierLabel}</span>
                  <span className="text-xs text-muted-foreground w-16 capitalize">{item.platform}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-foreground w-8 text-right">{item.count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Activity Stats */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Atividade da Plataforma</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Despesas", total: activity_stats.total_expenses, delta: activity_stats.expenses_30d },
                { label: "Receitas", total: activity_stats.total_incomes, delta: activity_stats.incomes_30d },
                { label: "Grupos", total: activity_stats.total_groups },
                { label: "Cartões", total: activity_stats.total_cards },
              ].map((s) => (
                <div key={s.label} className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold text-foreground">{s.total.toLocaleString("pt-BR")}</p>
                  {s.delta !== undefined && <p className="text-xs text-muted-foreground">+{s.delta} (30d)</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Signups */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Registros Recentes</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {recent_signups.map((u, i) => (
              <div key={i} className="flex justify-between items-center text-sm py-1.5 border-b border-border last:border-0">
                <span className="text-foreground truncate">{u.email}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{new Date(u.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab 2: Subscriptions ──

interface SubscriberInfo {
  email: string; tier: string; platform: string | null; started_at: string; expires_at: string | null;
}

interface UserSubscriptionInfo {
  user_id: string; email: string;
  subscription: { tier: string; platform: string | null; is_active: boolean; expires_at: string | null; started_at: string } | null;
}

function SubscriptionsTab() {
  const { toast } = useToast();
  const [subscribers, setSubscribers] = useState<SubscriberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [userInfo, setUserInfo] = useState<UserSubscriptionInfo | null>(null);
  const [selectedTier, setSelectedTier] = useState("premium");
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(SUBS_API, { headers });
        const data = await res.json();
        if (res.ok) setSubscribers(data.subscribers || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleSearch = async (emailOverride?: string) => {
    const email = emailOverride || searchEmail.trim();
    if (!email) return;
    if (emailOverride) setSearchEmail(email);
    setSearchLoading(true);
    setUserInfo(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${SUBS_API}?email=${encodeURIComponent(email)}`, { headers });
      const data = await res.json();
      if (!res.ok) toast({ title: "Erro", description: data.error, variant: "destructive" });
      else setUserInfo(data);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAction = async (action: "grant" | "revoke") => {
    if (!userInfo) return;
    setActionLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(SUBS_API, {
        method: action === "grant" ? "POST" : "DELETE",
        headers,
        body: JSON.stringify(action === "grant" ? { email: userInfo.email, tier: selectedTier } : { email: userInfo.email }),
      });
      const data = await res.json();
      if (!res.ok) toast({ title: "Erro", description: data.error, variant: "destructive" });
      else { toast({ title: "Sucesso! ✅", description: data.message }); handleSearch(); }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Active Subscribers Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Assinantes Ativos ({subscribers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <LoadingSpinner /> : subscribers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum assinante ativo</p>
          ) : (
            <div className="rounded-md border overflow-auto max-h-80">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Email</TableHead><TableHead>Plano</TableHead><TableHead>Plataforma</TableHead><TableHead>Início</TableHead><TableHead>Expiração</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {subscribers.map((sub) => (
                    <TableRow key={sub.email} className="cursor-pointer hover:bg-muted/50" onClick={() => handleSearch(sub.email)}>
                      <TableCell className="font-medium">{sub.email}</TableCell>
                      <TableCell><TierBadge tier={sub.tier} platform={sub.platform} /></TableCell>
                      <TableCell className="capitalize">{sub.platform || "—"}</TableCell>
                      <TableCell>{new Date(sub.started_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{sub.expires_at ? new Date(sub.expires_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search & Manage */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Gerenciar Assinatura</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Email do usuário..." value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
            <Button onClick={() => handleSearch()} disabled={searchLoading} size="icon">
              {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {userInfo && (
            <Card className="border-muted">
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium text-sm text-foreground">{userInfo.email}</p></div>
                  <div><p className="text-xs text-muted-foreground">Plano Atual</p><TierBadge tier={userInfo.subscription?.tier} platform={userInfo.subscription?.platform} /></div>
                </div>
                {userInfo.subscription?.expires_at && (
                  <div><p className="text-xs text-muted-foreground">Expira em</p><p className="text-sm text-foreground">{new Date(userInfo.subscription.expires_at).toLocaleDateString("pt-BR")}</p></div>
                )}
                <div className="border-t border-border pt-3 space-y-3">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <p className="text-xs text-muted-foreground">Conceder plano</p>
                      <Select value={selectedTier} onValueChange={setSelectedTier}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="premium">Premium ⭐</SelectItem>
                          <SelectItem value="no_ads">Sem Anúncios</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => handleAction("grant")} disabled={actionLoading} className="gap-1">
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />} Conceder
                    </Button>
                  </div>
                  {userInfo.subscription?.is_active && userInfo.subscription?.platform === "manual" && (
                    <Button variant="destructive" onClick={() => handleAction("revoke")} disabled={actionLoading} className="w-full gap-1">
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />} Revogar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Tab 3: User Details ──

interface UserDetail {
  user_id: string; email: string; created_at: string;
  subscription: { tier: string; platform: string | null; is_active: boolean; expires_at: string | null } | null;
  stats: { expenses: number; incomes: number; cards: number; groups: number };
  recent_expenses: { description: string; amount: number; expense_date: string; category_name: string | null }[];
  recent_incomes: { description: string; amount: number; income_date: string; category_name: string | null }[];
}

function UsersTab() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<UserDetail | null>(null);

  const handleSearch = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setDetail(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${DASH_API}?email=${encodeURIComponent(email.trim())}`, { headers });
      const data = await res.json();
      if (!res.ok) toast({ title: "Erro", description: data.error, variant: "destructive" });
      else setDetail(data);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" /> Buscar Usuário</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="Email do usuário..." value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
            <Button onClick={handleSearch} disabled={loading} size="icon">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {detail && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-medium text-foreground">{detail.email}</p></div>
              <div><p className="text-xs text-muted-foreground">Cadastro</p><p className="text-sm text-foreground">{new Date(detail.created_at).toLocaleDateString("pt-BR")}</p></div>
              <div><p className="text-xs text-muted-foreground">Plano</p><TierBadge tier={detail.subscription?.tier} platform={detail.subscription?.platform} /></div>
              <div><p className="text-xs text-muted-foreground">Status</p><Badge variant={detail.subscription?.is_active ? "default" : "secondary"}>{detail.subscription?.is_active ? "Ativo" : "Inativo"}</Badge></div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Despesas", value: detail.stats.expenses, icon: "📊" },
                { label: "Receitas", value: detail.stats.incomes, icon: "💰" },
                { label: "Cartões", value: detail.stats.cards, icon: "💳" },
                { label: "Grupos", value: detail.stats.groups, icon: "👥" },
              ].map((s) => (
                <div key={s.label} className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-lg">{s.icon}</p>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Recent Transactions */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Últimas Despesas</p>
                {detail.recent_expenses.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma</p> : (
                  <div className="space-y-1">
                    {detail.recent_expenses.map((e, i) => (
                      <div key={i} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                        <span className="text-foreground truncate">{e.description}</span>
                        <span className="text-destructive font-medium whitespace-nowrap ml-2">-R$ {Number(e.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Últimas Receitas</p>
                {detail.recent_incomes.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma</p> : (
                  <div className="space-y-1">
                    {detail.recent_incomes.map((e, i) => (
                      <div key={i} className="flex justify-between text-sm py-1 border-b border-border last:border-0">
                        <span className="text-foreground truncate">{e.description}</span>
                        <span className="text-green-500 font-medium whitespace-nowrap ml-2">+R$ {Number(e.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Tab 4: Audit Logs ──

interface AuditLog {
  id: string; user_id: string; action: string; details: any; created_at: string; email?: string;
  ip_address?: string | null; user_agent?: string | null;
}

function AuditLogsTab({ logs, loading }: { logs: AuditLog[]; loading: boolean }) {
  const [filter, setFilter] = useState("");

  if (loading) return <LoadingSpinner />;

  const filtered = filter
    ? logs.filter((l) =>
        l.email?.toLowerCase().includes(filter.toLowerCase()) ||
        l.action.toLowerCase().includes(filter.toLowerCase())
      )
    : logs;

  return (
    <div className="space-y-4">
      <Input placeholder="Filtrar por email ou ação..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum log encontrado</p>
      ) : (
        <div className="rounded-md border overflow-auto max-h-[500px]">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Email</TableHead><TableHead>Ação</TableHead><TableHead>Detalhes</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs">{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-sm">{log.email || log.user_id.slice(0, 8)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{log.action}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{log.details ? JSON.stringify(log.details) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Shared ──

function LoadingSpinner() {
  return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
}

// ── Main Admin Page ──

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashFetched, setDashFetched] = useState(false);

  // Lazy load dashboard data when overview or audit tab is selected
  useEffect(() => {
    if ((activeTab === "overview" || activeTab === "audit") && !dashFetched) {
      setDashLoading(true);
      (async () => {
        try {
          const headers = await getAuthHeaders();
          const res = await fetch(DASH_API, { headers });
          if (res.ok) setDashData(await res.json());
        } catch {}
        setDashLoading(false);
        setDashFetched(true);
      })();
    }
  }, [activeTab, dashFetched]);

  if (authLoading) return null;
  if (!user || user.email !== ADMIN_EMAIL) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Painel Admin</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="overview" className="gap-1 text-xs sm:text-sm"><BarChart3 className="h-3.5 w-3.5 hidden sm:inline" /> Visão Geral</TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-1 text-xs sm:text-sm"><CreditCard className="h-3.5 w-3.5 hidden sm:inline" /> Assinaturas</TabsTrigger>
            <TabsTrigger value="users" className="gap-1 text-xs sm:text-sm"><Users className="h-3.5 w-3.5 hidden sm:inline" /> Usuários</TabsTrigger>
            <TabsTrigger value="audit" className="gap-1 text-xs sm:text-sm"><ClipboardList className="h-3.5 w-3.5 hidden sm:inline" /> Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab data={dashData} loading={dashLoading} />
          </TabsContent>
          <TabsContent value="subscriptions">
            <SubscriptionsTab />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="audit">
            <AuditLogsTab logs={dashData?.audit_logs || []} loading={dashLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
