\set ON_ERROR_STOP on

DO $p3a4_ci_cron_assertions$
DECLARE
  v_has_rows boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'cron.job'::regclass
      AND tgname = 'p3a4_ci_force_job_inactive'
      AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: inactive-job guard is missing';
  END IF;

  IF (SELECT array_agg(jobid ORDER BY jobid) FROM cron.job WHERE jobid BETWEEN 1 AND 5)
     IS DISTINCT FROM ARRAY[1, 2, 3, 4, 5]::bigint[] THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: historical job IDs 1 through 5 are incomplete';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE active) THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: a local job is active';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE (jobid = 1 AND (jobname <> 'p3a4-ci-historical-slot-1' OR command <> 'SELECT 1'))
       OR (jobid = 2 AND (jobname <> 'p3a4-ci-historical-slot-2' OR command <> 'SELECT 1'))
  ) THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: replay-only slots are not neutralized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobid = 3 AND jobname = 'check-recurring-reminders-daily'
  ) OR NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobid = 4 AND jobname = 'check-budget-goals-daily'
  ) OR NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobid = 5 AND jobname = 'check-budget-goals-morning'
  ) THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: historical job names do not match IDs 3, 4 and 5';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobid BETWEEN 3 AND 5 AND command = 'SELECT 1'
  ) THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: the historical alter_job migration did not update every job';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cron.job_run_details WHERE jobid BETWEEN 1 AND 5
  ) THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: a historical job produced an execution record';
  END IF;

  IF to_regclass('net.http_request_queue') IS NULL THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: local request queue cannot be audited';
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM net.http_request_queue)' INTO v_has_rows;
  IF v_has_rows THEN
    RAISE EXCEPTION 'P3-A4 CI cron safety failed: local request queue is not empty';
  END IF;

  IF to_regclass('net._http_response') IS NULL THEN
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
WHERE jobid BETWEEN 1 AND 5;
