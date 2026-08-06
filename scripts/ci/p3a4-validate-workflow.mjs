import { readFile, readdir } from "node:fs/promises";
import { parse } from "yaml";

const workflowPath = ".github/workflows/p3a4-database-validation.yml";
const cronGuardPath = "scripts/ci/fixtures/20251119213053_ci_disable_historical_cron_execution.sql";
const cronFixturePath = "scripts/ci/fixtures/20260502001000_ci_historical_cron_prerequisites.sql";
const cronAssertionPath = "scripts/ci/fixtures/p3a4_assert_historical_cron_safety.sql";
const files = [
  workflowPath,
  "scripts/ci/p3a4-concurrency.sh",
  "scripts/ci/p3a4-collect-local-logs.sh",
  cronGuardPath,
  cronFixturePath,
  cronAssertionPath,
];
const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));
const workflow = contents[0];
const combined = contents.join("\n");
const cronGuard = contents[3];
const cronFixture = contents[4];
const cronAssertions = contents[5];
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
  "cp scripts/ci/fixtures/20251119213053_ci_disable_historical_cron_execution.sql",
  "cp scripts/ci/fixtures/20260502001000_ci_historical_cron_prerequisites.sql",
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

const fixtureVersion = Number(cronFixturePath.match(/\/(\d+)_/)?.[1]);
if (!(fixtureVersion > 20260502000738 && fixtureVersion < 20260502001825)) {
  failures.push("historical cron fixture timestamp is outside the required migration interval");
}
const copyPosition = workflow.indexOf(`cp ${cronFixturePath}`);
const guardCopyPosition = workflow.indexOf(`cp ${cronGuardPath}`);
const startPosition = workflow.indexOf("supabase start --workdir");
if (copyPosition < 0 || guardCopyPosition < 0 || startPosition < 0
    || copyPosition > startPosition || guardCopyPosition > startPosition) {
  failures.push("historical cron fixtures must be copied before local Supabase starts");
}
if (!workflow.includes('"$P3A4_LOCAL_PROJECT/supabase/migrations/"')) {
  failures.push("historical cron fixture copy must target only the temporary migration directory");
}
if ((workflow.match(/p3a4_assert_historical_cron_safety\.sql/g) ?? []).length < 6) {
  failures.push("historical cron safety assertions must cover start and every reset transition");
}

const guardVersion = Number(cronGuardPath.match(/\/(\d+)_/)?.[1]);
if (!(guardVersion < 20251119213054)) {
  failures.push("historical cron guard must run before the first versioned cron schedule");
}

const fixtureAndAssertions = `${cronGuard}\n${cronFixture}\n${cronAssertions}`;
const unsafeFixtureTokens = [
  ["net", "http_post"].join("."),
  ["https", "://"].join(""),
  ["http", "://"].join(""),
  ["e", "yJ"].join(""),
];
for (const token of unsafeFixtureTokens) {
  if (fixtureAndAssertions.includes(token)) failures.push(`unsafe cron fixture token: ${token}`);
}
if (!cronFixture.includes("BEGIN;") || !cronFixture.includes("COMMIT;")) {
  failures.push("historical cron fixture must be explicitly transactional");
}
if (!cronGuard.includes("NEW.active := false") || !cronGuard.includes("BEFORE INSERT OR UPDATE ON cron.job")) {
  failures.push("historical cron guard must force every inserted or updated job inactive");
}
if (!cronFixture.includes("command = 'SELECT 1'") || !cronFixture.includes("active = false")) {
  failures.push("historical cron fixture must use inert commands and inactive jobs");
}

const config = await readFile("supabase/config.toml", "utf8");
const repositoryProjectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (repositoryProjectId && fixtureAndAssertions.includes(repositoryProjectId)) {
  failures.push("historical cron fixture contains the repository project identifier");
}

const targetVersion = "20260805130000";
const migrationVersions = (await readdir("supabase/migrations"))
  .map((name) => name.match(/^(\d+)_.*\.sql$/)?.[1])
  .filter(Boolean);
const previousOfTarget = (versions) => {
  const ordered = [...new Set(versions)].sort();
  const index = ordered.indexOf(targetVersion);
  return index > 0 ? ordered[index - 1] : undefined;
};
if (previousOfTarget(migrationVersions) !== previousOfTarget([
  ...migrationVersions,
  String(guardVersion),
  String(fixtureVersion),
])) {
  failures.push("historical cron fixture changes detection of the migration immediately before P3-A4");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("P3-A4 workflow policy checks passed.");
