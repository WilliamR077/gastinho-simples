import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a Supabase client with the auth context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client to verify the user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Authentication error:", authError);
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;
    console.log(`Processing account deletion for user: ${userId}`);

    // Create admin client for data deletion
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // First, get all groups created by this user to handle cascade deletions
    console.log("Fetching user created groups...");
    const { data: userGroups } = await supabaseAdmin
      .from("shared_groups")
      .select("id")
      .eq("created_by", userId);

    // If user has created groups, delete all related data first
    if (userGroups && userGroups.length > 0) {
      const groupIds = userGroups.map(g => g.id);
      console.log(`User has ${groupIds.length} groups to clean up`);

      for (const groupId of groupIds) {
        // Delete budget goals for this group
        console.log(`Deleting budget goals for group ${groupId}...`);
        await supabaseAdmin
          .from("budget_goals")
          .delete()
          .eq("shared_group_id", groupId);

        // Delete expenses for this group
        console.log(`Deleting expenses for group ${groupId}...`);
        await supabaseAdmin
          .from("expenses")
          .delete()
          .eq("shared_group_id", groupId);

        // Delete recurring expenses for this group
        console.log(`Deleting recurring expenses for group ${groupId}...`);
        await supabaseAdmin
          .from("recurring_expenses")
          .delete()
          .eq("shared_group_id", groupId);

        // Delete all members from this group
        console.log(`Deleting members for group ${groupId}...`);
        await supabaseAdmin
          .from("shared_group_members")
          .delete()
          .eq("group_id", groupId);
      }

      // Delete the groups created by user
      console.log("Deleting user created groups...");
      await supabaseAdmin
        .from("shared_groups")
        .delete()
        .eq("created_by", userId);
    }

    // Delete user from other groups they are member of
    console.log("Deleting user group memberships...");
    await supabaseAdmin
      .from("shared_group_members")
      .delete()
      .eq("user_id", userId);

    // Delete budget goal alerts first (references budget_goals)
    console.log("Deleting user budget goal alerts...");
    await supabaseAdmin
      .from("budget_goal_alerts")
      .delete()
      .eq("user_id", userId);

    // Delete budget goals
    console.log("Deleting user budget goals...");
    const { error: budgetError } = await supabaseAdmin
      .from("budget_goals")
      .delete()
      .eq("user_id", userId);

    if (budgetError) {
      console.error("Error deleting budget goals:", budgetError);
    }

    // Delete expenses
    console.log("Deleting user expenses...");
    const { error: expensesError } = await supabaseAdmin
      .from("expenses")
      .delete()
      .eq("user_id", userId);

    if (expensesError) {
      console.error("Error deleting expenses:", expensesError);
    }

    // Delete recurring expenses
    console.log("Deleting user recurring expenses...");
    const { error: recurringError } = await supabaseAdmin
      .from("recurring_expenses")
      .delete()
      .eq("user_id", userId);

    if (recurringError) {
      console.error("Error deleting recurring expenses:", recurringError);
    }

    // Delete credit card configs
    console.log("Deleting user credit card configs...");
    const { error: configError } = await supabaseAdmin
      .from("credit_card_configs")
      .delete()
      .eq("user_id", userId);

    if (configError) {
      console.error("Error deleting credit card configs:", configError);
    }

    // Delete cards
    console.log("Deleting user cards...");
    const { error: cardsError } = await supabaseAdmin
      .from("cards")
      .delete()
      .eq("user_id", userId);

    if (cardsError) {
      console.error("Error deleting cards:", cardsError);
    }

    // Delete notification settings
    console.log("Deleting user notification settings...");
    const { error: notificationError } = await supabaseAdmin
      .from("notification_settings")
      .delete()
      .eq("user_id", userId);

    if (notificationError) {
      console.error("Error deleting notification settings:", notificationError);
    }

    // Delete FCM tokens
    console.log("Deleting user FCM tokens...");
    const { error: fcmError } = await supabaseAdmin
      .from("user_fcm_tokens")
      .delete()
      .eq("user_id", userId);

    if (fcmError) {
      console.error("Error deleting FCM tokens:", fcmError);
    }

    // Delete subscriptions
    console.log("Deleting user subscriptions...");
    const { error: subscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .delete()
      .eq("user_id", userId);

    if (subscriptionError) {
      console.error("Error deleting subscriptions:", subscriptionError);
    }

    // Delete audit logs
    console.log("Deleting user audit logs...");
    const { error: auditError } = await supabaseAdmin
      .from("audit_log")
      .delete()
      .eq("user_id", userId);

    if (auditError) {
      console.error("Error deleting audit logs:", auditError);
    }

    // Finally, delete the user account using admin API
    console.log("Deleting user account from auth...");
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error("Error deleting user account:", deleteUserError);
      throw new Error(`Erro ao deletar conta: ${deleteUserError.message}`);
    }

    console.log(`Successfully deleted account for user: ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Conta deletada com sucesso",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in delete-user-account function:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Erro ao processar solicitação",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
