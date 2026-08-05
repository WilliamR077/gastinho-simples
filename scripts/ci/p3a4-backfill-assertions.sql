\set ON_ERROR_STOP on

DO $$
BEGIN
  IF (SELECT system_key FROM public.user_categories
      WHERE id = '20000000-0000-4000-8000-000000000001') IS DISTINCT FROM 'other' THEN
    RAISE EXCEPTION 'default expense Outros was not backfilled';
  END IF;
  IF (SELECT system_key FROM public.user_categories
      WHERE id = '20000000-0000-4000-8000-000000000002') IS NOT NULL THEN
    RAISE EXCEPTION 'unrelated default expense category received system_key';
  END IF;
  IF (SELECT system_key FROM public.user_categories
      WHERE id = '20000000-0000-4000-8000-000000000003') IS NOT NULL THEN
    RAISE EXCEPTION 'custom expense Outros received system_key';
  END IF;
  IF (SELECT system_key FROM public.user_income_categories
      WHERE id = '30000000-0000-4000-8000-000000000001') IS DISTINCT FROM 'other' THEN
    RAISE EXCEPTION 'default income Outros was not backfilled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_income_categories
    WHERE id IN (
      '30000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000003'
    ) AND system_key IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'custom/unrelated income category received system_key';
  END IF;
  IF (SELECT category::text FROM public.budget_goals
      WHERE id = '40000000-0000-4000-8000-000000000001')
      IS DISTINCT FROM '20000000-0000-4000-8000-000000000004' THEN
    RAISE EXCEPTION 'unique textual legacy goal was not normalized to its exact UUID';
  END IF;
END;
$$;

UPDATE public.user_categories
SET name = 'Fallback renomeado'
WHERE id = '20000000-0000-4000-8000-000000000001';
UPDATE public.user_income_categories
SET name = 'Fallback de receita renomeado'
WHERE id = '30000000-0000-4000-8000-000000000001';

DO $$
BEGIN
  IF (SELECT system_key FROM public.user_categories
      WHERE id = '20000000-0000-4000-8000-000000000001') IS DISTINCT FROM 'other' THEN
    RAISE EXCEPTION 'renaming removed stable system identity';
  END IF;
  IF (SELECT system_key FROM public.user_income_categories
      WHERE id = '30000000-0000-4000-8000-000000000001') IS DISTINCT FROM 'other' THEN
    RAISE EXCEPTION 'renaming removed stable income system identity';
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    UPDATE public.user_categories
    SET system_key = 'invalid'
    WHERE id = '20000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'system_key check accepted invalid value';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE public.user_income_categories
    SET system_key = 'invalid'
    WHERE id = '30000000-0000-4000-8000-000000000003';
    RAISE EXCEPTION 'income system_key check accepted invalid value';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.user_categories
      (user_id, name, icon, is_default, system_key)
    VALUES
      ('10000000-0000-4000-8000-000000000001', 'Segundo fallback', '📦', false, 'other');
    RAISE EXCEPTION 'partial unique index accepted a second system fallback';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.user_income_categories
      (user_id, name, icon, is_default, system_key)
    VALUES
      ('10000000-0000-4000-8000-000000000001', 'Segundo fallback de receita', '📦', false, 'other');
    RAISE EXCEPTION 'income partial unique index accepted a second system fallback';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END;
$$;
