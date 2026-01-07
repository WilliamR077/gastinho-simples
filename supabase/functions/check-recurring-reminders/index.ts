import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const internalApiSecret = Deno.env.get("INTERNAL_API_SECRET")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate internal API secret
    const providedSecret = req.headers.get("x-internal-secret");
    if (providedSecret !== internalApiSecret) {
      console.error("Invalid or missing internal API secret");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Iniciando verificação de lembretes de despesas recorrentes...");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar todas as despesas recorrentes ativas
    const { data: recurringExpenses, error: expensesError } = await supabase
      .from("recurring_expenses")
      .select("*, user_id")
      .eq("is_active", true);

    if (expensesError) {
      console.error("Erro ao buscar despesas recorrentes:", expensesError);
      throw expensesError;
    }

    console.log(`Encontradas ${recurringExpenses?.length || 0} despesas recorrentes ativas`);

    // Buscar configurações de notificação de todos os usuários com despesas ativas
    const userIds = [...new Set(recurringExpenses?.map((e) => e.user_id) || [])];

    const { data: notificationSettings, error: settingsError } = await supabase
      .from("notification_settings")
      .select("*")
      .in("user_id", userIds)
      .eq("is_enabled", true);

    if (settingsError) {
      console.error("Erro ao buscar configurações de notificação:", settingsError);
      throw settingsError;
    }

    console.log(`Configurações de notificação habilitadas: ${notificationSettings?.length || 0}`);

    const today = new Date();
    const currentDay = today.getDate();

    let notificationsSent = 0;

    // Para cada despesa recorrente
    for (const expense of recurringExpenses || []) {
      const settings = notificationSettings?.find((s) => s.user_id === expense.user_id);

      if (!settings) {
        console.log(`Usuário ${expense.user_id} não tem notificações habilitadas`);
        continue;
      }

      const daysUntilDue = expense.day_of_month - currentDay;
      let shouldNotify = false;
      let notificationTitle = "";
      let notificationBody = "";

      // Verificar se deve enviar notificação
      if (settings.notify_3_days_before && daysUntilDue === 3) {
        shouldNotify = true;
        notificationTitle = "Lembrete: Despesa em 3 dias";
        notificationBody = `${expense.description} - R$ ${expense.amount} vence em 3 dias`;
      } else if (settings.notify_1_day_before && daysUntilDue === 1) {
        shouldNotify = true;
        notificationTitle = "Lembrete: Despesa amanhã";
        notificationBody = `${expense.description} - R$ ${expense.amount} vence amanhã`;
      } else if (settings.notify_on_day && daysUntilDue === 0) {
        shouldNotify = true;
        notificationTitle = "Lembrete: Despesa HOJE";
        notificationBody = `${expense.description} - R$ ${expense.amount} vence HOJE!`;
      }

      if (shouldNotify) {
        console.log(`Enviando notificação para ${expense.user_id}: ${notificationTitle}`);

        // Chamar a edge function send-notification com secret de autenticação
        const { error: notificationError } = await supabase.functions.invoke(
          "send-notification",
          {
            headers: {
              "x-internal-secret": internalApiSecret,
            },
            body: {
              user_id: expense.user_id,
              title: notificationTitle,
              body: notificationBody,
              data: {
                expense_id: expense.id,
                type: "recurring_expense_reminder",
              },
            },
          }
        );

        if (notificationError) {
          console.error(`Erro ao enviar notificação para ${expense.user_id}:`, notificationError);
        } else {
          notificationsSent++;
        }
      }
    }

    console.log(`Verificação concluída. ${notificationsSent} notificações enviadas.`);

    return new Response(
      JSON.stringify({
        success: true,
        checked: recurringExpenses?.length || 0,
        sent: notificationsSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Erro na Edge Function check-recurring-reminders:", error);
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
