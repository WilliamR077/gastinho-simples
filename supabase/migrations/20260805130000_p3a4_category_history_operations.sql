-- P3-A4: preserve category history and make destructive operations atomic.
-- budget_goals.category is a current category reference: UUID references (and
-- legacy name references that exactly match the source) move on substitution.

ALTER TABLE public.user_categories ADD COLUMN IF NOT EXISTS system_key text;
ALTER TABLE public.user_income_categories ADD COLUMN IF NOT EXISTS system_key text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_categories
    WHERE is_default AND lower(btrim(name)) = 'outros'
    GROUP BY user_id HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'P3-A4 aborted: ambiguous default expense fallback category'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_income_categories
    WHERE is_default AND lower(btrim(name)) = 'outros'
    GROUP BY user_id HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'P3-A4 aborted: ambiguous default income fallback category'; END IF;
END;
$$;

UPDATE public.user_categories SET system_key = 'other'
WHERE is_default AND lower(btrim(name)) = 'outros' AND system_key IS NULL;
UPDATE public.user_income_categories SET system_key = 'other'
WHERE is_default AND lower(btrim(name)) = 'outros' AND system_key IS NULL;

ALTER TABLE public.user_categories ADD CONSTRAINT user_categories_system_key_check
  CHECK (system_key IS NULL OR system_key = 'other');
ALTER TABLE public.user_income_categories ADD CONSTRAINT user_income_categories_system_key_check
  CHECK (system_key IS NULL OR system_key = 'other');
CREATE UNIQUE INDEX user_categories_one_system_key_per_user
  ON public.user_categories (user_id, system_key) WHERE system_key = 'other';
CREATE UNIQUE INDEX user_income_categories_one_system_key_per_user
  ON public.user_income_categories (user_id, system_key) WHERE system_key = 'other';

CREATE OR REPLACE FUNCTION public.p3a4_category_lock_key(p_user_id uuid, p_kind text)
RETURNS bigint LANGUAGE sql IMMUTABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT hashtextextended(p_user_id::text || ':p3a4-category:' || p_kind, 0) $$;

CREATE OR REPLACE FUNCTION public.p3a4_lock_category_scope(p_user_id uuid, p_kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_user_id IS NULL OR p_kind NOT IN ('expense', 'income') THEN
    RAISE EXCEPTION 'invalid category lock scope' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(public.p3a4_category_lock_key(p_user_id, p_kind));
END;
$$;

CREATE OR REPLACE FUNCTION public.p3a4_lock_budget_goal_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_user_id uuid := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.user_id ELSE NULL END;
  v_new_user_id uuid := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.user_id ELSE NULL END;
  v_old_kind text := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') AND OLD.type::text IN ('income_category', 'income_monthly_total') THEN 'income' ELSE 'expense' END;
  v_new_kind text := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') AND NEW.type::text IN ('income_category', 'income_monthly_total') THEN 'income' ELSE 'expense' END;
  v_scope record;
BEGIN
  FOR v_scope IN
    SELECT DISTINCT candidate.user_id, candidate.kind,
      public.p3a4_category_lock_key(candidate.user_id, candidate.kind) AS lock_key
    FROM (
      SELECT v_old_user_id AS user_id, v_old_kind AS kind
      UNION ALL SELECT v_new_user_id, v_new_kind
    ) AS candidate
    WHERE candidate.user_id IS NOT NULL
    ORDER BY lock_key
  LOOP
    PERFORM public.p3a4_lock_category_scope(v_scope.user_id, v_scope.kind);
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS p3a4_budget_goal_write_lock ON public.budget_goals;
CREATE TRIGGER p3a4_budget_goal_write_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.budget_goals
FOR EACH ROW EXECUTE FUNCTION public.p3a4_lock_budget_goal_write();

-- Normalize only legacy text with exactly one catalog match. Remaining
-- non-UUID values are deliberately left for manual review.
WITH expense_matches AS (
  SELECT bg.id, (array_agg(uc.id ORDER BY uc.id))[1] AS category_id
  FROM public.budget_goals bg
  JOIN public.user_categories uc ON uc.user_id = bg.user_id
   AND (lower(btrim(bg.category::text)) = lower(btrim(uc.name))
    OR lower(btrim(bg.category::text)) = replace(
      translate(lower(btrim(uc.name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'), ' ', '_'))
  WHERE bg.type = 'category' AND bg.category IS NOT NULL
    AND bg.category::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  GROUP BY bg.id HAVING count(DISTINCT uc.id) = 1
), income_matches AS (
  SELECT bg.id, (array_agg(uc.id ORDER BY uc.id))[1] AS category_id
  FROM public.budget_goals bg
  JOIN public.user_income_categories uc ON uc.user_id = bg.user_id
   AND (lower(btrim(bg.category::text)) = lower(btrim(uc.name))
    OR lower(btrim(bg.category::text)) = replace(
      translate(lower(btrim(uc.name)), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc'), ' ', '_'))
  WHERE bg.type = 'income_category' AND bg.category IS NOT NULL
    AND bg.category::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  GROUP BY bg.id HAVING count(DISTINCT uc.id) = 1
), matches AS (
  SELECT * FROM expense_matches UNION ALL SELECT * FROM income_matches
)
UPDATE public.budget_goals bg SET category = matches.category_id::text
FROM matches WHERE bg.id = matches.id;

CREATE OR REPLACE FUNCTION public.p3a4_has_ambiguous_legacy_goals(p_user_id uuid, p_kind text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.budget_goals bg
    WHERE bg.user_id = p_user_id
      AND bg.type::text = CASE p_kind WHEN 'expense' THEN 'category' ELSE 'income_category' END
      AND bg.category IS NOT NULL
      AND bg.category::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  )
$$;

CREATE OR REPLACE FUNCTION public.p3a4_category_reference_counts(
  p_kind text,
  p_category_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_transactions bigint;
  v_recurring bigint;
  v_goals bigint;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_kind NOT IN ('expense', 'income') THEN RAISE EXCEPTION 'invalid category kind' USING ERRCODE = '22023'; END IF;
  PERFORM public.p3a4_lock_category_scope(v_user_id, p_kind);

  IF p_kind = 'expense' THEN
    PERFORM 1 FROM public.user_categories WHERE id = p_category_id AND user_id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'category not found' USING ERRCODE = 'P0002'; END IF;
    SELECT count(*) INTO v_transactions FROM public.expenses
      WHERE user_id = v_user_id AND category_id = p_category_id;
    SELECT count(*) INTO v_recurring FROM public.recurring_expenses
      WHERE user_id = v_user_id AND category_id = p_category_id;
    SELECT count(*) INTO v_goals FROM public.budget_goals
      WHERE user_id = v_user_id AND type = 'category' AND category = p_category_id::text;
  ELSE
    PERFORM 1 FROM public.user_income_categories WHERE id = p_category_id AND user_id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'category not found' USING ERRCODE = 'P0002'; END IF;
    SELECT count(*) INTO v_transactions FROM public.incomes
      WHERE user_id = v_user_id AND income_category_id = p_category_id;
    SELECT count(*) INTO v_recurring FROM public.recurring_incomes
      WHERE user_id = v_user_id AND income_category_id = p_category_id;
    SELECT count(*) INTO v_goals FROM public.budget_goals
      WHERE user_id = v_user_id AND type = 'income_category' AND category = p_category_id::text;
  END IF;

  RETURN jsonb_build_object(
    'transactions', v_transactions,
    'recurring', v_recurring,
    'goals', v_goals,
    'total', v_transactions + v_recurring + v_goals
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.p3a4_archive_category(
  p_kind text,
  p_category_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_counts jsonb;
  v_system_key text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_kind NOT IN ('expense', 'income') THEN RAISE EXCEPTION 'invalid category kind' USING ERRCODE = '22023'; END IF;
  PERFORM public.p3a4_lock_category_scope(v_user_id, p_kind);
  IF p_kind = 'expense' THEN
    SELECT system_key INTO v_system_key FROM public.user_categories WHERE id = p_category_id AND user_id = v_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'category not found' USING ERRCODE = 'P0002'; END IF;
    IF v_system_key = 'other' THEN RAISE EXCEPTION 'system fallback category cannot be archived' USING ERRCODE = '22023'; END IF;
    v_counts := public.p3a4_category_reference_counts(p_kind, p_category_id);
    UPDATE public.user_categories SET is_active = false WHERE id = p_category_id AND user_id = v_user_id;
  ELSIF p_kind = 'income' THEN
    SELECT system_key INTO v_system_key FROM public.user_income_categories WHERE id = p_category_id AND user_id = v_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'category not found' USING ERRCODE = 'P0002'; END IF;
    IF v_system_key = 'other' THEN RAISE EXCEPTION 'system fallback category cannot be archived' USING ERRCODE = '22023'; END IF;
    v_counts := public.p3a4_category_reference_counts(p_kind, p_category_id);
    UPDATE public.user_income_categories SET is_active = false WHERE id = p_category_id AND user_id = v_user_id;
  ELSE
    RAISE EXCEPTION 'invalid category kind' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('category_id', p_category_id, 'archived', true, 'references', v_counts);
END;
$$;

CREATE OR REPLACE FUNCTION public.p3a4_replace_category(
  p_kind text,
  p_source_category_id uuid,
  p_destination_category_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_source_system_key text;
  v_source_found boolean;
  v_destination_name text;
  v_destination_icon text;
  v_destination_active boolean;
  v_counts jsonb;
  v_transactions bigint := 0;
  v_recurring bigint := 0;
  v_goals bigint := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_kind NOT IN ('expense', 'income') THEN RAISE EXCEPTION 'invalid category kind' USING ERRCODE = '22023'; END IF;
  IF p_source_category_id = p_destination_category_id THEN
    RAISE EXCEPTION 'source and destination must differ' USING ERRCODE = '22023';
  END IF;
  PERFORM public.p3a4_lock_category_scope(v_user_id, p_kind);
  IF public.p3a4_has_ambiguous_legacy_goals(v_user_id, p_kind) THEN
    RAISE EXCEPTION 'LEGACY_GOAL_REFERENCE_REQUIRES_REVIEW' USING ERRCODE = 'P0001';
  END IF;

  IF p_kind = 'expense' THEN
    PERFORM 1 FROM public.user_categories
      WHERE user_id = v_user_id AND id IN (p_source_category_id, p_destination_category_id)
      ORDER BY id FOR UPDATE;
    SELECT system_key, true INTO v_source_system_key, v_source_found
      FROM public.user_categories WHERE id = p_source_category_id AND user_id = v_user_id;
    SELECT name, icon, is_active INTO v_destination_name, v_destination_icon, v_destination_active
      FROM public.user_categories WHERE id = p_destination_category_id AND user_id = v_user_id;
    IF NOT coalesce(v_source_found, false) OR v_destination_name IS NULL THEN RAISE EXCEPTION 'category not found' USING ERRCODE = 'P0002'; END IF;
    IF v_source_system_key = 'other' THEN RAISE EXCEPTION 'system fallback category cannot be replaced' USING ERRCODE = '22023'; END IF;
    IF NOT v_destination_active THEN RAISE EXCEPTION 'destination category must be active' USING ERRCODE = '22023'; END IF;
    v_counts := public.p3a4_category_reference_counts(p_kind, p_source_category_id);
    UPDATE public.expenses SET category_id = p_destination_category_id,
      category_name = v_destination_name, category_icon = v_destination_icon
      WHERE user_id = v_user_id AND category_id = p_source_category_id;
    GET DIAGNOSTICS v_transactions = ROW_COUNT;
    UPDATE public.recurring_expenses SET category_id = p_destination_category_id,
      category_name = v_destination_name, category_icon = v_destination_icon
      WHERE user_id = v_user_id AND category_id = p_source_category_id;
    GET DIAGNOSTICS v_recurring = ROW_COUNT;
    UPDATE public.budget_goals SET category = p_destination_category_id::text
      WHERE user_id = v_user_id AND type = 'category'
        AND category = p_source_category_id::text;
    GET DIAGNOSTICS v_goals = ROW_COUNT;
    UPDATE public.user_categories SET is_active = false WHERE id = p_source_category_id AND user_id = v_user_id;
  ELSIF p_kind = 'income' THEN
    PERFORM 1 FROM public.user_income_categories
      WHERE user_id = v_user_id AND id IN (p_source_category_id, p_destination_category_id)
      ORDER BY id FOR UPDATE;
    v_source_found := false;
    SELECT system_key, true INTO v_source_system_key, v_source_found
      FROM public.user_income_categories WHERE id = p_source_category_id AND user_id = v_user_id;
    SELECT name, icon, is_active INTO v_destination_name, v_destination_icon, v_destination_active
      FROM public.user_income_categories WHERE id = p_destination_category_id AND user_id = v_user_id;
    IF NOT coalesce(v_source_found, false) OR v_destination_name IS NULL THEN RAISE EXCEPTION 'category not found' USING ERRCODE = 'P0002'; END IF;
    IF v_source_system_key = 'other' THEN RAISE EXCEPTION 'system fallback category cannot be replaced' USING ERRCODE = '22023'; END IF;
    IF NOT v_destination_active THEN RAISE EXCEPTION 'destination category must be active' USING ERRCODE = '22023'; END IF;
    v_counts := public.p3a4_category_reference_counts(p_kind, p_source_category_id);
    UPDATE public.incomes SET income_category_id = p_destination_category_id,
      category_name = v_destination_name, category_icon = v_destination_icon
      WHERE user_id = v_user_id AND income_category_id = p_source_category_id;
    GET DIAGNOSTICS v_transactions = ROW_COUNT;
    UPDATE public.recurring_incomes SET income_category_id = p_destination_category_id,
      category_name = v_destination_name, category_icon = v_destination_icon
      WHERE user_id = v_user_id AND income_category_id = p_source_category_id;
    GET DIAGNOSTICS v_recurring = ROW_COUNT;
    UPDATE public.budget_goals SET category = p_destination_category_id::text
      WHERE user_id = v_user_id AND type = 'income_category'
        AND category = p_source_category_id::text;
    GET DIAGNOSTICS v_goals = ROW_COUNT;
    UPDATE public.user_income_categories SET is_active = false WHERE id = p_source_category_id AND user_id = v_user_id;
  ELSE
    RAISE EXCEPTION 'invalid category kind' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'source_category_id', p_source_category_id,
    'destination_category_id', p_destination_category_id,
    'source_archived', true,
    'references_before', v_counts,
    'updated', jsonb_build_object('transactions', v_transactions, 'recurring', v_recurring, 'goals', v_goals,
      'total', v_transactions + v_recurring + v_goals)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.p3a4_delete_category(
  p_kind text,
  p_category_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_system_key text;
  v_is_default boolean;
  v_is_active boolean;
  v_counts jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501'; END IF;
  IF p_kind NOT IN ('expense', 'income') THEN RAISE EXCEPTION 'invalid category kind' USING ERRCODE = '22023'; END IF;
  PERFORM public.p3a4_lock_category_scope(v_user_id, p_kind);
  IF public.p3a4_has_ambiguous_legacy_goals(v_user_id, p_kind) THEN
    RAISE EXCEPTION 'LEGACY_GOAL_REFERENCE_REQUIRES_REVIEW' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind = 'expense' THEN
    SELECT system_key, is_default, is_active INTO v_system_key, v_is_default, v_is_active
      FROM public.user_categories WHERE id = p_category_id AND user_id = v_user_id FOR UPDATE;
  ELSIF p_kind = 'income' THEN
    SELECT system_key, is_default, is_active INTO v_system_key, v_is_default, v_is_active
      FROM public.user_income_categories WHERE id = p_category_id AND user_id = v_user_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'invalid category kind' USING ERRCODE = '22023';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'category not found' USING ERRCODE = 'P0002'; END IF;
  IF v_is_default OR v_system_key = 'other' THEN RAISE EXCEPTION 'system/default category cannot be deleted' USING ERRCODE = '22023'; END IF;
  IF v_is_active THEN RAISE EXCEPTION 'category must be archived first' USING ERRCODE = '22023'; END IF;
  v_counts := public.p3a4_category_reference_counts(p_kind, p_category_id);
  IF (v_counts->>'total')::bigint <> 0 THEN RAISE EXCEPTION 'category still has references' USING ERRCODE = '23503'; END IF;
  IF p_kind = 'expense' THEN
    DELETE FROM public.user_categories WHERE id = p_category_id AND user_id = v_user_id;
  ELSE
    DELETE FROM public.user_income_categories WHERE id = p_category_id AND user_id = v_user_id;
  END IF;
  RETURN jsonb_build_object('category_id', p_category_id, 'deleted', true, 'references', v_counts);
END;
$$;

REVOKE ALL ON FUNCTION public.p3a4_category_lock_key(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.p3a4_lock_category_scope(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.p3a4_lock_budget_goal_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.p3a4_has_ambiguous_legacy_goals(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.p3a4_category_reference_counts(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.p3a4_archive_category(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.p3a4_replace_category(text, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.p3a4_delete_category(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.p3a4_category_reference_counts(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.p3a4_archive_category(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.p3a4_replace_category(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.p3a4_delete_category(text, uuid) TO authenticated;
