-- Criar função para buscar membros do grupo com email (bypassa RLS de forma segura)
CREATE OR REPLACE FUNCTION public.get_group_members_with_email(group_id_param uuid)
RETURNS TABLE (
  id uuid,
  group_id uuid,
  user_id uuid,
  role text,
  joined_at timestamptz,
  user_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se usuário atual é membro do grupo
  IF NOT EXISTS (
    SELECT 1 FROM public.shared_group_members
    WHERE shared_group_members.group_id = group_id_param 
    AND shared_group_members.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Você não é membro deste grupo';
  END IF;

  RETURN QUERY
  SELECT 
    m.id,
    m.group_id,
    m.user_id,
    m.role::text,
    m.joined_at,
    u.email AS user_email
  FROM public.shared_group_members m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.group_id = group_id_param
  ORDER BY m.joined_at ASC;
END;
$$;