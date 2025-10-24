import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a Supabase client with the auth context
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client to verify the user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`Processing account deletion for user: ${userId}`);

    // Create admin client for data deletion
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Delete user data in order (respecting any constraints)
    console.log('Deleting user expenses...');
    const { error: expensesError } = await supabaseAdmin
      .from('expenses')
      .delete()
      .eq('user_id', userId);
    
    if (expensesError) {
      console.error('Error deleting expenses:', expensesError);
      throw new Error(`Erro ao deletar despesas: ${expensesError.message}`);
    }

    console.log('Deleting user recurring expenses...');
    const { error: recurringError } = await supabaseAdmin
      .from('recurring_expenses')
      .delete()
      .eq('user_id', userId);
    
    if (recurringError) {
      console.error('Error deleting recurring expenses:', recurringError);
      throw new Error(`Erro ao deletar despesas fixas: ${recurringError.message}`);
    }

    console.log('Deleting user budget goals...');
    const { error: budgetError } = await supabaseAdmin
      .from('budget_goals')
      .delete()
      .eq('user_id', userId);
    
    if (budgetError) {
      console.error('Error deleting budget goals:', budgetError);
      throw new Error(`Erro ao deletar metas: ${budgetError.message}`);
    }

    console.log('Deleting user credit card configs...');
    const { error: configError } = await supabaseAdmin
      .from('credit_card_configs')
      .delete()
      .eq('user_id', userId);
    
    if (configError) {
      console.error('Error deleting credit card configs:', configError);
      throw new Error(`Erro ao deletar configurações: ${configError.message}`);
    }

    console.log('Deleting user notification settings...');
    const { error: notificationError } = await supabaseAdmin
      .from('notification_settings')
      .delete()
      .eq('user_id', userId);
    
    if (notificationError) {
      console.error('Error deleting notification settings:', notificationError);
      throw new Error(`Erro ao deletar notificações: ${notificationError.message}`);
    }

    console.log('Deleting user audit logs...');
    const { error: auditError } = await supabaseAdmin
      .from('audit_log')
      .delete()
      .eq('user_id', userId);
    
    if (auditError) {
      console.error('Error deleting audit logs:', auditError);
      // Don't throw error for audit logs, it's not critical
    }

    // Finally, delete the user account using admin API
    console.log('Deleting user account from auth...');
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteUserError) {
      console.error('Error deleting user account:', deleteUserError);
      throw new Error(`Erro ao deletar conta: ${deleteUserError.message}`);
    }

    console.log(`Successfully deleted account for user: ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Conta deletada com sucesso' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in delete-user-account function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao processar solicitação' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
