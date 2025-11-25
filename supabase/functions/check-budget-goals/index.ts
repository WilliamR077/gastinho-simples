import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FIREBASE_SERVER_KEY = Deno.env.get('FIREBASE_SERVER_KEY')!;

interface BudgetGoal {
  id: string;
  user_id: string;
  type: 'monthly_total' | 'category';
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

interface FCMToken {
  fcm_token: string;
}

Deno.serve(async () => {
  try {
    console.log('Starting budget goals check...');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar todas as metas ativas
    const { data: goals, error: goalsError } = await supabase
      .from('budget_goals')
      .select('*');

    if (goalsError) {
      console.error('Error fetching goals:', goalsError);
      throw goalsError;
    }

    console.log(`Found ${goals?.length || 0} budget goals`);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const today = new Date().toISOString().split('T')[0];

    // Processar cada meta
    for (const goal of goals || []) {
      console.log(`Processing goal ${goal.id} for user ${goal.user_id}`);

      // Buscar despesas do mês atual
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount, category, expense_date')
        .eq('user_id', goal.user_id)
        .gte('expense_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`);

      // Buscar despesas recorrentes ativas
      const { data: recurringExpenses } = await supabase
        .from('recurring_expenses')
        .select('amount, category, is_active')
        .eq('user_id', goal.user_id)
        .eq('is_active', true);

      // Calcular total gasto
      let totalSpent = 0;

      if (goal.type === 'monthly_total') {
        totalSpent = (expenses || []).reduce((sum: number, exp: Expense) => sum + Number(exp.amount), 0);
        totalSpent += (recurringExpenses || []).reduce((sum: number, re: RecurringExpense) => sum + Number(re.amount), 0);
      } else if (goal.type === 'category' && goal.category) {
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
      let message = '';

      if (percentage >= 100) {
        alertLevel = 100;
        message = `🚨 Meta estourada! Você excedeu o limite em R$ ${(totalSpent - limit).toFixed(2)}.`;
      } else if (percentage >= 95) {
        alertLevel = 95;
        message = `⚠️ Alerta crítico! Você está a ${(limit - totalSpent).toFixed(2)} de estourar sua meta.`;
      } else if (percentage >= 80) {
        alertLevel = 80;
        message = `⚠️ Atenção! Você já usou ${percentage.toFixed(0)}% da sua meta.`;
      }

      // Se há alerta, verificar se já foi enviado hoje
      if (alertLevel) {
        const { data: existingAlert } = await supabase
          .from('budget_goal_alerts')
          .select('id')
          .eq('goal_id', goal.id)
          .eq('alert_level', alertLevel)
          .eq('alert_date', today)
          .single();

        if (!existingAlert) {
          console.log(`Sending alert level ${alertLevel} for goal ${goal.id}`);

          // Buscar tokens FCM do usuário
          const { data: tokens } = await supabase
            .from('user_fcm_tokens')
            .select('fcm_token')
            .eq('user_id', goal.user_id);

          if (tokens && tokens.length > 0) {
            // Enviar notificação para cada token
            for (const token of tokens) {
              try {
                const goalName = goal.type === 'category' && goal.category 
                  ? `Meta de ${goal.category}` 
                  : 'Meta Mensal Total';

                const response = await fetch('https://fcm.googleapis.com/fcm/send', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `key=${FIREBASE_SERVER_KEY}`,
                  },
                  body: JSON.stringify({
                    to: token.fcm_token,
                    notification: {
                      title: goalName,
                      body: message,
                      sound: 'default',
                    },
                    data: {
                      type: 'budget_alert',
                      goal_id: goal.id,
                      percentage: percentage.toFixed(1),
                    },
                  }),
                });

                if (!response.ok) {
                  console.error('FCM error:', await response.text());
                }
              } catch (error) {
                console.error('Error sending notification:', error);
              }
            }
          }

          // Registrar alerta
          await supabase
            .from('budget_goal_alerts')
            .insert({
              user_id: goal.user_id,
              goal_id: goal.id,
              alert_level: alertLevel,
              alert_date: today,
            });

          console.log(`Alert registered for goal ${goal.id}`);
        } else {
          console.log(`Alert already sent today for goal ${goal.id} at level ${alertLevel}`);
        }
      }
    }

    console.log('Budget goals check completed successfully');
    
    return new Response(
      JSON.stringify({ success: true, message: 'Budget goals checked successfully' }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in check-budget-goals:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
