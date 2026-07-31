import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const expectedMigrationName =
  "20260731001344_remove_empty_orphan_family_groups.sql";
const expectedMigrationPath = `supabase/migrations/${expectedMigrationName}`;
const targetGroupIds = [
  "35d36f8d-1d3c-4cc4-896a-46872bbe9b75",
  "55c7716c-1e38-48b9-978f-d16b52305310",
  "5d77b853-ff7f-4247-bc66-09b4ae32cf55",
  "cf7d4e2a-b925-404e-9ecc-9f814adf15b0",
];
const expectedCreatorId = "65e6ec36-089b-41f9-af7a-eaba92e30eff";
const requiredDependencyTables = [
  "public.shared_group_members",
  "public.expenses",
  "public.incomes",
  "public.recurring_expenses",
  "public.recurring_incomes",
  "public.budget_goals",
  "public.expense_splits",
  "public.budget_goal_alerts",
];

function git(args, encoding = "utf8") {
  return execFileSync("git", args, {
    cwd: root,
    encoding,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function lines(value) {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function stripSqlNoise(sql) {
  const withoutDollarDelimiters = sql.replace(
    /\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/gu,
    " ",
  );
  let output = "";
  let state = "normal";

  for (let index = 0; index < withoutDollarDelimiters.length; index += 1) {
    const current = withoutDollarDelimiters[index];
    const next = withoutDollarDelimiters[index + 1];

    if (state === "line-comment") {
      if (current === "\n") {
        state = "normal";
        output += "\n";
      } else {
        output += " ";
      }
      continue;
    }

    if (state === "block-comment") {
      if (current === "*" && next === "/") {
        output += "  ";
        index += 1;
        state = "normal";
      } else {
        output += current === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (state === "string") {
      if (current === "'" && next === "'") {
        output += "  ";
        index += 1;
      } else if (current === "'") {
        output += " ";
        state = "normal";
      } else {
        output += current === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (current === "-" && next === "-") {
      output += "  ";
      index += 1;
      state = "line-comment";
    } else if (current === "/" && next === "*") {
      output += "  ";
      index += 1;
      state = "block-comment";
    } else if (current === "'") {
      output += " ";
      state = "string";
    } else {
      output += current;
    }
  }

  assert.equal(state, "normal", "SQL has an unterminated comment or string");
  return output;
}

function assertHistoricalMigrationsUntouched() {
  const basePaths = lines(
    git(["ls-tree", "-r", "--name-only", "HEAD", "--", "supabase/migrations"]),
  );
  assert.ok(
    basePaths.includes(expectedMigrationPath),
    "HEAD must contain the G1-B migration",
  );

  const historicalThroughG1B = basePaths.filter(
    (path) => path.localeCompare(expectedMigrationPath) <= 0,
  );
  assert.ok(
    historicalThroughG1B.length > 0,
    "historical migrations through G1-B must exist",
  );

  for (const path of historicalThroughG1B) {
    const disk = readFileSync(join(root, path), "utf8").replace(/\r\n/gu, "\n");
    const committed = git(["show", `HEAD:${path}`]).replace(/\r\n/gu, "\n");
    assert.equal(disk, committed, `historical migration changed: ${path}`);
  }

  const currentPaths = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => `supabase/migrations/${name}`)
    .sort();
  const baseSet = new Set(basePaths);
  const newMigrations = currentPaths.filter((path) => !baseSet.has(path));

  assert.ok(
    currentPaths.includes(expectedMigrationPath),
    "G1-B migration must still exist locally",
  );
  assert.ok(
    newMigrations.every((path) => path.localeCompare(expectedMigrationPath) > 0),
    "all migrations added after HEAD must be later than G1-B",
  );

  const timestamp = Number(expectedMigrationName.slice(0, 14));
  assert.ok(
    timestamp > 20260729120000,
    "new migration timestamp must be after 20260729120000",
  );
}

function assertMigrationSafety() {
  const migrationPath = join(migrationsDir, expectedMigrationName);
  const sql = readFileSync(migrationPath, "utf8");
  const structuralSql = stripSqlNoise(sql);
  const compact = structuralSql.replace(/\s+/gu, " ").trim();
  const lower = compact.toLowerCase();

  const uuidValues = [
    ...new Set(
      [...sql.matchAll(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu,
      )].map((match) => match[0].toLowerCase()),
    ),
  ].sort();
  assert.deepEqual(
    uuidValues,
    [...targetGroupIds, expectedCreatorId].sort(),
    "migration must contain only the four target IDs and expected creator ID",
  );
  for (const id of targetGroupIds) {
    assert.ok(sql.includes(id), `missing target group ID: ${id}`);
  }
  assert.ok(sql.includes(expectedCreatorId), "missing expected creator ID");

  assert.match(lower, /^begin\s*;/u, "migration must start a transaction");
  assert.match(lower, /commit\s*;$/u, "migration must commit the transaction");
  assert.match(lower, /\bdo\b/u, "migration must use one anonymous block");
  assert.match(lower, /\braise\s+exception\b/u, "assertions must abort on drift");
  assert.match(
    lower,
    /\bget\s+diagnostics\s+deleted_count\s*=\s*row_count\b/u,
    "migration must inspect the affected row count",
  );
  assert.match(
    lower,
    /\bdeleted_count\s*<>\s*4\b/u,
    "migration must require exactly four deleted rows",
  );

  const deletes = [
    ...lower.matchAll(
      /\bdelete\s+from\s+([a-z_][a-z0-9_]*\.)?([a-z_][a-z0-9_]*)/gu,
    ),
  ];
  assert.equal(deletes.length, 1, "migration must contain exactly one DELETE");
  assert.equal(
    `${deletes[0][1] ?? ""}${deletes[0][2]}`,
    "public.shared_groups",
    "DELETE may target only public.shared_groups",
  );

  const forbiddenStatements = new Map([
    ["UPDATE", /\bupdate\s+(?:public\.)?[a-z_][a-z0-9_]*\s+set\b/u],
    ["INSERT", /\binsert\s+into\b/u],
    ["ALTER", /\balter\s+(?:table|function|type|policy|role)\b/u],
    ["DROP", /\bdrop\s+(?:table|function|type|policy|role|trigger)\b/u],
    ["CREATE", /\bcreate\s+(?:table|function|type|policy|role|trigger|index)\b/u],
    ["TRUNCATE", /\btruncate\s+(?:table\s+)?(?:public\.)?[a-z_]/u],
    ["MERGE", /\bmerge\s+into\b/u],
    ["GRANT", /\bgrant\s+\w+\s+on\b/u],
    ["REVOKE", /\brevoke\s+\w+\s+on\b/u],
  ]);
  for (const [statement, pattern] of forbiddenStatements) {
    assert.doesNotMatch(
      lower,
      pattern,
      `forbidden SQL statement found: ${statement}`,
    );
  }
  assert.doesNotMatch(lower, /\bcascade\b/u, "explicit CASCADE is forbidden");
  assert.doesNotMatch(lower, /\bcall\b/u, "RPC/function calls are forbidden");
  assert.doesNotMatch(
    sql,
    /\bservice[_ ]role\b/iu,
    "service role must not be referenced",
  );
  assert.doesNotMatch(
    sql,
    /\b(email|phone|password|token|raw_user_meta_data|user_metadata|app_metadata)\b/iu,
    "private Auth fields must not be referenced",
  );

  assert.match(lower, /\bg\.id\s*=\s*any\s*\(\s*target_group_ids\s*\)/u);
  assert.match(lower, /\bg\.created_by\s*=\s*expected_creator\b/u);
  assert.match(lower, /\bregexp_replace\s*\(/u);
  assert.match(lower, /\bbtrim\s*\(/u);
  assert.match(lower, /\blower\s*\(/u);
  assert.match(lower, /\btranslate\s*\(/u);
  assert.match(lower, /\bg\.is_active\s+is\s+true\b/u);
  assert.match(lower, /\btarget_count\s*<>\s*4\b/u);
  assert.match(lower, /\bmembership_count\s*<>\s*0\b/u);
  assert.match(lower, /\bowner_count\s*<>\s*0\b/u);
  assert.match(lower, /\badmin_count\s*<>\s*0\b/u);
  assert.match(lower, /\bmember_count\s*<>\s*0\b/u);

  const deleteStart = lower.indexOf("delete from public.shared_groups");
  const diagnosticsStart = lower.indexOf("get diagnostics", deleteStart);
  assert.ok(deleteStart >= 0 && diagnosticsStart > deleteStart);
  const deleteClause = lower.slice(deleteStart, diagnosticsStart);
  assert.match(
    deleteClause,
    /\bid\s*=\s*any\s*\(\s*target_group_ids\s*\)/u,
    "name must never be the sole deletion filter",
  );
  assert.match(deleteClause, /\bcreated_by\s*=\s*expected_creator\b/u);
  assert.match(deleteClause, /\bis_active\s+is\s+true\b/u);

  for (const table of requiredDependencyTables) {
    const escaped = table.replace(".", "\\.");
    assert.match(
      lower,
      new RegExp(`\\b${escaped}\\b`, "u"),
      `missing dependency validation: ${table}`,
    );
    assert.match(
      deleteClause,
      new RegExp(`\\b${escaped}\\b`, "u"),
      `DELETE guard missing dependency: ${table}`,
    );
  }
}

const checks = [
  ["G1-B and prior migration integrity", assertHistoricalMigrationsUntouched],
  ["transactional migration safety", assertMigrationSafety],
];

for (const [name, check] of checks) {
  check();
  console.log(`PASS ${name}`);
}

console.log(
  `PASS G1-B static suite (${checks.length} groups, migration ${expectedMigrationName})`,
);
