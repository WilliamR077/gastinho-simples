
-- Quota helpers
CREATE OR REPLACE FUNCTION public.can_add_card(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier subscription_tier;
  card_count int;
BEGIN
  SELECT tier INTO user_tier FROM public.subscriptions
  WHERE user_id = user_id_param AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF user_tier IN ('premium', 'premium_plus') THEN
    RETURN true;
  END IF;

  SELECT COUNT(*) INTO card_count FROM public.cards
  WHERE user_id = user_id_param AND is_active = true;

  RETURN card_count < 2;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_add_budget_goal(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier subscription_tier;
  goal_count int;
BEGIN
  SELECT tier INTO user_tier FROM public.subscriptions
  WHERE user_id = user_id_param AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF user_tier IN ('premium', 'premium_plus') THEN
    RETURN true;
  END IF;

  SELECT COUNT(*) INTO goal_count FROM public.budget_goals
  WHERE user_id = user_id_param;

  RETURN goal_count < 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_add_card(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_add_budget_goal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_add_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_budget_goal(uuid) TO authenticated;

-- Enforce quotas on INSERT policies
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.shared_groups;
CREATE POLICY "Authenticated users can create groups"
  ON public.shared_groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.can_create_group(auth.uid()));

DROP POLICY IF EXISTS "Users can create their own cards" ON public.cards;
CREATE POLICY "Users can create their own cards"
  ON public.cards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_add_card(auth.uid()));

DROP POLICY IF EXISTS "Users can create budget goals" ON public.budget_goals;
CREATE POLICY "Users can create budget goals"
  ON public.budget_goals FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND ((shared_group_id IS NULL) OR public.is_group_member(shared_group_id, auth.uid()))
    AND public.can_add_budget_goal(auth.uid())
  );

-- Tighten SECURITY DEFINER function exposure: remove anon/public execute where signed-in only
REVOKE EXECUTE ON FUNCTION public.shares_group_with(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_group_members_with_email(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
