import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parse } from "yaml";

const workflowPath = ".github/workflows/p3a4-database-validation.yml";
const bootstrapPath = "scripts/ci/p3a4-bootstrap-local-supabase.sh";
const cronOffAssertionPath = "scripts/ci/p3a4-assert-local-cron-off.sh";
const localGuardPath = "scripts/ci/p3a4-local-database-guard.sh";
const resetInPlacePath = "scripts/ci/p3a4-reset-local-database-in-place.sh";
const migrationInPlacePath = "scripts/ci/p3a4-migrate-local-database-in-place.sh";
const extensionPreparePath = "scripts/ci/p3a4-prepare-extension-state-for-reset.sh";
const fixtureDirectory = "scripts/ci/fixtures";
const cronGuardPath = `${fixtureDirectory}/20251119213053_ci_disable_historical_cron_execution.sql`;
const cronFixturePath = `${fixtureDirectory}/20260502001000_ci_historical_cron_prerequisites.sql`;
const cronFinalPath = `${fixtureDirectory}/20260504014235_ci_deactivate_historical_cron_jobs.sql`;
const cronAssertionPath = `${fixtureDirectory}/p3a4_assert_historical_cron_safety.sql`;
const policyPaths = [
  workflowPath,
  bootstrapPath,
  cronOffAssertionPath,
  localGuardPath,
  resetInPlacePath,
  migrationInPlacePath,
  extensionPreparePath,
  "scripts/ci/p3a4-concurrency.sh",
  "scripts/ci/p3a4-collect-local-logs.sh",
  cronGuardPath,
  cronFixturePath,
  cronFinalPath,
  cronAssertionPath,
];
const policyContents = await Promise.all(policyPaths.map((file) => readFile(file, "utf8")));
const contentByPath = new Map(policyPaths.map((path, index) => [path, policyContents[index]]));
const workflow = contentByPath.get(workflowPath);
const bootstrap = contentByPath.get(bootstrapPath);
const cronOffAssertion = contentByPath.get(cronOffAssertionPath);
const localGuard = contentByPath.get(localGuardPath);
const resetInPlace = contentByPath.get(resetInPlacePath);
const migrationInPlace = contentByPath.get(migrationInPlacePath);
const extensionPrepare = contentByPath.get(extensionPreparePath);
const collectLogs = contentByPath.get("scripts/ci/p3a4-collect-local-logs.sh");
const cronGuard = contentByPath.get(cronGuardPath);
const cronFixture = contentByPath.get(cronFixturePath);
const cronFinal = contentByPath.get(cronFinalPath);
const cronAssertions = contentByPath.get(cronAssertionPath);
const combined = policyContents.join("\n");
const remoteOperationContents = [
  workflow,
  bootstrap,
  cronOffAssertion,
  localGuard,
  resetInPlace,
  migrationInPlace,
  extensionPrepare,
  contentByPath.get("scripts/ci/p3a4-concurrency.sh"),
].join("\n");
const failures = [];

let document;
try {
  document = parse(workflow);
} catch (error) {
  console.error(`invalid workflow YAML: ${error.message}`);
  process.exit(1);
}

const workflowRequired = [
  "push:",
  "codex/p3-a4-category-history-preservation",
  "pull_request:",
  "workflow_dispatch:",
  "permissions:\n  contents: read",
  "runs-on: ubuntu-latest",
  "timeout-minutes:",
  "concurrency:",
  "cancel-in-progress: true",
  `bash ${bootstrapPath}`,
  `bash ${cronOffAssertionPath}`,
  `bash ${resetInPlacePath}`,
  `bash ${migrationInPlacePath}`,
  "PGSSLMODE: disable",
  "?sslmode=disable",
  "initial-full-reset.log",
  "pre-p3a4-reset.log",
  "negative-backfill-reset.log",
  "positive-backfill-reset.log",
  "final-full-reset.log",
  "cron_launcher_before_each_operation=off",
  "cron_launcher_after_each_operation=off",
  "supabase db lint --local --level error",
  "supabase test db",
  "supabase gen types --lang typescript --local",
  "npm run test:p3a4:category-history",
  "npm run typecheck:p3a4:category-history",
  "npm run build",
  "last-migration-after-initial-reset.txt",
  "last-migration-after-final-reset.txt",
  "bootstrap_container_id=",
  "Scan artifacts for credential material",
  "id: artifact_scan",
  "p3a4-collect-local-logs.sh --scan-only",
  "steps.artifact_scan.outcome == 'success'",
];
for (const token of workflowRequired) {
  if (!workflow.includes(token)) failures.push(`missing required workflow token: ${token}`);
}

const forbiddenRemoteTokens = [
  ["supabase", "login"].join(" "),
  ["supabase", "link"].join(" "),
  ["--", "linked"].join(""),
  ["db", "push"].join(" "),
  ["functions", "deploy"].join(" "),
  ["supabase", "stop"].join(" "),
  ["--", "project-ref"].join(""),
  ".supabase.co",
  ".supabase.net",
  ["continue-on", "error"].join("-"),
  ["secrets", "."].join(""),
];
for (const token of forbiddenRemoteTokens) {
  if (remoteOperationContents.toLowerCase().includes(token.toLowerCase())) failures.push(`forbidden token: ${token}`);
}
if ((workflow.match(/^\s{2}(push|pull_request|workflow_dispatch):/gm) ?? []).length < 3) {
  failures.push("workflow must expose push, pull_request, and workflow_dispatch triggers");
}
if (document?.permissions?.contents !== "read") failures.push("parsed permissions.contents must be read");
if (document?.jobs?.validate?.["runs-on"] !== "ubuntu-latest") failures.push("parsed runner must be ubuntu-latest");
if (!document?.on?.push || !document?.on?.pull_request || !("workflow_dispatch" in document.on)) {
  failures.push("parsed YAML is missing a required trigger");
}
const configuredDbUrl = document?.jobs?.validate?.env?.P3A4_DB_URL;
try {
  const target = new URL(configuredDbUrl);
  const parameters = [...target.searchParams.entries()];
  if (target.protocol !== "postgresql:"
      || target.hostname !== "127.0.0.1"
      || target.port !== "54322"
      || target.pathname !== "/postgres"
      || target.username !== "postgres"
      || parameters.length !== 1
      || parameters[0][0] !== "sslmode"
      || parameters[0][1] !== "disable") {
    failures.push("workflow database URL must be the exact approved local endpoint with sslmode disabled");
  }
} catch {
  failures.push("workflow database URL is invalid");
}
if (document?.jobs?.validate?.env?.PGSSLMODE !== "disable") {
  failures.push("workflow must control PGSSLMODE=disable");
}

const resetCalls = workflow.match(/p3a4-reset-local-database-in-place\.sh/g) ?? [];
if (resetCalls.length !== 5) failures.push("workflow must use exactly five in-place reset scenarios");
const migrationCalls = workflow.match(/p3a4-migrate-local-database-in-place\.sh/g) ?? [];
if (migrationCalls.length !== 2) failures.push("workflow must use the guarded migration-up runner twice");
if ((workflow.match(/p3a4_assert_historical_cron_safety\.sql/g) ?? []).length < 6) {
  failures.push("historical cron safety assertions must cover initial replay and every later transition");
}
const transitionTokens = [
  "before-negative-migration-up", "after-negative-migration-up",
  "before-positive-migration-up", "after-positive-migration-up",
];
for (const token of transitionTokens) {
  if (!workflow.includes(token)) failures.push(`missing cron launcher transition assertion: ${token}`);
}

const privilegedSettingCommand = ["ALTER", "SYSTEM", "SET cron.launch_active_jobs = 'off';"].join(" ");
if ((bootstrap.match(new RegExp(privilegedSettingCommand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length !== 1) {
  failures.push("bootstrap must contain exactly one privileged cron launcher setting command");
}
for (const [path, contents] of contentByPath) {
  if (path !== bootstrapPath && contents.includes(privilegedSettingCommand)) {
    failures.push(`privileged cron launcher setting command is forbidden outside bootstrap: ${path}`);
  }
}

const bootstrapRequired = [
  "set -Eeuo pipefail",
  "P3A4_LOCAL_PROJECT is required",
  "P3A4_ARTIFACT_DIR is required",
  "RUNNER_TEMP is required",
  "trap on_exit EXIT",
  "restore_inputs",
  "config.toml.replay",
  "[db.migrations]",
  "schema_paths",
  "[db.seed]",
  "sql_paths",
  'supabase start --workdir "$P3A4_LOCAL_PROJECT"',
  'db_container_name="supabase_db_${project_id}"',
  'docker container inspect "$db_container_name"',
  "objects.length !== 1",
  "item.Name",
  "item.Config?.Image",
  "item.State?.Running",
  "item.State?.Health?.Status",
  '"com.supabase.cli.project"',
  '"/$db_container_name"',
  "ghcr.io/supabase/postgres:",
  'project_label_present=false',
  'project_label_match=not_applicable',
  'project_label_match=true',
  'docker exec "$database_container_id"',
  "--username supabase_admin",
  "SELECT rolname, rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user;",
  "supabase_admin|t",
  "SELECT pg_catalog.pg_reload_conf();",
  "SELECT pg_catalog.current_setting('cron.launch_active_jobs');",
  "pg_catalog.pg_settings",
  "migrations-expected.sha256",
  "migrations-restored.sha256",
  "cmp --silent",
  `fixtures/20251119213053_ci_disable_historical_cron_execution.sql`,
  `fixtures/20260502001000_ci_historical_cron_prerequisites.sql`,
  `fixtures/20260504014235_ci_deactivate_historical_cron_jobs.sql`,
  "migrations-replay-list.txt",
  "bootstrap-container-status.txt",
  "bootstrap-metadata.txt",
  "cron_setting_source=",
  'raw_start_log="$RUNNER_TEMP/',
  'chmod 600 "$raw_start_log"',
  '>"$raw_start_log" 2>&1',
  'p3a4-collect-local-logs.sh" --sanitize',
  'rm -f -- "$raw_start_log"',
  "db_container_name=",
  "db_container_id=",
  "bootstrap_container_id=",
  "db_container_image=",
  "db_container_running=",
  "db_container_health=",
  "project_label_present=",
  "project_label_match=",
  "cron_launcher_before_reset=off",
];
for (const token of bootstrapRequired) {
  if (!bootstrap.includes(token)) failures.push(`missing required bootstrap token: ${token}`);
}
if (bootstrap.includes("eval")) failures.push("bootstrap must not use eval");
if (/docker\s+ps[^\n]*\|\s*grep/i.test(bootstrap)) {
  failures.push("database container selection must not use broad docker ps grep");
}
if (/docker\s+ps[^\n]*\|\s*(?:head|tail)\b/i.test(bootstrap)) {
  failures.push("database container selection must not depend on docker ps position");
}
if (/docker\s+ps[^\n]*--filter[^\n]*com\.supabase\.cli\.project/i.test(bootstrap)) {
  failures.push("project label must not be a mandatory container-selection filter");
}
if (/supabase start[^\n]*(?:\n[^\n]*)?\|\s*tee/i.test(bootstrap)) {
  failures.push("raw supabase start output must not be piped through tee");
}
const dockerExecCalls = bootstrap.match(/docker exec\s+"[^"]+"/g) ?? [];
if (dockerExecCalls.length < 5
    || dockerExecCalls.some((call) => call !== 'docker exec "$database_container_id"')) {
  failures.push("every privileged container command must use the confirmed database container ID");
}
const startPosition = bootstrap.indexOf('supabase start --workdir "$P3A4_LOCAL_PROJECT"');
const movePosition = bootstrap.indexOf('mv "$input_path" "$holding_dir/$relative_path"');
const inspectPosition = bootstrap.indexOf('docker container inspect "$db_container_name"');
const privilegedPosition = bootstrap.indexOf(privilegedSettingCommand);
const reloadPosition = bootstrap.indexOf("SELECT pg_catalog.pg_reload_conf();");
const effectivePosition = bootstrap.indexOf("SELECT pg_catalog.current_setting('cron.launch_active_jobs');");
const restorePosition = bootstrap.lastIndexOf("restore_inputs\n");
const fixtureCopyPosition = bootstrap.indexOf("fixtures/20251119213053_ci_disable_historical_cron_execution.sql");
if (!(movePosition >= 0 && movePosition < startPosition
    && startPosition < inspectPosition
    && inspectPosition < privilegedPosition
    && privilegedPosition < reloadPosition
    && reloadPosition < effectivePosition
    && effectivePosition < restorePosition
    && restorePosition < fixtureCopyPosition)) {
  failures.push("bootstrap two-phase ordering is invalid");
}
if ((bootstrap.match(/supabase start --workdir/g) ?? []).length !== 1) {
  failures.push("bootstrap must start exactly one disposable Supabase stack");
}

const guardRequired = [
  "p3a4_validate_local_db_url",
  '["postgres:", "postgresql:"]',
  'target.hostname !== "127.0.0.1"',
  'target.port !== "54322"',
  'target.pathname !== "/postgres"',
  'target.username !== "postgres"',
  'key === "sslmode" && value === "disable"',
  'sslMode !== "disable"',
  "db_target_scheme=postgresql",
  "db_target_host=127.0.0.1",
  "db_target_port=54322",
  "db_target_database=postgres",
  "db_target_sslmode=disable",
  "db_target_verified_local=true",
  'P3A4_INSPECTED_CONTAINER_NAME="supabase_db_${project_id}"',
  'docker container inspect "$P3A4_INSPECTED_CONTAINER_NAME"',
  'P3A4_INSPECTED_CONTAINER_ID" != "$P3A4_DB_CONTAINER_ID',
  "P3-A4 CI isolation failed: local database container was replaced",
  "P3A4_INSPECTED_CONTAINER_RUNNING",
  "P3A4_INSPECTED_CONTAINER_HEALTH",
  "p3a4_validate_migration_history",
  "supabase_migrations.schema_migrations",
  'history_mode" == "through-version',
  'cmp --silent "$expected_file" "$applied_file"',
];
for (const token of guardRequired) {
  if (!localGuard.includes(token)) failures.push(`missing required local database guard token: ${token}`);
}
if (localGuard.includes("eval")) failures.push("local database guard must not use eval");

const resetRequired = [
  "set -Eeuo pipefail",
  'source "$repository_root/scripts/ci/p3a4-local-database-guard.sh"',
  `bash "$repository_root/${extensionPreparePath}"`,
  "cmd=(",
  "supabase db reset",
  '--db-url "$P3A4_DB_URL"',
  '--workdir "$P3A4_LOCAL_PROJECT"',
  "--yes",
  'cmd+=(--version "$target_version")',
  "cmd+=(--no-seed)",
  '"${cmd[@]}" >"$raw_log" 2>&1',
  'trap cleanup EXIT',
  'p3a4-collect-local-logs.sh" --sanitize',
  "container_id_before",
  "container_id_after",
  "container_identity_preserved=true",
  "cron_launcher_before=",
  "cron_launcher_after=",
  "reset_mode=db_url_in_place",
  "reset_transport=db_url",
  "migration_history_accessible=true",
  'echo "reset_result=passed"',
];
for (const token of resetRequired) {
  if (!resetInPlace.includes(token)) failures.push(`missing required in-place reset token: ${token}`);
}
if (resetInPlace.includes("eval")) failures.push("in-place reset must not use eval");
if (resetInPlace.includes("--local") || resetInPlace.includes("--linked")
    || /supabase\s+db\s+reset[^\n]*(?:--local|--linked)/i.test(resetInPlace)) {
  failures.push("in-place reset must not use local or linked transport flags");
}
if (/\$raw_log[^\n]*\|\s*tee|supabase\s+db\s+reset[^\n]*(?:\n[^\n]*){0,6}\|\s*tee/i.test(resetInPlace)) {
  failures.push("raw reset output must never be piped through tee");
}
const resetUrlPosition = resetInPlace.indexOf("p3a4_validate_local_db_url");
const resetContainerPosition = resetInPlace.indexOf("p3a4_inspect_local_database_container");
const resetCronPosition = resetInPlace.indexOf("p3a4_read_cron_launcher");
const extensionPreparePosition = resetInPlace.indexOf(extensionPreparePath);
const postPrepareContainerPosition = resetInPlace.indexOf(
  "p3a4_inspect_local_database_container",
  extensionPreparePosition,
);
const postPrepareCronPosition = resetInPlace.indexOf("p3a4_read_cron_launcher", extensionPreparePosition);
const resetCommandPosition = resetInPlace.indexOf("supabase db reset");
if (!(resetUrlPosition >= 0
    && resetUrlPosition < resetContainerPosition
    && resetContainerPosition < resetCronPosition
    && resetCronPosition < extensionPreparePosition
    && extensionPreparePosition < postPrepareContainerPosition
    && postPrepareContainerPosition < postPrepareCronPosition
    && postPrepareCronPosition < resetCommandPosition)) {
  failures.push("extension state preparation must be guarded and immediately precede every in-place reset");
}

const extensionPrepareRequired = [
  "set -Eeuo pipefail",
  "p3a4_validate_local_db_url",
  "p3a4_inspect_local_database_container",
  "p3a4_require_bootstrap_container",
  "p3a4_read_cron_launcher",
  "cron.unschedule(job_id := v_job_id)",
  "cron.jobid_seq",
  "pg_catalog.has_sequence_privilege",
  "pg_catalog.setval('cron.jobid_seq'::regclass, 1, false)",
  'docker exec "$P3A4_INSPECTED_CONTAINER_ID"',
  "--username supabase_admin",
  "cron.job is not empty",
  "v_last_value <> 1 OR v_is_called",
  "cron.job_run_details",
  "net.http_request_queue",
  "net._http_response",
  "cron execution evidence exists",
  "pg_net request evidence exists",
  "pg_net response evidence exists",
  'p3a4-collect-local-logs.sh" --sanitize',
  "extension_reset_scenario=",
  "extension_reset_container_id=",
  "cron_jobs_before=",
  "cron_job_ids_before=",
  "cron_job_names_before=",
  "cron_job_active_before=",
  "cron_sequence_before=",
  "cron_job_run_details_count_before=",
  "pg_net_request_queue_count_before=",
  "pg_net_response_count_before=",
  "cron_launcher_before_extension_prepare=off",
  "cron_jobs_after=empty",
  "cron_sequence_after_initial=true",
  "cron_launcher_after_extension_prepare=off",
  "cron_run_details_count=0",
  "pg_net_request_queue_count=0",
  "pg_net_response_count=0",
  "extension_state_ready_for_replay=true",
];
for (const token of extensionPrepareRequired) {
  if (!extensionPrepare.includes(token)) failures.push(`missing required extension preparation token: ${token}`);
}
if ((resetInPlace.match(new RegExp(extensionPreparePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length !== 1) {
  failures.push("all five resets must share exactly one centralized extension preparation call");
}
if (migrationInPlace.includes(extensionPreparePath)) {
  failures.push("migration up must not normalize extension state");
}
const forbiddenExtensionStatePatterns = [
  [/(?:delete\s+from|update|insert\s+into|truncate(?:\s+table)?)\s+cron\.job\b/i, "direct DML on cron.job"],
  [/alter\s+table\s+(?:only\s+)?cron\.job\b/i, "ALTER TABLE cron.job"],
  [/create\s+(?:constraint\s+)?trigger\b[^;]*\bon\s+cron\.job\b/is, "CREATE TRIGGER on cron.job"],
  [/create\s+rule\b[^;]*\bon\s+cron\.job\b/is, "CREATE RULE on cron.job"],
  [/(?:delete\s+from|update|insert\s+into|truncate(?:\s+table)?)\s+cron\.job_run_details\b/i, "cleanup of cron execution evidence"],
  [/(?:delete\s+from|update|insert\s+into|truncate(?:\s+table)?)\s+net\.(?:http_request_queue|_http_response)\b/i, "cleanup of pg_net evidence"],
  [/alter\s+sequence\s+cron\.jobid_seq\b/i, "structural change to cron.jobid_seq"],
  [/docker\s+(?:restart|rm)\b|docker\s+volume\s+rm\b|supabase\s+stop\b/i, "container, volume, or stack replacement"],
  [/\beval\b/i, "eval"],
];
for (const [pattern, label] of forbiddenExtensionStatePatterns) {
  if (pattern.test(combined)) failures.push(`P3-A4 CI policy contains forbidden ${label}`);
}
const extensionDockerExecCalls = extensionPrepare.match(/docker exec\s+"[^"]+"/g) ?? [];
if (extensionDockerExecCalls.length !== 1
    || extensionDockerExecCalls[0] !== 'docker exec "$P3A4_INSPECTED_CONTAINER_ID"') {
  failures.push("the only privileged extension operation must use the preserved container ID");
}
const extensionEvidencePosition = extensionPrepare.indexOf("cron_job_run_details_count_before=");
const extensionAbortPosition = extensionPrepare.indexOf('if [[ "$cron_run_details_before" != "0" ]]');
const extensionUnschedulePosition = extensionPrepare.indexOf("cron.unschedule(job_id := v_job_id)");
const extensionSequencePosition = extensionPrepare.indexOf("pg_catalog.setval('cron.jobid_seq'::regclass, 1, false)");
const extensionPostcheckPosition = extensionPrepare.indexOf("$p3a4_extension_postcheck$");
if (!(extensionEvidencePosition >= 0
    && extensionEvidencePosition < extensionAbortPosition
    && extensionAbortPosition < extensionUnschedulePosition
    && extensionUnschedulePosition < extensionSequencePosition
    && extensionSequencePosition < extensionPostcheckPosition)) {
  failures.push("extension evidence must be recorded before abort checks and normalization");
}
if (/docker\s+(?:restart|rm)\b|docker\s+volume\s+rm\b|supabase\s+stop\b/i.test(remoteOperationContents)) {
  failures.push("CI operations must not restart/remove containers, remove volumes, or stop the stack");
}

const migrationRequired = [
  "set -Eeuo pipefail",
  "cmd=(",
  "supabase migration up",
  '--db-url "$P3A4_DB_URL"',
  '--workdir "$P3A4_LOCAL_PROJECT"',
  '"${cmd[@]}" >"$raw_log" 2>&1',
  "container_id_before",
  "container_id_after",
  "identity_preserved=true",
  "cron_launcher_before",
  "cron_launcher_after",
  "p3a4_validate_migration_history",
  "migration_transport=db_url",
];
for (const token of migrationRequired) {
  if (!migrationInPlace.includes(token)) failures.push(`missing required in-place migration token: ${token}`);
}
if (migrationInPlace.includes("eval") || migrationInPlace.includes("--local")
    || migrationInPlace.includes("--linked")
    || /supabase\s+migration\s+up[^\n]*(?:--local|--linked)/i.test(migrationInPlace)) {
  failures.push("in-place migration up must use an array and explicit db-url without local/linked mode");
}

const resetOccurrences = policyContents.reduce(
  (count, contents) => count + (contents.match(/supabase\s+db\s+reset/g) ?? []).length,
  0,
);
if (resetOccurrences !== 1 || (resetInPlace.match(/supabase\s+db\s+reset/g) ?? []).length !== 1) {
  failures.push("every post-bootstrap reset must be centralized in the in-place db-url script");
}
if (/supabase\s+db\s+reset[^\n]*(?:--local|--linked)/i.test(combined)
    || /supabase\s+migration\s+up[^\n]*(?:--local|--linked)/i.test(combined)) {
  failures.push("reset and migration-up operations must never use local or linked mode after bootstrap");
}
if ((combined.match(/ALTER SYSTEM SET cron\.launch_active_jobs = 'off';/g) ?? []).length !== 1) {
  failures.push("cron launcher configuration must be applied exactly once, only during bootstrap");
}
if (workflow.includes("eval")) failures.push("workflow must not use eval");

const collectorRequired = [
  "set -Eeuo pipefail",
  '"--sanitize"',
  '"--scan-only"',
  "artifact_secret_scan=failed",
  "artifact_secret_scan=passed",
  "artifact_file=",
  "pattern=",
  "supabase_secret_key",
  "supabase_publishable_key",
  "service_role_marker",
  "jwt",
  "postgres_credentials",
  "postgres_url",
  "remote_supabase_url",
  "project_ref_line",
  "project_ref_argument",
  "secret_key_line",
  "access_key_line",
  'db_container_id=',
  'docker logs "$database_container_id"',
  '[[ "$container_name" != supabase_db_* ]]',
];
for (const token of collectorRequired) {
  if (!collectLogs.includes(token)) failures.push(`missing required artifact protection token: ${token}`);
}
if (/docker logs\s+"\$container_name"/i.test(collectLogs)) {
  failures.push("docker logs must use inspected container IDs rather than names");
}
if (!cronOffAssertion.includes("set -Eeuo pipefail")
    || !cronOffAssertion.includes('source "$repository_root/scripts/ci/p3a4-local-database-guard.sh"')
    || !cronOffAssertion.includes("p3a4_validate_local_db_url")
    || !cronOffAssertion.includes("p3a4_require_bootstrap_container")
    || !cronOffAssertion.includes("p3a4_read_cron_launcher")) {
  failures.push("read-only cron launcher assertion script is incomplete");
}
if (/(?:alter|update|insert|delete|grant|create|perform|call)\b/i.test(cronOffAssertion)) {
  failures.push("cron launcher assertion script must remain read-only");
}

const fixtureNames = (await readdir(fixtureDirectory)).filter((name) => name.endsWith(".sql"));
const fixtureEntries = await Promise.all(fixtureNames.map(async (name) => ({
  name,
  sql: await readFile(`${fixtureDirectory}/${name}`, "utf8"),
})));
const unsafeRuntimeContent = [
  workflow,
  bootstrap,
  cronOffAssertion,
  localGuard,
  resetInPlace,
  migrationInPlace,
  extensionPrepare,
  ...fixtureEntries.map(({ sql }) => sql),
].join("\n");
if (/sb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}/i.test(unsafeRuntimeContent)
    || /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(unsafeRuntimeContent)) {
  failures.push("CI runtime files contain concrete local credential material");
}
const forbiddenFixturePatterns = [
  [/alter\s+system\b/i, "privileged parameter change"],
  [/create\s+(?:or\s+replace\s+)?function\s+cron\s*\./i, "CREATE FUNCTION in schema cron"],
  [/create\s+(?:constraint\s+)?trigger\b[^;]*\bon\s+cron\s*\.\s*job\b/is, "CREATE TRIGGER on cron.job"],
  [/create\s+rule\b[^;]*\bon\s+cron\s*\.\s*job\b/is, "CREATE RULE on cron.job"],
  [/alter\s+table\s+(?:only\s+)?cron\s*\.\s*job\b/i, "ALTER TABLE cron.job"],
  [/grant\b[^;]*\bon\b[^;]*cron\s*\.\s*job\b/is, "GRANT on cron.job"],
  [/alter\s+(?:table|schema|function)\b[^;]*\bowner\s+to\b/is, "owner change"],
  [/(?:insert\s+into|update|delete\s+from)\s+cron\s*\.\s*job\b/i, "direct DML on cron.job"],
  [/net\s*\.\s*http_post\b/i, "net.http_post"],
  [/https?:\/\//i, "endpoint"],
  [/\b(?:authorization|bearer|password|secret|api[_-]?key|token)\b/i, "credential or secret"],
  [/\beyJ[A-Za-z0-9_-]+/i, "JWT"],
];
for (const { name, sql } of fixtureEntries) {
  for (const [pattern, label] of forbiddenFixturePatterns) {
    if (pattern.test(sql)) failures.push(`${name} contains forbidden ${label}`);
  }
}
if (!/pg_catalog\.current_setting\('cron\.launch_active_jobs',\s*true\)/i.test(cronGuard)) {
  failures.push("initial cron fixture must validate the preconfigured launcher value");
}
if (/pg_reload_conf|cron\.(?:schedule|alter_job|unschedule)|\b(?:insert|update|delete|grant|create)\b/i.test(cronGuard)) {
  failures.push("initial cron fixture must be a read-only guard");
}
if (!cronFixture.includes("BEGIN;") || !cronFixture.includes("COMMIT;")
    || !cronFixture.includes("'0 0 31 2 *'") || !cronFixture.includes("'SELECT 1'")
    || (cronFixture.match(/cron\.alter_job\(/g) ?? []).length < 3
    || !cronFixture.includes("ARRAY[3, 4, 5]::bigint[]")) {
  failures.push("historical cron prerequisite fixture no longer preserves inert IDs 3 through 5");
}
if (!cronFinal.includes("BEGIN;") || !cronFinal.includes("COMMIT;")
    || !cronFinal.includes("cron.alter_job(")
    || !cronFinal.includes("ARRAY[3, 4, 5, 6]::bigint[]")
    || !/EXISTS\s*\(SELECT 1 FROM cron\.job WHERE active\)/i.test(cronFinal)) {
  failures.push("final cron fixture must identify and deactivate every replay job transactionally");
}
if (!/current_setting\('cron\.launch_active_jobs'/i.test(cronAssertions)
    || !/EXISTS\s*\(SELECT 1 FROM cron\.job WHERE active\)/i.test(cronAssertions)
    || /\b(?:PERFORM|CALL)\b|cron\.(?:schedule|alter_job|unschedule)\s*\(/i.test(cronAssertions)) {
  failures.push("post-replay cron assertions must be read-only and prove every job inactive");
}

const forbiddenPrivilegePatterns = [
  [/\balter\s+role\b/i, ["ALTER", "ROLE"].join(" ")],
  [/\bgrant\b[^\n;]*\bsuperuser\b/i, ["GRANT", "SUPERUSER"].join(" ")],
  [/\bowner\s+to\b/i, "owner change"],
];
for (const [pattern, label] of forbiddenPrivilegePatterns) {
  if (pattern.test(combined)) failures.push(`forbidden privilege operation: ${label}`);
}

const config = await readFile("supabase/config.toml", "utf8");
const repositoryProjectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (repositoryProjectId && combined.includes(repositoryProjectId)) {
  failures.push("CI bootstrap policy files contain the repository project identifier");
}

const versionOf = (path) => Number(path.match(/\/(\d+)_/)?.[1]);
const guardVersion = versionOf(cronGuardPath);
const fixtureVersion = versionOf(cronFixturePath);
const finalVersion = versionOf(cronFinalPath);
if (!(guardVersion < 20251119213054)) failures.push("cron guard must precede the first historical schedule");
if (!(fixtureVersion > 20260502000738 && fixtureVersion < 20260502001825)) {
  failures.push("historical cron fixture timestamp is outside the required interval");
}
const migrationNames = (await readdir("supabase/migrations")).filter((name) => /^\d+_.*\.sql$/.test(name));
const migrationEntries = await Promise.all(migrationNames.map(async (name) => ({
  name,
  contents: await readFile(`supabase/migrations/${name}`, "utf8"),
})));
const migrationDigest = createHash("sha256");
for (const { name, contents } of [...migrationEntries].sort((a, b) => a.name.localeCompare(b.name))) {
  migrationDigest.update(name);
  migrationDigest.update("\0");
  migrationDigest.update(contents.replace(/\r\n/g, "\n"));
  migrationDigest.update("\0");
}
if (migrationEntries.length !== 65
    || migrationDigest.digest("hex") !== "1128377317104eeddebfc1a2ff6be96ad47dccdfa584e0cf1bcb0f4b91d508f5") {
  failures.push("versioned migration byte manifest differs from the approved baseline");
}
const cronMigrationVersions = migrationEntries
  .filter(({ contents: sql }) => /cron\.(?:schedule(?:_in_database)?|alter_job|unschedule)|cron\.job\b/i.test(sql))
  .map(({ name }) => Number(name.match(/^(\d+)_/)?.[1]));
const lastCronMigrationVersion = Math.max(...cronMigrationVersions);
if (lastCronMigrationVersion !== 20260504014234 || finalVersion !== lastCronMigrationVersion + 1) {
  failures.push("final cron fixture is not immediately after the last versioned cron migration");
}

const targetVersion = "20260805130000";
const migrationVersions = migrationNames.map((name) => name.match(/^(\d+)_/)?.[1]).filter(Boolean);
if ([...migrationVersions].sort().at(-1) !== targetVersion) {
  failures.push(`unexpected latest project migration: ${[...migrationVersions].sort().at(-1)}`);
}
const orderedVersions = [...new Set([
  ...migrationVersions,
  String(guardVersion),
  String(fixtureVersion),
  String(finalVersion),
])].sort();
const targetIndex = orderedVersions.indexOf(targetVersion);
const detectedPrevious = targetIndex > 0 ? orderedVersions[targetIndex - 1] : undefined;
if (detectedPrevious !== "20260731030000") {
  failures.push(`unexpected migration immediately before P3-A4: ${detectedPrevious}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("P3-A4 workflow policy checks passed.");
