-- G1-C1-H1: fix the pgcrypto function schema used by atomic group creation.
--
-- Supabase installs pgcrypto functions in the extensions schema. The applied
-- G1-C1 function qualified gen_random_bytes as public.gen_random_bytes, which
-- raises undefined_function (42883) before the first group INSERT. Keep the
-- public RPC contract and all business/security invariants unchanged.

CREATE OR REPLACE FUNCTION public.create_shared_group_atomic(
  p_name text,
  p_description text DEFAULT NULL,
  p_color text DEFAULT '#6366f1'
)
RETURNS TABLE (
  group_id uuid,
  name text,
  description text,
  color text,
  invite_code text,
  max_members integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  membership_id uuid,
  role public.group_member_role,
  joined_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text;
  v_description text;
  v_color text;
  v_tier public.subscription_tier;
  v_group public.shared_groups%ROWTYPE;
  v_membership public.shared_group_members%ROWTYPE;
  v_owner_count integer;
  v_invite_code text;
  v_random_bytes bytea;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempt integer;
  v_position integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'G1C_NOT_AUTHENTICATED';
  END IF;

  v_name := btrim(p_name);
  v_description := NULLIF(btrim(p_description), '');
  v_color := COALESCE(NULLIF(btrim(p_color), ''), '#6366f1');

  IF v_name IS NULL
     OR char_length(v_name) = 0
     OR char_length(v_name) > 50
     OR v_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'G1C_INVALID_NAME';
  END IF;

  IF v_description IS NOT NULL
     AND (
       char_length(v_description) > 200
       OR v_description ~ '[[:cntrl:]]'
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'G1C_INVALID_DESCRIPTION';
  END IF;

  IF v_color NOT IN (
    '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'G1C_INVALID_COLOR';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('create_shared_group:' || v_user_id::text, 0)
  );

  SELECT s.tier
    INTO v_tier
  FROM public.subscriptions AS s
  WHERE s.user_id = v_user_id
    AND s.is_active = true
    AND (s.expires_at IS NULL OR s.expires_at > pg_catalog.now());

  IF v_tier IS NULL OR v_tier NOT IN ('premium', 'premium_plus') THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'G1C_PLAN_REQUIRED';
  END IF;

  IF (
    SELECT pg_catalog.count(*)
    FROM public.shared_groups AS g
    WHERE g.created_by = v_user_id
      AND g.is_active = true
  ) >= 3 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'G1C_GROUP_LIMIT_REACHED';
  END IF;

  BEGIN
    FOR v_attempt IN 1..5 LOOP
      v_random_bytes := extensions.gen_random_bytes(6);
      v_invite_code := '';

      FOR v_position IN 0..5 LOOP
        v_invite_code := v_invite_code || pg_catalog.substr(
          v_alphabet,
          (pg_catalog.get_byte(v_random_bytes, v_position) % 32) + 1,
          1
        );
      END LOOP;

      BEGIN
        INSERT INTO public.shared_groups (
          name,
          description,
          created_by,
          invite_code,
          color
        )
        VALUES (
          v_name,
          v_description,
          v_user_id,
          v_invite_code,
          v_color
        )
        RETURNING * INTO v_group;

        EXIT;
      EXCEPTION
        WHEN unique_violation THEN
          v_group.id := NULL;
      END;
    END LOOP;

    IF v_group.id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'G1C_INVITE_CODE_UNAVAILABLE';
    END IF;

    INSERT INTO public.shared_group_members (
      group_id,
      user_id,
      role
    )
    VALUES (
      v_group.id,
      v_user_id,
      'owner'::public.group_member_role
    )
    RETURNING * INTO v_membership;

    SELECT pg_catalog.count(*)
      INTO v_owner_count
    FROM public.shared_group_members AS m
    WHERE m.group_id = v_group.id
      AND m.user_id = v_user_id
      AND m.role = 'owner'::public.group_member_role;

    IF v_owner_count <> 1
       OR v_membership.group_id <> v_group.id
       OR v_membership.user_id <> v_user_id
       OR v_membership.role <> 'owner'::public.group_member_role THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'G1C_MEMBERSHIP_FAILED';
    END IF;

    RETURN QUERY
    SELECT
      v_group.id,
      v_group.name,
      v_group.description,
      v_group.color,
      v_group.invite_code,
      v_group.max_members,
      v_group.is_active,
      v_group.created_at,
      v_group.updated_at,
      v_membership.id,
      v_membership.role,
      v_membership.joined_at;
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RAISE;
    WHEN OTHERS THEN
      -- Log only the PostgreSQL error class/message. Do not log inputs,
      -- authenticated UUIDs, descriptions, invite codes, or row data.
      RAISE LOG
        'create_shared_group_atomic unexpected failure: SQLSTATE=%, SQLERRM=%',
        SQLSTATE,
        SQLERRM;
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'G1C_CREATE_FAILED';
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_shared_group_atomic(text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_shared_group_atomic(text, text, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
