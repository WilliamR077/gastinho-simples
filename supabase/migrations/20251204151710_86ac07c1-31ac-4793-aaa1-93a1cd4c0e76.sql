-- =============================================
-- FASE 1: Conta Conjunta / Grupos Compartilhados
-- =============================================

-- 1.1 Criar Enum para Roles de Grupo
CREATE TYPE public.group_member_role AS ENUM ('owner', 'admin', 'member');

-- 1.2 Criar Tabela shared_groups
CREATE TABLE public.shared_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#6366f1',
  max_members INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 1.3 Criar Tabela shared_group_members
CREATE TABLE public.shared_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.shared_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role group_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- 1.4 Adicionar shared_group_id nas tabelas existentes
ALTER TABLE public.expenses 
ADD COLUMN shared_group_id UUID REFERENCES public.shared_groups(id) ON DELETE SET NULL;

ALTER TABLE public.recurring_expenses 
ADD COLUMN shared_group_id UUID REFERENCES public.shared_groups(id) ON DELETE SET NULL;

-- 1.5 Criar índices para performance
CREATE INDEX idx_shared_groups_created_by ON public.shared_groups(created_by);
CREATE INDEX idx_shared_groups_invite_code ON public.shared_groups(invite_code);
CREATE INDEX idx_shared_group_members_user_id ON public.shared_group_members(user_id);
CREATE INDEX idx_shared_group_members_group_id ON public.shared_group_members(group_id);
CREATE INDEX idx_expenses_shared_group_id ON public.expenses(shared_group_id);
CREATE INDEX idx_recurring_expenses_shared_group_id ON public.recurring_expenses(shared_group_id);

-- 1.6 Habilitar RLS
ALTER TABLE public.shared_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_group_members ENABLE ROW LEVEL SECURITY;

-- 1.7 Função auxiliar para verificar se usuário é membro do grupo
CREATE OR REPLACE FUNCTION public.is_group_member(group_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_group_members
    WHERE group_id = group_id_param AND user_id = user_id_param
  )
$$;

-- 1.8 Função para verificar role no grupo
CREATE OR REPLACE FUNCTION public.get_group_role(group_id_param UUID, user_id_param UUID)
RETURNS group_member_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.shared_group_members
  WHERE group_id = group_id_param AND user_id = user_id_param
$$;

-- 1.9 Função para gerar código de convite único
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
  code_exists BOOLEAN := true;
BEGIN
  WHILE code_exists LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.shared_groups WHERE invite_code = result) INTO code_exists;
  END LOOP;
  RETURN result;
END;
$$;

-- 1.10 Função para verificar se pode criar grupo (Premium/Premium Plus)
CREATE OR REPLACE FUNCTION public.can_create_group(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier subscription_tier;
  group_count INTEGER;
BEGIN
  SELECT tier INTO user_tier FROM public.subscriptions 
  WHERE user_id = user_id_param AND is_active = true
  AND (expires_at IS NULL OR expires_at > now());
  
  IF user_tier IS NULL OR user_tier NOT IN ('premium', 'premium_plus') THEN
    RETURN false;
  END IF;
  
  SELECT COUNT(*) INTO group_count FROM public.shared_groups 
  WHERE created_by = user_id_param AND is_active = true;
  
  RETURN group_count < 3;
END;
$$;

-- 1.11 RLS Policies para shared_groups

-- SELECT: Pode ver grupos que criou ou é membro
CREATE POLICY "Users can view groups they belong to"
ON public.shared_groups
FOR SELECT
USING (
  auth.uid() = created_by 
  OR public.is_group_member(id, auth.uid())
);

-- INSERT: Usuário autenticado pode criar
CREATE POLICY "Authenticated users can create groups"
ON public.shared_groups
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- UPDATE: Apenas owner ou admin pode atualizar
CREATE POLICY "Owner or admin can update groups"
ON public.shared_groups
FOR UPDATE
USING (
  public.get_group_role(id, auth.uid()) IN ('owner', 'admin')
);

-- DELETE: Apenas owner pode deletar
CREATE POLICY "Only owner can delete groups"
ON public.shared_groups
FOR DELETE
USING (auth.uid() = created_by);

-- 1.12 RLS Policies para shared_group_members

-- SELECT: Membros podem ver outros membros do mesmo grupo
CREATE POLICY "Members can view group members"
ON public.shared_group_members
FOR SELECT
USING (public.is_group_member(group_id, auth.uid()));

-- INSERT: Owner ou admin podem adicionar membros
CREATE POLICY "Owner or admin can add members"
ON public.shared_group_members
FOR INSERT
WITH CHECK (
  public.get_group_role(group_id, auth.uid()) IN ('owner', 'admin')
  OR (auth.uid() = user_id AND role = 'member')
);

-- UPDATE: Owner pode mudar roles, admin pode mudar members
CREATE POLICY "Owner can update member roles"
ON public.shared_group_members
FOR UPDATE
USING (
  public.get_group_role(group_id, auth.uid()) = 'owner'
);

-- DELETE: Owner pode remover qualquer um, usuário pode sair
CREATE POLICY "Owner can remove members or user can leave"
ON public.shared_group_members
FOR DELETE
USING (
  public.get_group_role(group_id, auth.uid()) = 'owner'
  OR auth.uid() = user_id
);

-- 1.13 Atualizar RLS de expenses para incluir grupos
DROP POLICY IF EXISTS "Users can select their own expenses" ON public.expenses;
CREATE POLICY "Users can select their own expenses or group expenses"
ON public.expenses
FOR SELECT
USING (
  auth.uid() = user_id 
  OR (shared_group_id IS NOT NULL AND public.is_group_member(shared_group_id, auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.expenses;
CREATE POLICY "Users can insert expenses"
ON public.expenses
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (shared_group_id IS NULL OR public.is_group_member(shared_group_id, auth.uid()))
);

-- 1.14 Atualizar RLS de recurring_expenses para incluir grupos
DROP POLICY IF EXISTS "Users can view their own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can view their own or group recurring expenses"
ON public.recurring_expenses
FOR SELECT
USING (
  auth.uid() = user_id 
  OR (shared_group_id IS NOT NULL AND public.is_group_member(shared_group_id, auth.uid()))
);

DROP POLICY IF EXISTS "Users can insert their own recurring expenses" ON public.recurring_expenses;
CREATE POLICY "Users can insert recurring expenses"
ON public.recurring_expenses
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (shared_group_id IS NULL OR public.is_group_member(shared_group_id, auth.uid()))
);

-- 1.15 Trigger para atualizar updated_at em shared_groups
CREATE TRIGGER update_shared_groups_updated_at
BEFORE UPDATE ON public.shared_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();