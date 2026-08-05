-- Read-only preflight. The real repair must run separately after infrastructure smoke.
WITH candidates AS (
  SELECT e.user_id, e.category_id AS current_category_id,
    count(*) AS expense_count, sum(e.amount) AS total_amount,
    min(e.expense_date) AS first_date, max(e.expense_date) AS last_date,
    bool_and(e.category_name = 'Caldas Novas') AS snapshot_name_matches,
    bool_and(e.category_icon = '✈️') AS snapshot_icon_matches,
    bool_and(uc.is_default AND uc.system_key = 'other') AS points_to_system_other
  FROM public.expenses AS e
  JOIN public.user_categories AS uc ON uc.id = e.category_id AND uc.user_id = e.user_id
  WHERE e.category_name = 'Caldas Novas'
    AND e.category_icon = '✈️'
    AND e.expense_date >= DATE '2026-02-01' AND e.expense_date < DATE '2026-03-01'
  GROUP BY e.user_id, e.category_id
)
SELECT *, expense_count = 9 AND total_amount = 279.90 AS audited_signature_matches
FROM candidates
ORDER BY user_id, current_category_id;
