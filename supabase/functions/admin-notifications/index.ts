import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
// shared mask helpers available if needed

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

async function validateAdmin(req: Request): Promise<{ adminClient: ReturnType<typeof createClient>; callerId: string; callerEmail: string }> {
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
  const callerEmail = (data.claims.email as string) || "";

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: roleData, error: roleError } = await adminClient.rpc("has_role", {
    _user_id: callerId,
    _role: "admin",
  });
  if (roleError || roleData !== true) throw new Error("Acesso negado");

  return { adminClient, callerId, callerEmail };
}

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && tokenExpiresAt > now + 300) {
    return cachedAccessToken;
  }

  const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountJson) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON não configurado");

  const sa = JSON.parse(serviceAccountJson);
  const privatePem = sa.private_key.replace(/\\n/g, '\n');
  const privateKey = await importPrivateKey(privatePem);

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: getNumericDate(0),
      exp: getNumericDate(3600),
    },
    privateKey
  );

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error("Falha ao obter access token do Firebase");
  cachedAccessToken = tokenData.access_token;
  tokenExpiresAt = now + (tokenData.expires_in || 3600);
  return cachedAccessToken as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { adminClient, callerEmail } = await validateAdmin(req);

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
          sent_by: callerEmail,
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
        sent_by: callerEmail,
      });

      return jsonResponse({
        success: true,
        message: `Notificação enviada para ${successCount} dispositivo(s)${failCount > 0 ? `, ${failCount} falha(s)` : ""}`,
        sent: successCount,
        failed: failCount,
      });
    }

    return jsonResponse({ error: "Método não suportado" }, 405);
  } catch (err: unknown) {
    const message = (err as Error).message || "Erro interno";
    const status = message === "Acesso negado" ? 403 : message === "Não autorizado" ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
