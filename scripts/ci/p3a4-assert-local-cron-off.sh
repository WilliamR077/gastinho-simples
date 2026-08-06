#!/usr/bin/env bash
set -Eeuo pipefail

: "${P3A4_DB_URL:?P3A4_DB_URL is required}"
: "${P3A4_LOCAL_PROJECT:?P3A4_LOCAL_PROJECT is required}"
: "${P3A4_ARTIFACT_DIR:?P3A4_ARTIFACT_DIR is required}"
: "${P3A4_DB_CONTAINER_ID:?P3A4_DB_CONTAINER_ID is required}"

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
source "$repository_root/scripts/ci/p3a4-local-database-guard.sh"

check_name=${1:-unspecified}
if [[ ! "$check_name" =~ ^[A-Za-z0-9_.-]+$ ]]; then
  echo "Invalid cron assertion label" >&2
  exit 1
fi

p3a4_validate_local_db_url >/dev/null
p3a4_inspect_local_database_container
p3a4_require_bootstrap_container
p3a4_read_cron_launcher

mkdir -p "$P3A4_ARTIFACT_DIR"
printf '%s|%s|off\n' "$check_name" "$P3A4_INSPECTED_CONTAINER_ID" \
  | tee -a "$P3A4_ARTIFACT_DIR/cron-launcher-checks.txt"
