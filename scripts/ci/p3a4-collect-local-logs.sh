#!/usr/bin/env bash
set -euo pipefail

artifact_dir="${P3A4_ARTIFACT_DIR:-${RUNNER_TEMP:-/tmp}/p3a4-artifacts}"
mkdir -p "$artifact_dir/supabase-logs"

git status --short >"$artifact_dir/git-status-final.txt"
git diff --stat >"$artifact_dir/git-diff-stat.txt"

sanitize() {
  sed -E \
    -e 's/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/[REDACTED_JWT]/g' \
    -e 's/((api[_-]?key|password|secret|token)[=:][[:space:]]*)[^[:space:]]+/\1[REDACTED]/Ig' \
    -e 's#postgres(ql)?://[^[:space:]]+#postgresql://[REDACTED]#Ig'
}

docker ps -a --format '{{.Names}} {{.Image}} {{.Status}}' \
  | grep -E '(^|[[:space:]])supabase|supabase_' \
  | sanitize >"$artifact_dir/supabase-containers.txt" || true

while IFS= read -r container; do
  safe_name=$(printf '%s' "$container" | tr -cd 'A-Za-z0-9_.-')
  docker logs "$container" 2>&1 | sanitize >"$artifact_dir/supabase-logs/${safe_name}.log" || true
done < <(docker ps -a --format '{{.Names}}' | grep -E '^supabase_' || true)
