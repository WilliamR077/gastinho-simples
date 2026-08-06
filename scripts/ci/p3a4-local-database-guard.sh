#!/usr/bin/env bash

p3a4_validate_local_db_url() {
  : "${P3A4_DB_URL:?P3A4_DB_URL is required}"
  : "${PGSSLMODE:?PGSSLMODE is required}"

  if ! node <<'NODE'
const raw = process.env.P3A4_DB_URL;
const sslMode = process.env.PGSSLMODE;
let target;
try {
  target = new URL(raw);
} catch {
  process.exit(1);
}

const parameters = [...target.searchParams.entries()];
const validParameters = parameters.length <= 1
  && parameters.every(([key, value]) => key === "sslmode" && value === "disable");
const sslDisabled = target.searchParams.get("sslmode") === "disable" || sslMode === "disable";
if (!(["postgres:", "postgresql:"].includes(target.protocol))
    || target.hostname !== "127.0.0.1"
    || target.port !== "54322"
    || target.pathname !== "/postgres"
    || target.username !== "postgres"
    || target.hash !== ""
    || !validParameters
    || !sslDisabled
    || sslMode !== "disable") {
  process.exit(1);
}
NODE
  then
    echo "P3-A4 CI isolation failed: database target is not the approved local PostgreSQL endpoint" >&2
    return 1
  fi

  printf '%s\n' \
    "db_target_scheme=postgresql" \
    "db_target_host=127.0.0.1" \
    "db_target_port=54322" \
    "db_target_database=postgres" \
    "db_target_sslmode=disable" \
    "db_target_verified_local=true"
}

p3a4_inspect_local_database_container() {
  : "${P3A4_LOCAL_PROJECT:?P3A4_LOCAL_PROJECT is required}"
  local config_file="$P3A4_LOCAL_PROJECT/supabase/config.toml"
  local project_id inspect_json inspect_fields

  project_id=$(sed -n -E 's/^project_id = "([A-Za-z0-9_-]+)"/\1/p' "$config_file")
  if [[ -z "$project_id" ]]; then
    echo "P3-A4 CI isolation failed: isolated project_id is unavailable" >&2
    return 1
  fi

  P3A4_INSPECTED_CONTAINER_NAME="supabase_db_${project_id}"
  if ! inspect_json=$(docker container inspect "$P3A4_INSPECTED_CONTAINER_NAME" 2>/dev/null); then
    echo "P3-A4 CI isolation failed: exact local database container is unavailable" >&2
    return 1
  fi

  if ! inspect_fields=$(printf '%s' "$inspect_json" | node -e '
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => {
      const objects = JSON.parse(input);
      if (!Array.isArray(objects) || objects.length !== 1) process.exit(2);
      const item = objects[0];
      console.log([
        item.Id ?? "",
        item.Name ?? "",
        String(item.State?.Running ?? false),
        item.State?.Health?.Status ?? "",
      ].join("\t"));
    });
  '); then
    echo "P3-A4 CI isolation failed: container inspection was not singular" >&2
    return 1
  fi

  IFS=$'\t' read -r \
    P3A4_INSPECTED_CONTAINER_ID \
    inspected_name \
    P3A4_INSPECTED_CONTAINER_RUNNING \
    P3A4_INSPECTED_CONTAINER_HEALTH <<<"$inspect_fields"

  if [[ ! "$P3A4_INSPECTED_CONTAINER_ID" =~ ^[[:xdigit:]]{64}$ ]] \
     || [[ "$inspected_name" != "/$P3A4_INSPECTED_CONTAINER_NAME" ]] \
     || [[ "$P3A4_INSPECTED_CONTAINER_RUNNING" != "true" ]] \
     || [[ "$P3A4_INSPECTED_CONTAINER_HEALTH" != "healthy" ]]; then
    echo "P3-A4 CI isolation failed: local database container is not running and healthy" >&2
    return 1
  fi
}

p3a4_require_bootstrap_container() {
  : "${P3A4_DB_CONTAINER_ID:?P3A4_DB_CONTAINER_ID is required}"
  if [[ "$P3A4_INSPECTED_CONTAINER_ID" != "$P3A4_DB_CONTAINER_ID" ]]; then
    echo "P3-A4 CI isolation failed: local database container was replaced" >&2
    return 1
  fi
}

p3a4_read_cron_launcher() {
  P3A4_CRON_LAUNCHER=$(psql "$P3A4_DB_URL" --no-psqlrc \
    --set ON_ERROR_STOP=1 --tuples-only --no-align \
    --command "SELECT pg_catalog.current_setting('cron.launch_active_jobs');")
  if [[ "$P3A4_CRON_LAUNCHER" != "off" ]]; then
    echo "P3-A4 CI isolation failed: cron.launch_active_jobs is not off" >&2
    return 1
  fi
}

p3a4_validate_migration_history() {
  local expected_version=$1
  local history_mode=$2
  local scratch_dir=$3
  local migrations_dir="$P3A4_LOCAL_PROJECT/supabase/migrations"
  local expected_file="$scratch_dir/expected-migrations.txt"
  local applied_file="$scratch_dir/applied-migrations.txt"
  local actual_latest expected_latest

  if [[ ! "$expected_version" =~ ^[0-9]{14}$ ]] \
     || [[ "$history_mode" != "all" && "$history_mode" != "through-version" ]]; then
    echo "P3-A4 CI isolation failed: invalid migration-history expectation" >&2
    return 1
  fi

  find "$migrations_dir" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' \
    | sed -n -E 's/^([0-9]{14})_.*/\1/p' \
    | sort -u >"$expected_file"
  if [[ "$history_mode" == "through-version" ]]; then
    awk -v target="$expected_version" '$0 <= target' "$expected_file" >"$expected_file.filtered"
    mv "$expected_file.filtered" "$expected_file"
  fi

  expected_latest=$(tail -n 1 "$expected_file")
  if [[ "$expected_latest" != "$expected_version" ]]; then
    echo "P3-A4 CI isolation failed: expected migration target is absent from replay inputs" >&2
    return 1
  fi

  if ! psql "$P3A4_DB_URL" --no-psqlrc --set ON_ERROR_STOP=1 \
    --tuples-only --no-align \
    --command "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version" \
    | sed '/^[[:space:]]*$/d' >"$applied_file"; then
    echo "P3-A4 CI isolation failed: migration history is not accessible" >&2
    return 1
  fi

  actual_latest=$(tail -n 1 "$applied_file")
  if [[ "$actual_latest" != "$expected_version" ]] || ! cmp --silent "$expected_file" "$applied_file"; then
    echo "P3-A4 CI isolation failed: migration history does not match the expected replay set" >&2
    return 1
  fi

  P3A4_MIGRATION_HISTORY_LATEST="$actual_latest"
  P3A4_MIGRATION_HISTORY_COUNT=$(wc -l <"$applied_file" | tr -d '[:space:]')
}
