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
  type: "monthly_total" | "category" | "income_monthly_total" | "income_category";
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

interface Income {
  amount: number;
  category: string;
  income_date: string;
}

interface RecurringIncome {
  amount: number;
  category: string;
  is_active: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;

    let alertsSent = 0;

    for (const goal of goals || []) {
      console.log(`Processing goal ${goal.id} for user ${goal.user_id}`);

      const isIncomeGoal = goal.type.startsWith("income_");
      let totalValue = 0;

      if (isIncomeGoal) {
        // Fetch incomes for the current month
        const { data: incomes } = await supabase
          .from("incomes")
          .select("amount, category, income_date")
          .eq("user_id", goal.user_id)
          .gte("income_date", monthStart);

        const { data: recurringIncomes } = await supabase
          .from("recurring_incomes")
          .select("amount, category, is_active")
          .eq("user_id", goal.user_id)
          .eq("is_active", true);

        if (goal.type === "income_monthly_total") {
          totalValue = (incomes || []).reduce((sum: number, inc: Income) => sum + Number(inc.amount), 0);
          totalValue += (recurringIncomes || []).reduce((sum: number, ri: RecurringIncome) => sum + Number(ri.amount), 0);
        } else if (goal.type === "income_category" && goal.category) {
          totalValue = (incomes || [])
            .filter((inc: Income) => inc.category === goal.category)
            .reduce((sum: number, inc: Income) => sum + Number(inc.amount), 0);
          totalValue += (recurringIncomes || [])
            .filter((ri: RecurringIncome) => ri.category === goal.category)
            .reduce((sum: number, ri: RecurringIncome) => sum + Number(ri.amount), 0);
        }
      } else {
        // Expense goals (existing logic)
        const { data: expenses } = await supabase
          .from("expenses")
          .select("amount, category, expense_date")
          .eq("user_id", goal.user_id)
          .gte("expense_date", monthStart);

        const { data: recurringExpenses } = await supabase
          .from("recurring_expenses")
          .select("amount, category, is_active")
          .eq("user_id", goal.user_id)
          .eq("is_active", true);

        if (goal.type === "monthly_total") {
          totalValue = (expenses || []).reduce((sum: number, exp: Expense) => sum + Number(exp.amount), 0);
          totalValue += (recurringExpenses || []).reduce((sum: number, re: RecurringExpense) => sum + Number(re.amount), 0);
        } else if (goal.type === "category" && goal.category) {
          totalValue = (expenses || [])
            .filter((exp: Expense) => exp.category === goal.category)
            .reduce((sum: number, exp: Expense) => sum + Number(exp.amount), 0);
          totalValue += (recurringExpenses || [])
            .filter((re: RecurringExpense) => re.category === goal.category)
            .reduce((sum: number, re: RecurringExpense) => sum + Number(re.amount), 0);
        }
      }

      const limit = Number(goal.limit_amount);
      const percentage = (totalValue / limit) * 100;

      console.log(`Goal ${goal.id}: ${percentage.toFixed(1)}% (${totalValue}/${limit})`);

      let alertLevel: number | null = null;
      let alertTitle = "";
      let alertBody = "";

      if (isIncomeGoal) {
        // Income goal alerts - celebratory messages
        const goalName = goal.type === "income_category" && goal.category
          ? `Meta de ${goal.category}`
          : "Meta Mensal de Entradas";

        if (percentage >= 100) {
          alertLevel = 100;
          const exceeded = totalValue - limit;
          alertTitle = exceeded > 0
            ? `🌟 ${goalName}: Meta superada!`
            : `🎉 ${goalName}: Meta atingida!`;
          alertBody = exceeded > 0
            ? `Incrível! Você superou sua meta em R$ ${exceeded.toFixed(2)}!`
            : `Parabéns! Você bateu sua meta de R$ ${limit.toFixed(2)}!`;
        } else if (percentage >= 80) {
          alertLevel = 80;
          alertTitle = `💪 ${goalName}: Quase lá!`;
          alertBody = `Você já atingiu ${percentage.toFixed(0)}% da sua meta. Faltam R$ ${(limit - totalValue).toFixed(2)}!`;
        }
      } else {
        // Expense goal alerts (existing logic)
        if (percentage >= 100) {
          alertLevel = 100;
          alertTitle = "🚨 Meta estourada!";
          alertBody = `Você excedeu o limite em R$ ${(totalValue - limit).toFixed(2)}.`;
        } else if (percentage >= 95) {
          alertLevel = 95;
          alertTitle = "⚠️ Alerta crítico!";
          alertBody = `Você está a R$ ${(limit - totalValue).toFixed(2)} de estourar sua meta.`;
        } else if (percentage >= 80) {
          alertLevel = 80;
          alertTitle = "⚠️ Atenção!";
          alertBody = `Você já usou ${percentage.toFixed(0)}% da sua meta.`;
        }
      }

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

          const goalName = isIncomeGoal
            ? (goal.type === "income_category" && goal.category ? `Meta de ${goal.category}` : "Meta Mensal de Entradas")
            : (goal.type === "category" && goal.category ? `Meta de ${goal.category}` : "Meta Mensal Total");

          const { error: notificationError } = await supabase.functions.invoke(
            "send-notification",
            {
              headers: {
                "x-internal-secret": INTERNAL_API_SECRET,
              },
              body: {
                user_id: goal.user_id,
                title: alertTitle,
                body: alertBody,
                data: {
                  type: isIncomeGoal ? "income_goal_alert" : "budget_alert",
                  goal_id: goal.id,
                  percentage: percentage.toFixed(1),
                },
              },
            }
          );

          if (notificationError) {
            console.error(`Error sending notification for goal ${goal.id}:`, notificationError);
          } else {
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
