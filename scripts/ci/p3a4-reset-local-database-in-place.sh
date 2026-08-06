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
target_version=""
history_mode="all"
no_seed=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario) scenario=${2:-}; shift 2 ;;
    --log-name) log_name=${2:-}; shift 2 ;;
    --expected-version) expected_version=${2:-}; shift 2 ;;
    --version) target_version=${2:-}; history_mode="through-version"; shift 2 ;;
    --no-seed) no_seed=true; shift ;;
    *) echo "Unsupported in-place reset argument" >&2; exit 1 ;;
  esac
done

if [[ ! "$scenario" =~ ^[a-z0-9_]+$ ]] \
   || [[ ! "$log_name" =~ ^[a-z0-9.-]+\.log$ ]] \
   || [[ ! "$expected_version" =~ ^[0-9]{14}$ ]] \
   || { [[ -n "$target_version" ]] && [[ ! "$target_version" =~ ^[0-9]{14}$ ]]; }; then
  echo "Invalid in-place reset scenario configuration" >&2
  exit 1
fi
if [[ -n "$target_version" && "$target_version" != "$expected_version" ]]; then
  echo "Reset version and expected migration version must match" >&2
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
p3a4_validate_local_db_url | tee -a "$metadata_file"
p3a4_inspect_local_database_container
p3a4_require_bootstrap_container
container_id_before=$P3A4_INSPECTED_CONTAINER_ID
p3a4_read_cron_launcher
cron_before=$P3A4_CRON_LAUNCHER

bash "$repository_root/scripts/ci/p3a4-prepare-extension-state-for-reset.sh" \
  --scenario "$scenario"
p3a4_inspect_local_database_container
p3a4_require_bootstrap_container
if [[ "$P3A4_INSPECTED_CONTAINER_ID" != "$container_id_before" ]]; then
  echo "P3-A4 CI isolation failed: local database container was replaced" >&2
  exit 1
fi
p3a4_read_cron_launcher

cmd=(
  supabase db reset
  --db-url "$P3A4_DB_URL"
  --workdir "$P3A4_LOCAL_PROJECT"
  --yes
)
if [[ -n "$target_version" ]]; then
  cmd+=(--version "$target_version")
fi
if [[ "$no_seed" == true ]]; then
  cmd+=(--no-seed)
fi

set +e
"${cmd[@]}" >"$raw_log" 2>&1
reset_status=$?
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

if [[ $reset_status -ne 0 ]]; then
  {
    echo "scenario=$scenario"
    echo "reset_mode=db_url_in_place"
    echo "reset_transport=db_url"
    echo "container_id_before=$container_id_before"
    echo "container_id_after=$container_id_after"
    echo "container_identity_preserved=true"
    echo "cron_launcher_before=$cron_before"
    echo "cron_launcher_after=$cron_after"
    echo "reset_result=failed"
    echo "${scenario}_container_id_before=$container_id_before"
    echo "${scenario}_container_id_after=$container_id_after"
    echo "${scenario}_identity_preserved=true"
    echo "${scenario}_cron_launcher_before=$cron_before"
    echo "${scenario}_cron_launcher_after=$cron_after"
    echo "${scenario}_reset_result=failed"
  } >>"$metadata_file"
  exit "$reset_status"
fi

p3a4_validate_migration_history "$expected_version" "$history_mode" "$scratch_dir"
{
  echo "scenario=$scenario"
  echo "reset_mode=db_url_in_place"
  echo "reset_transport=db_url"
  echo "container_id_before=$container_id_before"
  echo "container_id_after=$container_id_after"
  echo "container_identity_preserved=true"
  echo "cron_launcher_before=$cron_before"
  echo "cron_launcher_after=$cron_after"
  echo "reset_result=passed"
  echo "${scenario}_container_id_before=$container_id_before"
  echo "${scenario}_container_id_after=$container_id_after"
  echo "${scenario}_identity_preserved=true"
  echo "${scenario}_cron_launcher_before=$cron_before"
  echo "${scenario}_cron_launcher_after=$cron_after"
  echo "${scenario}_migration_history_accessible=true"
  echo "${scenario}_migration_history_latest=$P3A4_MIGRATION_HISTORY_LATEST"
  echo "${scenario}_migration_history_count=$P3A4_MIGRATION_HISTORY_COUNT"
  echo "${scenario}_reset_result=passed"
} >>"$metadata_file"
