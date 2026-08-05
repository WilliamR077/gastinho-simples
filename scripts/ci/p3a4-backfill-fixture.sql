\set ON_ERROR_STOP on

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p3a4-a@example.invalid', '', now(), '{}', '{}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'p3a4-b@example.invalid', '', now(), '{}', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_categories
  (id, user_id, name, icon, is_default, is_active, display_order)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Outros', '📦', true, true, 8),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Mercado', '🛒', true, true, 1),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Outros', '🧪', false, true, 1),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Meta Unica', '🎯', false, true, 10);

INSERT INTO public.user_income_categories
  (id, user_id, name, icon, is_default, is_active, display_order)
VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Outros', '📦', true, true, 8),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Outros', '🧪', false, true, 9),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Salário', '💰', true, true, 1);

-- A unique legacy slug is expected to be normalized by the P3-A4 migration.
INSERT INTO public.budget_goals (id, user_id, type, category, limit_amount)
VALUES ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
        'category', 'meta_unica', 250);
