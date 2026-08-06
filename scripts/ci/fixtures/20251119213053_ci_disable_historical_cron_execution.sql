BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.p3a4_ci_force_job_inactive()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $p3a4_ci_force_job_inactive$
BEGIN
  NEW.active := false;
  RETURN NEW;
END;
$p3a4_ci_force_job_inactive$;

REVOKE ALL ON FUNCTION public.p3a4_ci_force_job_inactive() FROM PUBLIC;

DO $p3a4_ci_revoke_trigger_function$
BEGIN
  IF pg_catalog.to_regrole('anon') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.p3a4_ci_force_job_inactive() FROM anon';
  END IF;
  IF pg_catalog.to_regrole('authenticated') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.p3a4_ci_force_job_inactive() FROM authenticated';
  END IF;
END;
$p3a4_ci_revoke_trigger_function$;

DROP TRIGGER IF EXISTS p3a4_ci_force_job_inactive ON cron.job;
CREATE TRIGGER p3a4_ci_force_job_inactive
BEFORE INSERT OR UPDATE ON cron.job
FOR EACH ROW EXECUTE FUNCTION public.p3a4_ci_force_job_inactive();

COMMIT;
