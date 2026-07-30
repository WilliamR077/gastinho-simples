-- Função privada usada apenas pelo pg_cron para montar headers seguros.
-- Não é chamável via PostgREST: REVOKE em todos os papéis públicos.
CREATE OR REPLACE FUNCTION public.get_internal_api_secret_for_cron()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret text;
BEGIN
  -- Defesa em profundidade: rejeita explicitamente os papéis expostos via API,
  -- mesmo que algum GRANT futuro seja adicionado por engano.
  IF current_user IN ('anon', 'authenticated', 'service_role') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT decrypted_secret
    INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'internal_api_secret_for_cron'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'internal_api_secret_for_cron not found in vault';
  END IF;

  RETURN v_secret;
END;
$$;

-- Trava de permissões: ninguém público pode executar.
REVOKE ALL ON FUNCTION public.get_internal_api_secret_for_cron() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_internal_api_secret_for_cron() FROM anon;
REVOKE ALL ON FUNCTION public.get_internal_api_secret_for_cron() FROM authenticated;
REVOKE ALL ON FUNCTION public.get_internal_api_secret_for_cron() FROM service_role;

-- Apenas o papel que executa pg_cron pode invocar.
GRANT EXECUTE ON FUNCTION public.get_internal_api_secret_for_cron() TO postgres;

COMMENT ON FUNCTION public.get_internal_api_secret_for_cron() IS
  'Returns INTERNAL_API_SECRET from Vault for pg_cron http_post calls. Not callable from PostgREST/anon/authenticated/service_role.';