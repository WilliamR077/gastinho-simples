import { readFile, readdir } from "node:fs/promises";
import { parse } from "yaml";

const workflowPath = ".github/workflows/p3a4-database-validation.yml";
const fixtureDirectory = "scripts/ci/fixtures";
const cronGuardPath = `${fixtureDirectory}/20251119213053_ci_disable_historical_cron_execution.sql`;
const cronFixturePath = `${fixtureDirectory}/20260502001000_ci_historical_cron_prerequisites.sql`;
const cronFinalPath = `${fixtureDirectory}/20260504014235_ci_deactivate_historical_cron_jobs.sql`;
const cronAssertionPath = `${fixtureDirectory}/p3a4_assert_historical_cron_safety.sql`;
const files = [
  workflowPath,
  "scripts/ci/p3a4-concurrency.sh",
  "scripts/ci/p3a4-collect-local-logs.sh",
  cronGuardPath,
  cronFixturePath,
  cronFinalPath,
  cronAssertionPath,
];
const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));
const workflow = contents[0];
const combined = contents.join("\n");
const cronGuard = contents[3];
const cronFixture = contents[4];
const cronFinal = contents[5];
const cronAssertions = contents[6];
let document;
try {
  document = parse(workflow);
} catch (error) {
  console.error(`invalid workflow YAML: ${error.message}`);
  process.exit(1);
}

const required = [
  "push:",
  "codex/p3-a4-category-history-preservation",
  "pull_request:",
  "workflow_dispatch:",
  "permissions:\n  contents: read",
  "runs-on: ubuntu-latest",
  "timeout-minutes:",
  "concurrency:",
  "cancel-in-progress: true",
  "supabase db reset --local --no-seed",
  "supabase migration up --local",
  "supabase db lint --local --level error",
  "supabase test db",
  "supabase gen types --lang typescript --local",
  "npm run test:p3a4:category-history",
  "npm run typecheck:p3a4:category-history",
  "npm run build",
  `cp ${cronGuardPath}`,
  `cp ${cronFixturePath}`,
  `cp ${cronFinalPath}`,
  "p3a4_assert_historical_cron_safety.sql",
];
const forbidden = [
  ["supabase", "login"].join(" "),
  ["supabase", "link"].join(" "),
  ["--", "linked"].join(""),
  ["db", "push"].join(" "),
  ["functions", "deploy"].join(" "),
  ["continue-on", "error"].join("-"),
  ["secrets", "."].join(""),
];

const failures = [];
for (const token of required) {
  if (!workflow.includes(token)) failures.push(`missing required token: ${token}`);
}
for (const token of forbidden) {
  if (combined.toLowerCase().includes(token.toLowerCase())) failures.push(`forbidden token: ${token}`);
}
if ((workflow.match(/^\s{2}(push|pull_request|workflow_dispatch):/gm) ?? []).length < 3) {
  failures.push("workflow must expose push, pull_request, and workflow_dispatch triggers");
}
if (document?.permissions?.contents !== "read") failures.push("parsed permissions.contents must be read");
if (document?.jobs?.validate?.["runs-on"] !== "ubuntu-latest") failures.push("parsed runner must be ubuntu-latest");
if (!document?.on?.push || !document?.on?.pull_request || !("workflow_dispatch" in document.on)) {
  failures.push("parsed YAML is missing a required trigger");
}

const versionOf = (path) => Number(path.match(/\/(\d+)_/)?.[1]);
const guardVersion = versionOf(cronGuardPath);
const fixtureVersion = versionOf(cronFixturePath);
const finalVersion = versionOf(cronFinalPath);
if (!(guardVersion < 20251119213054)) {
  failures.push("historical cron guard must run before the first versioned cron schedule");
}
if (!(fixtureVersion > 20260502000738 && fixtureVersion < 20260502001825)) {
  failures.push("historical cron fixture timestamp is outside the required migration interval");
}

const migrationNames = (await readdir("supabase/migrations"))
  .filter((name) => /^\d+_.*\.sql$/.test(name));
const migrationEntries = await Promise.all(migrationNames.map(async (name) => ({
  name,
  contents: await readFile(`supabase/migrations/${name}`, "utf8"),
})));
const cronMigrationVersions = migrationEntries
  .filter(({ contents: sql }) => /cron\.(?:schedule(?:_in_database)?|alter_job|unschedule)|cron\.job\b/i.test(sql))
  .map(({ name }) => Number(name.match(/^(\d+)_/)?.[1]));
const lastCronMigrationVersion = Math.max(...cronMigrationVersions);
if (lastCronMigrationVersion !== 20260504014234) {
  failures.push(`unexpected last versioned cron migration: ${lastCronMigrationVersion}`);
}
if (finalVersion !== lastCronMigrationVersion + 1) {
  failures.push("final cron fixture must run immediately after the last versioned cron migration");
}

const startPosition = workflow.indexOf("supabase start --workdir");
for (const fixturePath of [cronGuardPath, cronFixturePath, cronFinalPath]) {
  const copyPosition = workflow.indexOf(`cp ${fixturePath}`);
  if (copyPosition < 0 || startPosition < 0 || copyPosition > startPosition) {
    failures.push(`${fixturePath} must be copied before local Supabase starts`);
  }
}
if (!workflow.includes('"$P3A4_LOCAL_PROJECT/supabase/migrations/"')) {
  failures.push("historical cron fixture copy must target only the temporary migration directory");
}
if ((workflow.match(/p3a4_assert_historical_cron_safety\.sql/g) ?? []).length < 6) {
  failures.push("historical cron safety assertions must cover start and every reset transition");
}

const fixtureNames = (await readdir(fixtureDirectory)).filter((name) => name.endsWith(".sql"));
const fixtureEntries = await Promise.all(fixtureNames.map(async (name) => ({
  name,
  sql: await readFile(`${fixtureDirectory}/${name}`, "utf8"),
})));
const forbiddenFixturePatterns = [
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

if (!cronGuard.includes("ALTER SYSTEM SET cron.launch_active_jobs = 'off';")) {
  failures.push("historical cron guard must disable cron.launch_active_jobs with ALTER SYSTEM");
}
if (!/SELECT\s+pg_catalog\.pg_reload_conf\(\);/i.test(cronGuard)) {
  failures.push("historical cron guard must reload the PostgreSQL configuration");
}
if (!/pg_catalog\.current_setting\('cron\.launch_active_jobs',\s*true\)/i.test(cronGuard)) {
  failures.push("historical cron guard must validate cron.launch_active_jobs");
}
if (/\bBEGIN\s*;/i.test(cronGuard)) {
  failures.push("ALTER SYSTEM cron guard cannot run inside an explicit transaction");
}
if (!cronFixture.includes("BEGIN;") || !cronFixture.includes("COMMIT;")) {
  failures.push("historical cron fixture must be explicitly transactional");
}
if (!cronFixture.includes("'0 0 31 2 *'") || !cronFixture.includes("'SELECT 1'")) {
  failures.push("historical cron fixture must create only inert auxiliary jobs");
}
if ((cronFixture.match(/cron\.alter_job\(/g) ?? []).length < 3) {
  failures.push("historical cron fixture must deactivate IDs 3 through 5 with cron.alter_job");
}
if (!cronFixture.includes("ARRAY[3, 4, 5]::bigint[]")) {
  failures.push("historical cron fixture must validate deterministic IDs 3 through 5");
}
if (!cronFinal.includes("BEGIN;") || !cronFinal.includes("COMMIT;")
    || !cronFinal.includes("cron.alter_job(")
    || !cronFinal.includes("ARRAY[3, 4, 5, 6]::bigint[]")
    || !/EXISTS\s*\(SELECT 1 FROM cron\.job WHERE active\)/i.test(cronFinal)) {
  failures.push("final cron fixture must identify and deactivate every replay job transactionally");
}
if (!/current_setting\('cron\.launch_active_jobs'/i.test(cronAssertions)
    || !/EXISTS\s*\(SELECT 1 FROM cron\.job WHERE active\)/i.test(cronAssertions)) {
  failures.push("final cron assertions must prove the launcher and every job are inactive");
}
if (/\b(?:PERFORM|CALL)\b|cron\.(?:schedule|alter_job|unschedule)\s*\(/i.test(cronAssertions)) {
  failures.push("final cron assertions must not invoke stored job commands or mutate cron state");
}

const config = await readFile("supabase/config.toml", "utf8");
const repositoryProjectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
const fixtureSql = fixtureEntries.map(({ sql }) => sql).join("\n");
if (repositoryProjectId && fixtureSql.includes(repositoryProjectId)) {
  failures.push("historical cron fixture contains the repository project identifier");
}

const targetVersion = "20260805130000";
const migrationVersions = migrationNames
  .map((name) => name.match(/^(\d+)_.*\.sql$/)?.[1])
  .filter(Boolean);
const previousOfTarget = (versions) => {
  const ordered = [...new Set(versions)].sort();
  const index = ordered.indexOf(targetVersion);
  return index > 0 ? ordered[index - 1] : undefined;
};
const detectedPrevious = previousOfTarget([
  ...migrationVersions,
  String(guardVersion),
  String(fixtureVersion),
  String(finalVersion),
]);
if (detectedPrevious !== "20260731030000") {
  failures.push(`unexpected migration immediately before P3-A4: ${detectedPrevious}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("P3-A4 workflow policy checks passed.");
