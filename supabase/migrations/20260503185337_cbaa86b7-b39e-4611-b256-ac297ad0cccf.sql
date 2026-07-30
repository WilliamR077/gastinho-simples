-- Phase 2 - Block A: DB hardening (linter, search_path, grants, GraphQL exposure)

-- A.1 search_path em funções faltantes
ALTER FUNCTION public.update_user_fcm_tokens_updated_at()
  SET search_path = public;

-- A.2 Funções internas (não chamadas pelo client) — revogar EXECUTE total
REVOKE EXECUTE ON FUNCTION public.migrate_credit_card_config()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_fcm_tokens_updated_at()      FROM PUBLIC, anon, authenticated;

-- A.3 Funções user-facing — revogar de PUBLIC/anon, garantir EXECUTE para authenticated
DO $$
DECLARE
  fns text[] := ARRAY[
    'public.has_role(uuid, public.app_role)',
    'public.get_user_subscription_tier(uuid)',
    'public.can_create_group(uuid)',
    'public.is_group_member(uuid, uuid)',
    'public.get_group_role(uuid, uuid)',
    'public.find_group_by_invite_code(text)',
    'public.get_group_members_with_email(uuid)',
    'public.delete_group_and_data(uuid, text)',
    'public.generate_invite_code()',
    'public.initialize_user_categories(uuid)',
    'public.initialize_user_income_categories(uuid)',
    'public.migrate_expense_categories(uuid)',
    'public.migrate_income_categories(uuid)'
  ];
  f text;
BEGIN
  FOREACH f IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- A.4 GraphQL exposure: revogar SELECT a anon em tabelas internas
-- (RLS continua governando authenticated; isto remove discoverability via anon GraphQL)
REVOKE SELECT ON public.audit_log               FROM anon;
REVOKE SELECT ON public.admin_notifications_log FROM anon;
REVOKE SELECT ON public.budget_goal_alerts      FROM anon;
REVOKE SELECT ON public.user_roles              FROM anon;
REVOKE SELECT ON public.notification_settings   FROM anon;
REVOKE SELECT ON public.expense_splits          FROM anon;