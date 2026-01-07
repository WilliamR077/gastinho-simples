import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

const FIREBASE_SERVICE_ACCOUNT_JSON = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
const INTERNAL_API_SECRET = Deno.env.get("INTERNAL_API_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

interface NotificationPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface ServiceAccount {
  project_id: string;
  private_key: string;
  client_email: string;
}

// Cache do access token OAuth 2.0
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Converte uma private key PEM (PKCS#8) em CryptoKey para uso com djwt
 */
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  // Remover header/footer e quebras de linha do PEM
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  // Converter base64 para ArrayBuffer
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  console.log("🔑 Importando private key como CryptoKey...");
  
  // Importar como CryptoKey
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",  // Formato da chave privada
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",  // Algoritmo usado pelo RS256
      hash: "SHA-256",
    },
    false,  // Não exportável (mais seguro)
    ["sign"]  // Uso: assinar JWTs
  );
  
  console.log("✅ Private key importada com sucesso");
  return cryptoKey;
}

/**
 * Gera um Access Token OAuth 2.0 usando a Service Account do Firebase
 */
async function getAccessToken(): Promise<string> {
  // Verificar se há token em cache válido
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && tokenExpiresAt > now + 300) {
    console.log("🔄 Reutilizando access token em cache (expira em " + (tokenExpiresAt - now) + "s)");
    return cachedAccessToken;
  }

  console.log("🔑 Gerando novo access token OAuth 2.0...");

  if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON não configurada");
  }

  const serviceAccount: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
  const { project_id, client_email } = serviceAccount;
  
  // ✅ CORREÇÃO: Converter \n literais para quebras de linha reais
  const private_key_pem = serviceAccount.private_key.replace(/\\n/g, '\n');

  console.log("📝 Project ID:", project_id);
  console.log("📝 Client Email:", client_email);
  console.log("🔑 Private key format check:", private_key_pem.substring(0, 30) + "...");

  // Criar JWT assinado com a private key da service account
  const iat = getNumericDate(0);
  const exp = getNumericDate(60 * 60); // 1 hora

  try {
    // ✅ Importar private key como CryptoKey para djwt
    const private_key = await importPrivateKey(private_key_pem);
    
    const jwt = await create(
      { alg: "RS256", typ: "JWT" },
      {
        iss: client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat,
        exp,
      },
      private_key
    );

    console.log("✅ JWT criado com sucesso");

    // Trocar JWT por Access Token OAuth 2.0
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("❌ Erro ao obter access token:", error);
      throw new Error("Falha na autenticação OAuth 2.0");
    }

    const tokenData = await tokenResponse.json();
    cachedAccessToken = tokenData.access_token;
    tokenExpiresAt = now + tokenData.expires_in;

    console.log("✅ Access token gerado com sucesso (expira em " + tokenData.expires_in + "s)");
    return cachedAccessToken as string;
    
  } catch (error) {
    console.error("❌ Erro ao criar JWT:", error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Validate internal API secret to prevent unauthorized notifications
    const providedSecret = req.headers.get("x-internal-secret");
    if (!INTERNAL_API_SECRET || providedSecret !== INTERNAL_API_SECRET) {
      console.error("❌ Unauthorized: Invalid or missing internal API secret");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const payload: NotificationPayload = await req.json();
    const { user_id, title, body, data } = payload;

    console.log(`📤 Enviando notificação para user_id: ${user_id}`);

    // Buscar FCM tokens do usuário no Supabase
    const { createClient } = await import(
      "https://esm.sh/@supabase/supabase-js@2"
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: tokens, error: tokenError } = await supabase
      .from("user_fcm_tokens")
      .select("fcm_token")
      .eq("user_id", user_id);

    if (tokenError) {
      console.error("❌ Erro ao buscar FCM tokens:", tokenError);
      throw new Error("Erro ao buscar tokens do usuário");
    }

    if (!tokens || tokens.length === 0) {
      console.warn(`⚠️ Nenhum FCM token encontrado para user_id: ${user_id}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Nenhum dispositivo registrado para este usuário" 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    console.log(`📱 Enviando para ${tokens.length} dispositivo(s)`);

    // Obter access token OAuth 2.0
    const accessToken = await getAccessToken();

    // Obter project_id da service account
    const serviceAccount: ServiceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON!);
    const FCM_ENDPOINT = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    // Enviar notificação para cada token usando FCM HTTP v1 API
    const results = await Promise.allSettled(
      tokens.map(async ({ fcm_token }) => {
        // Formato HTTP v1 da API do FCM
        const fcmPayload = {
          message: {
            token: fcm_token,
            notification: {
              title,
              body,
            },
            data: data || {},
            android: {
              priority: "high",
              notification: {
                sound: "default",
                channelId: "default",
              },
            },
          },
        };

        const response = await fetch(FCM_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(fcmPayload),
        });

        const result = await response.json();

        if (!response.ok) {
          console.error(`❌ FCM HTTP v1 Error - Status: ${response.status}`);
          console.error(`Token: •••${fcm_token.slice(-8)}`);
          console.error(`Response:`, JSON.stringify(result, null, 2));
          
          // Verificar se o token é inválido (formato v1)
          const errorCode = result?.error?.status || result?.error?.code;
          const errorMessage = result?.error?.message || "";
          
          const isInvalidToken = 
            errorCode === "INVALID_ARGUMENT" ||
            errorCode === "NOT_FOUND" ||
            errorMessage.includes("not a valid FCM registration token") ||
            errorMessage.includes("Requested entity was not found");
          
          if (isInvalidToken) {
            await supabase
              .from("user_fcm_tokens")
              .delete()
              .eq("fcm_token", fcm_token);
            console.log(`🗑️ Token inválido removido: •••${fcm_token.slice(-8)}`);
          }
          
          // Verificar se é erro de autenticação
          if (response.status === 401 || response.status === 403) {
            console.error("⚠️ Erro de autenticação! Verificar FIREBASE_SERVICE_ACCOUNT_JSON");
          }
          
          throw new Error(result?.error?.message || "Erro ao enviar notificação");
        }

        console.log(`✅ Notificação enviada com sucesso para token: •••${fcm_token.slice(-8)}`);
        return result;
      })
    );

    // Contar sucessos e falhas
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`📊 Resultado: ${successful} enviadas, ${failed} falhas (total: ${tokens.length})`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful,
        failed,
        total: tokens.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("❌ Erro na Edge Function send-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
