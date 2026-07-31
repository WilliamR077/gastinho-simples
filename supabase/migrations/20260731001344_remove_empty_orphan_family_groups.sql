BEGIN;

DO $$
DECLARE
  target_group_ids constant uuid[] := ARRAY[
    '35d36f8d-1d3c-4cc4-896a-46872bbe9b75'::uuid,
    '55c7716c-1e38-48b9-978f-d16b52305310'::uuid,
    '5d77b853-ff7f-4247-bc66-09b4ae32cf55'::uuid,
    'cf7d4e2a-b925-404e-9ecc-9f814adf15b0'::uuid
  ];
  expected_creator constant uuid :=
    '65e6ec36-089b-41f9-af7a-eaba92e30eff'::uuid;
  target_count bigint;
  creator_mismatch_count bigint;
  name_mismatch_count bigint;
  inactive_count bigint;
  membership_count bigint;
  owner_count bigint;
  admin_count bigint;
  member_count bigint;
  expense_count bigint;
  income_count bigint;
  recurring_expense_count bigint;
  recurring_income_count bigint;
  budget_goal_count bigint;
  expense_split_count bigint;
  budget_goal_alert_count bigint;
  deleted_count bigint;
BEGIN
  PERFORM 1
  FROM public.shared_groups AS g
  WHERE g.id = ANY(target_group_ids)
  ORDER BY g.id
  FOR UPDATE;

  SELECT
    count(*),
    count(*) FILTER (WHERE g.created_by <> expected_creator),
    count(*) FILTER (
      WHERE translate(
        lower(regexp_replace(btrim(g.name), '\s+', ' ', 'g')),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'
      ) <> 'familia'
    ),
    count(*) FILTER (WHERE g.is_active IS DISTINCT FROM true)
  INTO
    target_count,
    creator_mismatch_count,
    name_mismatch_count,
    inactive_count
  FROM public.shared_groups AS g
  WHERE g.id = ANY(target_group_ids);

  IF target_count <> 4 THEN
    RAISE EXCEPTION
      'G1-B aborted: target_group_count expected 4, found %',
      target_count;
  END IF;

  IF creator_mismatch_count <> 0 THEN
    RAISE EXCEPTION
      'G1-B aborted: expected_creator precondition failed for % target group(s)',
      creator_mismatch_count;
  END IF;

  IF name_mismatch_count <> 0 THEN
    RAISE EXCEPTION
      'G1-B aborted: normalized_group_name precondition failed for % target group(s)',
      name_mismatch_count;
  END IF;

  IF inactive_count <> 0 THEN
    RAISE EXCEPTION
      'G1-B aborted: active_group precondition failed for % target group(s)',
      inactive_count;
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE m.role = 'owner'),
    count(*) FILTER (WHERE m.role = 'admin'),
    count(*) FILTER (WHERE m.role = 'member')
  INTO
    membership_count,
    owner_count,
    admin_count,
    member_count
  FROM public.shared_group_members AS m
  WHERE m.group_id = ANY(target_group_ids);

  IF membership_count <> 0
     OR owner_count <> 0
     OR admin_count <> 0
     OR member_count <> 0 THEN
    RAISE EXCEPTION
      'G1-B aborted: zero_memberships precondition failed; found % membership row(s)',
      membership_count;
  END IF;

  SELECT count(*)
  INTO expense_count
  FROM public.expenses AS e
  WHERE e.shared_group_id = ANY(target_group_ids);

  IF expense_count <> 0 THEN
    RAISE EXCEPTION
      'G1-B aborted: zero_expenses precondition failed; found % row(s)',
      expense_count;
  END IF;

  SELECT count(*)
  INTO income_count
  FROM public.incomes AS i
  WHERE i.shared_group_id = ANY(target_group_ids);

  IF income_count <> 0 THEN
    RAISE EXCEPTION
      'G1-B aborted: zero_incomes precondition failed; found % row(s)',
      income_count;
  END IF;

  SELECT count(*)
  INTO recurring_expense_count
  FROM public.recurring_expenses AS re
  WHERE re.shared_group_id = ANY(target_group_ids);

  IF recurring_expense_count <> 0 THEN
    RAISE EXCEPTION
      'G1-B aborted: zero_recurring_expenses precondition failed; found % row(s)',
      recurring_expense_count;
  END IF;

  SELECT count(*)
  INTO recurring_income_count
  FROM public.recurring_incomes AS ri
  WHERE ri.shared_group_id = ANY(target_group_ids);

  IF recurring_income_count <> 0 THEN
    RAISE EXCEPTION
      'G1-B aborted: zero_recurring_incomes precondition failed; found % row(s)',
      recurring_income_count;
  END IF;

  SELECT count(*)
  INTO budget_goal_count
  FROM public.budget_goals AS bg
  WHERE bg.shared_group_id = ANY(target_group_ids);

  IF budget_goal_count <> 0 THEN
    RAISE EXCEPTION
      'G1-B aborted: zero_budget_goals precondition failed; found % row(s)',
      budget_goal_count;
  END IF;

  SELECT count(*)
  INTO expense_split_count
  FROM public.expense_splits AS es
  JOIN public.expenses AS e
    ON e.id = es.expense_id
  WHERE e.shared_group_id = ANY(target_group_ids);

  IF expense_split_count <> 0 THEN
    RAISE EXCEPTION
      'G1-B aborted: zero_expense_splits precondition failed; found % row(s)',
      expense_split_count;
  END IF;

  SELECT count(*)
  INTO budget_goal_alert_count
  FROM public.budget_goal_alerts AS bga
  JOIN public.budget_goals AS bg
    ON bg.id = bga.goal_id
  WHERE bg.shared_group_id = ANY(target_group_ids);

  IF budget_goal_alert_count <> 0 THEN
    RAISE EXCEPTION
      'G1-B aborted: zero_budget_goal_alerts precondition failed; found % row(s)',
      budget_goal_alert_count;
  END IF;

  DELETE FROM public.shared_groups AS g
  WHERE g.id = ANY(target_group_ids)
    AND g.created_by = expected_creator
    AND translate(
      lower(regexp_replace(btrim(g.name), '\s+', ' ', 'g')),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ) = 'familia'
    AND g.is_active IS TRUE
    AND NOT EXISTS (
      SELECT 1
      FROM public.shared_group_members AS m
      WHERE m.group_id = g.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.expenses AS e
      WHERE e.shared_group_id = g.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.incomes AS i
      WHERE i.shared_group_id = g.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.recurring_expenses AS re
      WHERE re.shared_group_id = g.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.recurring_incomes AS ri
      WHERE ri.shared_group_id = g.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.budget_goals AS bg
      WHERE bg.shared_group_id = g.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.expense_splits AS es
      JOIN public.expenses AS e
        ON e.id = es.expense_id
      WHERE e.shared_group_id = g.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.budget_goal_alerts AS bga
      JOIN public.budget_goals AS bg
        ON bg.id = bga.goal_id
      WHERE bg.shared_group_id = g.id
    );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count <> 4 THEN
    RAISE EXCEPTION
      'G1-B aborted: deleted_group_count expected 4, found %',
      deleted_count;
  END IF;
END;
$$;

COMMIT;
