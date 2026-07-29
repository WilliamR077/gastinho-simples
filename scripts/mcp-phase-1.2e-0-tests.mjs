import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";

let checks = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks += 1;
};

const migrationName =
  "20260729120000_add_user_income_categories_updated_at_trigger.sql";
const migrationPath = `supabase/migrations/${migrationName}`;
const migration = await readFile(migrationPath, "utf8");
const normalized = migration.replace(/\s+/g, " ").trim();
const migrations = await readdir("supabase/migrations");

check(migrations.includes(migrationName), "migration nova presente");
check(
  normalized.includes(
    "CREATE TRIGGER update_user_income_categories_updated_at",
  ),
  "nome do trigger",
);
check(
  normalized.includes("BEFORE UPDATE ON public.user_income_categories"),
  "BEFORE UPDATE na tabela correta",
);
check(normalized.includes("FOR EACH ROW"), "trigger por linha");
check(
  normalized.includes(
    "EXECUTE FUNCTION public.update_updated_at_column()",
  ),
  "reutiliza função existente",
);
equal(
  (migration.match(/\bCREATE\s+TRIGGER\b/giu) ?? []).length,
  1,
  "cria exatamente um trigger",
);
check(
  !/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/iu.test(migration),
  "não cria função duplicada",
);
check(
  !/\bpublic\.user_categories\b/iu.test(migration),
  "não altera categoria de despesa",
);
check(!/\b(expenses|incomes|recurring_expenses|recurring_incomes|budget_goals)\b/iu.test(migration), "não altera tabelas financeiras");
check(!/\b(ENABLE|DISABLE)\s+ROW\s+LEVEL\s+SECURITY\b/iu.test(migration), "não altera RLS");
check(!/\b(CREATE|ALTER|DROP)\s+POLICY\b/iu.test(migration), "não altera policies");
check(!/\b(auth\.|oauth|secret|service_role)\b/iu.test(migration), "não altera Auth, OAuth ou secrets");
check(!/^\s*(INSERT|UPDATE|DELETE)\s/imu.test(migration), "sem DML de dados");
check(!/\bbackfill\b/iu.test(migration), "sem backfill");
check(!/\bALTER\s+TABLE\b/iu.test(migration), "sem alteração de tabela");
check(!/\b(DEFAULT|ADD\s+COLUMN|DROP\s+COLUMN|FOREIGN\s+KEY|CREATE\s+INDEX)\b/iu.test(migration), "sem colunas, defaults, FKs ou índices");

const functionMigration = await readFile(
  "supabase/migrations/20250902150325_666c3b1a-cd63-4629-b973-b42898fb29b1.sql",
  "utf8",
);
check(
  /create or replace function public\.update_updated_at_column\(\)[\s\S]*new\.updated_at = now\(\);[\s\S]*return new;/iu.test(
    functionMigration,
  ),
  "função existente atualiza NEW.updated_at e retorna NEW",
);
const expenseCategoryMigration = await readFile(
  "supabase/migrations/20251209221428_d0200111-68e6-4b01-b27b-d7078adbb7c1.sql",
  "utf8",
);
check(
  /CREATE TRIGGER update_user_categories_updated_at\s+BEFORE UPDATE ON public\.user_categories\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.update_updated_at_column\(\);/iu.test(
    expenseCategoryMigration,
  ),
  "espelha o trigger de user_categories",
);
const incomeCategoryMigration = await readFile(
  "supabase/migrations/20260223175652_b28776df-9bc5-4b82-9871-ebb8e32dc3de.sql",
  "utf8",
);
check(
  /updated_at timestamptz DEFAULT now\(\)/iu.test(incomeCategoryMigration),
  "default original preservado",
);
check(
  !/CREATE TRIGGER[\s\S]*user_income_categories/iu.test(
    incomeCategoryMigration,
  ),
  "migration histórica continua sem trigger",
);

const manifest = JSON.parse(
  await readFile(".lovable/mcp/manifest.json", "utf8"),
);
const tools = manifest.mcp.tools;
equal(tools.length, 44, "manifest mantém 44 tools");
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
  20,
  "manifest mantém 20 read-only",
);
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint === false).length,
  24,
  "manifest mantém 24 write",
);

const changedMigrations = execFileSync(
  "git",
  ["status", "--porcelain", "--", "supabase/migrations"],
  { encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/u)
  .filter(Boolean);
equal(changedMigrations.length, 0, "nenhuma migration alterada na fase atual");

console.log(
  `MCP 1.2E-0: ${checks} verificações estáticas e regressivas concluídas.`,
);
