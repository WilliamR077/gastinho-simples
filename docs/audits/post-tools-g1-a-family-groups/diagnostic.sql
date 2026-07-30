WITH
normalized_groups AS (
  SELECT
    g.id,
    g.name,
    g.created_by,
    g.created_at,
    g.updated_at,
    g.is_active,
    translate(
      lower(regexp_replace(btrim(g.name), '\s+', ' ', 'g')),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ) AS normalized_name
  FROM public.shared_groups AS g
),
membership_rows AS (
  SELECT
    m.id,
    m.group_id,
    m.user_id,
    m.role::text AS role,
    m.joined_at,
    (u.id IS NOT NULL) AS user_exists
  FROM public.shared_group_members AS m
  LEFT JOIN auth.users AS u
    ON u.id = m.user_id
),
membership_per_user AS (
  SELECT
    mr.group_id,
    mr.user_id,
    count(*) AS row_count
  FROM membership_rows AS mr
  GROUP BY mr.group_id, mr.user_id
),
membership_aggregates AS (
  SELECT
    ng.id AS group_id,
    count(mr.id) AS membership_total,
    count(DISTINCT mr.user_id) AS distinct_member_total,
    count(*) FILTER (WHERE mr.role = 'owner') AS owner_total,
    count(*) FILTER (WHERE mr.role = 'admin') AS admin_total,
    count(*) FILTER (WHERE mr.role = 'member') AS member_role_total,
    count(*) FILTER (
      WHERE mr.role NOT IN ('owner', 'admin', 'member')
    ) AS invalid_role_total,
    count(*) FILTER (WHERE mr.user_exists IS FALSE) AS missing_auth_user_total,
    coalesce(bool_or(mr.user_id = ng.created_by), false)
      AS creator_membership_exists,
    max(mr.role) FILTER (WHERE mr.user_id = ng.created_by)
      AS creator_membership_role,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'membership_id', mr.id,
          'user_id', mr.user_id,
          'role', mr.role,
          'joined_at', mr.joined_at,
          'membership_status', NULL,
          'user_exists', mr.user_exists
        )
        ORDER BY mr.joined_at NULLS FIRST, mr.id
      ) FILTER (WHERE mr.id IS NOT NULL),
      '[]'::jsonb
    ) AS memberships
  FROM normalized_groups AS ng
  LEFT JOIN membership_rows AS mr
    ON mr.group_id = ng.id
  GROUP BY ng.id, ng.created_by
),
duplicate_aggregates AS (
  SELECT
    mpu.group_id,
    count(*) FILTER (WHERE mpu.row_count > 1) AS duplicate_user_total,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', mpu.user_id,
          'membership_rows', mpu.row_count
        )
        ORDER BY mpu.user_id
      ) FILTER (WHERE mpu.row_count > 1),
      '[]'::jsonb
    ) AS duplicate_memberships
  FROM membership_per_user AS mpu
  GROUP BY mpu.group_id
),
expense_counts AS (
  SELECT e.shared_group_id AS group_id, count(*) AS row_count
  FROM public.expenses AS e
  WHERE e.shared_group_id IS NOT NULL
  GROUP BY e.shared_group_id
),
income_counts AS (
  SELECT i.shared_group_id AS group_id, count(*) AS row_count
  FROM public.incomes AS i
  WHERE i.shared_group_id IS NOT NULL
  GROUP BY i.shared_group_id
),
recurring_expense_counts AS (
  SELECT re.shared_group_id AS group_id, count(*) AS row_count
  FROM public.recurring_expenses AS re
  WHERE re.shared_group_id IS NOT NULL
  GROUP BY re.shared_group_id
),
recurring_income_counts AS (
  SELECT ri.shared_group_id AS group_id, count(*) AS row_count
  FROM public.recurring_incomes AS ri
  WHERE ri.shared_group_id IS NOT NULL
  GROUP BY ri.shared_group_id
),
goal_counts AS (
  SELECT bg.shared_group_id AS group_id, count(*) AS row_count
  FROM public.budget_goals AS bg
  WHERE bg.shared_group_id IS NOT NULL
  GROUP BY bg.shared_group_id
),
split_counts AS (
  SELECT e.shared_group_id AS group_id, count(*) AS row_count
  FROM public.expense_splits AS es
  JOIN public.expenses AS e
    ON e.id = es.expense_id
  WHERE e.shared_group_id IS NOT NULL
  GROUP BY e.shared_group_id
),
goal_alert_counts AS (
  SELECT bg.shared_group_id AS group_id, count(*) AS row_count
  FROM public.budget_goal_alerts AS bga
  JOIN public.budget_goals AS bg
    ON bg.id = bga.goal_id
  WHERE bg.shared_group_id IS NOT NULL
  GROUP BY bg.shared_group_id
),
assessed AS (
  SELECT
    ng.*,
    ma.membership_total,
    ma.distinct_member_total,
    ma.owner_total,
    ma.admin_total,
    ma.member_role_total,
    ma.invalid_role_total,
    ma.missing_auth_user_total,
    ma.creator_membership_exists,
    ma.creator_membership_role,
    ma.memberships,
    coalesce(da.duplicate_user_total, 0) AS duplicate_user_total,
    coalesce(da.duplicate_memberships, '[]'::jsonb)
      AS duplicate_memberships,
    coalesce(ec.row_count, 0) AS expense_total,
    coalesce(ic.row_count, 0) AS income_total,
    coalesce(rec.row_count, 0) AS recurring_expense_total,
    coalesce(ric.row_count, 0) AS recurring_income_total,
    coalesce(gc.row_count, 0) AS goal_total,
    coalesce(sc.row_count, 0) AS split_total,
    coalesce(gac.row_count, 0) AS goal_alert_total,
    (NOT ma.creator_membership_exists) AS creator_membership_missing,
    (
      ma.creator_membership_exists
      AND ma.creator_membership_role IS DISTINCT FROM 'owner'
    ) AS creator_not_owner,
    (ma.owner_total = 0) AS owner_missing,
    (ma.owner_total > 1) AS multiple_owners,
    (
      ma.owner_total = 1
      AND ma.creator_membership_role IS DISTINCT FROM 'owner'
    ) AS owner_mismatch_created_by,
    (coalesce(da.duplicate_user_total, 0) > 0) AS duplicate_membership,
    (ma.membership_total <> ma.distinct_member_total)
      AS membership_count_inconsistent,
    (ma.membership_total = 0) AS group_has_no_members,
    (ma.invalid_role_total > 0) AS invalid_membership_role,
    (ma.missing_auth_user_total > 0) AS membership_user_missing,
    (
      NOT ma.creator_membership_exists
      OR ma.creator_membership_role IS DISTINCT FROM 'owner'
      OR ma.owner_total <> 1
      OR coalesce(da.duplicate_user_total, 0) > 0
      OR ma.invalid_role_total > 0
      OR ma.missing_auth_user_total > 0
      OR ma.membership_total = 0
    ) AS structurally_inconsistent
  FROM normalized_groups AS ng
  JOIN membership_aggregates AS ma
    ON ma.group_id = ng.id
  LEFT JOIN duplicate_aggregates AS da
    ON da.group_id = ng.id
  LEFT JOIN expense_counts AS ec
    ON ec.group_id = ng.id
  LEFT JOIN income_counts AS ic
    ON ic.group_id = ng.id
  LEFT JOIN recurring_expense_counts AS rec
    ON rec.group_id = ng.id
  LEFT JOIN recurring_income_counts AS ric
    ON ric.group_id = ng.id
  LEFT JOIN goal_counts AS gc
    ON gc.group_id = ng.id
  LEFT JOIN split_counts AS sc
    ON sc.group_id = ng.id
  LEFT JOIN goal_alert_counts AS gac
    ON gac.group_id = ng.id
),
flagged AS (
  SELECT
    a.*,
    array_remove(
      ARRAY[
        CASE
          WHEN a.creator_membership_missing
          THEN 'MISSING_CREATOR_MEMBERSHIP'
        END,
        CASE WHEN a.owner_missing THEN 'MISSING_OWNER' END,
        CASE WHEN a.multiple_owners THEN 'MULTIPLE_OWNERS' END,
        CASE
          WHEN a.creator_not_owner
          THEN 'CREATOR_NOT_OWNER'
        END,
        CASE
          WHEN a.owner_mismatch_created_by
          THEN 'OWNER_MISMATCH_CREATED_BY'
        END,
        CASE
          WHEN a.duplicate_membership
          THEN 'DUPLICATE_MEMBERSHIP'
        END,
        CASE
          WHEN a.invalid_membership_role
          THEN 'INVALID_MEMBERSHIP_ROLE'
        END,
        CASE
          WHEN a.membership_user_missing
          THEN 'MEMBERSHIP_USER_MISSING'
        END,
        CASE
          WHEN a.group_has_no_members
          THEN 'GROUP_HAS_NO_MEMBERS'
        END
      ]::text[],
      NULL
    ) AS structural_flags
  FROM assessed AS a
),
classified AS (
  SELECT
    f.*,
    CASE
      WHEN cardinality(f.structural_flags) = 0 THEN 'CONSISTENT'
      WHEN cardinality(f.structural_flags) > 1
        THEN 'MULTIPLE_INCONSISTENCIES'
      ELSE f.structural_flags[1]
    END AS classification
  FROM flagged AS f
),
scope_summary AS (
  SELECT
    count(*) FILTER (WHERE c.normalized_name = 'familia')
      AS family_group_count,
    count(*) FILTER (
      WHERE c.structurally_inconsistent
        AND c.normalized_name <> 'familia'
    ) AS other_inconsistent_group_count
  FROM classified AS c
)
SELECT
  jsonb_build_object(
    'identification', jsonb_build_object(
      'group_id', c.id,
      'name', c.name,
      'normalized_name', c.normalized_name,
      'is_family_name', c.normalized_name = 'familia',
      'created_by', c.created_by,
      'created_at', c.created_at,
      'updated_at', c.updated_at,
      'is_active', c.is_active
    ),
    'memberships', jsonb_build_object(
      'membership_status_supported', false,
      'total', c.membership_total,
      'distinct_users', c.distinct_member_total,
      'active', NULL,
      'inactive', NULL,
      'owners', c.owner_total,
      'active_owners', NULL,
      'admins', c.admin_total,
      'members', c.member_role_total,
      'creator_has_membership', c.creator_membership_exists,
      'creator_role', c.creator_membership_role,
      'creator_status', CASE
        WHEN c.creator_membership_exists THEN 'NOT_MODELED'
        ELSE NULL
      END,
      'duplicate_users', c.duplicate_user_total,
      'duplicate_memberships', c.duplicate_memberships,
      'invalid_roles', c.invalid_role_total,
      'invalid_statuses', NULL,
      'missing_auth_users', c.missing_auth_user_total,
      'facts', c.memberships
    ),
    'integrity', jsonb_build_object(
      'creator_membership_missing', c.creator_membership_missing,
      'creator_membership_inactive', NULL,
      'creator_not_owner', c.creator_not_owner,
      'owner_missing', c.owner_missing,
      'multiple_owners', c.multiple_owners,
      'inactive_owner', NULL,
      'owner_mismatch_created_by', c.owner_mismatch_created_by,
      'duplicate_membership', c.duplicate_membership,
      'group_has_no_members', c.group_has_no_members,
      'group_has_no_active_members', NULL,
      'membership_count_inconsistent',
        c.membership_count_inconsistent,
      'invalid_membership_role', c.invalid_membership_role,
      'invalid_membership_status', NULL,
      'membership_user_missing', c.membership_user_missing,
      'membership_group_missing', false,
      'structurally_inconsistent', c.structurally_inconsistent,
      'status_flags_are_not_applicable', true
    ),
    'dependencies', jsonb_build_object(
      'expenses', c.expense_total,
      'incomes', c.income_total,
      'recurring_expenses', c.recurring_expense_total,
      'recurring_incomes', c.recurring_income_total,
      'budget_goals', c.goal_total,
      'expense_splits_via_expenses', c.split_total,
      'budget_goal_alerts_via_budget_goals', c.goal_alert_total
    ),
    'classification', jsonb_build_object(
      'value', c.classification,
      'flags', to_jsonb(c.structural_flags)
    ),
    'scope_checks', jsonb_build_object(
      'family_group_count', ss.family_group_count,
      'expected_family_group_count', 4,
      'family_group_count_matches_expectation',
        ss.family_group_count = 4,
      'other_inconsistent_group_count',
        ss.other_inconsistent_group_count,
      'stop_for_manual_review',
        ss.family_group_count <> 4
        OR ss.other_inconsistent_group_count > 0
    )
  ) AS diagnostic
FROM classified AS c
CROSS JOIN scope_summary AS ss
WHERE c.normalized_name = 'familia'
   OR c.structurally_inconsistent
ORDER BY
  (c.normalized_name = 'familia') DESC,
  c.name,
  c.id;
