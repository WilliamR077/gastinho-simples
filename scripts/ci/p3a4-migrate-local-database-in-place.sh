#!/usr/bin/env bash
set -Eeuo pipefail

: "${P3A4_DB_URL:?P3A4_DB_URL is required}"
: "${P3A4_LOCAL_PROJECT:?P3A4_LOCAL_PROJECT is required}"
: "${P3A4_ARTIFACT_DIR:?P3A4_ARTIFACT_DIR is required}"
: "${P3A4_DB_CONTAINER_ID:?P3A4_DB_CONTAINER_ID is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
source "$repository_root/scripts/ci/p3a4-local-database-guard.sh"

scenario=""
log_name=""
expected_version=""
history_mode="all"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario) scenario=${2:-}; shift 2 ;;
    --log-name) log_name=${2:-}; shift 2 ;;
    --expected-version) expected_version=${2:-}; shift 2 ;;
    --history-through-version) history_mode="through-version"; shift ;;
    *) echo "Unsupported in-place migration argument" >&2; exit 1 ;;
  esac
done
if [[ ! "$scenario" =~ ^[a-z0-9_]+$ ]] \
   || [[ ! "$log_name" =~ ^[a-z0-9.-]+\.log$ ]] \
   || [[ ! "$expected_version" =~ ^[0-9]{14}$ ]]; then
  echo "Invalid in-place migration scenario configuration" >&2
  exit 1
fi

mkdir -p "$P3A4_ARTIFACT_DIR"
umask 077
raw_log=$(mktemp "$RUNNER_TEMP/p3a4-${scenario}.XXXXXX.raw.log")
scratch_dir=$(mktemp -d "$RUNNER_TEMP/p3a4-${scenario}.XXXXXX.history")
cleanup() {
  rm -f -- "$raw_log"
  rm -rf -- "$scratch_dir"
}
trap cleanup EXIT

metadata_file="$P3A4_ARTIFACT_DIR/database-operations-metadata.txt"
p3a4_validate_local_db_url >/dev/null
p3a4_inspect_local_database_container
p3a4_require_bootstrap_container
container_id_before=$P3A4_INSPECTED_CONTAINER_ID
p3a4_read_cron_launcher
cron_before=$P3A4_CRON_LAUNCHER

cmd=(
  supabase migration up
  --db-url "$P3A4_DB_URL"
  --workdir "$P3A4_LOCAL_PROJECT"
)
set +e
"${cmd[@]}" >"$raw_log" 2>&1
migration_status=$?
set -e
bash "$repository_root/scripts/ci/p3a4-collect-local-logs.sh" --sanitize \
  <"$raw_log" >"$P3A4_ARTIFACT_DIR/$log_name"
cat "$P3A4_ARTIFACT_DIR/$log_name"

p3a4_inspect_local_database_container
p3a4_require_bootstrap_container
container_id_after=$P3A4_INSPECTED_CONTAINER_ID
if [[ "$container_id_after" != "$container_id_before" ]]; then
  echo "P3-A4 CI isolation failed: local database container was replaced" >&2
  exit 1
fi
p3a4_read_cron_launcher
cron_after=$P3A4_CRON_LAUNCHER
p3a4_validate_migration_history "$expected_version" "$history_mode" "$scratch_dir"

{
  echo "scenario=$scenario"
  echo "migration_transport=db_url"
  echo "${scenario}_container_id_before=$container_id_before"
  echo "${scenario}_container_id_after=$container_id_after"
  echo "${scenario}_identity_preserved=true"
  echo "${scenario}_cron_launcher_before=$cron_before"
  echo "${scenario}_cron_launcher_after=$cron_after"
  echo "${scenario}_migration_history_accessible=true"
  echo "${scenario}_migration_history_latest=$P3A4_MIGRATION_HISTORY_LATEST"
  echo "${scenario}_migration_result_status=$migration_status"
} >>"$metadata_file"

exit "$migration_status"
