import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "gastinhosimples@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  if (error || !data?.claims) throw new Error("Token inválido");
  if (data.claims.email !== ADMIN_EMAIL) throw new Error("Acesso negado");

  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

const PRICES = { premium: 14.9, no_ads: 3.9, premium_plus: 14.9 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = await validateAdmin(req);
    const url = new URL(req.url);

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

    // Top users by expense count (from subscriptions user_ids mapped)
    // We need to get expense counts per user - use a simple approach
    const { data: topExpenses } = await adminClient.rpc("", {}).catch(() => ({ data: null }));
    // Since we can't run arbitrary SQL, get top users from expense table grouped manually
    // We'll skip top_users for now and use a simpler approach
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
  } catch (err) {
    const status = err.message === "Acesso negado" ? 403 : err.message === "Não autorizado" ? 401 : 500;
    return jsonResponse({ error: err.message }, status);
  }
});
