-- A2 + M1 — Roles + RLS de admin_notifications_log (idempotente)

-- 1) Enum app_role (idempotente)
DO $$
BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- 2) Tabela user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3) has_role (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM public;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  TO authenticated, service_role;

-- 4) Seed admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'gastinhosimples@gmail.com'
ON CONFLICT DO NOTHING;

-- 5) RLS explícita do log de admin (M1)
ALTER TABLE public.admin_notifications_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read admin_notifications_log" ON public.admin_notifications_log;
CREATE POLICY "admins read admin_notifications_log"
  ON public.admin_notifications_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "service role writes admin_notifications_log" ON public.admin_notifications_log;
CREATE POLICY "service role writes admin_notifications_log"
  ON public.admin_notifications_log FOR INSERT
  TO service_role
  WITH CHECK (true);
