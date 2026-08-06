BEGIN;

DO $p3a4_ci_deactivate_historical_cron_jobs$
DECLARE
  v_job record;
BEGIN
  IF pg_catalog.current_setting('cron.launch_active_jobs', true) IS DISTINCT FROM 'off' THEN
    RAISE EXCEPTION 'P3-A4 CI final cron safety failed: cron.launch_active_jobs is not off';
  END IF;

  IF (SELECT pg_catalog.array_agg(jobid ORDER BY jobid) FROM cron.job)
     IS DISTINCT FROM ARRAY[3, 4, 5, 6]::bigint[] THEN
    RAISE EXCEPTION 'P3-A4 CI final cron safety failed: expected only replay job IDs 3 through 6';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobid = 3 AND jobname = 'check-recurring-reminders-daily'
  ) OR NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobid = 4 AND jobname = 'check-budget-goals-daily'
  ) OR NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobid = 5 AND jobname = 'check-budget-goals-morning'
  ) OR NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobid = 6 AND jobname = 'cleanup-rate-limit-events'
  ) THEN
    RAISE EXCEPTION 'P3-A4 CI final cron safety failed: replay job names do not match IDs 3 through 6';
  END IF;

  FOR v_job IN
    SELECT jobid FROM cron.job WHERE jobid BETWEEN 3 AND 6 ORDER BY jobid
  LOOP
    PERFORM cron.alter_job(job_id := v_job.jobid, active := false);
  END LOOP;

  IF EXISTS (SELECT 1 FROM cron.job WHERE active) THEN
    RAISE EXCEPTION 'P3-A4 CI final cron safety failed: a replay job remains active';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cron.job_run_details WHERE jobid BETWEEN 3 AND 6
  ) THEN
    RAISE EXCEPTION 'P3-A4 CI final cron safety failed: a replay job was executed';
  END IF;
END;
$p3a4_ci_deactivate_historical_cron_jobs$;

COMMIT;
