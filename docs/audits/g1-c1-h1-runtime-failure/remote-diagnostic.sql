-- G1-C1-H1 catalog-only diagnostic.
-- Read-only: do not add application-table data queries or execute writes.

SELECT
  p.oid::regprocedure AS function_signature,
  pg_catalog.pg_get_functiondef(p.oid) AS function_definition,
  r.rolname AS function_owner,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config,
  p.proacl AS function_acl,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_catalog.pg_get_function_result(p.oid) AS function_result
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_roles AS r ON r.oid = p.proowner
WHERE n.nspname = 'public'
  AND p.proname = 'create_shared_group_atomic';

SELECT
  e.extname AS extension_name,
  n.nspname AS extension_schema,
  e.extversion AS extension_version
FROM pg_catalog.pg_extension AS e
JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
WHERE e.extname = 'pgcrypto';

SELECT
  n.nspname AS function_schema,
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_catalog.pg_get_function_result(p.oid) AS function_result
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE p.proname IN (
  'gen_random_bytes',
  'gen_random_uuid',
  'encode',
  'substr',
  'substring',
  'get_byte',
  'hashtextextended',
  'pg_advisory_xact_lock'
)
ORDER BY n.nspname, p.proname, identity_arguments;

SELECT
  n.nspname AS enum_schema,
  t.typname AS enum_name,
  e.enumsortorder,
  e.enumlabel
FROM pg_catalog.pg_type AS t
JOIN pg_catalog.pg_namespace AS n ON n.oid = t.typnamespace
JOIN pg_catalog.pg_enum AS e ON e.enumtypid = t.oid
WHERE n.nspname = 'public'
  AND t.typname IN ('group_member_role', 'subscription_tier')
ORDER BY t.typname, e.enumsortorder;

SELECT
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_schema,
  c.udt_name,
  c.is_nullable,
  c.column_default
FROM information_schema.columns AS c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'shared_groups',
    'shared_group_members',
    'subscriptions'
  )
ORDER BY c.table_name, c.ordinal_position;

SELECT
  n.nspname AS table_schema,
  c.relname AS table_name,
  con.conname AS constraint_name,
  con.contype AS constraint_type,
  pg_catalog.pg_get_constraintdef(con.oid, true) AS constraint_definition
FROM pg_catalog.pg_constraint AS con
JOIN pg_catalog.pg_class AS c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'shared_groups',
    'shared_group_members',
    'subscriptions'
  )
ORDER BY c.relname, con.conname;

SELECT
  n.nspname AS table_schema,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  t.tgenabled AS trigger_enabled,
  pg_catalog.pg_get_triggerdef(t.oid, true) AS trigger_definition
FROM pg_catalog.pg_trigger AS t
JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'shared_groups',
    'shared_group_members',
    'subscriptions'
  )
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;
