import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FIREBASE_SERVER_KEY = Deno.env.get("FIREBASE_SERVER_KEY");
const FCM_API_URL = "https://fcm.googleapis.com/fcm/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: NotificationPayload = await req.json();
    const { user_id, title, body, data } = payload;

    console.log(`Enviando notificação para user_id: ${user_id}`);

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
      console.error("Erro ao buscar FCM tokens:", tokenError);
      throw new Error("Erro ao buscar tokens do usuário");
    }

    if (!tokens || tokens.length === 0) {
      console.warn(`Nenhum FCM token encontrado para user_id: ${user_id}`);
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

    console.log(`Enviando para ${tokens.length} dispositivo(s)`);

    // Enviar notificação para cada token
    const results = await Promise.allSettled(
      tokens.map(async ({ fcm_token }) => {
        const fcmPayload = {
          to: fcm_token,
          notification: {
            title,
            body,
            sound: "default",
          },
          data: data || {},
          priority: "high",
        };

        const response = await fetch(FCM_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${FIREBASE_SERVER_KEY}`,
          },
          body: JSON.stringify(fcmPayload),
        });

        const result = await response.json();

        if (!response.ok) {
          console.error(`❌ FCM Error - Status: ${response.status}`);
          console.error(`Token: ${fcm_token.slice(-8)}`);
          console.error(`Response:`, JSON.stringify(result, null, 2));
          
          // Se o token é inválido, remover do banco
          if (result.error === "InvalidRegistration" || result.error === "NotRegistered") {
            await supabase
              .from("user_fcm_tokens")
              .delete()
              .eq("fcm_token", fcm_token);
            console.log(`🗑️ Token inválido removido: ${fcm_token.slice(-8)}`);
          }
          
          // Verificar se é erro de autenticação
          if (response.status === 401 || result.error === "Unauthorized") {
            console.error("⚠️ FIREBASE_SERVER_KEY pode estar incorreta ou expirada!");
          }
          
          throw new Error(result.error || "Erro ao enviar notificação");
        }

        console.log(`✅ Notificação enviada com sucesso para token: ${fcm_token.slice(-8)}`);
        return result;
      })
    );

    // Contar sucessos e falhas
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`Notificações enviadas: ${successful} sucesso, ${failed} falhas`);

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
    console.error("Erro na Edge Function send-notification:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
