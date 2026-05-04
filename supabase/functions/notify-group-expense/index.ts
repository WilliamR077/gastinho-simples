import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildBucketKey, checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// CORS allowlist (Phase 1 hardening)
const ALLOWED_ORIGINS = new Set<string>([
  "https://gastinho-simples.lovable.app",
  "https://id-preview--a1f2a0b1-38be-4811-8b36-2e341ccca268.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
  "capacitor://localhost",
  "https://localhost",
]);

function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

interface ServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
}

interface NotifyGroupExpensePayload {
  group_id: string;
  description: string;
  amount: number;
  category_name?: string;
  group_name: string;
}

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && tokenExpiresAt > now + 300) return cachedAccessToken;
  if (!FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON missing");

  const serviceAccount: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
  const private_key_pem = serviceAccount.private_key.replace(/\\n/g, "\n");
  const private_key = await importPrivateKey(private_key_pem);

  const jwt = await create(
    { alg: "RS256", typ: "JWT" },
    {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: getNumericDate(0),
      exp: getNumericDate(60 * 60),
    },
    private_key
  );

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    console.error("❌ OAuth2 token exchange failed");
    throw new Error("OAuth2 failure");
  }

  const tokenData = await tokenResponse.json();
  cachedAccessToken = tokenData.access_token;
  tokenExpiresAt = now + tokenData.expires_in;
  return cachedAccessToken as string;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const jsonResp = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // 1) Require Supabase Auth JWT (verify_jwt=true also enforces this at the edge)
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return jsonResp(401, { success: false, error: "Missing bearer token" });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResp(401, { success: false, error: "Invalid token" });
    }
    const callerId = userData.user.id;
    const callerEmail = userData.user.email ?? "Alguém";

    // 2) Parse payload — never trust user_id from body.
    const payload: NotifyGroupExpensePayload = await req.json();
    const { group_id, description, amount, category_name, group_name } = payload;

    if (!group_id || typeof group_id !== "string") {
      return jsonResp(400, { success: false, error: "group_id required" });
    }

    // 3) Use service role client for elevated reads, but enforce ownership in code.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 4) Verify caller is a member of this group.
    const { data: callerMembership, error: memErr } = await admin
      .from("shared_group_members")
      .select("user_id")
      .eq("group_id", group_id)
      .eq("user_id", callerId)
      .maybeSingle();

    if (memErr) {
      console.error("❌ membership lookup failed");
      return jsonResp(500, { success: false, error: "Membership check failed" });
    }
    if (!callerMembership) {
      return jsonResp(403, { success: false, error: "Not a member of this group" });
    }

    // 5) Fetch other members.
    const { data: members, error: membersError } = await admin
      .from("shared_group_members")
      .select("user_id")
      .eq("group_id", group_id)
      .neq("user_id", callerId);

    if (membersError) {
      console.error("❌ members lookup failed");
      throw new Error("Members lookup failed");
    }

    if (!members || members.length === 0) {
      return jsonResp(200, { success: true, sent: 0, message: "No other members" });
    }

    const memberUserIds = members.map((m) => m.user_id);

    const { data: tokens, error: tokensError } = await admin
      .from("user_fcm_tokens")
      .select("fcm_token, user_id")
      .in("user_id", memberUserIds);

    if (tokensError) {
      console.error("❌ tokens lookup failed");
      throw new Error("Tokens lookup failed");
    }

    if (!tokens || tokens.length === 0) {
      return jsonResp(200, { success: true, sent: 0, message: "No tokens" });
    }

    const formattedAmount = `R$${Number(amount).toFixed(2).replace(".", ",")}`;
    const categoryText = category_name ? ` (${category_name})` : "";
    const title = group_name;
    const body = `${callerEmail} adicionou ${formattedAmount}${categoryText}`;

    const accessToken = await getAccessToken();
    const serviceAccount: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON!);
    const FCM_ENDPOINT = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    const results = await Promise.allSettled(
      tokens.map(async ({ fcm_token }) => {
        const response = await fetch(FCM_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token: fcm_token,
              notification: { title, body },
              data: { type: "group_expense", group_id },
              android: {
                priority: "high",
                notification: { sound: "default", channelId: "default" },
              },
            },
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          console.error(`❌ FCM Error token •••${fcm_token.slice(-8)}`);
          const errorCode = result?.error?.status || result?.error?.code;
          const errorMessage = result?.error?.message || "";
          const isInvalidToken =
            errorCode === "INVALID_ARGUMENT" ||
            errorCode === "NOT_FOUND" ||
            errorMessage.includes("not a valid FCM registration token") ||
            errorMessage.includes("Requested entity was not found");

          if (isInvalidToken) {
            await admin.from("user_fcm_tokens").delete().eq("fcm_token", fcm_token);
          }
          throw new Error("FCM send failed");
        }

        return result;
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return jsonResp(200, { success: true, sent: successful, failed, total: tokens.length });
  } catch (error) {
    console.error("❌ notify-group-expense error:", error instanceof Error ? error.message : "unknown");
    return jsonResp(500, { success: false, error: "Internal error" });
  }
});
