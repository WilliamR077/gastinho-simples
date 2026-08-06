#!/usr/bin/env bash
set -Eeuo pipefail

: "${P3A4_DB_URL:?P3A4_DB_URL is required}"
: "${P3A4_LOCAL_PROJECT:?P3A4_LOCAL_PROJECT is required}"
: "${P3A4_ARTIFACT_DIR:?P3A4_ARTIFACT_DIR is required}"
: "${P3A4_DB_CONTAINER_ID:?P3A4_DB_CONTAINER_ID is required}"

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
source "$repository_root/scripts/ci/p3a4-local-database-guard.sh"

scenario=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario) scenario=${2:-}; shift 2 ;;
    *) echo "Unsupported extension-state preparation argument" >&2; exit 1 ;;
  esac
done
if [[ ! "$scenario" =~ ^[a-z0-9_]+$ ]]; then
  echo "Invalid extension-state preparation scenario" >&2
  exit 1
fi

mkdir -p "$P3A4_ARTIFACT_DIR"
metadata_file="$P3A4_ARTIFACT_DIR/database-operations-metadata.txt"

p3a4_validate_local_db_url >/dev/null
p3a4_inspect_local_database_container
p3a4_require_bootstrap_container
container_id_before=$P3A4_INSPECTED_CONTAINER_ID
p3a4_read_cron_launcher

psql "$P3A4_DB_URL" --no-psqlrc --set ON_ERROR_STOP=1 <<'SQL'
DO $p3a4_extension_precheck$
BEGIN
  IF pg_catalog.to_regclass('cron.job') IS NULL
     OR pg_catalog.to_regclass('cron.jobid_seq') IS NULL
     OR pg_catalog.to_regclass('cron.job_run_details') IS NULL THEN
    RAISE EXCEPTION 'P3-A4 CI extension preparation failed: pg_cron state cannot be audited';
  END IF;
  IF pg_catalog.to_regclass('net.http_request_queue') IS NULL
     OR pg_catalog.to_regclass('net._http_response') IS NULL THEN
    RAISE EXCEPTION 'P3-A4 CI extension preparation failed: pg_net state cannot be audited';
  END IF;
END;
$p3a4_extension_precheck$;
SQL

cron_job_ids_before=$(psql "$P3A4_DB_URL" --no-psqlrc --set ON_ERROR_STOP=1 \
  --tuples-only --no-align --command \
  "SELECT COALESCE(pg_catalog.jsonb_agg(jobid ORDER BY jobid)::text, '[]') FROM cron.job")
cron_job_names_before=$(psql "$P3A4_DB_URL" --no-psqlrc --set ON_ERROR_STOP=1 \
  --tuples-only --no-align --command \
  "SELECT COALESCE(pg_catalog.jsonb_agg(jobname ORDER BY jobid)::text, '[]') FROM cron.job")
cron_job_active_before=$(psql "$P3A4_DB_URL" --no-psqlrc --set ON_ERROR_STOP=1 \
  --tuples-only --no-align --command \
  "SELECT COALESCE(pg_catalog.jsonb_agg(active ORDER BY jobid)::text, '[]') FROM cron.job")
IFS='|' read -r cron_sequence_last_before cron_sequence_called_before < <(
  psql "$P3A4_DB_URL" --no-psqlrc --set ON_ERROR_STOP=1 \
    --tuples-only --no-align --field-separator='|' \
    --command "SELECT last_value, is_called FROM cron.jobid_seq"
)
cron_run_details_before=$(psql "$P3A4_DB_URL" --no-psqlrc --set ON_ERROR_STOP=1 \
  --tuples-only --no-align --command "SELECT count(*) FROM cron.job_run_details")
pg_net_requests_before=$(psql "$P3A4_DB_URL" --no-psqlrc --set ON_ERROR_STOP=1 \
  --tuples-only --no-align --command "SELECT count(*) FROM net.http_request_queue")
pg_net_responses_before=$(psql "$P3A4_DB_URL" --no-psqlrc --set ON_ERROR_STOP=1 \
  --tuples-only --no-align --command "SELECT count(*) FROM net._http_response")

{
  echo "extension_reset_scenario=$scenario"
  echo "extension_reset_container_id=$container_id_before"
  echo "cron_jobs_before=${cron_job_ids_before}:${cron_job_names_before}:${cron_job_active_before}"
  echo "cron_job_ids_before=$cron_job_ids_before"
  echo "cron_job_names_before=$cron_job_names_before"
  echo "cron_job_active_before=$cron_job_active_before"
  echo "cron_sequence_before=${cron_sequence_last_before}:${cron_sequence_called_before}"
  echo "cron_job_run_details_before=$cron_run_details_before"
  echo "cron_job_run_details_count_before=$cron_run_details_before"
  echo "pg_net_request_queue_before=$pg_net_requests_before"
  echo "pg_net_request_queue_count_before=$pg_net_requests_before"
  echo "pg_net_response_before=$pg_net_responses_before"
  echo "pg_net_response_count_before=$pg_net_responses_before"
  echo "cron_launcher_before_extension_prepare=off"
} | bash "$repository_root/scripts/ci/p3a4-collect-local-logs.sh" --sanitize \
  >>"$metadata_file"

for evidence_count in \
  "$cron_run_details_before" \
  "$pg_net_requests_before" \
  "$pg_net_responses_before"; do
  if [[ ! "$evidence_count" =~ ^[0-9]+$ ]]; then
    echo "P3-A4 CI extension preparation failed: evidence count is invalid" >&2
    exit 1
  fi
done
if [[ "$cron_run_details_before" != "0" ]]; then
  echo "P3-A4 CI extension preparation aborted: cron execution evidence exists" >&2
  exit 1
fi
if [[ "$pg_net_requests_before" != "0" ]]; then
  echo "P3-A4 CI extension preparation aborted: pg_net request evidence exists" >&2
  exit 1
fi
if [[ "$pg_net_responses_before" != "0" ]]; then
  echo "P3-A4 CI extension preparation aborted: pg_net response evidence exists" >&2
  exit 1
fi

psql "$P3A4_DB_URL" --no-psqlrc --set ON_ERROR_STOP=1 <<'SQL'
DO $p3a4_extension_evidence_recheck$
DECLARE
  v_has_rows boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job_run_details) THEN
    RAISE EXCEPTION 'P3-A4 CI extension preparation aborted: cron execution evidence appeared';
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM net.http_request_queue)' INTO v_has_rows;
  IF v_has_rows THEN
    RAISE EXCEPTION 'P3-A4 CI extension preparation aborted: pg_net request evidence appeared';
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM net._http_response)' INTO v_has_rows;
  IF v_has_rows THEN
    RAISE EXCEPTION 'P3-A4 CI extension preparation aborted: pg_net response evidence appeared';
  END IF;
END;
$p3a4_extension_evidence_recheck$;
SQL

psql "$P3A4_DB_URL" --no-psqlrc --set ON_ERROR_STOP=1 <<'SQL'
DO $p3a4_unschedule_existing_jobs$
DECLARE
  v_job_id bigint;
  v_unscheduled boolean;
BEGIN
  FOR v_job_id IN SELECT jobid FROM cron.job ORDER BY jobid LOOP
    SELECT cron.unschedule(job_id := v_job_id) INTO v_unscheduled;
    IF v_unscheduled IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'P3-A4 CI extension preparation failed: cron.unschedule rejected job %', v_job_id;
    END IF;
  END LOOP;
END;
$p3a4_unschedule_existing_jobs$;
SQL

sequence_update_allowed=$(psql "$P3A4_DB_URL" --no-psqlrc --set ON_ERROR_STOP=1 \
  --tuples-only --no-align --command \
  "SELECT pg_catalog.has_sequence_privilege(current_user, 'cron.jobid_seq', 'UPDATE')")
p3a4_inspect_local_database_container
p3a4_require_bootstrap_container
if [[ "$sequence_update_allowed" == "t" ]]; then
  psql "$P3A4_DB_URL" --no-psqlrc --set ON_ERROR_STOP=1 \
    --command "SELECT pg_catalog.setval('cron.jobid_seq'::regclass, 1, false)" >/dev/null
elif [[ "$sequence_update_allowed" == "f" ]]; then
  docker exec "$P3A4_INSPECTED_CONTAINER_ID" \
    psql --username supabase_admin --dbname postgres --no-psqlrc \
    --set ON_ERROR_STOP=1 \
    --command "SELECT pg_catalog.setval('cron.jobid_seq'::regclass, 1, false)" >/dev/null
else
  echo "P3-A4 CI extension preparation failed: sequence privilege check was inconclusive" >&2
  exit 1
fi

p3a4_inspect_local_database_container
p3a4_require_bootstrap_container
if [[ "$P3A4_INSPECTED_CONTAINER_ID" != "$container_id_before" ]]; then
  echo "P3-A4 CI isolation failed: local database container was replaced" >&2
  exit 1
fi
p3a4_read_cron_launcher

psql "$P3A4_DB_URL" --no-psqlrc --set ON_ERROR_STOP=1 <<'SQL'
DO $p3a4_extension_postcheck$
DECLARE
  v_last_value bigint;
  v_is_called boolean;
  v_has_rows boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job) THEN
    RAISE EXCEPTION 'P3-A4 CI extension preparation failed: cron.job is not empty';
  END IF;
  SELECT last_value, is_called INTO v_last_value, v_is_called FROM cron.jobid_seq;
  IF v_last_value <> 1 OR v_is_called THEN
    RAISE EXCEPTION 'P3-A4 CI extension preparation failed: cron.jobid_seq is not initial';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job_run_details) THEN
    RAISE EXCEPTION 'P3-A4 CI extension preparation aborted: cron execution evidence appeared';
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM net.http_request_queue)' INTO v_has_rows;
  IF v_has_rows THEN
    RAISE EXCEPTION 'P3-A4 CI extension preparation aborted: pg_net request evidence appeared';
  END IF;
  EXECUTE 'SELECT EXISTS (SELECT 1 FROM net._http_response)' INTO v_has_rows;
  IF v_has_rows THEN
    RAISE EXCEPTION 'P3-A4 CI extension preparation aborted: pg_net response evidence appeared';
  END IF;
END;
$p3a4_extension_postcheck$;
SQL

{
  echo "extension_reset_scenario=$scenario"
  echo "extension_reset_container_id=$P3A4_INSPECTED_CONTAINER_ID"
  echo "cron_jobs_after=empty"
  echo "cron_sequence_after_initial=true"
  echo "cron_launcher_after_extension_prepare=off"
  echo "cron_run_details_count=0"
  echo "pg_net_request_queue_count=0"
  echo "pg_net_response_count=0"
  echo "extension_state_ready_for_replay=true"
} >>"$metadata_file"
