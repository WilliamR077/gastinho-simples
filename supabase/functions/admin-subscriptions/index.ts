import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "gastinhosimples@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate admin via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerEmail = claimsData.claims.email;
    if (callerEmail !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for admin operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (req.method === "GET") {
      const url = new URL(req.url);
      const email = url.searchParams.get("email");

      // If no email, return all active subscribers
      if (!email) {
        const { data: activeSubs } = await adminClient
          .from("subscriptions")
          .select("*")
          .eq("is_active", true)
          .neq("tier", "free");

        const { data: { users } } = await adminClient.auth.admin.listUsers();
        const userMap = new Map((users || []).map((u) => [u.id, u.email]));

        const subscribers = (activeSubs || []).map((sub) => ({
          email: userMap.get(sub.user_id) || "desconhecido",
          tier: sub.tier,
          platform: sub.platform,
          started_at: sub.started_at,
          expires_at: sub.expires_at,
        }));

        return new Response(JSON.stringify({ subscribers }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find user by email
      const { data: { users } } = await adminClient.auth.admin.listUsers();
      const targetUser = users?.find((u) => u.email === email);

      if (!targetUser) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get subscription
      const { data: sub } = await adminClient
        .from("subscriptions")
        .select("*")
        .eq("user_id", targetUser.id)
        .eq("is_active", true)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          user_id: targetUser.id,
          email: targetUser.email,
          subscription: sub || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const { email, tier } = await req.json();
      if (!email || !tier || !["premium", "no_ads"].includes(tier)) {
        return new Response(
          JSON.stringify({ error: "Email e tier (premium/no_ads) são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: { users } } = await adminClient.auth.admin.listUsers();
      const targetUser = users?.find((u) => u.email === email);
      if (!targetUser) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upsert subscription - first check if exists
      const { data: existing } = await adminClient
        .from("subscriptions")
        .select("id")
        .eq("user_id", targetUser.id)
        .maybeSingle();

      if (existing) {
        const { error } = await adminClient
          .from("subscriptions")
          .update({
            tier,
            is_active: true,
            platform: "manual",
            expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await adminClient.from("subscriptions").insert({
          user_id: targetUser.id,
          tier,
          is_active: true,
          platform: "manual",
          started_at: new Date().toISOString(),
          expires_at: null,
        });
        if (error) throw error;
      }

      return new Response(
        JSON.stringify({ success: true, message: `Plano ${tier} concedido para ${email}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "DELETE") {
      const { email } = await req.json();
      if (!email) {
        return new Response(JSON.stringify({ error: "Email é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: { users } } = await adminClient.auth.admin.listUsers();
      const targetUser = users?.find((u) => u.email === email);
      if (!targetUser) {
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Reset subscription to free for ANY platform (not just manual)
      const { error } = await adminClient
        .from("subscriptions")
        .update({
          tier: "free",
          is_active: true,
          purchase_token: null,
          product_id: null,
          expires_at: null,
          platform: "manual",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", targetUser.id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: `Plano revogado para ${email} (resetado para gratuito)` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Admin subscriptions error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
