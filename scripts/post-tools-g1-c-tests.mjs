import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationName = "20260731010000_create_shared_group_atomic.sql";
const migrationPath = join(root, "supabase", "migrations", migrationName);
const migration = readFileSync(migrationPath, "utf8");
const migrationLower = migration.toLowerCase();
const hook = readFileSync(join(root, "src", "hooks", "use-shared-groups.tsx"), "utf8");
const dialog = readFileSync(join(root, "src", "components", "create-group-dialog.tsx"), "utf8");
const types = readFileSync(join(root, "src", "integrations", "supabase", "types.ts"), "utf8");

const check = (condition, message) => assert.ok(condition, message);
const count = (source, expression) => [...source.matchAll(expression)].length;

const migrations = readdirSync(join(root, "supabase", "migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort();

const migrationIndex = migrations.indexOf(migrationName);
assert.ok(migrationIndex >= 0, "a migration G1-C1 deve existir");
assert.equal(migrationIndex, 61, "a G1-C1 deve permanecer como a 62ª migration");
assert.ok(migrations.length >= 62, "deve haver ao menos 62 migrations locais");
check(
  Number(migrationName.slice(0, 14)) > 20260731001344,
  "timestamp deve ser posterior à limpeza G1-B",
);

const historicalHash = createHash("sha256");
for (const name of migrations.slice(0, migrationIndex)) {
  historicalHash.update(name);
  historicalHash.update("\0");
  historicalHash.update(
    readFileSync(join(root, "supabase", "migrations", name), "utf8").replace(
      /\r\n/gu,
      "\n",
    ),
  );
  historicalHash.update("\0");
}
assert.equal(
  historicalHash.digest("hex"),
  "58d5cfd005125b34af9dbb82b42158e17e1ef960016d49db3406663421ff2a0b",
  "as 61 migrations históricas devem permanecer byte a byte intactas",
);

check(
  /create function public\.create_shared_group_atomic\s*\(/iu.test(migration),
  "RPC criada sem sobrescrever função preexistente",
);
const signature = migration.match(
  /create function public\.create_shared_group_atomic\s*\(([\s\S]*?)\)\s*returns table/iu,
)?.[1] ?? "";
for (const forbidden of [
  "user_id",
  "created_by",
  "owner_id",
  "membership_id",
  "invite_code",
  "role",
  "is_active",
]) {
  check(!signature.toLowerCase().includes(forbidden), `input proibido: ${forbidden}`);
}
check(/p_name text/iu.test(signature), "nome é o único input obrigatório");
check(/p_description text default null/iu.test(signature), "descrição opcional");
check(/p_color text default '#6366f1'/iu.test(signature), "cor com default real");

check(/v_user_id uuid := auth\.uid\(\)/iu.test(migration), "identidade vem de auth.uid()");
check(/if v_user_id is null/iu.test(migration), "autenticação obrigatória");
check(
  /security definer[\s\S]*set search_path = pg_catalog, public, pg_temp/iu.test(migration),
  "SECURITY DEFINER com search_path seguro e explícito",
);
for (const object of [
  "public.subscriptions",
  "public.shared_groups",
  "public.shared_group_members",
  "public.group_member_role",
]) {
  check(migration.includes(object), `objeto qualificado: ${object}`);
}
check(!/\bexecute\s+(format|\()/iu.test(migration), "sem SQL dinâmico");
check(!migrationLower.includes("auth.users"), "sem consulta a auth.users");

check(
  /revoke all on function public\.create_shared_group_atomic\(text, text, text\)[\s\S]*from public, anon/iu.test(
    migration,
  ),
  "EXECUTE revogado de PUBLIC e anon",
);
check(
  /grant execute on function public\.create_shared_group_atomic\(text, text, text\)[\s\S]*to authenticated/iu.test(
    migration,
  ),
  "EXECUTE concedido somente a authenticated",
);
check(!/grant execute[\s\S]{0,100}service_role/iu.test(migration), "sem grant à service role");
check(
  !/\b(?:grant|revoke)\b[\s\S]*?\bon\s+(?:table\s+)?public\.shared_groups\b/iu.test(
    migration,
  ),
  "G1-C1 não altera grants da tabela shared_groups",
);
check(
  !/\brevoke\s+insert\s+on\s+(?:table\s+)?public\.shared_groups\b/iu.test(migration),
  "G1-C1 não revoga INSERT direto em shared_groups",
);
check(
  !/revoke insert on table public\.shared_group_members/iu.test(migration),
  "entrada existente por convite preservada",
);

const groupInsert = migrationLower.indexOf("insert into public.shared_groups");
const membershipInsert = migrationLower.indexOf("insert into public.shared_group_members");
const returnQuery = migrationLower.indexOf("return query");
check(groupInsert > 0, "grupo inserido");
check(membershipInsert > groupInsert, "owner inserido depois do grupo");
check(returnQuery > membershipInsert, "retorno ocorre depois das duas escritas");
check(
  /insert into public\.shared_group_members[\s\S]*v_group\.id[\s\S]*v_user_id[\s\S]*'owner'::public\.group_member_role/iu.test(
    migration,
  ),
  "membership usa grupo novo, auth.uid e role owner internos",
);
check(/v_owner_count <> 1/iu.test(migration), "exatamente um owner é confirmado");
check(
  /begin[\s\S]*insert into public\.shared_groups[\s\S]*insert into public\.shared_group_members[\s\S]*exception[\s\S]*when others/iu.test(
    migration,
  ),
  "as duas escritas pertencem ao mesmo bloco transacional",
);
check(!/\b(commit|rollback|start transaction)\b/iu.test(migration), "sem transação manual");

check(/pg_advisory_xact_lock/iu.test(migration), "lock transacional por usuário");
check(/create_shared_group:' \|\| v_user_id::text/iu.test(migration), "lock não é global");
check(/from public\.subscriptions/iu.test(migration), "assinatura verificada no banco");
check(/premium', 'premium_plus/iu.test(migration), "tiers atuais preservados");
check(/g\.created_by = v_user_id[\s\S]*g\.is_active = true/iu.test(migration), "quota conta grupos ativos do criador");
check(/\)\s*>= 3 then/iu.test(migration), "limite atual de três grupos");

check(/v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'/iu.test(migration), "alfabeto atual");
check(/public\.gen_random_bytes\(6\)/iu.test(migration), "seis bytes aleatórios no banco");
check(/for v_attempt in 1\.\.5 loop/iu.test(migration), "retry de colisão limitado");
check(/when unique_violation then/iu.test(migration), "colisão tratada");
check(/g1c_invite_code_unavailable/iu.test(migration), "falha genérica após retries");

const returnedFields = migration.match(/returns table\s*\(([\s\S]*?)\)\s*language/iu)?.[1] ?? "";
for (const required of [
  "group_id",
  "name",
  "description",
  "color",
  "invite_code",
  "max_members",
  "is_active",
  "created_at",
  "updated_at",
  "membership_id",
  "role",
  "joined_at",
]) {
  check(returnedFields.includes(required), `retorno inclui ${required}`);
}
for (const forbidden of ["email", "phone", "token", "user_id", "created_by", "subscription"]) {
  check(!returnedFields.includes(forbidden), `retorno reduzido sem ${forbidden}`);
}
check(!/\b(delete|update)\s+public\.shared_groups/iu.test(migration), "sem alteração de grupos existentes");
check(!migration.includes("Família"), "não recria grupos Família");

const createStart = hook.indexOf("const createGroup = useCallback");
const createEnd = hook.indexOf("// Entrar em grupo", createStart);
const createFlow = hook.slice(createStart, createEnd);
assert.equal(
  count(createFlow, /\.rpc\('create_shared_group_atomic'/gu),
  1,
  "frontend faz uma única chamada à RPC atômica",
);
check(!createFlow.includes(".insert("), "criação oficial não contém insert direto");
check(!createFlow.includes("generate_invite_code"), "frontend não gera invite code");
const rpcArgs = createFlow.match(
  /\.rpc\('create_shared_group_atomic',\s*\{([\s\S]*?)\}\)/u,
)?.[1] ?? "";
check(!rpcArgs.includes("created_by"), "frontend não envia created_by");
check(!rpcArgs.includes("user_id"), "frontend não envia user_id");
check(!rpcArgs.includes("role"), "frontend não envia role");
check(/input\.name\.trim\(\)/u.test(createFlow), "nome normalizado");
check(/input\.description\?\.trim\(\) \|\| null/u.test(createFlow), "descrição normalizada");
check(/data\.length !== 1/u.test(createFlow), "resposta inesperada rejeitada");
check(/created\.role !== 'owner'/u.test(createFlow), "retorno owner validado");
check(/await fetchGroups\(\)/u.test(createFlow), "cache atualizado no sucesso");
check(/createGroupInFlightRef\.current/u.test(createFlow), "reentrada bloqueada no hook");
check(/finally[\s\S]*createGroupInFlightRef\.current = false/iu.test(createFlow), "lock local liberado");
check(/if \(isLoading \|\| !name\.trim\(\)\) return/u.test(dialog), "submit duplicado bloqueado");
check(/disabled=\{isLoading \|\| !name\.trim\(\)\}/u.test(dialog), "botão desabilitado em loading");
check(dialog.includes("Criando..."), "loading visível");
check(types.includes("create_shared_group_atomic:"), "tipos Supabase atualizados");

async function syntheticFrontendCreate({ rpc, refresh, setContext, input, inFlight }) {
  if (inFlight.current) return null;
  inFlight.current = true;
  try {
    const response = await rpc({
      p_name: input.name.trim(),
      p_description: input.description?.trim() || null,
      p_color: input.color?.trim() || "#6366f1",
    });
    if (response.error) return null;
    if (!response.data || response.data.length !== 1 || response.data[0].role !== "owner") {
      return null;
    }
    await refresh();
    setContext(response.data[0].group_id);
    return response.data[0];
  } finally {
    inFlight.current = false;
  }
}

const validRow = { group_id: "group-1", membership_id: "member-1", role: "owner" };
const calls = [];
let refreshes = 0;
let context = null;
const success = await syntheticFrontendCreate({
  rpc: async (args) => {
    calls.push(args);
    return { data: [validRow], error: null };
  },
  refresh: async () => {
    refreshes += 1;
  },
  setContext: (id) => {
    context = id;
  },
  input: { name: "  Família  ", description: "  Casa  ", color: " #6366f1 " },
  inFlight: { current: false },
});
assert.equal(success, validRow, "envio válido retorna grupo");
assert.equal(calls.length, 1, "sucesso chama RPC uma vez");
assert.deepEqual(
  calls[0],
  { p_name: "Família", p_description: "Casa", p_color: "#6366f1" },
  "campos chegam normalizados",
);
assert.equal(refreshes, 1, "cache atualizado no sucesso");
assert.equal(context, "group-1", "contexto muda somente no sucesso");

for (const failure of [
  { data: null, error: { message: "G1C_GROUP_LIMIT_REACHED" } },
  { data: null, error: { message: "G1C_CREATE_FAILED" } },
  { data: [], error: null },
  { data: [{ ...validRow, role: "member" }], error: null },
]) {
  let failedRefreshes = 0;
  let failedContext = null;
  const result = await syntheticFrontendCreate({
    rpc: async () => failure,
    refresh: async () => {
      failedRefreshes += 1;
    },
    setContext: (id) => {
      failedContext = id;
    },
    input: { name: "Teste" },
    inFlight: { current: false },
  });
  assert.equal(result, null, "erro/resposta inesperada não retorna grupo parcial");
  assert.equal(failedRefreshes, 0, "cache inalterado no erro");
  assert.equal(failedContext, null, "sem navegação/contexto no erro");
}

let releaseRpc;
const pendingRpc = new Promise((resolve) => {
  releaseRpc = resolve;
});
const sharedInFlight = { current: false };
let concurrentCalls = 0;
const first = syntheticFrontendCreate({
  rpc: async () => {
    concurrentCalls += 1;
    return pendingRpc;
  },
  refresh: async () => {},
  setContext: () => {},
  input: { name: "Único" },
  inFlight: sharedInFlight,
});
const second = await syntheticFrontendCreate({
  rpc: async () => {
    concurrentCalls += 1;
    return { data: [validRow], error: null };
  },
  refresh: async () => {},
  setContext: () => {},
  input: { name: "Duplicado" },
  inFlight: sharedInFlight,
});
assert.equal(second, null, "duplo submit é ignorado");
assert.equal(concurrentCalls, 1, "duplo submit não dispara segunda RPC");
releaseRpc({ data: [validRow], error: null });
await first;

function syntheticAtomicTransaction({ failMembership = false } = {}) {
  const persisted = { groups: [], memberships: [] };
  const tx = { groups: [...persisted.groups], memberships: [...persisted.memberships] };
  try {
    const group = { id: "group-1" };
    tx.groups.push(group);
    if (failMembership) throw new Error("membership rejected");
    tx.memberships.push({ id: "member-1", group_id: group.id, role: "owner" });
    persisted.groups = tx.groups;
    persisted.memberships = tx.memberships;
    return persisted;
  } catch {
    return persisted;
  }
}

assert.deepEqual(
  syntheticAtomicTransaction({ failMembership: true }),
  { groups: [], memberships: [] },
  "modelo sintético: falha da membership não persiste o grupo",
);
assert.deepEqual(
  syntheticAtomicTransaction(),
  {
    groups: [{ id: "group-1" }],
    memberships: [{ id: "member-1", group_id: "group-1", role: "owner" }],
  },
  "modelo sintético: sucesso persiste grupo e owner juntos",
);

console.log("G1-C1: static database, synthetic atomicity, and frontend tests passed.");
