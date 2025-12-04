-- FASE 1: Adicionar shared_group_id em budget_goals
ALTER TABLE public.budget_goals 
ADD COLUMN shared_group_id uuid REFERENCES public.shared_groups(id) ON DELETE CASCADE;

-- Criar índice para performance
CREATE INDEX idx_budget_goals_shared_group_id ON public.budget_goals(shared_group_id);

-- Atualizar RLS para budget_goals - permitir ver metas do grupo
DROP POLICY IF EXISTS "Users can view their own budget goals" ON public.budget_goals;
CREATE POLICY "Users can view their own or group budget goals"
ON public.budget_goals
FOR SELECT
USING (
  (auth.uid() = user_id AND shared_group_id IS NULL) 
  OR (shared_group_id IS NOT NULL AND is_group_member(shared_group_id, auth.uid()))
);

DROP POLICY IF EXISTS "Users can create their own budget goals" ON public.budget_goals;
CREATE POLICY "Users can create budget goals"
ON public.budget_goals
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) 
  AND (shared_group_id IS NULL OR is_group_member(shared_group_id, auth.uid()))
);

DROP POLICY IF EXISTS "Users can update their own budget goals" ON public.budget_goals;
CREATE POLICY "Users can update their own budget goals"
ON public.budget_goals
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own budget goals" ON public.budget_goals;
CREATE POLICY "Users can delete their own budget goals"
ON public.budget_goals
FOR DELETE
USING (auth.uid() = user_id);

-- FASE 3: Alterar limite de membros para ilimitado (NULL)
ALTER TABLE public.shared_groups 
ALTER COLUMN max_members DROP DEFAULT,
ALTER COLUMN max_members SET DEFAULT NULL;

-- Atualizar grupos existentes para ilimitado
UPDATE public.shared_groups SET max_members = NULL;

-- Notificar reload do schema
NOTIFY pgrst, 'reload schema';