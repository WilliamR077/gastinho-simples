-- Criar função para buscar grupo pelo código de convite (bypassa RLS de forma segura)
CREATE OR REPLACE FUNCTION public.find_group_by_invite_code(invite_code_param text)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  color text,
  max_members integer,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.name,
    g.description,
    g.color,
    g.max_members,
    g.is_active
  FROM public.shared_groups g
  WHERE g.invite_code = UPPER(TRIM(invite_code_param))
    AND g.is_active = true;
END;
$$;