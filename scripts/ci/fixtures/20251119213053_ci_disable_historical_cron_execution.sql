BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION cron.p3a4_ci_force_job_inactive()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, cron
AS $p3a4_ci_force_job_inactive$
BEGIN
  NEW.active := false;
  RETURN NEW;
END;
$p3a4_ci_force_job_inactive$;

DROP TRIGGER IF EXISTS p3a4_ci_force_job_inactive ON cron.job;
CREATE TRIGGER p3a4_ci_force_job_inactive
BEFORE INSERT OR UPDATE ON cron.job
FOR EACH ROW EXECUTE FUNCTION cron.p3a4_ci_force_job_inactive();

COMMIT;
