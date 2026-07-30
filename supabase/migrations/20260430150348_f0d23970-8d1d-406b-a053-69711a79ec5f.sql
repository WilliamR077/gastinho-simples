-- Phase 1 hardening: revoke EXECUTE on sensitive SECURITY DEFINER functions from anon
-- and add explicit auth guard on find_group_by_invite_code.

-- 1) find_group_by_invite_code: only authenticated users may search groups by invite code.
--    Add explicit auth.uid() guard so even if EXECUTE is mistakenly granted, anon is blocked.
CREATE OR REPLACE FUNCTION public.find_group_by_invite_code(invite_code_param text)
 RETURNS TABLE(id uuid, name text, description text, color text, max_members integer, is_active boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT 
    g.id,
    g.name,
    g.description,
    g.color,
    g.max_members,
    g.is_active
  FROM public.shared_groups g
  WHERE g.invite_code = UPPER(TRIM(invite_code_param))
    AND g.is_active = true;
END;
$function$;

REVOKE ALL ON FUNCTION public.find_group_by_invite_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_group_by_invite_code(text) TO authenticated;

-- 2) generate_invite_code: utility helper, must never be callable by anon.
REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_invite_code() TO authenticated;

-- 3) delete_group_and_data: destructive; only authenticated owners (already enforced inside).
REVOKE ALL ON FUNCTION public.delete_group_and_data(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_group_and_data(uuid, text) TO authenticated;

-- 4) get_group_members_with_email: leaks emails; already member-checked inside but block anon.
REVOKE ALL ON FUNCTION public.get_group_members_with_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_group_members_with_email(uuid) TO authenticated;

-- 5) can_create_group: subscription check; no need for anon access.
REVOKE ALL ON FUNCTION public.can_create_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_group(uuid) TO authenticated;