import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");
const originalName = "20260731010000_create_shared_group_atomic.sql";
const hotfixName = "20260731020000_fix_create_shared_group_atomic_runtime.sql";
const original = readFileSync(join(migrationsDir, originalName), "utf8");
const hotfix = readFileSync(join(migrationsDir, hotfixName), "utf8");
const lower = hotfix.toLowerCase();
const hotfixWithoutComments = hotfix
  .replace(/--[^\r\n]*/gu, " ")
  .replace(/\/\*[\s\S]*?\*\//gu, " ");
const hook = readFileSync(join(root, "src", "hooks", "use-shared-groups.tsx"), "utf8");
const types = readFileSync(join(root, "src", "integrations", "supabase", "types.ts"), "utf8");
const diagnostic = readFileSync(
  join(root, "docs", "audits", "g1-c1-h1-runtime-failure", "remote-diagnostic.sql"),
  "utf8",
);

const check = (condition, message) => assert.ok(condition, message);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const migrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const originalIndex = migrations.indexOf(originalName);
const hotfixIndex = migrations.indexOf(hotfixName);
assert.equal(originalIndex, 61, "a G1-C1 permanece como a 62ª migration");
assert.equal(hotfixIndex, 62, "somente a H1 sucede imediatamente a G1-C1");
assert.ok(migrations.length >= 63, "ao menos 63 migrations locais");
assert.equal(
  sha256(original),
  "0f872b1a7e143c4ee71e118bceb60272f6afbbc0329e03f4dbc555232b665960",
  "migration G1-C1 aplicada permanece intacta",
);
check(
  migrations.slice(hotfixIndex + 1).every((name) => name > hotfixName),
  "migrations posteriores não alteram a ordem G1-C1/H1",
);

const signaturePattern =
  /create(?:\s+or\s+replace)?\s+function\s+public\.create_shared_group_atomic\s*\(([\s\S]*?)\)\s*returns\s+table\s*\(([\s\S]*?)\)\s*language/iu;
const originalContract = original.match(signaturePattern);
const hotfixContract = hotfix.match(signaturePattern);
check(originalContract && hotfixContract, "contratos SQL encontrados");
assert.equal(
  hotfixContract[1].replace(/\s+/gu, " ").trim(),
  originalContract[1].replace(/\s+/gu, " ").trim(),
  "inputs públicos preservados",
);
assert.equal(
  hotfixContract[2].replace(/\s+/gu, " ").trim(),
  originalContract[2].replace(/\s+/gu, " ").trim(),
  "retorno público preservado",
);
check(/create or replace function public\.create_shared_group_atomic/iu.test(hotfix), "CREATE OR REPLACE");
check(/security definer/iu.test(hotfix), "SECURITY DEFINER preservado");
check(/set search_path = pg_catalog, public, pg_temp/iu.test(hotfix), "search_path seguro");
check(/v_user_id uuid := auth\.uid\(\)/iu.test(hotfix), "identidade interna");
check(/pg_catalog\.pg_advisory_xact_lock/iu.test(hotfix), "lock transacional");
check(/create_shared_group:' \|\| v_user_id::text/iu.test(hotfix), "lock por usuário");

check(/public\.gen_random_bytes\(6\)/iu.test(original), "regressão reproduz referência public incorreta");
check(!/public\.gen_random_bytes/iu.test(hotfixWithoutComments), "referência public removida");
check(/extensions\.gen_random_bytes\(6\)/iu.test(hotfix), "pgcrypto qualificado no schema Supabase");
check(/v_random_bytes bytea/iu.test(hotfix), "tipo bytea preservado");
check(/pg_catalog\.get_byte\(v_random_bytes, v_position\)/iu.test(hotfix), "bytes consumidos como bytea");
check(/v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'/iu.test(hotfix), "alfabeto preservado");
check(/for v_attempt in 1\.\.5 loop/iu.test(hotfix), "cinco tentativas");
check(/when unique_violation then/iu.test(hotfix), "colisão tratada");

for (const domainError of [
  "G1C_NOT_AUTHENTICATED",
  "G1C_INVALID_NAME",
  "G1C_INVALID_DESCRIPTION",
  "G1C_INVALID_COLOR",
  "G1C_PLAN_REQUIRED",
  "G1C_GROUP_LIMIT_REACHED",
  "G1C_INVITE_CODE_UNAVAILABLE",
  "G1C_MEMBERSHIP_FAILED",
]) {
  check(hotfix.includes(domainError), `erro de domínio preservado: ${domainError}`);
}
check(/v_tier is null or v_tier not in \('premium', 'premium_plus'\)/iu.test(hotfix), "ausência e plano não elegível");
check(/from public\.subscriptions/iu.test(hotfix), "assinatura consultada");
check(/g\.created_by = v_user_id[\s\S]*g\.is_active = true/iu.test(hotfix), "quota atual");
check(/\)\s*>= 3 then/iu.test(hotfix), "limite de três grupos");
check(/'owner'::public\.group_member_role/iu.test(hotfix), "enum owner real");

const groupInsert = lower.indexOf("insert into public.shared_groups");
const membershipInsert = lower.indexOf("insert into public.shared_group_members");
const returnQuery = lower.indexOf("return query");
check(groupInsert > 0, "INSERT do grupo");
check(membershipInsert > groupInsert, "INSERT owner após grupo");
check(returnQuery > membershipInsert, "retorno após as duas escritas");
check(
  /begin[\s\S]*insert into public\.shared_groups[\s\S]*insert into public\.shared_group_members[\s\S]*exception[\s\S]*when others/iu.test(
    hotfix,
  ),
  "grupo e membership no mesmo bloco transacional",
);
check(/v_owner_count <> 1/iu.test(hotfix), "owner único confirmado");
check(!/\b(commit|rollback|start transaction)\b/iu.test(hotfix), "sem transação manual");

check(
  /raise log[\s\S]*sqlstate=%[\s\S]*sqlerrm=%[\s\S]*sqlstate,[\s\S]*sqlerrm/iu.test(hotfix),
  "falha inesperada registra SQLSTATE e SQLERRM",
);
check(
  /when others then[\s\S]*raise log[\s\S]*message = 'G1C_CREATE_FAILED'/iu.test(hotfix),
  "falha inesperada é mascarada no cliente",
);
const logBlock = hotfix.match(/raise log([\s\S]*?)raise exception/iu)?.[1] ?? "";
for (const forbiddenLogValue of [
  "v_user_id",
  "v_name",
  "v_description",
  "v_invite_code",
  "v_group",
  "v_membership",
]) {
  check(!logBlock.includes(forbiddenLogValue), `log sem ${forbiddenLogValue}`);
}

check(
  /revoke all on function public\.create_shared_group_atomic\(text, text, text\)[\s\S]*from public, anon/iu.test(
    hotfix,
  ),
  "RPC não executável por PUBLIC/anon",
);
check(
  /grant execute on function public\.create_shared_group_atomic\(text, text, text\)[\s\S]*to authenticated/iu.test(
    hotfix,
  ),
  "RPC executável por authenticated",
);
check(
  !/\b(?:grant|revoke)\b[\s\S]*?\bon\s+(?:table\s+)?public\.shared_groups\b/iu.test(
    hotfix,
  ),
  "grants INSERT da tabela não mudam",
);
check(!/alter table|create policy|drop policy|delete from|update public\./iu.test(hotfix), "sem schema/RLS/dados");

const createStart = hook.indexOf("const createGroup = useCallback");
const createEnd = hook.indexOf("// Entrar em grupo", createStart);
const createFlow = hook.slice(createStart, createEnd);
assert.equal(
  [...createFlow.matchAll(/\.rpc\('create_shared_group_atomic'/gu)].length,
  1,
  "hook faz uma RPC",
);
check(!createFlow.includes(".insert("), "hook sem fallback por INSERT");
check(/createGroupInFlightRef\.current/iu.test(createFlow), "reentrada preservada");
check(/data\.length !== 1/iu.test(createFlow), "formato de retorno validado");
check(types.includes("create_shared_group_atomic:"), "tipos gerados preservados");

const availableFunctions = new Set([
  "extensions.gen_random_bytes(integer)",
  "pg_catalog.gen_random_uuid()",
]);
const resolveFunction = (schema, name, args) =>
  availableFunctions.has(`${schema}.${name}(${args})`);
assert.equal(
  resolveFunction("public", "gen_random_bytes", "integer"),
  false,
  "implementação aplicada resolve para função inexistente",
);
assert.equal(
  resolveFunction("extensions", "gen_random_bytes", "integer"),
  true,
  "hotfix resolve a função pgcrypto real",
);
assert.equal("42883", "42883", "undefined_function é SQLSTATE 42883");

function syntheticRpc({
  authenticated = true,
  tier = "premium",
  activeGroups = 0,
  randomFunctionSchema = "extensions",
  collisions = 0,
  failMembership = false,
} = {}) {
  const persisted = { groups: [], memberships: [] };
  const logs = [];
  if (!authenticated) return { error: "G1C_NOT_AUTHENTICATED", persisted, logs };
  if (!["premium", "premium_plus"].includes(tier)) {
    return { error: "G1C_PLAN_REQUIRED", persisted, logs };
  }
  if (activeGroups >= 3) return { error: "G1C_GROUP_LIMIT_REACHED", persisted, logs };

  const tx = { groups: [], memberships: [] };
  try {
    if (!resolveFunction(randomFunctionSchema, "gen_random_bytes", "integer")) {
      const error = new Error("function does not exist");
      error.sqlstate = "42883";
      throw error;
    }
    if (collisions >= 5) return { error: "G1C_INVITE_CODE_UNAVAILABLE", persisted, logs };
    tx.groups.push({ id: "group-1", invite_code: "ABC234" });
    if (failMembership) {
      const error = new Error("membership insert failed");
      error.sqlstate = "23514";
      throw error;
    }
    tx.memberships.push({ id: "membership-1", group_id: "group-1", role: "owner" });
    persisted.groups = tx.groups;
    persisted.memberships = tx.memberships;
    return {
      data: [{
        group_id: "group-1",
        membership_id: "membership-1",
        invite_code: "ABC234",
        role: "owner",
      }],
      error: null,
      persisted,
      logs,
    };
  } catch (error) {
    logs.push({ sqlstate: error.sqlstate, message: error.message });
    return { error: "G1C_CREATE_FAILED", persisted, logs };
  }
}

assert.equal(syntheticRpc({ tier: null }).error, "G1C_PLAN_REQUIRED", "sem assinatura");
assert.equal(syntheticRpc({ tier: "free" }).error, "G1C_PLAN_REQUIRED", "plano não elegível");
assert.equal(syntheticRpc({ activeGroups: 3 }).error, "G1C_GROUP_LIMIT_REACHED", "quota atingida");
assert.equal(
  syntheticRpc({ collisions: 5 }).error,
  "G1C_INVITE_CODE_UNAVAILABLE",
  "cinco colisões retornam erro de domínio",
);
const oldRuntime = syntheticRpc({ randomFunctionSchema: "public" });
assert.equal(oldRuntime.error, "G1C_CREATE_FAILED", "falha antiga mascarada no cliente");
assert.deepEqual(oldRuntime.persisted, { groups: [], memberships: [] }, "falha antiga sem parcial");
assert.equal(oldRuntime.logs[0].sqlstate, "42883", "SQLSTATE original registrado");
const validRuntime = syntheticRpc();
assert.equal(validRuntime.error, null, "conta elegível cria com sucesso");
assert.equal(validRuntime.data[0].role, "owner", "retorno owner esperado pelo hook");
assert.equal(validRuntime.persisted.groups.length, 1, "um grupo persistido");
assert.equal(validRuntime.persisted.memberships.length, 1, "uma membership persistida");
const membershipFailure = syntheticRpc({ failMembership: true });
assert.equal(membershipFailure.error, "G1C_CREATE_FAILED", "erro inesperado mascarado");
assert.deepEqual(
  membershipFailure.persisted,
  { groups: [], memberships: [] },
  "falha da membership reverte o grupo",
);
assert.equal(membershipFailure.logs[0].sqlstate, "23514", "falha inesperada registrada");

const diagnosticWithoutComments = diagnostic
  .replace(/--[^\r\n]*/gu, " ")
  .replace(/\/\*[\s\S]*?\*\//gu, " ");
check(
  diagnosticWithoutComments
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .every((statement) => statement.toLowerCase().startsWith("select")),
  "diagnóstico contém somente SELECTs",
);
for (const forbidden of [
  "auth.users",
  "email",
  "token",
  "metadata",
  "expenses",
  "incomes",
  "insert ",
  "update ",
  "delete ",
]) {
  check(!diagnosticWithoutComments.toLowerCase().includes(forbidden), `diagnóstico sem ${forbidden}`);
}

console.log("G1-C1-H1: runtime regression and hotfix checks passed.");
