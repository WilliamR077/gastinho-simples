\set ON_ERROR_STOP on

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '10000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'p3a4-ambiguous@example.invalid', '', now(), '{}', '{}', now(), now()
) ON CONFLICT (id) DO NOTHING;

-- user_income_categories deliberately has no unique(user_id, name) constraint.
INSERT INTO public.user_income_categories
  (id, user_id, name, icon, is_default, is_active, display_order)
VALUES
  ('30000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000003', 'Outros', '1️⃣', true, true, 1),
  ('30000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000003', 'Outros', '2️⃣', true, true, 2);
