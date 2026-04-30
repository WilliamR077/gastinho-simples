import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://gastinho-simples.lovable.app",
  "https://id-preview--a1f2a0b1-38be-4811-8b36-2e341ccca268.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
  "capacitor://localhost",
  "https://localhost",
]);

function pickOrigin(req) {
  const o = req.headers.get("origin");
  return o && ALLOWED_ORIGINS.has(o) ? o : "";
}

function buildCorsHeaders(req) {
  const origin = pickOrigin(req);
  const base =  {
  "Access-Control-Allow-Origin": "__ORIGIN__",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};
  base["Access-Control-Allow-Origin"] = origin;
  base["Vary"] = "Origin";
  return base;
}
// Back-compat default (no origin) for any legacy reference; real usage builds per-request.
const corsHeaders = { "Access-Control-Allow-Origin": "", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Vary": "Origin" };

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
  });
}

async function validateAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Não autorizado");

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await anonClient.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Token inválido");

  const callerId = data.claims.sub as string;

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: roleData, error: roleError } = await adminClient.rpc("has_role", {
    _user_id: callerId,
    _role: "admin",
  });
  if (roleError || roleData !== true) throw new Error("Acesso negado");

  return adminClient;
}

const PRICES = { premium: 14.9, no_ads: 3.9, premium_plus: 14.9 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(req) });
  }

  try {
    const adminClient = await validateAdmin(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── Action: list_emails ──
    if (action === "list_emails") {
      const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 10000 });
      const emails = (users || []).map((u) => u.email).filter(Boolean).sort();
      return jsonResponse({ emails });
    }

    // ── Action: list_users ──
    if (action === "list_users") {
      const [usersRes, subsRes] = await Promise.all([
        adminClient.auth.admin.listUsers({ perPage: 10000 }),
        adminClient.from("subscriptions").select("user_id, tier, is_active, platform").eq("is_active", true),
      ]);
      const allUsers = usersRes.data?.users || [];
      const subMap = new Map((subsRes.data || []).map((s) => [s.user_id, s]));

      const users = allUsers.map((u) => {
        const sub = subMap.get(u.id);
        return {
          id: u.id,
          email: u.email || "—",
          created_at: u.created_at,
          tier: sub?.tier || "free",
          platform: sub?.platform || null,
        };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return jsonResponse({ users });
    }

    // ── Action: delete_user ──
    if (action === "delete_user" && req.method === "POST") {
      const { user_id } = await req.json();
      if (!user_id) return jsonResponse({ error: "user_id é obrigatório" }, 400);

      // Delete user data first
      await Promise.all([
        adminClient.from("expenses").delete().eq("user_id", user_id),
        adminClient.from("incomes").delete().eq("user_id", user_id),
        adminClient.from("recurring_expenses").delete().eq("user_id", user_id),
        adminClient.from("recurring_incomes").delete().eq("user_id", user_id),
        adminClient.from("budget_goal_alerts").delete().eq("user_id", user_id),
        adminClient.from("budget_goals").delete().eq("user_id", user_id),
        adminClient.from("cards").delete().eq("user_id", user_id),
        adminClient.from("subscriptions").delete().eq("user_id", user_id),
        adminClient.from("user_categories").delete().eq("user_id", user_id),
        adminClient.from("user_income_categories").delete().eq("user_id", user_id),
        adminClient.from("user_fcm_tokens").delete().eq("user_id", user_id),
        adminClient.from("notification_settings").delete().eq("user_id", user_id),
        adminClient.from("shared_group_members").delete().eq("user_id", user_id),
        adminClient.from("credit_card_configs").delete().eq("user_id", user_id),
        adminClient.from("audit_log").delete().eq("user_id", user_id),
      ]);

      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return jsonResponse({ success: true, message: "Usuário excluído com sucesso" });
    }

    // User detail mode
    const email = url.searchParams.get("email");
    if (email) {
      const { data: { users } } = await adminClient.auth.admin.listUsers();
      const user = users?.find((u) => u.email === email);
      if (!user) return jsonResponse({ error: "Usuário não encontrado" }, 404);

      const [subRes, expRes, incRes, cardRes, groupRes, recentExpRes, recentIncRes] = await Promise.all([
        adminClient.from("subscriptions").select("*").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
        adminClient.from("expenses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        adminClient.from("incomes").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        adminClient.from("cards").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        adminClient.from("shared_group_members").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        adminClient.from("expenses").select("description, amount, expense_date, category_name").eq("user_id", user.id).order("expense_date", { ascending: false }).limit(5),
        adminClient.from("incomes").select("description, amount, income_date, category_name").eq("user_id", user.id).order("income_date", { ascending: false }).limit(5),
      ]);

      return jsonResponse({
        user_id: user.id,
        email: user.email,
        created_at: user.created_at,
        subscription: subRes.data || null,
        stats: {
          expenses: expRes.count || 0,
          incomes: incRes.count || 0,
          cards: cardRes.count || 0,
          groups: groupRes.count || 0,
        },
        recent_expenses: recentExpRes.data || [],
        recent_incomes: recentIncRes.data || [],
      });
    }

    // Dashboard overview mode
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

    const [
      usersRes,
      allSubsRes,
      totalExpRes,
      totalIncRes,
      totalGroupsRes,
      totalCardsRes,
      exp30dRes,
      inc30dRes,
      auditRes,
    ] = await Promise.all([
      adminClient.auth.admin.listUsers({ perPage: 10000 }),
      adminClient.from("subscriptions").select("*").eq("is_active", true),
      adminClient.from("expenses").select("id", { count: "exact", head: true }),
      adminClient.from("incomes").select("id", { count: "exact", head: true }),
      adminClient.from("shared_groups").select("id", { count: "exact", head: true }).eq("is_active", true),
      adminClient.from("cards").select("id", { count: "exact", head: true }),
      adminClient.from("expenses").select("id", { count: "exact", head: true }).gte("expense_date", thirtyDaysAgo),
      adminClient.from("incomes").select("id", { count: "exact", head: true }).gte("income_date", thirtyDaysAgo),
      adminClient.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100),
    ]);

    const allUsers = usersRes.data?.users || [];
    const allSubs = allSubsRes.data || [];
    const activePaid = allSubs.filter((s) => s.tier !== "free");

    // Revenue
    const revenue: Record<string, number> = {};
    let totalMrr = 0;
    for (const sub of activePaid) {
      const price = PRICES[sub.tier as keyof typeof PRICES] || 0;
      revenue[sub.tier] = (revenue[sub.tier] || 0) + price;
      totalMrr += price;
    }

    // Breakdown by tier+platform
    const breakdownMap = new Map<string, number>();
    for (const sub of allSubs) {
      const key = `${sub.tier}|${sub.platform || "unknown"}`;
      breakdownMap.set(key, (breakdownMap.get(key) || 0) + 1);
    }
    const subscription_breakdown = Array.from(breakdownMap.entries()).map(([key, count]) => {
      const [tier, platform] = key.split("|");
      return { tier, platform, count };
    });

    // New users
    const new_users_30d = allUsers.filter((u) => u.created_at >= thirtyDaysAgo).length;
    const new_users_7d = allUsers.filter((u) => u.created_at >= sevenDaysAgo).length;

    // Recent signups
    const recent_signups = allUsers
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20)
      .map((u) => ({ email: u.email || "—", created_at: u.created_at }));

    const userEmailMap = new Map(allUsers.map((u) => [u.id, u.email || "—"]));

    // Audit logs with email
    const audit_logs = (auditRes.data || []).map((log) => ({
      ...log,
      email: userEmailMap.get(log.user_id) || "desconhecido",
    }));

    return jsonResponse({
      overview: {
        total_users: allUsers.length,
        active_subscribers: activePaid.length,
        revenue_estimate: { ...revenue, total_mrr: totalMrr },
        new_users_30d,
        new_users_7d,
      },
      subscription_breakdown,
      recent_signups,
      activity_stats: {
        total_expenses: totalExpRes.count || 0,
        total_incomes: totalIncRes.count || 0,
        total_groups: totalGroupsRes.count || 0,
        total_cards: totalCardsRes.count || 0,
        expenses_30d: exp30dRes.count || 0,
        incomes_30d: inc30dRes.count || 0,
      },
      audit_logs,
    });
  } catch (err: unknown) {
    const message = (err as Error).message || "Erro interno";
    const status = message === "Acesso negado" ? 403 : message === "Não autorizado" ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
