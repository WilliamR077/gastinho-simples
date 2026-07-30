-- Dropar política existente
DROP POLICY IF EXISTS "Owner or admin can add members" ON public.shared_group_members;

-- Criar nova política que permite:
-- 1. Owner/Admin adicionar membros
-- 2. Usuário se adicionar como 'member' (para joinGroup)
-- 3. Criador do grupo se adicionar como 'owner' (para createGroup)
CREATE POLICY "Owner or admin can add members" ON public.shared_group_members
FOR INSERT
WITH CHECK (
  -- Condição 1: já é owner ou admin do grupo
  (get_group_role(group_id, auth.uid()) = ANY (ARRAY['owner'::group_member_role, 'admin'::group_member_role]))
  OR
  -- Condição 2: está se adicionando como member (joinGroup via código)
  ((auth.uid() = user_id) AND (role = 'member'::group_member_role))
  OR
  -- Condição 3: é o criador do grupo e está se adicionando como owner
  (
    (auth.uid() = user_id) 
    AND (role = 'owner'::group_member_role)
    AND EXISTS (
      SELECT 1 FROM public.shared_groups 
      WHERE id = group_id 
      AND created_by = auth.uid()
    )
  )
);