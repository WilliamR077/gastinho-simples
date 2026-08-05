import { readFile } from "node:fs/promises";
import { parse } from "yaml";

const workflowPath = ".github/workflows/p3a4-database-validation.yml";
const files = [
  workflowPath,
  "scripts/ci/p3a4-concurrency.sh",
  "scripts/ci/p3a4-collect-local-logs.sh",
];
const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));
const workflow = contents[0];
const combined = contents.join("\n");
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

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("P3-A4 workflow policy checks passed.");
