BEGIN;

DO $p3a4_ci_historical_cron$
DECLARE
  v_job_3 bigint;
  v_job_4 bigint;
  v_job_5 bigint;
  v_last_value bigint;
  v_is_called boolean;
  v_unscheduled boolean;
BEGIN
  IF pg_catalog.current_setting('cron.launch_active_jobs', true) IS DISTINCT FROM 'off' THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: cron.launch_active_jobs is not off';
  END IF;

  IF pg_catalog.to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: cron.job is missing';
  END IF;

  IF (SELECT pg_catalog.array_agg(jobid ORDER BY jobid) FROM cron.job)
     IS DISTINCT FROM ARRAY[1, 2]::bigint[] THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: expected only job IDs 1 and 2';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobid = 1 AND jobname = 'check-recurring-reminders-daily'
  ) OR NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobid = 2 AND jobname = 'check-budget-goals-daily'
  ) THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: replay jobs 1 and 2 differ from the expected history';
  END IF;

  SELECT last_value, is_called
    INTO v_last_value, v_is_called
  FROM cron.jobid_seq;

  IF v_last_value <> 2 OR NOT v_is_called THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: job sequence is not positioned at 2';
  END IF;

  SELECT cron.unschedule(job_id := 1) INTO v_unscheduled;
  IF v_unscheduled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: could not remove replay job 1';
  END IF;

  SELECT cron.unschedule(job_id := 2) INTO v_unscheduled;
  IF v_unscheduled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: could not remove replay job 2';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job) THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: replay jobs 1 and 2 were not removed';
  END IF;

  SELECT cron.schedule(
    'check-recurring-reminders-daily', '0 0 31 2 *', 'SELECT 1'
  ) INTO v_job_3;
  SELECT cron.schedule(
    'check-budget-goals-daily', '0 0 31 2 *', 'SELECT 1'
  ) INTO v_job_4;
  SELECT cron.schedule(
    'check-budget-goals-morning', '0 0 31 2 *', 'SELECT 1'
  ) INTO v_job_5;

  IF ARRAY[v_job_3, v_job_4, v_job_5] IS DISTINCT FROM ARRAY[3, 4, 5]::bigint[] THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: expected deterministic job IDs 3, 4 and 5';
  END IF;

  PERFORM cron.alter_job(job_id := v_job_3, active := false);
  PERFORM cron.alter_job(job_id := v_job_4, active := false);
  PERFORM cron.alter_job(job_id := v_job_5, active := false);

  IF (SELECT pg_catalog.array_agg(jobid ORDER BY jobid) FROM cron.job)
     IS DISTINCT FROM ARRAY[3, 4, 5]::bigint[]
     OR EXISTS (SELECT 1 FROM cron.job WHERE active) THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: historical jobs are incomplete or active';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM cron.job
    WHERE schedule <> '0 0 31 2 *'
       OR command <> 'SELECT 1'
  ) THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: historical jobs are not inert';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cron.job_run_details WHERE jobid BETWEEN 1 AND 5
  ) THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: a fixture job was executed';
  END IF;
END;
$p3a4_ci_historical_cron$;

COMMIT;
