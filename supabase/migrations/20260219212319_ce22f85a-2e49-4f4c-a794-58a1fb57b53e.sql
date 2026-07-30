
CREATE OR REPLACE FUNCTION public.delete_group_and_data(group_id_param uuid, action_param text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller_id uuid := auth.uid();
  group_owner uuid;
BEGIN
  -- Verificar se o grupo existe e pegar o owner
  SELECT created_by INTO group_owner
  FROM public.shared_groups
  WHERE id = group_id_param;

  IF group_owner IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;

  -- Verificar se o caller é o owner
  IF caller_id != group_owner THEN
    RAISE EXCEPTION 'Apenas o dono do grupo pode excluí-lo';
  END IF;

  IF action_param = 'delete_all' THEN
    -- Deletar TUDO do grupo (de todos os membros)
    DELETE FROM public.budget_goal_alerts WHERE goal_id IN (
      SELECT id FROM public.budget_goals WHERE shared_group_id = group_id_param
    );
    DELETE FROM public.budget_goals WHERE shared_group_id = group_id_param;
    DELETE FROM public.expenses WHERE shared_group_id = group_id_param;
    DELETE FROM public.recurring_expenses WHERE shared_group_id = group_id_param;
    DELETE FROM public.incomes WHERE shared_group_id = group_id_param;
    DELETE FROM public.recurring_incomes WHERE shared_group_id = group_id_param;

  ELSIF action_param = 'move_to_personal' THEN
    -- Mover dados do owner para pessoal (remover shared_group_id)
    UPDATE public.expenses SET shared_group_id = NULL WHERE shared_group_id = group_id_param AND user_id = caller_id;
    UPDATE public.recurring_expenses SET shared_group_id = NULL WHERE shared_group_id = group_id_param AND user_id = caller_id;
    UPDATE public.incomes SET shared_group_id = NULL WHERE shared_group_id = group_id_param AND user_id = caller_id;
    UPDATE public.recurring_incomes SET shared_group_id = NULL WHERE shared_group_id = group_id_param AND user_id = caller_id;
    UPDATE public.budget_goals SET shared_group_id = NULL WHERE shared_group_id = group_id_param AND user_id = caller_id;

    -- Deletar dados dos outros membros
    DELETE FROM public.budget_goal_alerts WHERE goal_id IN (
      SELECT id FROM public.budget_goals WHERE shared_group_id = group_id_param AND user_id != caller_id
    );
    DELETE FROM public.budget_goals WHERE shared_group_id = group_id_param AND user_id != caller_id;
    DELETE FROM public.expenses WHERE shared_group_id = group_id_param AND user_id != caller_id;
    DELETE FROM public.recurring_expenses WHERE shared_group_id = group_id_param AND user_id != caller_id;
    DELETE FROM public.incomes WHERE shared_group_id = group_id_param AND user_id != caller_id;
    DELETE FROM public.recurring_incomes WHERE shared_group_id = group_id_param AND user_id != caller_id;
  ELSE
    RAISE EXCEPTION 'Ação inválida: %', action_param;
  END IF;

  -- Deletar membros do grupo
  DELETE FROM public.shared_group_members WHERE group_id = group_id_param;

  -- Deletar o grupo
  DELETE FROM public.shared_groups WHERE id = group_id_param;
END;
$$;
