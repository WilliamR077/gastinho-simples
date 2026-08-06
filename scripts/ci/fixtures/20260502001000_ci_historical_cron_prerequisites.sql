BEGIN;

DO $p3a4_ci_historical_cron$
DECLARE
  v_job_3 bigint;
  v_job_4 bigint;
  v_job_5 bigint;
  v_last_value bigint;
  v_is_called boolean;
  v_updated integer;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: cron.job is missing';
  END IF;

  IF (SELECT array_agg(jobid ORDER BY jobid) FROM cron.job)
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

  -- Fresh replay assigns the first two versioned jobs to IDs 1 and 2. The
  -- historical database already had two occupied slots, so neutralize these
  -- replay-only rows before recreating the historical IDs below.
  UPDATE cron.job
  SET jobname = CASE jobid
        WHEN 1 THEN 'p3a4-ci-historical-slot-1'
        WHEN 2 THEN 'p3a4-ci-historical-slot-2'
      END,
      schedule = '0 0 31 2 *',
      command = 'SELECT 1',
      active = false
  WHERE jobid IN (1, 2);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> 2 THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: could not neutralize jobs 1 and 2';
  END IF;

  -- These inserts are invisible to the cron launcher until commit. They are
  -- disabled below in the same transaction, so no active state is committed.
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

  UPDATE cron.job
  SET active = false
  WHERE jobid IN (3, 4, 5);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated <> 3 OR EXISTS (
    SELECT 1 FROM cron.job WHERE jobid BETWEEN 1 AND 5 AND active
  ) THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: all historical jobs must remain inactive';
  END IF;

  IF EXISTS (
    SELECT 1 FROM cron.job_run_details WHERE jobid BETWEEN 1 AND 5
  ) THEN
    RAISE EXCEPTION 'P3-A4 CI cron prerequisite failed: a fixture job was executed';
  END IF;
END;
$p3a4_ci_historical_cron$;

COMMIT;
