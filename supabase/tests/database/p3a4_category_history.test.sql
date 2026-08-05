BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

-- Synthetic identities only; no production UUIDs or credentials.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ci-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('b0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ci-b@example.invalid', '', now(), '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_categories
  (id, user_id, name, icon, is_default, is_active, display_order, system_key)
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'A Origem', '🅰️', false, true, 1, null),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'A Destino', '🎯', false, true, 2, null),
  ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'A Arquivada', '📚', false, false, 3, null),
  ('a1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'Outros', '📦', true, true, 8, 'other'),
  ('a1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'Padrão não sistema', 'pin', true, false, 9, null),
  ('a1000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'Origem para Outros', 'swap', false, true, 10, null),
  ('a1000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'Com despesa', 'receipt', false, false, 11, null),
  ('a1000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'Com recorrência', 'repeat', false, false, 12, null),
  ('a1000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'Com meta UUID', 'target', false, false, 13, null),
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'B Categoria', '🅱️', false, true, 1, null);

INSERT INTO public.user_income_categories
  (id, user_id, name, icon, is_default, is_active, display_order, system_key)
VALUES
  ('a2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Receita origem', '💵', false, true, 1, null),
  ('a2000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Receita destino', '💰', false, true, 2, null),
  ('a2000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'Outros', '📦', true, true, 8, 'other'),
  ('b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'Receita B', '🅱️', false, true, 1, null);

-- Structure and catalog.
SELECT has_column('public', 'user_categories', 'system_key', 'expense system_key exists');
SELECT has_column('public', 'user_income_categories', 'system_key', 'income system_key exists');
SELECT ok(EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'user_categories_system_key_check'
), 'expense system_key check exists');
SELECT ok(EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'user_income_categories_system_key_check'
), 'income system_key check exists');
SELECT has_index('public', 'user_categories', 'user_categories_one_system_key_per_user', 'expense partial unique index exists');
SELECT has_index('public', 'user_income_categories', 'user_income_categories_one_system_key_per_user', 'income partial unique index exists');

SELECT has_function('public', 'p3a4_category_reference_counts', ARRAY['text', 'uuid'], 'count RPC exists');
SELECT has_function('public', 'p3a4_archive_category', ARRAY['text', 'uuid'], 'archive RPC exists');
SELECT has_function('public', 'p3a4_replace_category', ARRAY['text', 'uuid', 'uuid'], 'replace RPC exists');
SELECT has_function('public', 'p3a4_delete_category', ARRAY['text', 'uuid'], 'delete RPC exists');
SELECT has_function('public', 'p3a4_category_lock_key', ARRAY['uuid', 'text'], 'lock key function exists');
SELECT has_function('public', 'p3a4_lock_category_scope', ARRAY['uuid', 'text'], 'scope lock function exists');
SELECT has_function('public', 'p3a4_lock_budget_goal_write', ARRAY[]::text[], 'goal trigger function exists');
SELECT has_trigger('public', 'budget_goals', 'p3a4_budget_goal_write_lock', 'goal write trigger exists');
SELECT is(
  (SELECT tgtype::integer & 28 FROM pg_trigger
   WHERE tgrelid = 'public.budget_goals'::regclass AND tgname = 'p3a4_budget_goal_write_lock'),
  28,
  'goal trigger covers INSERT, DELETE and UPDATE'
);

SELECT ok(bool_and(p.prosecdef), 'all public P3-A4 RPCs are SECURITY DEFINER')
FROM pg_proc p
WHERE p.oid IN (
  'public.p3a4_category_reference_counts(text,uuid)'::regprocedure,
  'public.p3a4_archive_category(text,uuid)'::regprocedure,
  'public.p3a4_replace_category(text,uuid,uuid)'::regprocedure,
  'public.p3a4_delete_category(text,uuid)'::regprocedure
);
SELECT ok(bool_and('search_path=public, pg_temp' = ANY(p.proconfig)), 'public RPC search_path is fixed')
FROM pg_proc p
WHERE p.oid IN (
  'public.p3a4_category_reference_counts(text,uuid)'::regprocedure,
  'public.p3a4_archive_category(text,uuid)'::regprocedure,
  'public.p3a4_replace_category(text,uuid,uuid)'::regprocedure,
  'public.p3a4_delete_category(text,uuid)'::regprocedure
);
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p, LATERAL aclexplode(p.proacl) acl
  WHERE p.proname LIKE 'p3a4_%' AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
), 'PUBLIC has no P3-A4 EXECUTE');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p, LATERAL aclexplode(p.proacl) acl
  WHERE p.proname LIKE 'p3a4_%'
    AND acl.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'anon')
    AND acl.privilege_type = 'EXECUTE'
), 'anon has no P3-A4 EXECUTE');
SELECT ok(bool_and(has_function_privilege(
  'authenticated',
  p.oid,
  'EXECUTE'
)), 'authenticated can execute exactly the four public RPCs')
FROM pg_proc p
WHERE p.oid IN (
  'public.p3a4_category_reference_counts(text,uuid)'::regprocedure,
  'public.p3a4_archive_category(text,uuid)'::regprocedure,
  'public.p3a4_replace_category(text,uuid,uuid)'::regprocedure,
  'public.p3a4_delete_category(text,uuid)'::regprocedure
);
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_proc p
  WHERE p.oid IN (
    'public.p3a4_category_lock_key(uuid,text)'::regprocedure,
    'public.p3a4_lock_category_scope(uuid,text)'::regprocedure,
    'public.p3a4_lock_budget_goal_write()'::regprocedure,
    'public.p3a4_has_ambiguous_legacy_goals(uuid,text)'::regprocedure
  ) AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
), 'authenticated cannot execute internal helpers');

SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;

-- Archive and reactivate without changing references/snapshots.
INSERT INTO public.expenses
  (id, user_id, description, amount, payment_method, expense_date,
   category_id, category_name, category_icon, total_installments, installment_number, installment_group_id)
VALUES
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Preservar', 12.34, 'pix', '2026-02-10', 'a1000000-0000-4000-8000-000000000001', 'Snapshot antigo', '🕰️',
   4, 2, 'e9000000-0000-4000-8000-000000000001');
SELECT lives_ok(
  $$SELECT public.p3a4_archive_category('expense', 'a1000000-0000-4000-8000-000000000001')$$,
  'active custom category can be archived'
);
SELECT is((SELECT is_active FROM public.user_categories WHERE id = 'a1000000-0000-4000-8000-000000000001'), false, 'archive sets inactive');
SELECT is((SELECT category_id FROM public.expenses WHERE id = 'e0000000-0000-4000-8000-000000000001'), 'a1000000-0000-4000-8000-000000000001'::uuid, 'archive preserves category ID');
SELECT is((SELECT category_name FROM public.expenses WHERE id = 'e0000000-0000-4000-8000-000000000001'), 'Snapshot antigo', 'archive preserves snapshot');
SELECT lives_ok(
  $$SELECT public.p3a4_archive_category('expense', 'a1000000-0000-4000-8000-000000000001')$$,
  'repeated archive is predictably idempotent'
);
SELECT lives_ok(
  $$UPDATE public.user_categories SET is_active = true WHERE id = 'a1000000-0000-4000-8000-000000000001'$$,
  'reactivation through RLS succeeds'
);
SELECT is((SELECT is_active FROM public.user_categories WHERE id = 'a1000000-0000-4000-8000-000000000001'), true, 'reactivation restores active');
SELECT lives_ok(
  $$UPDATE public.user_categories SET is_active = true WHERE id = 'a1000000-0000-4000-8000-000000000001'$$,
  'repeated reactivation is predictably idempotent'
);
SELECT throws_ok(
  $$SELECT public.p3a4_archive_category('expense', 'a1000000-0000-4000-8000-000000000004')$$,
  '22023', 'system fallback category cannot be archived', 'system Outros cannot be archived'
);
SELECT throws_ok(
  $$SELECT public.p3a4_archive_category('expense', 'b1000000-0000-4000-8000-000000000001')$$,
  'P0002', 'category not found', 'user cannot archive another user category'
);
SELECT throws_ok(
  $$SELECT public.p3a4_replace_category('expense',
    'a1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000003')$$,
  '22023', 'destination category must be active', 'replacement destination must be active'
);

RESET ROLE;

-- Active expense substitution, including snapshots and exact UUID goal.
INSERT INTO public.recurring_expenses
  (id, user_id, description, amount, payment_method, day_of_month,
   category_id, category_name, category_icon)
VALUES
  ('e1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Recorrente preservada', 45.67, 'pix', 15, 'a1000000-0000-4000-8000-000000000001', 'Snapshot recorrente', '🕰️');
INSERT INTO public.budget_goals (id, user_id, type, category, limit_amount)
VALUES ('e2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
  'category', 'a1000000-0000-4000-8000-000000000001', 500);

SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT public.p3a4_replace_category('expense',
    'a1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002')$$,
  'active expense category can be replaced'
);
SELECT lives_ok(
  $$SELECT public.p3a4_replace_category('expense',
    'a1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002')$$,
  'repeated replacement has a predictable no-op result'
);
SELECT lives_ok(
  $$SELECT public.p3a4_replace_category('expense',
    'a1000000-0000-4000-8000-000000000006',
    'a1000000-0000-4000-8000-000000000004')$$,
  'system Outros is allowed as an active destination'
);
RESET ROLE;

SELECT is((SELECT category_id FROM public.expenses WHERE id = 'e0000000-0000-4000-8000-000000000001'), 'a1000000-0000-4000-8000-000000000002'::uuid, 'expense ID replaced');
SELECT is((SELECT category_name FROM public.expenses WHERE id = 'e0000000-0000-4000-8000-000000000001'), 'A Destino', 'expense snapshot name replaced');
SELECT is((SELECT category_icon FROM public.expenses WHERE id = 'e0000000-0000-4000-8000-000000000001'), '🎯', 'expense snapshot icon replaced');
SELECT is((SELECT amount FROM public.expenses WHERE id = 'e0000000-0000-4000-8000-000000000001'), 12.34::numeric, 'expense amount preserved');
SELECT is((SELECT expense_date::date FROM public.expenses WHERE id = 'e0000000-0000-4000-8000-000000000001'), DATE '2026-02-10', 'expense date preserved');
SELECT is((SELECT description FROM public.expenses WHERE id = 'e0000000-0000-4000-8000-000000000001'), 'Preservar', 'expense description preserved');
SELECT is((SELECT total_installments FROM public.expenses WHERE id = 'e0000000-0000-4000-8000-000000000001'), 4, 'expense installment count preserved');
SELECT is((SELECT installment_number FROM public.expenses WHERE id = 'e0000000-0000-4000-8000-000000000001'), 2, 'expense installment number preserved');
SELECT is((SELECT installment_group_id FROM public.expenses WHERE id = 'e0000000-0000-4000-8000-000000000001'), 'e9000000-0000-4000-8000-000000000001'::uuid, 'expense installment group preserved');
SELECT is((SELECT category_id FROM public.recurring_expenses WHERE id = 'e1000000-0000-4000-8000-000000000001'), 'a1000000-0000-4000-8000-000000000002'::uuid, 'recurring expense replaced');
SELECT is((SELECT category FROM public.budget_goals WHERE id = 'e2000000-0000-4000-8000-000000000001'), 'a1000000-0000-4000-8000-000000000002', 'exact UUID goal replaced');
SELECT is((SELECT is_active FROM public.user_categories WHERE id = 'a1000000-0000-4000-8000-000000000001'), false, 'source archived after replacement');

-- Archived source replacement.
INSERT INTO public.expenses
  (id, user_id, description, amount, payment_method, category_id, category_name, category_icon)
VALUES
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Arquivada', 9.99, 'pix', 'a1000000-0000-4000-8000-000000000003', 'A Arquivada', '📚');
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT public.p3a4_replace_category('expense',
    'a1000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000002')$$,
  'archived source can be replaced'
);
SELECT throws_ok(
  $$SELECT public.p3a4_replace_category('expense',
    'a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000002')$$,
  '22023', 'source and destination must differ', 'same source/destination fails'
);
SELECT throws_ok(
  $$SELECT public.p3a4_replace_category('expense',
    'a1000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000002')$$,
  '22023', 'system fallback category cannot be replaced', 'system Outros cannot be source'
);
SELECT throws_ok(
  $$SELECT public.p3a4_replace_category('expense',
    'a1000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000001')$$,
  'P0002', 'category not found', 'cross-user destination fails'
);
SELECT throws_ok(
  $$SELECT public.p3a4_replace_category('expense',
    'a1000000-0000-4000-8000-000000000002',
    'a2000000-0000-4000-8000-000000000002')$$,
  'P0002', 'category not found', 'expense cannot use income destination'
);
RESET ROLE;

-- Income and recurring income substitution.
INSERT INTO public.incomes
  (id, user_id, description, amount, category, income_date,
   income_category_id, category_name, category_icon)
VALUES
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Receita', 100, 'salario', '2026-02-12', 'a2000000-0000-4000-8000-000000000001', 'Receita origem', '💵');
INSERT INTO public.recurring_incomes
  (id, user_id, description, amount, category, day_of_month,
   income_category_id, category_name, category_icon)
VALUES
  ('d1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Receita recorrente', 200, 'salario', 10, 'a2000000-0000-4000-8000-000000000001', 'Receita origem', '💵');
INSERT INTO public.budget_goals (id, user_id, type, category, limit_amount)
VALUES ('d2000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
  'income_category', 'a2000000-0000-4000-8000-000000000001', 1000);
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT public.p3a4_replace_category('income',
    'a2000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000002')$$,
  'income category can be replaced'
);
RESET ROLE;
SELECT is((SELECT income_category_id FROM public.incomes WHERE id = 'd0000000-0000-4000-8000-000000000001'), 'a2000000-0000-4000-8000-000000000002'::uuid, 'income replaced');
SELECT is((SELECT income_category_id FROM public.recurring_incomes WHERE id = 'd1000000-0000-4000-8000-000000000001'), 'a2000000-0000-4000-8000-000000000002'::uuid, 'recurring income replaced');
SELECT is((SELECT category FROM public.budget_goals WHERE id = 'd2000000-0000-4000-8000-000000000001'), 'a2000000-0000-4000-8000-000000000002', 'income UUID goal replaced within its own type');

-- Every reference class blocks physical deletion after archival.
INSERT INTO public.expenses
  (id, user_id, description, amount, payment_method, category_id, category_name, category_icon)
VALUES ('e3000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
        'Referência direta', 1, 'pix', 'a1000000-0000-4000-8000-000000000007', 'Com despesa', 'receipt');
INSERT INTO public.recurring_expenses
  (id, user_id, description, amount, payment_method, day_of_month, category_id, category_name, category_icon)
VALUES ('e4000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
        'Referência recorrente', 2, 'pix', 5, 'a1000000-0000-4000-8000-000000000008', 'Com recorrência', 'repeat');
INSERT INTO public.budget_goals (id, user_id, type, category, limit_amount)
VALUES ('e5000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
        'category', 'a1000000-0000-4000-8000-000000000009', 50);
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.p3a4_delete_category('expense', 'a1000000-0000-4000-8000-000000000007')$$,
  '23503', 'category still has references', 'expense reference blocks physical deletion'
);
SELECT throws_ok(
  $$SELECT public.p3a4_delete_category('expense', 'a1000000-0000-4000-8000-000000000008')$$,
  '23503', 'category still has references', 'recurring reference blocks physical deletion'
);
SELECT throws_ok(
  $$SELECT public.p3a4_delete_category('expense', 'a1000000-0000-4000-8000-000000000009')$$,
  '23503', 'category still has references', 'exact UUID goal blocks physical deletion'
);
SELECT throws_ok(
  $$SELECT public.p3a4_delete_category('expense', 'a1000000-0000-4000-8000-000000000005')$$,
  '22023', 'system/default category cannot be deleted', 'default non-system category cannot be deleted'
);
RESET ROLE;

-- Legacy textual goal blocks replacement/deletion but not archival.
INSERT INTO public.user_categories
  (id, user_id, name, icon, is_default, is_active, display_order)
VALUES
  ('a1000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001', 'Meta antiga', '🧭', false, true, 20),
  ('a1000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', 'Meta_Antiga', '🧭', false, true, 21);
INSERT INTO public.budget_goals (id, user_id, type, category, limit_amount)
VALUES
  ('e2000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000001', 'category', 'Meta antiga', 100),
  ('e2000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000001', 'category', 'meta_antiga', 100);
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.p3a4_replace_category('expense',
    'a1000000-0000-4000-8000-000000000010',
    'a1000000-0000-4000-8000-000000000002')$$,
  'P0001', 'LEGACY_GOAL_REFERENCE_REQUIRES_REVIEW', 'legacy name/slug blocks replacement'
);
SELECT lives_ok(
  $$SELECT public.p3a4_archive_category('expense', 'a1000000-0000-4000-8000-000000000010')$$,
  'legacy goal does not block archive'
);
SELECT throws_ok(
  $$SELECT public.p3a4_delete_category('expense', 'a1000000-0000-4000-8000-000000000010')$$,
  'P0001', 'LEGACY_GOAL_REFERENCE_REQUIRES_REVIEW', 'legacy goal blocks physical delete'
);
RESET ROLE;
SELECT is((SELECT category FROM public.budget_goals WHERE id = 'e2000000-0000-4000-8000-000000000010'), 'Meta antiga', 'name goal not silently changed');
SELECT is((SELECT category FROM public.budget_goals WHERE id = 'e2000000-0000-4000-8000-000000000011'), 'meta_antiga', 'slug goal not silently changed');

-- Physical deletion rules.
INSERT INTO public.user_categories
  (id, user_id, name, icon, is_default, is_active, display_order)
VALUES
  ('a1000000-0000-4000-8000-000000000020', 'a0000000-0000-4000-8000-000000000001', 'Excluir vazia', '🗑️', false, false, 20),
  ('a1000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000001', 'Ativa', '⚡', false, true, 21);
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$SELECT public.p3a4_delete_category('expense', 'a1000000-0000-4000-8000-000000000020')$$,
  'inactive custom category without references is deleted'
);
SELECT throws_ok(
  $$SELECT public.p3a4_delete_category('expense', 'a1000000-0000-4000-8000-000000000021')$$,
  '22023', 'category must be archived first', 'active category cannot be deleted'
);
SELECT throws_ok(
  $$SELECT public.p3a4_delete_category('expense', 'a1000000-0000-4000-8000-000000000004')$$,
  '22023', 'system/default category cannot be deleted', 'system/default category cannot be deleted'
);
SELECT throws_ok(
  $$SELECT public.p3a4_delete_category('expense', 'b1000000-0000-4000-8000-000000000001')$$,
  'P0002', 'category not found', 'other user category cannot be deleted'
);
SELECT throws_ok(
  $$SELECT public.p3a4_delete_category('expense', 'a1000000-0000-4000-8000-000000000020')$$,
  'P0002', 'category not found', 'repeated delete has predictable not-found contract'
);
RESET ROLE;

-- Transaction rollback after financial rows have begun changing.
INSERT INTO public.user_categories
  (id, user_id, name, icon, is_default, is_active, display_order)
VALUES
  ('a1000000-0000-4000-8000-000000000030', 'a0000000-0000-4000-8000-000000000001', 'Rollback origem', '↩️', false, true, 30),
  ('a1000000-0000-4000-8000-000000000031', 'a0000000-0000-4000-8000-000000000001', 'Rollback destino', '✅', false, true, 31);
INSERT INTO public.expenses
  (id, user_id, description, amount, payment_method, category_id, category_name, category_icon)
VALUES
  ('e0000000-0000-4000-8000-000000000030', 'a0000000-0000-4000-8000-000000000001',
   'Rollback', 33, 'pix', 'a1000000-0000-4000-8000-000000000030', 'Rollback origem', '↩️');
CREATE FUNCTION pg_temp.reject_source_archive() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id = 'a1000000-0000-4000-8000-000000000030' AND NEW.is_active = false THEN
    RAISE EXCEPTION 'test forced late failure';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER p3a4_test_late_failure
BEFORE UPDATE ON public.user_categories
FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_source_archive();
SELECT set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-000000000001', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.p3a4_replace_category('expense',
    'a1000000-0000-4000-8000-000000000030',
    'a1000000-0000-4000-8000-000000000031')$$,
  'P0001', 'test forced late failure', 'late failure rolls back whole replacement'
);
RESET ROLE;
SELECT is((SELECT category_id FROM public.expenses WHERE id = 'e0000000-0000-4000-8000-000000000030'), 'a1000000-0000-4000-8000-000000000030'::uuid, 'rollback restored category ID');
SELECT is((SELECT category_name FROM public.expenses WHERE id = 'e0000000-0000-4000-8000-000000000030'), 'Rollback origem', 'rollback restored snapshot');
SELECT is((SELECT is_active FROM public.user_categories WHERE id = 'a1000000-0000-4000-8000-000000000030'), true, 'rollback left source active');

SELECT * FROM finish();
ROLLBACK;
