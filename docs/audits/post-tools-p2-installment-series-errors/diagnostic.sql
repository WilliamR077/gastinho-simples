-- P2-A: diagnóstico manual, exclusivamente read-only. Não executar via Codex.
-- Execute cada statement separadamente no SQL Editor com uma função administrativa
-- autorizada. A saída omite valores financeiros, descrições e identidade pessoal.

-- Catálogo: tipos, nulabilidade e defaults das colunas relevantes.
SELECT
  c.relname AS source_table,
  a.attname AS column_name,
  pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
  a.attnotnull AS is_not_null,
  pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS column_default
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
JOIN pg_catalog.pg_attribute AS a ON a.attrelid = c.oid
LEFT JOIN pg_catalog.pg_attrdef AS d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'public'
  AND c.relname IN ('expenses', 'incomes')
  AND a.attnum > 0
  AND NOT a.attisdropped
  AND a.attname IN (
    'id', 'user_id', 'shared_group_id', 'expense_date', 'income_date',
    'installment_group_id', 'installment_number', 'total_installments',
    'created_at', 'updated_at'
  )
ORDER BY c.relname, a.attnum;

-- Catálogo: constraints, índices, RLS e policies.
SELECT
  c.relname AS source_table,
  con.conname AS object_name,
  con.contype::text AS object_kind,
  pg_catalog.pg_get_constraintdef(con.oid, true) AS definition
FROM pg_catalog.pg_constraint AS con
JOIN pg_catalog.pg_class AS c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('expenses', 'incomes')
ORDER BY c.relname, con.conname;

SELECT schemaname, tablename AS source_table, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public' AND tablename IN ('expenses', 'incomes')
ORDER BY tablename, indexname;

SELECT
  c.relname AS source_table,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('expenses', 'incomes')
ORDER BY c.relname;

SELECT schemaname, tablename AS source_table, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public' AND tablename IN ('expenses', 'incomes')
ORDER BY tablename, policyname;

-- Uma linha JSON por série anômala ou capaz de reproduzir um dos avisos atuais.
WITH source_rows AS (
  SELECT
    'expenses'::text AS source_table,
    e.id,
    e.installment_group_id,
    e.installment_number,
    e.total_installments,
    e.expense_date::date AS transaction_date,
    e.user_id,
    e.shared_group_id,
    (e.card_id IS NOT NULL) AS eligible_for_card_tool
  FROM public.expenses AS e
  WHERE e.installment_group_id IS NOT NULL
  UNION ALL
  SELECT
    'incomes'::text,
    i.id,
    i.installment_group_id,
    i.installment_number,
    i.total_installments,
    (i.income_date AT TIME ZONE 'America/Sao_Paulo')::date,
    i.user_id,
    i.shared_group_id,
    false
  FROM public.incomes AS i
  WHERE i.installment_group_id IS NOT NULL
), ordered_rows AS (
  SELECT
    r.*,
    pg_catalog.lag(r.transaction_date) OVER (
      PARTITION BY r.source_table, r.installment_group_id
      ORDER BY r.installment_number NULLS LAST, r.transaction_date, r.id
    ) AS previous_date
  FROM source_rows AS r
), number_counts AS (
  SELECT source_table, installment_group_id, installment_number, count(*)::integer AS number_count
  FROM source_rows
  WHERE installment_number IS NOT NULL
  GROUP BY source_table, installment_group_id, installment_number
), series_stats AS (
  SELECT
    r.source_table,
    r.installment_group_id,
    CASE WHEN count(DISTINCT r.user_id) = 1 THEN (array_agg(r.user_id))[1] END AS user_id,
    CASE WHEN count(DISTINCT pg_catalog.coalesce(r.shared_group_id::text, '__NULL__')) = 1
      THEN (array_agg(r.shared_group_id))[1] END AS shared_group_id,
    count(*)::integer AS row_count,
    count(DISTINCT r.installment_number)::integer AS distinct_installment_numbers,
    min(r.total_installments) AS expected_total_min,
    max(r.total_installments) AS expected_total_max,
    min(r.installment_number) AS min_installment_number,
    max(r.installment_number) AS max_installment_number,
    min(r.transaction_date) AS first_date,
    max(r.transaction_date) AS last_date,
    count(*) FILTER (WHERE r.installment_number IS NULL OR r.installment_number <= 0)::integer AS invalid_number_count,
    (count(DISTINCT r.total_installments) > 1 OR count(*) FILTER (WHERE r.total_installments IS NULL) > 0) AS divergent_total_installments,
    pg_catalog.coalesce(bool_or(r.installment_number > r.total_installments), false) AS total_less_than_max_number,
    count(*) FILTER (
      WHERE r.total_installments IS NOT NULL AND r.installment_number > r.total_installments
    )::integer AS extra_rows_beyond_expected,
    count(*) FILTER (WHERE r.transaction_date < r.previous_date)::integer AS dates_out_of_order,
    count(*) FILTER (
      WHERE r.previous_date IS NOT NULL
        AND (extract(year FROM r.transaction_date)::integer * 12 + extract(month FROM r.transaction_date)::integer)
          = (extract(year FROM r.previous_date)::integer * 12 + extract(month FROM r.previous_date)::integer)
    )::integer AS repeated_months,
    count(*) FILTER (
      WHERE r.previous_date IS NOT NULL
        AND (extract(year FROM r.transaction_date)::integer * 12 + extract(month FROM r.transaction_date)::integer)
          - (extract(year FROM r.previous_date)::integer * 12 + extract(month FROM r.previous_date)::integer) > 1
    )::integer AS skipped_months,
    count(*) FILTER (
      WHERE r.previous_date IS NOT NULL
        AND (extract(year FROM r.transaction_date)::integer * 12 + extract(month FROM r.transaction_date)::integer)
          - (extract(year FROM r.previous_date)::integer * 12 + extract(month FROM r.previous_date)::integer) < 0
    )::integer AS backwards_months,
    count(DISTINCT r.user_id)::integer AS distinct_user_count,
    count(DISTINCT pg_catalog.coalesce(r.shared_group_id::text, '__NULL__'))::integer AS distinct_shared_group_count,
    bool_or(r.eligible_for_card_tool) AS eligible_for_card_tool
  FROM ordered_rows AS r
  GROUP BY r.source_table, r.installment_group_id
), enriched AS (
  SELECT
    s.*,
    pg_catalog.coalesce((
      SELECT jsonb_agg(n.number_value ORDER BY n.number_value)
      FROM generate_series(
        1,
        CASE WHEN s.expected_total_min = s.expected_total_max AND s.expected_total_min > 0
          THEN s.expected_total_min ELSE 0 END
      ) AS n(number_value)
      WHERE NOT EXISTS (
        SELECT 1 FROM number_counts AS present
        WHERE present.source_table = s.source_table
          AND present.installment_group_id = s.installment_group_id
          AND present.installment_number = n.number_value
      )
    ), '[]'::jsonb) AS missing_numbers,
    pg_catalog.coalesce((
      SELECT jsonb_agg(nc.installment_number ORDER BY nc.installment_number)
      FROM number_counts AS nc
      WHERE nc.source_table = s.source_table
        AND nc.installment_group_id = s.installment_group_id
        AND nc.number_count > 1
    ), '[]'::jsonb) AS duplicate_numbers
  FROM series_stats AS s
), classified AS (
  SELECT
    e.*,
    CASE
      WHEN e.divergent_total_installments OR e.invalid_number_count > 0
        OR e.total_less_than_max_number OR jsonb_array_length(e.duplicate_numbers) > 0 THEN 'inconsistent'
      WHEN jsonb_array_length(e.missing_numbers) > 0
        OR e.expected_total_min IS NULL OR e.row_count <> e.expected_total_min THEN 'incomplete'
      ELSE 'complete'
    END AS completeness_status,
    CASE
      WHEN e.dates_out_of_order > 0 OR e.repeated_months > 0 OR e.skipped_months > 0 OR e.backwards_months > 0
        THEN 'suspicious_month_sequence'
      ELSE 'ordered_month_sequence'
    END AS date_sequence_status
  FROM enriched AS e
)
SELECT jsonb_build_object(
  'source_table', c.source_table,
  'installment_group_id', c.installment_group_id,
  'user_id', c.user_id,
  'shared_group_id', c.shared_group_id,
  'row_count', c.row_count,
  'distinct_installment_numbers', c.distinct_installment_numbers,
  'expected_total_min', c.expected_total_min,
  'expected_total_max', c.expected_total_max,
  'min_installment_number', c.min_installment_number,
  'max_installment_number', c.max_installment_number,
  'first_date', c.first_date,
  'last_date', c.last_date,
  'missing_numbers', c.missing_numbers,
  'duplicate_numbers', c.duplicate_numbers,
  'invalid_number_count', c.invalid_number_count,
  'divergent_total_installments', c.divergent_total_installments,
  'total_less_than_max_number', c.total_less_than_max_number,
  'extra_rows_beyond_expected', c.extra_rows_beyond_expected,
  'completeness_status', c.completeness_status,
  'null_date_count', 0,
  'dates_out_of_order', c.dates_out_of_order,
  'repeated_months', c.repeated_months,
  'skipped_months', c.skipped_months,
  'backwards_months', c.backwards_months,
  'invalid_date_status', 'not_provable_from_typed_not_null_column',
  'date_sequence_status', c.date_sequence_status,
  'distinct_user_count', c.distinct_user_count,
  'distinct_shared_group_count', c.distinct_shared_group_count,
  'mixed_user_context', c.distinct_user_count > 1,
  'mixed_group_context', c.distinct_shared_group_count > 1,
  'possible_guard_conditions', jsonb_build_object(
    'INSTALLMENT_DATE_INVALID', false,
    'SERIES_COMPLETENESS_NOT_VERIFIED', c.source_table = 'expenses' AND c.eligible_for_card_tool
  ),
  'needs_manual_review',
    c.completeness_status <> 'complete'
    OR c.date_sequence_status <> 'ordered_month_sequence'
    OR c.distinct_user_count > 1
    OR c.distinct_shared_group_count > 1
) AS anomalous_series
FROM classified AS c
WHERE c.completeness_status <> 'complete'
   OR c.date_sequence_status <> 'ordered_month_sequence'
   OR c.distinct_user_count > 1
   OR c.distinct_shared_group_count > 1
   OR (c.source_table = 'expenses' AND c.eligible_for_card_tool)
ORDER BY c.source_table, c.installment_group_id;

-- Resumo. Repete o CTE de forma autocontida para execução isolada.
WITH source_rows AS (
  SELECT 'expenses'::text AS source_table, installment_group_id, installment_number,
    total_installments, expense_date::date AS transaction_date, user_id, shared_group_id,
    (card_id IS NOT NULL) AS eligible_for_card_tool
  FROM public.expenses WHERE installment_group_id IS NOT NULL
  UNION ALL
  SELECT 'incomes'::text, installment_group_id, installment_number, total_installments,
    (income_date AT TIME ZONE 'America/Sao_Paulo')::date, user_id, shared_group_id, false
  FROM public.incomes WHERE installment_group_id IS NOT NULL
), groups AS (
  SELECT
    source_table,
    installment_group_id,
    count(*)::integer AS row_count,
    count(DISTINCT installment_number)::integer AS distinct_numbers,
    min(total_installments) AS total_min,
    max(total_installments) AS total_max,
    count(*) FILTER (WHERE installment_number IS NULL OR installment_number <= 0)::integer AS invalid_numbers,
    count(DISTINCT total_installments)::integer AS total_variants,
    count(*) FILTER (WHERE total_installments IS NULL)::integer AS null_totals,
    count(DISTINCT user_id)::integer AS user_contexts,
    count(DISTINCT pg_catalog.coalesce(shared_group_id::text, '__NULL__'))::integer AS group_contexts,
    bool_or(eligible_for_card_tool) AS eligible_for_card_tool,
    count(DISTINCT (extract(year FROM transaction_date)::integer * 12 + extract(month FROM transaction_date)::integer))::integer AS distinct_months,
    min(extract(year FROM transaction_date)::integer * 12 + extract(month FROM transaction_date)::integer) AS first_month,
    max(extract(year FROM transaction_date)::integer * 12 + extract(month FROM transaction_date)::integer) AS last_month,
    count(*) - count(DISTINCT installment_number) AS duplicate_rows
  FROM source_rows
  GROUP BY source_table, installment_group_id
), classified AS (
  SELECT
    g.*,
    (g.total_min = g.total_max AND g.total_min IS NOT NULL AND g.invalid_numbers = 0
      AND g.row_count = g.total_min AND g.distinct_numbers = g.total_min AND g.duplicate_rows = 0) AS structurally_complete,
    (g.distinct_months < (g.last_month - g.first_month + 1)) AS suspicious_dates,
    (g.total_variants > 1 OR g.null_totals > 0) AS divergent_total
  FROM groups AS g
)
SELECT jsonb_build_object(
  'total_expense_series', count(*) FILTER (WHERE source_table = 'expenses'),
  'total_income_series', count(*) FILTER (WHERE source_table = 'incomes'),
  'structurally_complete_series', count(*) FILTER (WHERE structurally_complete),
  'incomplete_series', count(*) FILTER (WHERE NOT structurally_complete),
  'series_with_suspicious_dates', count(*) FILTER (WHERE suspicious_dates),
  'series_with_duplicates', count(*) FILTER (WHERE duplicate_rows > 0),
  'series_with_divergent_total', count(*) FILTER (WHERE divergent_total),
  'series_with_mixed_context', count(*) FILTER (WHERE user_contexts > 1 OR group_contexts > 1),
  'potential_INSTALLMENT_DATE_INVALID', 0,
  'potential_SERIES_COMPLETENESS_NOT_VERIFIED',
    count(*) FILTER (WHERE source_table = 'expenses' AND eligible_for_card_tool)
) AS diagnostic_summary
FROM classified;
