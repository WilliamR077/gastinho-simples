import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_API_SECRET = Deno.env.get("INTERNAL_API_SECRET")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

interface BudgetGoal {
  id: string;
  user_id: string;
  type: "monthly_total" | "category";
  category: string | null;
  limit_amount: number;
}

interface Expense {
  amount: number;
  category: string;
  expense_date: string;
}

interface RecurringExpense {
  amount: number;
  category: string;
  is_active: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate internal API secret
    const providedSecret = req.headers.get("x-internal-secret");
    if (providedSecret !== INTERNAL_API_SECRET) {
      console.error("Invalid or missing internal API secret");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting budget goals check...");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar todas as metas ativas
    const { data: goals, error: goalsError } = await supabase
      .from("budget_goals")
      .select("*");

    if (goalsError) {
      console.error("Error fetching goals:", goalsError);
      throw goalsError;
    }

    console.log(`Found ${goals?.length || 0} budget goals`);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const today = new Date().toISOString().split("T")[0];

    let alertsSent = 0;

    // Processar cada meta
    for (const goal of goals || []) {
      console.log(`Processing goal ${goal.id} for user ${goal.user_id}`);

      // Buscar despesas do mês atual
      const { data: expenses } = await supabase
        .from("expenses")
        .select("amount, category, expense_date")
        .eq("user_id", goal.user_id)
        .gte("expense_date", `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`);

      // Buscar despesas recorrentes ativas
      const { data: recurringExpenses } = await supabase
        .from("recurring_expenses")
        .select("amount, category, is_active")
        .eq("user_id", goal.user_id)
        .eq("is_active", true);

      // Calcular total gasto
      let totalSpent = 0;

      if (goal.type === "monthly_total") {
        totalSpent = (expenses || []).reduce((sum: number, exp: Expense) => sum + Number(exp.amount), 0);
        totalSpent += (recurringExpenses || []).reduce((sum: number, re: RecurringExpense) => sum + Number(re.amount), 0);
      } else if (goal.type === "category" && goal.category) {
        totalSpent = (expenses || [])
          .filter((exp: Expense) => exp.category === goal.category)
          .reduce((sum: number, exp: Expense) => sum + Number(exp.amount), 0);
        totalSpent += (recurringExpenses || [])
          .filter((re: RecurringExpense) => re.category === goal.category)
          .reduce((sum: number, re: RecurringExpense) => sum + Number(re.amount), 0);
      }

      const limit = Number(goal.limit_amount);
      const percentage = (totalSpent / limit) * 100;

      console.log(`Goal ${goal.id}: ${percentage.toFixed(1)}% used (${totalSpent}/${limit})`);

      // Determinar nível de alerta
      let alertLevel: number | null = null;
      let alertTitle = "";
      let alertBody = "";

      if (percentage >= 100) {
        alertLevel = 100;
        alertTitle = "🚨 Meta estourada!";
        alertBody = `Você excedeu o limite em R$ ${(totalSpent - limit).toFixed(2)}.`;
      } else if (percentage >= 95) {
        alertLevel = 95;
        alertTitle = "⚠️ Alerta crítico!";
        alertBody = `Você está a R$ ${(limit - totalSpent).toFixed(2)} de estourar sua meta.`;
      } else if (percentage >= 80) {
        alertLevel = 80;
        alertTitle = "⚠️ Atenção!";
        alertBody = `Você já usou ${percentage.toFixed(0)}% da sua meta.`;
      }

      // Se há alerta, verificar se já foi enviado hoje
      if (alertLevel) {
        const { data: existingAlert } = await supabase
          .from("budget_goal_alerts")
          .select("id")
          .eq("goal_id", goal.id)
          .eq("alert_level", alertLevel)
          .eq("alert_date", today)
          .single();

        if (!existingAlert) {
          console.log(`Sending alert level ${alertLevel} for goal ${goal.id}`);

          const goalName = goal.type === "category" && goal.category
            ? `Meta de ${goal.category}`
            : "Meta Mensal Total";

          // Use send-notification edge function instead of direct FCM call
          const { error: notificationError } = await supabase.functions.invoke(
            "send-notification",
            {
              headers: {
                "x-internal-secret": INTERNAL_API_SECRET,
              },
              body: {
                user_id: goal.user_id,
                title: `${goalName}: ${alertTitle}`,
                body: alertBody,
                data: {
                  type: "budget_alert",
                  goal_id: goal.id,
                  percentage: percentage.toFixed(1),
                },
              },
            }
          );

          if (notificationError) {
            console.error(`Error sending notification for goal ${goal.id}:`, notificationError);
          } else {
            // Registrar alerta
            await supabase
              .from("budget_goal_alerts")
              .insert({
                user_id: goal.user_id,
                goal_id: goal.id,
                alert_level: alertLevel,
                alert_date: today,
              });

            console.log(`Alert registered for goal ${goal.id}`);
            alertsSent++;
          }
        } else {
          console.log(`Alert already sent today for goal ${goal.id} at level ${alertLevel}`);
        }
      }
    }

    console.log(`Budget goals check completed successfully. ${alertsSent} alerts sent.`);

    return new Response(
      JSON.stringify({ success: true, checked: goals?.length || 0, alertsSent }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in check-budget-goals:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
