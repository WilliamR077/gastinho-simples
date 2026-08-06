#!/usr/bin/env bash
set -Eeuo pipefail

artifact_dir="${P3A4_ARTIFACT_DIR:-${RUNNER_TEMP:-/tmp}/p3a4-artifacts}"
mode="${1:-collect}"

sanitize() {
  sed -E \
    -e '/(Publishable|Secret([[:space:]]+Key)?|Access[[:space:]]+Key|service[_ -]?role|anon[[:space:]_-]*key)/Id' \
    -e 's/sb_publishable_[A-Za-z0-9_-]+/[REDACTED_LOCAL_KEY]/g' \
    -e 's/sb_secret_[A-Za-z0-9_-]+/[REDACTED_LOCAL_KEY]/g' \
    -e 's/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/[REDACTED_JWT]/g' \
    -e 's/((api[_-]?key|password|secret|token)[=:][[:space:]]*)[^[:space:]]+/\1[REDACTED]/Ig' \
    -e 's#postgres(ql)?://[^:/[:space:]]+:[^@[:space:]]+@#postgresql://[REDACTED]@#Ig' \
    -e 's/\b[[:xdigit:]]{32,}\b/[REDACTED_HEX_KEY]/g'
}

scan_pattern() {
  local pattern_name=$1
  local pattern=$2
  local affected_file
  local found=false
  while IFS= read -r affected_file; do
    [[ -n "$affected_file" ]] || continue
    echo "artifact_secret_scan=failed" >&2
    echo "artifact_file=${affected_file#"$artifact_dir"/}" >&2
    echo "pattern=$pattern_name" >&2
    found=true
  done < <(grep -RIlE -- "$pattern" "$artifact_dir" 2>/dev/null || true)
  [[ "$found" == false ]]
}

scan_artifacts() {
  local status=0
  [[ -d "$artifact_dir" ]] || return 0
  scan_pattern "supabase_secret_key" 'sb_secret_[A-Za-z0-9_-]+' || status=1
  scan_pattern "supabase_publishable_key" 'sb_publishable_[A-Za-z0-9_-]+' || status=1
  scan_pattern "service_role_marker" 'service[_ -]?role' || status=1
  scan_pattern "jwt" 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' || status=1
  scan_pattern "postgres_credentials" 'postgres(ql)?://[^:/[:space:]]+:[^@[:space:]]+@' || status=1
  scan_pattern "secret_key_line" 'Secret[[:space:]]+Key' || status=1
  scan_pattern "access_key_line" 'Access[[:space:]]+Key' || status=1
  if [[ $status -ne 0 ]]; then
    return "$status"
  fi
  echo "artifact_secret_scan=passed"
}

if [[ "$mode" == "--sanitize" ]]; then
  sanitize
  exit $?
fi
if [[ "$mode" == "--scan-only" ]]; then
  scan_artifacts
  exit $?
fi
if [[ "$mode" != "collect" ]]; then
  echo "Unsupported collection mode" >&2
  exit 1
fi

mkdir -p "$artifact_dir/supabase-logs"
git status --short >"$artifact_dir/git-status-final.txt"
git diff --stat >"$artifact_dir/git-diff-stat.txt"

docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}' \
  | sanitize >"$artifact_dir/supabase-containers.txt" || true

database_container_id=""
database_container_name=""
if [[ -f "$artifact_dir/bootstrap-metadata.txt" ]]; then
  database_container_id=$(sed -n 's/^db_container_id=//p' "$artifact_dir/bootstrap-metadata.txt")
  database_container_name=$(sed -n 's/^db_container_name=//p' "$artifact_dir/bootstrap-metadata.txt")
fi
if [[ -n "$database_container_id" ]] && [[ "$database_container_id" =~ ^[[:xdigit:]]+$ ]] \
   && [[ "$database_container_name" == supabase_db_* ]]; then
  safe_name=$(printf '%s' "$database_container_name" | tr -cd 'A-Za-z0-9_.-')
  docker logs "$database_container_id" 2>&1 \
    | sanitize >"$artifact_dir/supabase-logs/${safe_name}.log" || true
fi

while IFS='|' read -r container_id container_name; do
  [[ -n "$container_id" ]] || continue
  [[ "$container_name" == supabase_* ]] || continue
  [[ "$container_name" != supabase_db_* ]] || continue
  safe_name=$(printf '%s' "$container_name" | tr -cd 'A-Za-z0-9_.-')
  docker logs "$container_id" 2>&1 \
    | sanitize >"$artifact_dir/supabase-logs/${safe_name}.log" || true
done < <(docker ps -a --format '{{.ID}}|{{.Names}}')
