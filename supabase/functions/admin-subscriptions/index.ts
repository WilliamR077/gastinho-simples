import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildBucketKey, checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const ALLOWED_ORIGINS = new Set([
  "https://gastinho-simples.lovable.app",
  "https://id-preview--a1f2a0b1-38be-4811-8b36-2e341ccca268.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
  "capacitor://localhost",
  "https://localhost",
]);

function pickOrigin(req: Request): string {
  const o = req.headers.get("origin");
  return o && ALLOWED_ORIGINS.has(o) ? o : "";
}

function buildCorsHeaders(req: Request): Record<string,string> {
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

type Duration = "1m" | "3m" | "6m" | "1y" | "lifetime";

function calcExpiresAt(duration: Duration): string | null {
  if (duration === "lifetime") return null;
  const d = new Date();
  switch (duration) {
    case "1m": d.setMonth(d.getMonth() + 1); break;
    case "3m": d.setMonth(d.getMonth() + 3); break;
    case "6m": d.setMonth(d.getMonth() + 6); break;
    case "1y": d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString();
}

function effectiveStatus(sub: any): "active" | "expired" | "lifetime" | "revoked" {
  if (!sub) return "revoked";
  if (sub.tier === "free" || !sub.is_active) return "revoked";
  if (!sub.expires_at) return "lifetime";
  return new Date(sub.expires_at) > new Date() ? "active" : "expired";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(req) });
  }

  try {
    // Validate admin via JWT + has_role RPC
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub as string;

    // Service role client for admin operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData, error: roleError } = await adminClient.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });
    if (roleError || roleData !== true) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Rate limit (fail-open): 30 req/60s per admin user.
    const rlKey = await buildBucketKey({ functionName: "admin-subscriptions", userId: callerId });
    if (rlKey) {
      const rl = await checkRateLimit(rlKey, {
        functionName: "admin-subscriptions",
        maxRequests: 30,
        windowSeconds: 60,
        failOpen: true,
      });
      if (!rl.allowed) {
        console.warn(`[admin-subscriptions] rate-limited admin=${callerId} retry=${rl.retryAfterSeconds}s`);
        return rateLimitResponse(rl, buildCorsHeaders(req));
      }
    }

    if (req.method === "GET") {
      const url = new URL(req.url);
      const email = url.searchParams.get("email");
      const filter = url.searchParams.get("filter"); // active | expired | lifetime | all

      // List all subscribers (no email)
      if (!email) {
        const { data: allSubs } = await adminClient
          .from("subscriptions")
          .select("*")
          .neq("tier", "free");

        const { data: { users } } = await adminClient.auth.admin.listUsers();
        const userMap = new Map((users || []).map((u) => [u.id, u.email]));

        let subscribers = (allSubs || []).map((sub) => {
          const status = effectiveStatus(sub);
          return {
            email: userMap.get(sub.user_id) || "desconhecido",
            tier: sub.tier,
            platform: sub.platform,
            started_at: sub.started_at,
            expires_at: sub.expires_at,
            granted_by_email: sub.granted_by ? (userMap.get(sub.granted_by) || null) : null,
            granted_at: sub.platform === "manual" ? sub.started_at : null,
            status,
          };
        });

        if (filter && filter !== "all") {
          subscribers = subscribers.filter((s) => s.status === filter);
        }

        return new Response(JSON.stringify({ subscribers }),
          { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      // Find user by email
      const { data: { users } } = await adminClient.auth.admin.listUsers();
      const targetUser = users?.find((u) => u.email === email);

      if (!targetUser) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
          status: 404,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Get subscription
      const { data: sub } = await adminClient
        .from("subscriptions")
        .select("*")
        .eq("user_id", targetUser.id)
        .eq("is_active", true)
        .maybeSingle();

      const granted_by_email = sub?.granted_by
        ? (users?.find((u) => u.id === sub.granted_by)?.email || null)
        : null;

      return new Response(
        JSON.stringify({
          user_id: targetUser.id,
          email: targetUser.email,
          subscription: sub
            ? {
                ...sub,
                granted_by_email,
                granted_at: sub.platform === "manual" ? sub.started_at : null,
                status: effectiveStatus(sub),
              }
            : null,
        }),
        { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { email, tier, duration } = body as {
        email?: string; tier?: string; duration?: Duration;
      };

      if (!email || !tier || !["premium", "no_ads"].includes(tier)) {
        return new Response(
          JSON.stringify({ error: "Email e tier (premium/no_ads) são obrigatórios" }),
          { status: 400, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const validDurations: Duration[] = ["1m", "3m", "6m", "1y", "lifetime"];
      const dur: Duration = (duration && validDurations.includes(duration)) ? duration : "lifetime";

      const { data: { users } } = await adminClient.auth.admin.listUsers();
      const targetUser = users?.find((u) => u.email === email);
      if (!targetUser) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
          status: 404,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Check existing subscription — block if Google Play active
      const { data: existing } = await adminClient
        .from("subscriptions")
        .select("id, platform, expires_at, tier, purchase_token")
        .eq("user_id", targetUser.id)
        .maybeSingle();

      if (existing && existing.purchase_token && existing.platform && existing.platform !== "manual") {
        const stillValid = !existing.expires_at || new Date(existing.expires_at) > new Date();
        if (stillValid && existing.tier !== "free") {
          const platformLabel = existing.platform === "android" || existing.platform === "google_play"
            ? "Google Play"
            : existing.platform === "ios" ? "App Store" : existing.platform;
          return new Response(
            JSON.stringify({
              error: `Usuário tem assinatura ativa via ${platformLabel}. Aguarde expiração ou peça para o usuário cancelar antes de conceder manualmente.`,
            }),
            { status: 409, headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
          );
        }
      }

      const expires_at = calcExpiresAt(dur);
      const nowIso = new Date().toISOString();

      if (existing) {
        const { error } = await adminClient
          .from("subscriptions")
          .update({
            tier,
            is_active: true,
            platform: "manual",
            purchase_token: null,
            product_id: null,
            expires_at,
            started_at: nowIso,
            granted_by: callerId || null,
            updated_at: nowIso,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await adminClient.from("subscriptions").insert({
          user_id: targetUser.id,
          tier,
          is_active: true,
          platform: "manual",
          started_at: nowIso,
          expires_at,
          granted_by: callerId || null,
        });
        if (error) throw error;
      }

      const durLabel = dur === "lifetime" ? "vitalício"
        : dur === "1m" ? "1 mês"
        : dur === "3m" ? "3 meses"
        : dur === "6m" ? "6 meses"
        : "1 ano";

      return new Response(
        JSON.stringify({
          success: true,
          message: `Plano ${tier} (${durLabel}) concedido para ${email}`,
          expires_at,
        }),
        { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if (req.method === "DELETE") {
      const { email } = await req.json();
      if (!email) {
        return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
          status: 400,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const { data: { users } } = await adminClient.auth.admin.listUsers();
      const targetUser = users?.find((u) => u.email === email);
      if (!targetUser) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
          status: 404,
          headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Reset subscription to free
      const { error } = await adminClient
        .from("subscriptions")
        .update({
          tier: "free",
          is_active: true,
          purchase_token: null,
          product_id: null,
          expires_at: null,
          platform: "manual",
          granted_by: callerId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", targetUser.id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: `Acesso revogado para ${email} (resetado para gratuito)` }),
        { headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-subscriptions error:", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...buildCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
