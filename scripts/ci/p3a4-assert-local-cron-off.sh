#!/usr/bin/env bash
set -Eeuo pipefail

: "${P3A4_DB_URL:?P3A4_DB_URL is required}"
: "${P3A4_ARTIFACT_DIR:?P3A4_ARTIFACT_DIR is required}"

check_name=${1:-unspecified}
if [[ ! "$check_name" =~ ^[A-Za-z0-9_.-]+$ ]]; then
  echo "Invalid cron assertion label" >&2
  exit 1
fi

effective_value=$(psql "$P3A4_DB_URL" --no-psqlrc \
  --set ON_ERROR_STOP=1 --tuples-only --no-align \
  --command "SELECT pg_catalog.current_setting('cron.launch_active_jobs');")
if [[ "$effective_value" != "off" ]]; then
  echo "cron.launch_active_jobs is not off at $check_name" >&2
  exit 1
fi

mkdir -p "$P3A4_ARTIFACT_DIR"
printf '%s|off\n' "$check_name" \
  | tee -a "$P3A4_ARTIFACT_DIR/cron-launcher-checks.txt"
