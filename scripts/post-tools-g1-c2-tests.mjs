import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const migrationName = "20260731030000_revoke_direct_shared_group_insert.sql";
const migrationRelativePath = `supabase/migrations/${migrationName}`;
const migrationPath = join(migrationsDir, migrationName);
const originalName = "20260731010000_create_shared_group_atomic.sql";
const hotfixName = "20260731020000_fix_create_shared_group_atomic_runtime.sql";
const hookPath = join(root, "src", "hooks", "use-shared-groups.tsx");
const negativeSmokePath = join(root, "scripts", "post-tools-g1-c2-negative-smoke.mjs");
const documentationPath = join(
  root,
  "docs",
  "audits",
  "post-tools-g1-c2-revoke-direct-group-insert",
  "README.md",
);

const expectedChangedPaths = new Set([
  "docs/audits/post-tools-g1-c2-revoke-direct-group-insert/README.md",
  "scripts/g1-c1-h1-tests.mjs",
  "scripts/post-tools-g1-c-tests.mjs",
  "scripts/post-tools-g1-c2-negative-smoke.mjs",
  "scripts/post-tools-g1-c2-tests.mjs",
  migrationRelativePath,
]);

function git(args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function lines(value) {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalize(value) {
  return value.replace(/\r\n/gu, "\n");
}

function walk(directory) {
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...walk(path));
    else paths.push(path);
  }
  return paths;
}

const baseMigrationPaths = lines(
  git(["ls-tree", "-r", "--name-only", "HEAD", "--", "supabase/migrations"]),
);
const currentMigrationNames = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const baseMigrationSet = new Set(baseMigrationPaths);
const newMigrationPaths = currentMigrationNames
  .map((name) => `supabase/migrations/${name}`)
  .filter((path) => !baseMigrationSet.has(path));

assert.equal(baseMigrationPaths.length, 63, "HEAD deve conter 63 migrations históricas");
assert.equal(currentMigrationNames.length, 64, "deve haver 64 migrations locais");
assert.deepEqual(
  newMigrationPaths,
  [migrationRelativePath],
  "deve existir exatamente uma migration nova",
);
assert.ok(
  Number(migrationName.slice(0, 14)) > 20260731020000,
  "timestamp deve ser posterior à H1",
);

for (const path of baseMigrationPaths) {
  assert.equal(
    normalize(readFileSync(join(root, path), "utf8")),
    normalize(git(["show", `HEAD:${path}`])),
    `migration histórica alterada: ${path}`,
  );
}

const sql = readFileSync(migrationPath, "utf8");
const statements = sql
  .replace(/--[^\r\n]*/gu, " ")
  .replace(/\/\*[\s\S]*?\*\//gu, " ")
  .split(";")
  .map((statement) => statement.replace(/\s+/gu, " ").trim().toLowerCase())
  .filter(Boolean);

assert.deepEqual(
  statements,
  [
    "revoke insert on table public.shared_groups from public",
    "revoke insert on table public.shared_groups from anon",
    "revoke insert on table public.shared_groups from authenticated",
  ],
  "migration deve conter somente os três REVOKE INSERT esperados",
);
assert.doesNotMatch(sql, /\brevoke\s+all\b/iu, "REVOKE ALL é proibido");
assert.doesNotMatch(sql, /\brevoke\s+(?:select|update|delete)\b/iu, "outros privilégios devem permanecer");
assert.doesNotMatch(sql, /\bfrom\s+service_role\b/iu, "service_role deve permanecer intacta");
assert.doesNotMatch(sql, /\b(?:create|alter|drop)\s+policy\b/iu, "policies RLS não podem mudar");
assert.doesNotMatch(sql, /\b(?:create|alter|drop)(?:\s+or\s+replace)?\s+function\b/iu, "funções não podem mudar");
assert.doesNotMatch(sql, /\b(?:create|alter|drop)\s+table\b/iu, "estrutura da tabela não pode mudar");
assert.doesNotMatch(sql, /\b(?:insert\s+into|update\s+|delete\s+from|truncate\s+)\b/iu, "dados não podem mudar");
assert.doesNotMatch(sql, /\b(?:create|call)\s+[^;]*create_shared_group_atomic\b/iu, "nenhuma RPC nova");

const hook = readFileSync(hookPath, "utf8");
const createStart = hook.indexOf("const createGroup = useCallback");
const joinStart = hook.indexOf("// Entrar em grupo", createStart);
const leaveStart = hook.indexOf("// Sair de grupo", joinStart);
const deleteStart = hook.indexOf("// Deletar grupo", leaveStart);
const updateStart = hook.indexOf("// Atualizar grupo", deleteStart);
const membersStart = hook.indexOf("// Buscar membros", updateStart);
const createFlow = hook.slice(createStart, joinStart);
const joinFlow = hook.slice(joinStart, leaveStart);
const deleteFlow = hook.slice(deleteStart, updateStart);
const updateFlow = hook.slice(updateStart, membersStart);

assert.ok(createStart >= 0 && joinStart > createStart, "fluxo oficial de criação deve existir");
assert.equal(
  [...createFlow.matchAll(/\.rpc\(\s*['"]create_shared_group_atomic['"]/gu)].length,
  1,
  "frontend deve usar uma única chamada create_shared_group_atomic",
);
assert.doesNotMatch(createFlow, /\.insert\s*\(/u, "criação oficial não pode usar INSERT direto");
assert.match(createFlow, /createGroupInFlightRef\.current/u, "proteção de reentrada preservada");
assert.match(joinFlow, /\.from\(\s*['"]shared_group_members['"]\s*\)[\s\S]{0,160}?\.insert\s*\(/u, "convite insere somente membership");
assert.doesNotMatch(joinFlow, /\.from\(\s*['"]shared_groups['"]\s*\)[\s\S]{0,160}?\.insert\s*\(/u, "convite não cria grupo");
assert.match(deleteFlow, /\.rpc\(\s*['"]delete_group_and_data['"]/u, "exclusão oficial preservada");
assert.match(updateFlow, /\.from\(\s*['"]shared_groups['"]\s*\)[\s\S]{0,80}?\.update\s*\(/u, "update preservado");

const productionFiles = [
  ...walk(join(root, "src")),
  ...walk(join(root, "supabase", "functions")),
].filter((path) => [".js", ".jsx", ".mjs", ".ts", ".tsx"].includes(extname(path)));
const directInsertPattern = /\.from\(\s*['"]shared_groups['"]\s*\)[\s\S]{0,160}?\.insert\s*\(/u;
for (const path of productionFiles) {
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(
    source,
    directInsertPattern,
    `INSERT direto oficial encontrado: ${relative(root, path)}`,
  );
}

const edgeFunctionFiles = walk(join(root, "supabase", "functions"))
  .filter((path) => [".js", ".mjs", ".ts"].includes(extname(path)));
for (const path of edgeFunctionFiles) {
  const source = readFileSync(path, "utf8");
  assert.doesNotMatch(
    source,
    /create_shared_group_atomic|insert\s+into\s+(?:public\.)?shared_groups/iu,
    `Edge Function não pode criar grupo: ${relative(root, path)}`,
  );
}

const sqlInsertLocations = [];
for (const name of currentMigrationNames) {
  const source = readFileSync(join(migrationsDir, name), "utf8");
  if (/\binsert\s+into\s+public\.shared_groups\b/iu.test(source)) sqlInsertLocations.push(name);
}
assert.deepEqual(
  sqlInsertLocations,
  [originalName, hotfixName],
  "somente as implementações históricas da RPC podem inserir em shared_groups",
);

const original = readFileSync(join(migrationsDir, originalName), "utf8");
const hotfix = readFileSync(join(migrationsDir, hotfixName), "utf8");
assert.equal(normalize(original), normalize(git(["show", `HEAD:supabase/migrations/${originalName}`])), "G1-C1 intacta");
assert.equal(normalize(hotfix), normalize(git(["show", `HEAD:supabase/migrations/${hotfixName}`])), "H1 intacta");
assert.match(hotfix, /security definer[\s\S]*set search_path = pg_catalog, public, pg_temp/iu, "SECURITY DEFINER e search_path preservados");
assert.match(hotfix, /extensions\.gen_random_bytes\(6\)/u, "correção H1 preservada");
assert.match(hotfix, /revoke all on function public\.create_shared_group_atomic\(text, text, text\)[\s\S]*from public, anon/iu, "EXECUTE de PUBLIC/anon permanece revogado");
assert.match(hotfix, /grant execute on function public\.create_shared_group_atomic\(text, text, text\)[\s\S]*to authenticated/iu, "EXECUTE de authenticated preservado");

const negativeSmoke = readFileSync(negativeSmokePath, "utf8");
assert.match(negativeSmoke, /SUPABASE_ACCESS_TOKEN/u, "smoke recebe token somente por ambiente");
assert.match(negativeSmoke, /SUPABASE_ANON_KEY/u, "smoke usa anon key, não service role");
assert.doesNotMatch(negativeSmoke, /SERVICE_ROLE/u, "smoke não usa service role");
assert.match(negativeSmoke, /permission denied|42501/iu, "smoke espera erro de permissão");
assert.match(negativeSmoke, /count:\s*["']exact["']/u, "smoke confirma ausência da linha");
assert.ok(readFileSync(documentationPath, "utf8").includes("GRANT INSERT ON TABLE public.shared_groups TO authenticated;"), "rollback conceitual documentado");

const changedPaths = new Set([
  ...lines(git(["diff", "--name-only", "HEAD"])),
  ...lines(git(["ls-files", "--others", "--exclude-standard"])),
]);
assert.deepEqual([...changedPaths].sort(), [...expectedChangedPaths].sort(), "somente arquivos G1-C2 esperados podem mudar");
for (const path of changedPaths) {
  assert.doesNotMatch(path, /(?:^|\/)(?:supabase\/functions\/mcp|src\/lib\/mcp)(?:\/|$)/u, "nenhum arquivo MCP alterado");
  assert.doesNotMatch(path, /(?:expense|income|transaction|budget|goal|card|categor|financial|financeir)/iu, "nenhum arquivo financeiro alterado");
}

console.log("G1-C2: revoke, integrity, flow and scope checks passed.");
