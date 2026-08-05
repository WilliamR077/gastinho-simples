#!/usr/bin/env bash
set -euo pipefail

db_url="${P3A4_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
artifact_dir="${P3A4_ARTIFACT_DIR:-${RUNNER_TEMP:-/tmp}/p3a4-artifacts}"
mkdir -p "$artifact_dir"

user_id="c1000000-0000-4000-8000-000000000001"
delete_category="c1000000-0000-4000-8000-000000000011"
count_category="c1000000-0000-4000-8000-000000000012"
income_category="c1000000-0000-4000-8000-000000000013"
goal_one="c1000000-0000-4000-8000-000000000021"
goal_two="c1000000-0000-4000-8000-000000000022"
goal_three="c1000000-0000-4000-8000-000000000023"

export PGOPTIONS="-c statement_timeout=12000 -c lock_timeout=10000"
background_pids=()
cleanup() {
  for pid in "${background_pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

milliseconds() { date +%s%3N; }
assert_waited() {
  local elapsed="$1"
  local label="$2"
  if (( elapsed < 1800 )); then
    echo "$label did not wait for the category-scope lock (elapsed=${elapsed}ms)" >&2
    exit 1
  fi
}
wait_for_ready() {
  local marker="$1"
  local pid="$2"
  for _ in {1..100}; do
    if [[ -e "$marker" ]]; then
      rm -f -- "$marker"
      return 0
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Background PostgreSQL session exited before acquiring its lock" >&2
      wait "$pid"
      exit 1
    fi
    sleep 0.1
  done
  echo "Timed out waiting for the background PostgreSQL session to acquire its lock" >&2
  exit 1
}

psql "$db_url" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES ('$user_id', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'p3a4-concurrency@example.invalid', '', now(), now(), now());

INSERT INTO public.user_categories (id, user_id, name, icon, color, is_default, is_active)
VALUES
  ('$delete_category', '$user_id', 'Delete lock', 'lock', '#111111', false, false),
  ('$count_category', '$user_id', 'Count lock', 'lock', '#222222', false, true);

INSERT INTO public.user_income_categories (id, user_id, name, icon, color, is_default, is_active)
VALUES ('$income_category', '$user_id', 'Income lock', 'lock', '#333333', false, true);
SQL

echo "Scenario 1: budget-goal writer acquires the expense lock first"
psql "$db_url" -v ON_ERROR_STOP=1 >"$artifact_dir/concurrency-1-session-a.log" 2>&1 <<SQL &
SELECT 'session_a_pid=' || pg_backend_pid();
BEGIN;
INSERT INTO public.budget_goals (id, user_id, type, category, limit_amount)
VALUES ('$goal_one', '$user_id', 'category', '$delete_category', 100);
\! touch "$artifact_dir/concurrency-1.ready"
SELECT pg_sleep(3);
COMMIT;
SQL
session_a=$!
background_pids+=("$session_a")
wait_for_ready "$artifact_dir/concurrency-1.ready" "$session_a"
start=$(milliseconds)
set +e
psql "$db_url" -v ON_ERROR_STOP=1 >"$artifact_dir/concurrency-1-session-b.log" 2>&1 <<SQL
SELECT 'session_b_pid=' || pg_backend_pid();
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$user_id', true);
SELECT public.p3a4_delete_category('expense', '$delete_category');
COMMIT;
SQL
session_b_status=$?
set -e
elapsed=$(( $(milliseconds) - start ))
wait "$session_a"
background_pids=()
assert_waited "$elapsed" "Scenario 1 session B"
if (( session_b_status == 0 )); then
  echo "Scenario 1 deletion unexpectedly succeeded" >&2
  exit 1
fi
grep -q "category still has references" "$artifact_dir/concurrency-1-session-b.log"
psql "$db_url" -v ON_ERROR_STOP=1 -Atc \
  "SELECT CASE WHEN EXISTS (SELECT 1 FROM public.user_categories WHERE id='$delete_category') AND EXISTS (SELECT 1 FROM public.budget_goals WHERE id='$goal_one' AND category='$delete_category') THEN 'scenario_1_consistent' ELSE 'scenario_1_invalid' END" \
  | grep -q '^scenario_1_consistent$'
echo "scenario_1 elapsed_ms=$elapsed expected_error=category_still_has_references"

echo "Scenario 2: category operation acquires the expense lock first"
psql "$db_url" -v ON_ERROR_STOP=1 >"$artifact_dir/concurrency-2-session-a.log" 2>&1 <<SQL &
SELECT 'session_a_pid=' || pg_backend_pid();
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$user_id', true);
SELECT public.p3a4_category_reference_counts('expense', '$count_category');
\! touch "$artifact_dir/concurrency-2.ready"
SELECT pg_sleep(3);
COMMIT;
SQL
session_a=$!
background_pids+=("$session_a")
wait_for_ready "$artifact_dir/concurrency-2.ready" "$session_a"
start=$(milliseconds)
psql "$db_url" -v ON_ERROR_STOP=1 >"$artifact_dir/concurrency-2-session-b.log" 2>&1 <<SQL
SELECT 'session_b_pid=' || pg_backend_pid();
INSERT INTO public.budget_goals (id, user_id, type, category, limit_amount)
VALUES ('$goal_two', '$user_id', 'category', '$count_category', 200);
SQL
elapsed=$(( $(milliseconds) - start ))
wait "$session_a"
background_pids=()
assert_waited "$elapsed" "Scenario 2 session B"
psql "$db_url" -v ON_ERROR_STOP=1 -Atc \
  "SELECT CASE WHEN EXISTS (SELECT 1 FROM public.budget_goals WHERE id='$goal_two' AND category='$count_category') THEN 'scenario_2_consistent' ELSE 'scenario_2_invalid' END" \
  | grep -q '^scenario_2_consistent$'
echo "scenario_2 elapsed_ms=$elapsed result=consistent"

echo "Scenario 3: expense and income scopes remain independent"
psql "$db_url" -v ON_ERROR_STOP=1 >"$artifact_dir/concurrency-3-session-a.log" 2>&1 <<SQL &
SELECT 'session_a_pid=' || pg_backend_pid();
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$user_id', true);
SELECT public.p3a4_category_reference_counts('expense', '$count_category');
\! touch "$artifact_dir/concurrency-3.ready"
SELECT pg_sleep(3);
COMMIT;
SQL
session_a=$!
background_pids+=("$session_a")
wait_for_ready "$artifact_dir/concurrency-3.ready" "$session_a"
start=$(milliseconds)
psql "$db_url" -v ON_ERROR_STOP=1 >"$artifact_dir/concurrency-3-session-b.log" 2>&1 <<SQL
SELECT 'session_b_pid=' || pg_backend_pid();
INSERT INTO public.budget_goals (id, user_id, type, category, limit_amount)
VALUES ('$goal_three', '$user_id', 'income_category', '$income_category', 300);
SQL
elapsed=$(( $(milliseconds) - start ))
wait "$session_a"
background_pids=()
if (( elapsed >= 1800 )); then
  echo "Scenario 3 independent income write was blocked (elapsed=${elapsed}ms)" >&2
  exit 1
fi
echo "scenario_3 elapsed_ms=$elapsed result=independent_scopes"

echo "All concurrency scenarios passed. Connection strings and credentials were not logged."
