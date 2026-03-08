import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "gastinhosimples@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

async function getAccessToken(): Promise<string> {
  const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountJson) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON não configurado");
  
  const sa = JSON.parse(serviceAccountJson);
  
  // Create JWT for Google OAuth2
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  
  const signInput = `${header}.${claimSet}`;
  
  // Import private key
  const pemContent = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signInput)
  );
  
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
  const jwt = `${signInput}.${sig}`;
  
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Falha ao obter access token do Firebase");
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = await validateAdmin(req);

    // GET: list notification logs
    if (req.method === "GET") {
      const { data, error } = await adminClient
        .from("admin_notifications_log")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return jsonResponse({ notifications: data || [] });
    }

    // POST: send notification
    if (req.method === "POST") {
      const { title, body, target_type, target_email } = await req.json();
      if (!title || !body) return jsonResponse({ error: "Título e corpo são obrigatórios" }, 400);

      let tokens: string[] = [];

      if (target_type === "user" && target_email) {
        // Find user by email, get their FCM tokens
        const { data: { users } } = await adminClient.auth.admin.listUsers();
        const targetUser = users?.find((u) => u.email === target_email);
        if (!targetUser) return jsonResponse({ error: "Usuário não encontrado" }, 404);

        const { data: fcmData } = await adminClient
          .from("user_fcm_tokens")
          .select("fcm_token")
          .eq("user_id", targetUser.id);
        tokens = (fcmData || []).map((t) => t.fcm_token);
      } else {
        // Broadcast: get all FCM tokens
        const { data: fcmData } = await adminClient
          .from("user_fcm_tokens")
          .select("fcm_token");
        tokens = (fcmData || []).map((t) => t.fcm_token);
      }

      if (tokens.length === 0) {
        // Log anyway
        await adminClient.from("admin_notifications_log").insert({
          title, body,
          target_type: target_type || "broadcast",
          target_email: target_email || null,
          status: "no_tokens",
          recipients_count: 0,
          sent_by: ADMIN_EMAIL,
        });
        return jsonResponse({ success: true, message: "Nenhum token FCM encontrado", sent: 0 });
      }

      // Get Firebase access token
      const accessToken = await getAccessToken();
      const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
      const sa = JSON.parse(serviceAccountJson!);
      const projectId = sa.project_id;

      let successCount = 0;
      let failCount = 0;

      // Send to each token
      for (const token of tokens) {
        try {
          const res = await fetch(
            `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: {
                  token,
                  notification: { title, body },
                  data: { type: "admin_notification" },
                },
              }),
            }
          );
          if (res.ok) successCount++;
          else failCount++;
        } catch {
          failCount++;
        }
      }

      // Log
      await adminClient.from("admin_notifications_log").insert({
        title, body,
        target_type: target_type || "broadcast",
        target_email: target_email || null,
        status: failCount === 0 ? "sent" : successCount > 0 ? "partial" : "failed",
        recipients_count: successCount,
        sent_by: ADMIN_EMAIL,
      });

      return jsonResponse({
        success: true,
        message: `Notificação enviada para ${successCount} dispositivo(s)${failCount > 0 ? `, ${failCount} falha(s)` : ""}`,
        sent: successCount,
        failed: failCount,
      });
    }

    return jsonResponse({ error: "Método não suportado" }, 405);
  } catch (err) {
    const status = err.message === "Acesso negado" ? 403 : err.message === "Não autorizado" ? 401 : 500;
    return jsonResponse({ error: err.message }, status);
  }
});
