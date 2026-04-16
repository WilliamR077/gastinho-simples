import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Search, UserCheck, UserX, Loader2, Users, TrendingUp, DollarSign,
  UserPlus, Activity, CreditCard, BarChart3, ClipboardList, ArrowLeft, Bell,
  Trash2, Eye, Send, Filter, ArrowUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ADMIN_EMAIL = "gastinhosimples@gmail.com";
const SUBS_API = `https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/admin-subscriptions`;
const DASH_API = `https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/admin-dashboard`;
const NOTIF_API = `https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/admin-notifications`;
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
    <div className="flex items-center gap-2 flex-wrap">
      <Badge className="bg-primary text-primary-foreground">{label}</Badge>
      {platform === "manual" && <Badge variant="outline">Manual</Badge>}
      {platform === "google_play" && <Badge variant="outline">Google Play</Badge>}
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Ativo", className: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30" },
    lifetime: { label: "Vitalício", className: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30" },
    expired: { label: "Expirado", className: "bg-muted text-muted-foreground border-border" },
    revoked: { label: "Revogado", className: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  const m = map[status] || map.revoked;
  return <Badge variant="outline" className={m.className}>{m.label}</Badge>;
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

function LoadingSpinner() {
  return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
}

// ── Email Autocomplete Input ──

function EmailAutocomplete({ value, onChange, onSearch, allEmails, placeholder, loading }: {
  value: string; onChange: (v: string) => void; onSearch: (email?: string) => void;
  allEmails: string[]; placeholder?: string; loading?: boolean;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value.trim().length >= 2
    ? allEmails.filter((e) => e.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative flex gap-2 flex-1" ref={ref}>
      <div className="relative flex-1">
        <Input
          placeholder={placeholder || "Email do usuário..."}
          value={value}
          onChange={(e) => { onChange(e.target.value); setShowSuggestions(true); }}
          onKeyDown={(e) => { if (e.key === "Enter") { setShowSuggestions(false); onSearch(); } }}
          onFocus={() => setShowSuggestions(true)}
        />
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {filtered.map((email) => (
              <button
                key={email}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted text-foreground truncate"
                onClick={() => { onChange(email); setShowSuggestions(false); onSearch(email); }}
              >
                {email}
              </button>
            ))}
          </div>
        )}
      </div>
      <Button onClick={() => { setShowSuggestions(false); onSearch(); }} disabled={loading} size="icon">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
      </Button>
    </div>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users} title="Total de Usuários" value={overview.total_users} subtitle={`+${overview.new_users_7d} esta semana`} color="text-blue-500" />
        <KpiCard icon={TrendingUp} title="Assinantes Ativos" value={overview.active_subscribers} color="text-green-500" />
        <KpiCard icon={DollarSign} title="MRR Estimado" value={`R$ ${overview.revenue_estimate.total_mrr.toFixed(2)}`} color="text-yellow-500" />
        <KpiCard icon={UserPlus} title="Novos (30 dias)" value={overview.new_users_30d} color="text-purple-500" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
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

// ── Tab 2: Users (unified with subscriptions) ──

interface UserListItem {
  id: string; email: string; created_at: string; tier: string; platform: string | null;
}

interface UserDetail {
  user_id: string; email: string; created_at: string;
  subscription: {
    tier: string; platform: string | null; is_active: boolean; expires_at: string | null;
    granted_by_email?: string | null; granted_at?: string | null; status?: string;
    started_at?: string;
  } | null;
  stats: { expenses: number; incomes: number; cards: number; groups: number };
  recent_expenses: { description: string; amount: number; expense_date: string; category_name: string | null }[];
  recent_incomes: { description: string; amount: number; income_date: string; category_name: string | null }[];
}

type SortOption = "newest" | "oldest" | "az" | "za";
type TierFilter = "all" | "premium" | "no_ads" | "free";

function UsersTab({ allEmails, onSubscriptionChange }: {
  allEmails: string[];
  onSubscriptionChange: () => void;
}) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState("premium");
  const [selectedDuration, setSelectedDuration] = useState<"1m" | "3m" | "6m" | "1y" | "lifetime">("lifetime");
  const [actionLoading, setActionLoading] = useState(false);
  const [showSubForm, setShowSubForm] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${DASH_API}?action=list_users`, { headers });
        const data = await res.json();
        if (res.ok) setUsers(data.users || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  // Filter + sort
  const processed = (() => {
    let result = [...users];
    if (filter) result = result.filter((u) => u.email.toLowerCase().includes(filter.toLowerCase()));
    if (tierFilter !== "all") {
      result = result.filter((u) => {
        const t = u.tier || "free";
        if (tierFilter === "free") return t === "free";
        if (tierFilter === "premium") return t === "premium" || t === "premium_plus";
        if (tierFilter === "no_ads") return t === "no_ads";
        return true;
      });
    }
    switch (sortBy) {
      case "newest": result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case "oldest": result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case "az": result.sort((a, b) => a.email.localeCompare(b.email)); break;
      case "za": result.sort((a, b) => b.email.localeCompare(a.email)); break;
    }
    return result;
  })();

  const paged = processed.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(processed.length / PAGE_SIZE);

  const handleViewDetail = async (user: UserListItem) => {
    setSelectedUser(user);
    setModalOpen(true);
    setDetailLoading(true);
    setDetail(null);
    setShowSubForm(false);
    try {
      const headers = await getAuthHeaders();
      // Fetch dashboard detail + subscription detail (with manual fields) in parallel
      const [resDash, resSub] = await Promise.all([
        fetch(`${DASH_API}?email=${encodeURIComponent(user.email)}`, { headers }),
        fetch(`${SUBS_API}?email=${encodeURIComponent(user.email)}`, { headers }),
      ]);
      const dataDash = await resDash.json();
      const dataSub = resSub.ok ? await resSub.json() : null;
      if (resDash.ok) {
        // Merge: prefer subs API for subscription details (has granted_by_email, status, etc.)
        const merged: UserDetail = {
          ...dataDash,
          subscription: dataSub?.subscription
            ? {
                tier: dataSub.subscription.tier,
                platform: dataSub.subscription.platform,
                is_active: dataSub.subscription.is_active,
                expires_at: dataSub.subscription.expires_at,
                granted_by_email: dataSub.subscription.granted_by_email,
                granted_at: dataSub.subscription.granted_at,
                status: dataSub.subscription.status,
                started_at: dataSub.subscription.started_at,
              }
            : dataDash.subscription,
        };
        setDetail(merged);
      } else {
        toast({ title: "Erro", description: dataDash.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setDeleteLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${DASH_API}?action=delete_user`, {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id: selectedUser.id }),
      });
      const data = await res.json();
      if (!res.ok) toast({ title: "Erro", description: data.error, variant: "destructive" });
      else {
        toast({ title: "Sucesso! ✅", description: data.message });
        setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
        setModalOpen(false);
        setSelectedUser(null);
        setDetail(null);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSubAction = async (action: "grant" | "revoke") => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(SUBS_API, {
        method: action === "grant" ? "POST" : "DELETE",
        headers,
        body: JSON.stringify(
          action === "grant"
            ? { email: selectedUser.email, tier: selectedTier, duration: selectedDuration }
            : { email: selectedUser.email }
        ),
      });
      const data = await res.json();
      if (!res.ok) toast({ title: "Erro", description: data.error, variant: "destructive" });
      else {
        toast({ title: "Sucesso! ✅", description: data.message });
        // Update user in list
        const newTier = action === "grant" ? selectedTier : "free";
        setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, tier: newTier, platform: "manual" } : u));
        // Refresh detail
        handleViewDetail(selectedUser);
        onSubscriptionChange();
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-3">
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <Input
            placeholder="Filtrar por email..."
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(0); }}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v as TierFilter); setPage(0); }}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os planos</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="no_ads">Sem Anúncios</SelectItem>
              <SelectItem value="free">Gratuito</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v as SortOption); setPage(0); }}>
            <SelectTrigger className="w-[150px]">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigos</SelectItem>
              <SelectItem value="az">A → Z</SelectItem>
              <SelectItem value="za">Z → A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">{processed.length} usuário(s) encontrado(s)</p>

      {/* User list - full height */}
      <div className="space-y-1 min-h-[calc(100vh-18rem)] overflow-y-auto">
        {paged.map((u) => (
          <div
            key={u.id}
            className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => handleViewDetail(u)}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{u.email}</p>
              <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
            <TierBadge tier={u.tier} platform={u.platform} />
          </div>
        ))}
        {paged.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário encontrado</p>}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
          <span className="text-xs text-muted-foreground">{page + 1} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Próximo</Button>
        </div>
      )}

      {/* User Detail Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4" /> Detalhes do Usuário
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? <LoadingSpinner /> : detail ? (
            <div className="space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-medium text-foreground truncate">{detail.email}</p></div>
                <div><p className="text-xs text-muted-foreground">Cadastro</p><p className="text-sm text-foreground">{new Date(detail.created_at).toLocaleDateString("pt-BR")}</p></div>
                <div><p className="text-xs text-muted-foreground">Plano</p><TierBadge tier={detail.subscription?.tier} platform={detail.subscription?.platform} /></div>
                <div><p className="text-xs text-muted-foreground">Status efetivo</p><StatusBadge status={detail.subscription?.status} /></div>
              </div>

              {/* Subscription extra info (only for paid plans) */}
              {detail.subscription && detail.subscription.tier !== "free" && (
                <div className="grid grid-cols-2 gap-3 bg-muted/30 rounded-lg p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Expira em</p>
                    <p className="text-sm text-foreground">
                      {detail.subscription.expires_at
                        ? new Date(detail.subscription.expires_at).toLocaleDateString("pt-BR")
                        : "—  (vitalício)"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Origem</p>
                    <p className="text-sm text-foreground capitalize">
                      {detail.subscription.platform === "manual" ? "Manual"
                        : detail.subscription.platform === "google_play" ? "Google Play"
                        : (detail.subscription.platform || "—")}
                    </p>
                  </div>
                  {detail.subscription.platform === "manual" && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Concedido por</p>
                        <p className="text-sm text-foreground truncate">{detail.subscription.granted_by_email || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Concedido em</p>
                        <p className="text-sm text-foreground">
                          {detail.subscription.granted_at
                            ? new Date(detail.subscription.granted_at).toLocaleDateString("pt-BR")
                            : "—"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Despesas", value: detail.stats.expenses, icon: "📊" },
                  { label: "Receitas", value: detail.stats.incomes, icon: "💰" },
                  { label: "Cartões", value: detail.stats.cards, icon: "💳" },
                  { label: "Grupos", value: detail.stats.groups, icon: "👥" },
                ].map((s) => (
                  <div key={s.label} className="bg-muted/50 rounded-lg p-2 text-center">
                    <p className="text-sm">{s.icon}</p>
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Recent transactions */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-foreground mb-1">Últimas Despesas</p>
                  {detail.recent_expenses.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma</p> : (
                    <div className="space-y-0.5">
                      {detail.recent_expenses.slice(0, 3).map((e, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                          <span className="text-foreground truncate">{e.description}</span>
                          <span className="text-destructive font-medium whitespace-nowrap ml-1">-R$ {Number(e.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground mb-1">Últimas Receitas</p>
                  {detail.recent_incomes.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma</p> : (
                    <div className="space-y-0.5">
                      {detail.recent_incomes.slice(0, 3).map((e, i) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-border last:border-0">
                          <span className="text-foreground truncate">{e.description}</span>
                          <span className="text-green-500 font-medium whitespace-nowrap ml-1">+R$ {Number(e.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Subscription management inline */}
              <div className="border-t border-border pt-3 space-y-3">
                {!showSubForm ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowSubForm(true)}>
                      <CreditCard className="h-3.5 w-3.5" /> Gerenciar Assinatura
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="gap-1">
                          <Trash2 className="h-3.5 w-3.5" /> Excluir Conta
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Todos os dados de <strong>{selectedUser?.email}</strong> serão permanentemente excluídos. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteUser} disabled={deleteLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : (
                  <div className="space-y-3 bg-muted/30 rounded-lg p-3">
                    <p className="text-xs font-medium text-foreground">Conceder acesso manual</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground">Plano</label>
                        <Select value={selectedTier} onValueChange={setSelectedTier}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="premium">Premium ⭐</SelectItem>
                            <SelectItem value="no_ads">Sem Anúncios</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-muted-foreground">Duração</label>
                        <Select value={selectedDuration} onValueChange={(v) => setSelectedDuration(v as any)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1m">1 mês</SelectItem>
                            <SelectItem value="3m">3 meses</SelectItem>
                            <SelectItem value="6m">6 meses</SelectItem>
                            <SelectItem value="1y">1 ano</SelectItem>
                            <SelectItem value="lifetime">Vitalício</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleSubAction("grant")}
                      disabled={actionLoading}
                      size="sm"
                      className="w-full gap-1"
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                      Conceder
                    </Button>

                    <p className="text-[11px] text-muted-foreground leading-snug">
                      ℹ️ Concessão manual é perdida se o usuário assinar via Google Play depois.
                      Oriente o usuário a não assinar enquanto tiver acesso manual.
                    </p>

                    {/* Botão de revogar manual explícito (só aparece se já tem plano manual ativo) */}
                    {detail.subscription?.platform === "manual" && detail.subscription.tier !== "free" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="w-full gap-1">
                            <UserX className="h-4 w-4" /> Revogar acesso manual
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revogar acesso manual?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O plano de <strong>{selectedUser?.email}</strong> voltará para <strong>Gratuito</strong> imediatamente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleSubAction("revoke")}
                              disabled={actionLoading}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revogar"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => setShowSubForm(false)}>Fechar</Button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Tab 3: Audit Logs ──

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
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filtered.map((log) => (
            <div key={log.id} className="p-3 rounded-lg border border-border space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground truncate">{log.email || log.user_id.slice(0, 8)}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{log.action}</Badge>
                {log.details && <span className="text-xs text-muted-foreground truncate">{JSON.stringify(log.details)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab 4: Notifications ──

interface NotificationLog {
  id: string; title: string; body: string; target_type: string; target_email: string | null;
  sent_at: string; status: string; recipients_count: number; sent_by: string | null;
}

function NotificationsTab({ allEmails }: { allEmails: string[] }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState("broadcast");
  const [targetEmail, setTargetEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [searchLog, setSearchLog] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [logPage, setLogPage] = useState(1);
  const LOGS_PER_PAGE = 15;

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (searchLog) {
        const q = searchLog.toLowerCase();
        if (!log.title.toLowerCase().includes(q) && !log.body.toLowerCase().includes(q) && !(log.target_email || "").toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== "all" && log.status !== statusFilter) return false;
      if (typeFilter !== "all" && log.target_type !== typeFilter) return false;
      return true;
    });
  }, [logs, searchLog, statusFilter, typeFilter]);
  useEffect(() => { setLogPage(1); }, [searchLog, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE));
  const paginatedLogs = filteredLogs.slice((logPage - 1) * LOGS_PER_PAGE, logPage * LOGS_PER_PAGE);

  const fetchLogs = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(NOTIF_API, { headers });
      const data = await res.json();
      if (res.ok) setLogs(data.notifications || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Erro", description: "Título e corpo são obrigatórios", variant: "destructive" });
      return;
    }
    if (targetType === "user" && !targetEmail.trim()) {
      toast({ title: "Erro", description: "Email do destinatário é obrigatório", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(NOTIF_API, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          target_type: targetType,
          target_email: targetType === "user" ? targetEmail.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) toast({ title: "Erro", description: data.error, variant: "destructive" });
      else {
        toast({ title: "Sucesso! ✅", description: data.message });
        setTitle("");
        setBody("");
        setTargetEmail("");
        fetchLogs();
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> Enviar Notificação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Título da notificação" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Corpo da notificação..." value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <p className="text-xs text-muted-foreground">Destinatário</p>
              <Select value={targetType} onValueChange={setTargetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="broadcast">Todos os usuários</SelectItem>
                  <SelectItem value="user">Usuário específico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {targetType === "user" && (
              <div className="flex-1">
                <EmailAutocomplete
                  value={targetEmail}
                  onChange={setTargetEmail}
                  onSearch={() => {}}
                  allEmails={allEmails}
                  placeholder="Email do destinatário..."
                />
              </div>
            )}
          </div>
          <Button onClick={handleSend} disabled={sending} className="w-full gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar Notificação
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Histórico de Notificações</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Buscar por título, corpo ou email..." value={searchLog} onChange={(e) => setSearchLog(e.target.value)} className="flex-1" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="sent">Enviado</SelectItem>
                <SelectItem value="partial">Parcial</SelectItem>
                <SelectItem value="no_tokens">Sem tokens</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="broadcast">Broadcast</SelectItem>
                <SelectItem value="user">Usuário específico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filteredLogs.length > 0 && (
            <p className="text-xs text-muted-foreground">{filteredLogs.length} registro(s) encontrado(s)</p>
          )}
          {loading ? <LoadingSpinner /> : filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{logs.length === 0 ? "Nenhuma notificação enviada" : "Nenhum resultado para os filtros aplicados"}</p>
          ) : (
            <>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {paginatedLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-lg border border-border space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{log.title}</p>
                      <Badge variant={log.status === "sent" ? "default" : log.status === "partial" ? "secondary" : "destructive"} className="text-xs">
                        {log.status === "sent" ? "Enviado" : log.status === "partial" ? "Parcial" : log.status === "no_tokens" ? "Sem tokens" : "Falhou"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{log.body}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{new Date(log.sent_at).toLocaleString("pt-BR")}</span>
                      <span>{log.target_type === "broadcast" ? "📢 Todos" : `👤 ${log.target_email}`}</span>
                      <span>{log.recipients_count} destinatário(s)</span>
                    </div>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <Button variant="outline" size="sm" disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)}>
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">Página {logPage} de {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={logPage >= totalPages} onClick={() => setLogPage(p => p + 1)}>
                    Próxima
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Admin Page ──

export default function Admin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashFetched, setDashFetched] = useState(false);
  const [allEmails, setAllEmails] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${DASH_API}?action=list_emails`, { headers });
        const data = await res.json();
        if (res.ok) setAllEmails(data.emails || []);
      } catch {}
    })();
  }, []);

  const refreshDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(DASH_API, { headers });
      if (res.ok) setDashData(await res.json());
    } catch {}
    setDashLoading(false);
    setDashFetched(true);
  }, []);

  useEffect(() => {
    if ((activeTab === "overview" || activeTab === "audit") && !dashFetched) {
      refreshDashboard();
    }
  }, [activeTab, dashFetched, refreshDashboard]);

  const handleSubscriptionChange = () => {
    setDashFetched(false);
  };

  if (authLoading) return null;
  if (!user || user.email !== ADMIN_EMAIL) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Shield className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Painel Admin</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="overview" className="gap-1 text-xs sm:text-sm"><BarChart3 className="h-3.5 w-3.5 hidden sm:inline" /> Visão Geral</TabsTrigger>
            <TabsTrigger value="users" className="gap-1 text-xs sm:text-sm"><Users className="h-3.5 w-3.5 hidden sm:inline" /> Usuários</TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1 text-xs sm:text-sm"><Bell className="h-3.5 w-3.5 hidden sm:inline" /> Notificações</TabsTrigger>
            <TabsTrigger value="audit" className="gap-1 text-xs sm:text-sm"><ClipboardList className="h-3.5 w-3.5 hidden sm:inline" /> Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab data={dashData} loading={dashLoading} />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab allEmails={allEmails} onSubscriptionChange={handleSubscriptionChange} />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsTab allEmails={allEmails} />
          </TabsContent>
          <TabsContent value="audit">
            <AuditLogsTab logs={dashData?.audit_logs || []} loading={dashLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
