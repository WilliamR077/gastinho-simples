#!/usr/bin/env bash
set -Eeuo pipefail

: "${P3A4_LOCAL_PROJECT:?P3A4_LOCAL_PROJECT is required}"
: "${P3A4_ARTIFACT_DIR:?P3A4_ARTIFACT_DIR is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

case "$P3A4_LOCAL_PROJECT" in
  "$RUNNER_TEMP"/*) ;;
  *) echo "P3A4_LOCAL_PROJECT must be inside RUNNER_TEMP" >&2; exit 1 ;;
esac

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
source_supabase="$repository_root/supabase"
target_supabase="$P3A4_LOCAL_PROJECT/supabase"
holding_dir="$P3A4_LOCAL_PROJECT/.p3a4-replay-inputs"
config_backup="$holding_dir/config.toml.replay"
bootstrap_log="$P3A4_ARTIFACT_DIR/bootstrap-metadata.txt"
raw_start_log="$RUNNER_TEMP/p3a4-supabase-start.raw.log"
raw_inspect_error="$RUNNER_TEMP/p3a4-db-inspect.raw.err"
moved_inputs=()
restore_required=false
database_container_id=""

restore_inputs() {
  cp "$config_backup" "$target_supabase/config.toml"
  local relative_path
  for relative_path in "${moved_inputs[@]}"; do
    mkdir -p "$(dirname "$target_supabase/$relative_path")"
    mv "$holding_dir/$relative_path" "$target_supabase/$relative_path"
  done
}

on_exit() {
  local status=$?
  trap - EXIT
  set +e
  rm -f -- "$raw_start_log" "$raw_inspect_error"
  if [[ "$restore_required" == true ]]; then
    restore_inputs
    if [[ $? -ne 0 ]]; then
      echo "Failed to restore temporarily held Supabase inputs" >&2
      status=1
    fi
  fi
  if [[ -n "$database_container_id" ]]; then
    docker ps -a --filter "id=$database_container_id" \
      --format '{{.ID}} {{.Names}} {{.Status}}' \
      >"$P3A4_ARTIFACT_DIR/bootstrap-container-status.txt" 2>/dev/null || true
  fi
  exit "$status"
}
trap on_exit EXIT

if [[ ! -f "$source_supabase/config.toml" ]] || [[ ! -d "$source_supabase/migrations" ]]; then
  echo "Versioned Supabase config or migrations are missing" >&2
  exit 1
fi
if [[ -e "$target_supabase" ]] || [[ -e "$holding_dir" ]]; then
  echo "Bootstrap target must be empty" >&2
  exit 1
fi

mkdir -p "$P3A4_ARTIFACT_DIR" "$target_supabase" "$holding_dir"
find "$source_supabase" -mindepth 1 -maxdepth 1 ! -name .temp \
  -exec cp -R '{}' "$target_supabase/" \;
test ! -e "$target_supabase/.temp"

sed -i -E 's/^project_id = .*/project_id = "p3a4-ci"/' "$target_supabase/config.toml"
project_id=$(sed -n -E 's/^project_id = "([^"]+)"/\1/p' "$target_supabase/config.toml")
if [[ "$project_id" != "p3a4-ci" ]]; then
  echo "Unable to establish the isolated local project_id" >&2
  exit 1
fi
cp "$target_supabase/config.toml" "$config_backup"

disable_sql_inputs() {
  local section=$1
  local paths_key=$2
  local input_file=$3
  local output_file=$4
  awk -v section="$section" -v paths_key="$paths_key" '
    BEGIN { inside = 0; found = 0; saw_enabled = 0; saw_paths = 0 }
    function finish_section() {
      if (inside) {
        if (!saw_enabled) print "enabled = false"
        if (!saw_paths) print paths_key " = []"
      }
    }
    /^\[/ {
      finish_section()
      inside = ($0 == section)
      if (inside) {
        found = 1
        saw_enabled = 0
        saw_paths = 0
      }
      print
      next
    }
    inside && /^[[:space:]]*enabled[[:space:]]*=/ {
      print "enabled = false"
      saw_enabled = 1
      next
    }
    inside && $0 ~ "^[[:space:]]*" paths_key "[[:space:]]*=" {
      print paths_key " = []"
      saw_paths = 1
      next
    }
    { print }
    END {
      finish_section()
      if (!found) {
        print ""
        print section
        print "enabled = false"
        print paths_key " = []"
      }
    }
  ' "$input_file" >"$output_file"
}

disable_sql_inputs '[db.migrations]' 'schema_paths' \
  "$target_supabase/config.toml" "$holding_dir/config.migrations-disabled.toml"
disable_sql_inputs '[db.seed]' 'sql_paths' \
  "$holding_dir/config.migrations-disabled.toml" "$target_supabase/config.toml"

shopt -s nullglob
for input_path in \
  "$target_supabase/migrations" \
  "$target_supabase"/seed*.sql \
  "$target_supabase/seeds" \
  "$target_supabase/schemas"; do
  [[ -e "$input_path" ]] || continue
  relative_path=${input_path#"$target_supabase"/}
  mkdir -p "$(dirname "$holding_dir/$relative_path")"
  mv "$input_path" "$holding_dir/$relative_path"
  moved_inputs+=("$relative_path")
done
shopt -u nullglob
restore_required=true

if [[ -e "$target_supabase/migrations" ]] \
   || compgen -G "$target_supabase/seed*.sql" >/dev/null \
   || [[ -e "$target_supabase/seeds" ]] \
   || [[ -e "$target_supabase/schemas" ]]; then
  echo "SQL inputs remain visible before the empty bootstrap start" >&2
  exit 1
fi
if [[ $(grep -c '^enabled = false$' "$target_supabase/config.toml") -ne 2 ]] \
   || ! grep -q '^schema_paths = \[\]$' "$target_supabase/config.toml" \
   || ! grep -q '^sql_paths = \[\]$' "$target_supabase/config.toml"; then
  echo "Temporary config did not disable every migration, schema, and seed SQL path" >&2
  exit 1
fi

{
  echo "project_id=$project_id"
  echo "bootstrap_migrations_visible=false"
  echo "bootstrap_seed_visible=false"
} >"$bootstrap_log"

umask 077
: >"$raw_start_log"
chmod 600 "$raw_start_log"
set +e
supabase start --workdir "$P3A4_LOCAL_PROJECT" >"$raw_start_log" 2>&1
start_status=$?
set -e
bash "$repository_root/scripts/ci/p3a4-collect-local-logs.sh" --sanitize \
  <"$raw_start_log" >"$P3A4_ARTIFACT_DIR/bootstrap-start.log"
rm -f -- "$raw_start_log"
if [[ $start_status -ne 0 ]]; then
  echo "Sanitized Supabase start diagnostics:" >&2
  tail -n 80 "$P3A4_ARTIFACT_DIR/bootstrap-start.log" >&2
  exit "$start_status"
fi
cat "$P3A4_ARTIFACT_DIR/bootstrap-start.log"

db_container_name="supabase_db_${project_id}"
if ! inspect_json=$(docker container inspect "$db_container_name" 2>"$raw_inspect_error"); then
  {
    echo "database_container_inspect=failed"
    docker ps -a --format '{{.ID}} {{.Names}} {{.Image}} {{.Status}}'
    bash "$repository_root/scripts/ci/p3a4-collect-local-logs.sh" --sanitize \
      <"$raw_inspect_error"
  } >"$P3A4_ARTIFACT_DIR/bootstrap-container-discovery.txt"
  rm -f -- "$raw_inspect_error"
  echo "The exact local database container does not exist: $db_container_name" >&2
  exit 1
fi
rm -f -- "$raw_inspect_error"

if ! inspect_fields=$(printf '%s' "$inspect_json" | node -e '
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    const objects = JSON.parse(input);
    if (!Array.isArray(objects) || objects.length !== 1) process.exit(2);
    const item = objects[0];
    const label = item.Config?.Labels?.["com.supabase.cli.project"] ?? "";
    console.log([
      item.Id ?? "",
      item.Name ?? "",
      item.Config?.Image ?? "",
      String(item.State?.Running ?? false),
      item.State?.Health?.Status ?? "",
      label,
    ].join("\t"));
  });
'); then
  echo "docker container inspect did not return exactly one valid object" >&2
  exit 1
fi

IFS=$'\t' read -r \
  database_container_id \
  inspected_container_name \
  database_container_image \
  database_container_running \
  database_container_health \
  project_label <<<"$inspect_fields"

if [[ -z "$database_container_id" ]] \
   || [[ "$inspected_container_name" != "/$db_container_name" ]] \
   || [[ "$database_container_image" != ghcr.io/supabase/postgres:* ]] \
   || [[ "$database_container_running" != "true" ]] \
   || [[ "$database_container_health" != "healthy" ]]; then
  echo "The exact local database container failed identity or health validation" >&2
  exit 1
fi

if [[ -z "$project_label" ]]; then
  project_label_present=false
  project_label_match=not_applicable
elif [[ "$project_label" == "$project_id" ]]; then
  project_label_present=true
  project_label_match=true
else
  echo "The optional project label conflicts with the isolated local project_id" >&2
  exit 1
fi

{
  echo "db_container_name=$db_container_name"
  echo "db_container_id=$database_container_id"
  echo "bootstrap_container_id=$database_container_id"
  echo "db_container_image=$database_container_image"
  echo "db_container_running=$database_container_running"
  echo "db_container_health=$database_container_health"
  echo "project_label_present=$project_label_present"
  echo "project_label_match=$project_label_match"
} >>"$bootstrap_log"

role_state=$(docker exec "$database_container_id" \
  psql --username supabase_admin --dbname postgres --no-psqlrc \
  --set ON_ERROR_STOP=1 --tuples-only --no-align --field-separator='|' \
  --command "SELECT rolname, rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user;")
if [[ "$role_state" != "supabase_admin|t" ]]; then
  echo "The local database session is not the expected supabase_admin superuser" >&2
  exit 1
fi
echo "supabase_admin_rolsuper=true" >>"$bootstrap_log"

docker exec "$database_container_id" \
  psql --username supabase_admin --dbname postgres --no-psqlrc \
  --set ON_ERROR_STOP=1 \
  --command "ALTER SYSTEM SET cron.launch_active_jobs = 'off';"

reload_result=$(docker exec "$database_container_id" \
  psql --username supabase_admin --dbname postgres --no-psqlrc \
  --set ON_ERROR_STOP=1 --tuples-only --no-align \
  --command "SELECT pg_catalog.pg_reload_conf();")
if [[ "$reload_result" != "t" ]]; then
  echo "PostgreSQL did not confirm the configuration reload" >&2
  exit 1
fi
echo "pg_reload_conf=true" >>"$bootstrap_log"

effective_value=$(docker exec "$database_container_id" \
  psql --username supabase_admin --dbname postgres --no-psqlrc \
  --set ON_ERROR_STOP=1 --tuples-only --no-align \
  --command "SELECT pg_catalog.current_setting('cron.launch_active_jobs');")
if [[ "$effective_value" != "off" ]]; then
  echo "cron.launch_active_jobs is not off in the new database session" >&2
  exit 1
fi
echo "cron_launcher_before_reset=off" >>"$bootstrap_log"

setting_source=$(docker exec "$database_container_id" \
  psql --username supabase_admin --dbname postgres --no-psqlrc \
  --set ON_ERROR_STOP=1 --tuples-only --no-align --field-separator='|' \
  --command "SELECT source, CASE WHEN sourcefile IS NULL THEN '' ELSE pg_catalog.regexp_replace(sourcefile, '^.*/', '') END FROM pg_catalog.pg_settings WHERE name = 'cron.launch_active_jobs';")
IFS='|' read -r setting_source_kind setting_source_file <<<"$setting_source"
if [[ -z "$setting_source_kind" ]]; then
  echo "pg_settings did not report the source of cron.launch_active_jobs" >&2
  exit 1
fi
echo "cron_setting_source=$setting_source" >>"$bootstrap_log"

restore_inputs
restore_required=false
cmp --silent "$config_backup" "$target_supabase/config.toml"

(
  cd "$source_supabase/migrations"
  find . -maxdepth 1 -type f -name '*.sql' -print0 \
    | sort -z \
    | xargs -0 sha256sum
) >"$P3A4_ARTIFACT_DIR/migrations-expected.sha256"
(
  cd "$target_supabase/migrations"
  find . -maxdepth 1 -type f -name '*.sql' -print0 \
    | sort -z \
    | xargs -0 sha256sum
) >"$P3A4_ARTIFACT_DIR/migrations-restored.sha256"
cmp --silent \
  "$P3A4_ARTIFACT_DIR/migrations-expected.sha256" \
  "$P3A4_ARTIFACT_DIR/migrations-restored.sha256"

cp "$repository_root/scripts/ci/fixtures/20251119213053_ci_disable_historical_cron_execution.sql" \
  "$target_supabase/migrations/"
cp "$repository_root/scripts/ci/fixtures/20260502001000_ci_historical_cron_prerequisites.sql" \
  "$target_supabase/migrations/"
cp "$repository_root/scripts/ci/fixtures/20260504014235_ci_deactivate_historical_cron_jobs.sql" \
  "$target_supabase/migrations/"

find "$target_supabase/migrations" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' \
  | sort >"$P3A4_ARTIFACT_DIR/migrations-replay-list.txt"

echo "Bootstrap completed; project SQL inputs restored for replay."
