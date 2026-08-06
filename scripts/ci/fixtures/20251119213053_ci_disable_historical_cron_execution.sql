ALTER SYSTEM SET cron.launch_active_jobs = 'off';

SELECT pg_catalog.pg_reload_conf();

DO $p3a4_ci_verify_cron_launcher$
BEGIN
  IF pg_catalog.current_setting('cron.launch_active_jobs', true) IS DISTINCT FROM 'off' THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: cron.launch_active_jobs is not off';
  END IF;
END;
$p3a4_ci_verify_cron_launcher$;
