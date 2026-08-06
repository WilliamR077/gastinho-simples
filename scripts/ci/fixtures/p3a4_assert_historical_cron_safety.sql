\set ON_ERROR_STOP on

DO $p3a4_ci_cron_assertions$
DECLARE
  v_has_rows boolean;
BEGIN
  IF pg_catalog.current_setting('cron.launch_active_jobs', true) IS DISTINCT FROM 'off' THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: cron.launch_active_jobs is not off';
  END IF;

  IF (SELECT pg_catalog.array_agg(jobid ORDER BY jobid) FROM cron.job)
     IS DISTINCT FROM ARRAY[3, 4, 5, 6]::bigint[] THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: expected only historical job IDs 3 through 6';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE active) THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: a local job is active';
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
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: historical job names do not match IDs 3 through 6';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobid BETWEEN 3 AND 5 AND command = 'SELECT 1'
  ) THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: the historical alter_job migration did not update every job';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cron.job_run_details WHERE jobid BETWEEN 3 AND 6
  ) THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: a historical job produced an execution record';
  END IF;

  IF pg_catalog.to_regclass('net.http_request_queue') IS NULL THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: local request queue cannot be audited';
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM net.http_request_queue)' INTO v_has_rows;
  IF v_has_rows THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: local request queue is not empty';
  END IF;

  IF pg_catalog.to_regclass('net._http_response') IS NULL THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: local response table cannot be audited';
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM net._http_response)' INTO v_has_rows;
  IF v_has_rows THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: local response table is not empty';
  END IF;
END;
$p3a4_ci_cron_assertions$;

SELECT jobid, jobname, schedule, active, command = 'SELECT 1' AS uses_fixture_command
FROM cron.job
ORDER BY jobid;

SELECT count(*) AS historical_job_run_count
FROM cron.job_run_details
WHERE jobid BETWEEN 3 AND 6;
