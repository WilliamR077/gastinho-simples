
CREATE OR REPLACE FUNCTION public.delete_group_and_data(group_id_param uuid, action_param text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  group_owner uuid;
BEGIN
  SELECT created_by INTO group_owner
  FROM public.shared_groups
  WHERE id = group_id_param;

  IF group_owner IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;

  IF caller_id != group_owner THEN
    RAISE EXCEPTION 'Apenas o dono do grupo pode excluí-lo';
  END IF;

  IF action_param = 'delete_all' THEN
    DELETE FROM public.budget_goal_alerts WHERE goal_id IN (
      SELECT id FROM public.budget_goals WHERE shared_group_id = group_id_param
    );
    DELETE FROM public.budget_goals WHERE shared_group_id = group_id_param;
    DELETE FROM public.expenses WHERE shared_group_id = group_id_param;
    DELETE FROM public.recurring_expenses WHERE shared_group_id = group_id_param;
    DELETE FROM public.incomes WHERE shared_group_id = group_id_param;
    DELETE FROM public.recurring_incomes WHERE shared_group_id = group_id_param;

  ELSIF action_param = 'move_to_personal' THEN
    -- Remover alertas de metas do grupo antes de mover
    DELETE FROM public.budget_goal_alerts WHERE goal_id IN (
      SELECT id FROM public.budget_goals WHERE shared_group_id = group_id_param
    );

    -- Mover dados de TODOS os membros para pessoal
    UPDATE public.expenses SET shared_group_id = NULL WHERE shared_group_id = group_id_param;
    UPDATE public.recurring_expenses SET shared_group_id = NULL WHERE shared_group_id = group_id_param;
    UPDATE public.incomes SET shared_group_id = NULL WHERE shared_group_id = group_id_param;
    UPDATE public.recurring_incomes SET shared_group_id = NULL WHERE shared_group_id = group_id_param;
    UPDATE public.budget_goals SET shared_group_id = NULL WHERE shared_group_id = group_id_param;
  ELSE
    RAISE EXCEPTION 'Ação inválida: %', action_param;
  END IF;

  DELETE FROM public.shared_group_members WHERE group_id = group_id_param;
  DELETE FROM public.shared_groups WHERE id = group_id_param;
END;
$function$;
