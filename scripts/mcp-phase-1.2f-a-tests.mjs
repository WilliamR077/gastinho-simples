import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { mock } from "node:test";
import { build } from "esbuild";

mock.timers.enable({
  apis: ["Date"],
  now: new Date("2026-07-29T12:00:00-03:00"),
});

const plugin = {
  name: "phase-1.2f-a-supabase",
  setup(builder) {
    builder.onResolve({ filter: /supabase-client$/ }, () => ({
      path: "supabase-client",
      namespace: "test",
    }));
    builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({
      contents:
        "export function supabaseForUser(){return globalThis.__MCP_TEST_SUPABASE__}",
      loader: "js",
    }));
  },
};
const bundled = await build({
  stdin: {
    contents: `
      export { default as listSharedGroups } from "./src/lib/mcp/tools/list-shared-groups.ts";
      export { default as listSharedGroupMembers } from "./src/lib/mcp/tools/list-shared-group-members.ts";
      export * from "./src/lib/mcp/shared/shared-group-read.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2f-a-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [plugin],
});
const core = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`,
);

let checks = 0;
const check = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks += 1;
};
const errorCode = (result, expected, message) =>
  equal(result.structuredContent?.error?.code, expected, message);

const userA = "10000000-0000-4000-8000-000000000001";
const userB = "20000000-0000-4000-8000-000000000002";
const userC = "30000000-0000-4000-8000-000000000003";
const userD = "40000000-0000-4000-8000-000000000004";
const groupOwner = "51000000-0000-4000-8000-000000000001";
const groupMember = "52000000-0000-4000-8000-000000000002";
const groupOrphan = "53000000-0000-4000-8000-000000000003";
const groupInactive = "54000000-0000-4000-8000-000000000004";
const groupAlien = "55000000-0000-4000-8000-000000000005";
const membershipAOwner = "61000000-0000-4000-8000-000000000001";
const membershipBAdmin = "62000000-0000-4000-8000-000000000002";
const membershipCMember = "63000000-0000-4000-8000-000000000003";
const membershipAMember = "64000000-0000-4000-8000-000000000004";
const membershipAAdmin = "65000000-0000-4000-8000-000000000005";
const t0 = "2026-07-01T12:00:00.000Z";

const group = (overrides = {}) => ({
  id: groupOwner,
  name: "Casa",
  description: "Despesas da casa",
  color: "#6366f1",
  created_by: userA,
  invite_code: "OWNER1",
  max_members: 5,
  is_active: true,
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: t0,
  ...overrides,
});
const membership = (overrides = {}) => ({
  id: membershipAOwner,
  group_id: groupOwner,
  user_id: userA,
  role: "owner",
  joined_at: "2026-06-01T12:00:00.000Z",
  ...overrides,
});
const base = (overrides = {}) => ({
  shared_groups: [
    group(),
    group({
      id: groupMember,
      name: "Amigos",
      created_by: userB,
      invite_code: "MEMBER1",
      max_members: null,
      created_at: "2026-06-02T12:00:00.000Z",
    }),
    group({
      id: groupOrphan,
      name: "Órfão",
      created_by: userA,
      invite_code: "ORPHAN1",
      max_members: null,
      created_at: "2026-06-03T12:00:00.000Z",
    }),
    group({
      id: groupInactive,
      name: "Arquivo",
      created_by: userB,
      invite_code: "ADMIN1",
      max_members: 2,
      is_active: false,
      created_at: "2026-06-04T12:00:00.000Z",
    }),
    group({
      id: groupAlien,
      name: "Alheio",
      created_by: userD,
      invite_code: "ALIEN1",
      created_at: "2026-06-05T12:00:00.000Z",
    }),
  ],
  shared_group_members: [
    membership(),
    membership({
      id: membershipBAdmin,
      user_id: userB,
      role: "admin",
      joined_at: "2026-06-02T12:00:00.000Z",
    }),
    membership({
      id: membershipCMember,
      user_id: userC,
      role: "member",
      joined_at: "2026-06-03T12:00:00.000Z",
    }),
    membership({
      id: membershipAMember,
      group_id: groupMember,
      role: "member",
      joined_at: "2026-06-05T12:00:00.000Z",
    }),
    membership({
      id: "66000000-0000-4000-8000-000000000006",
      group_id: groupMember,
      user_id: userB,
      role: "owner",
      joined_at: "2026-06-02T12:00:00.000Z",
    }),
    membership({
      id: membershipAAdmin,
      group_id: groupInactive,
      role: "admin",
      joined_at: "2026-06-06T12:00:00.000Z",
    }),
    membership({
      id: "67000000-0000-4000-8000-000000000007",
      group_id: groupInactive,
      user_id: userB,
      role: "owner",
      joined_at: "2026-06-04T12:00:00.000Z",
    }),
    membership({
      id: "68000000-0000-4000-8000-000000000008",
      group_id: groupAlien,
      user_id: userD,
      role: "owner",
      joined_at: "2026-06-05T12:00:00.000Z",
    }),
  ],
  profiles: [
    { user_id: userA, display_name: "João" },
    { user_id: userB, display_name: "Alex" },
    { user_id: userC, display_name: "Alex" },
    { user_id: userD, display_name: "Pessoa alheia" },
  ],
  ...overrides,
});

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.columns = null;
    this.max = Infinity;
  }
  select(columns) {
    this.columns = columns.split(",").map((column) => column.trim());
    this.db.calls.push({ table: this.table, method: "select", columns });
    return this;
  }
  eq(column, value) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  in(column, values) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  limit(value) {
    this.max = value;
    return this;
  }
  canSeeGroup(groupId) {
    const groupRow = this.db.tables.shared_groups.find(
      (candidate) => candidate.id === groupId,
    );
    return (
      groupRow?.created_by === this.db.userId ||
      this.db.tables.shared_group_members.some(
        (candidate) =>
          candidate.group_id === groupId &&
          candidate.user_id === this.db.userId,
      )
    );
  }
  sharesGroup(left, right) {
    const leftGroups = new Set(
      this.db.tables.shared_group_members
        .filter((candidate) => candidate.user_id === left)
        .map((candidate) => candidate.group_id),
    );
    return this.db.tables.shared_group_members.some(
      (candidate) =>
        candidate.user_id === right && leftGroups.has(candidate.group_id),
    );
  }
  rows() {
    let rows = structuredClone(this.db.tables[this.table] ?? []);
    if (this.table === "shared_groups") {
      rows = rows.filter((row) => this.canSeeGroup(row.id));
    }
    if (this.table === "shared_group_members") {
      rows = rows.filter((row) =>
        this.db.tables.shared_group_members.some(
          (candidate) =>
            candidate.group_id === row.group_id &&
            candidate.user_id === this.db.userId,
        ),
      );
    }
    if (this.table === "profiles") {
      rows = rows.filter(
        (row) =>
          row.user_id === this.db.userId ||
          this.sharesGroup(this.db.userId, row.user_id),
      );
    }
    for (const filter of this.filters) rows = rows.filter(filter);
    return rows.slice(0, this.max);
  }
  project(row) {
    if (!this.columns) return row;
    return Object.fromEntries(
      this.columns
        .filter((column) => column in row)
        .map((column) => [column, row[column]]),
    );
  }
  execute(single) {
    if (this.db.failTable === this.table) {
      return { data: null, error: { message: "private database detail" } };
    }
    const rows = this.rows().map((row) => this.project(row));
    return { data: single ? rows[0] ?? null : rows, error: null };
  }
  async maybeSingle() {
    return this.execute(true);
  }
  then(resolve, reject) {
    return Promise.resolve(this.execute(false)).then(resolve, reject);
  }
}

class DB {
  constructor(tables, options = {}) {
    this.tables = structuredClone(tables);
    this.userId = options.userId ?? userA;
    this.failTable = options.failTable ?? null;
    this.calls = [];
    this.writes = [];
  }
  from(table) {
    return new Query(this, table);
  }
  rpc() {
    throw new Error("RPC não deve ser usada");
  }
}

const ctx = {
  isAuthenticated: () => true,
  getUserId: () => userA,
  getToken: () => "synthetic",
};
const use = (tables = base(), options) => {
  const db = new DB(tables, options);
  globalThis.__MCP_TEST_SUPABASE__ = db;
  return db;
};
const serialized = (value) => JSON.stringify(value);

{
  const db = use();
  const result = await core.listSharedGroups.handler({}, ctx);
  const data = result.structuredContent;
  equal(data.resource_type, "shared_group_collection", "resource groups");
  equal(data.total_accessible_count, 4, "quatro grupos acessíveis");
  equal(data.returned_count, 3, "inativo oculto");
  equal(data.active_count, 3, "três ativos");
  equal(data.inactive_count, 1, "um inativo acessível");
  check(!data.groups.some((item) => item.id === groupAlien), "grupo alheio omitido");
  check(!data.groups.some((item) => item.id === groupInactive), "inativo oculto");
  equal(
    data.groups.map((item) => item.name),
    ["Amigos", "Casa", "Órfão"],
    "ordenação determinística por nome",
  );
  const owner = data.groups.find((item) => item.id === groupOwner);
  equal(owner.current_user_role, "owner", "papel owner");
  equal(owner.current_membership_id, membershipAOwner, "membership owner");
  equal(owner.is_owner, true, "is_owner consistente");
  equal(owner.can_manage, true, "owner gerencia");
  equal(owner.member_count, 3, "contagem distinta");
  equal(owner.max_members, 5, "limite real");
  equal(owner.capacity_remaining, 2, "capacidade calculada");
  equal(owner.updated_at, t0, "updated_at disponível");
  const memberGroup = data.groups.find((item) => item.id === groupMember);
  equal(memberGroup.current_user_role, "member", "papel member");
  equal(memberGroup.is_owner, false, "member não owner");
  equal(memberGroup.can_manage, false, "member não gerencia");
  equal(memberGroup.max_members, null, "capacidade ilimitada real");
  equal(memberGroup.capacity_remaining, null, "vagas ilimitadas não inventadas");
  const orphan = data.groups.find((item) => item.id === groupOrphan);
  equal(orphan.current_user_role, null, "papel órfão não inventado");
  equal(orphan.current_membership_id, null, "membership órfã não inventada");
  equal(orphan.is_owner, false, "owner inconsistente conservador");
  equal(orphan.can_manage, false, "permissão conservadora");
  equal(orphan.member_count, null, "contagem inacessível não inventada");
  check(orphan.warnings.includes("OWNER_MEMBERSHIP_MISSING"), "warning owner ausente");
  check(orphan.warnings.includes("GROUP_ROLE_INCONSISTENCY"), "warning divergência");
  equal(data.data_complete, false, "inconsistência marca incompleto");
  check(data.warnings.includes("DATA_INCOMPLETE"), "warning coleção incompleta");
  check(result.content[0].text.includes(groupOwner), "content contém group_id copiável");
  check(result.content[0].text.includes(membershipAOwner), "content contém membership copiável");
  check(result.content[0].text.includes("nenhum dado foi alterado"), "content read-only");
  check(!serialized(result).includes(userA), "output sem UUID do usuário atual");
  check(!serialized(result).includes(userB), "output sem UUID de outro usuário");
  check(!serialized(result).includes("OWNER1"), "convite owner ausente por padrão");
  check(!serialized(result).includes("MEMBER1"), "convite member ausente por padrão");
  check(!db.calls[0].columns.includes("invite_code"), "convite nem selecionado por padrão");
  equal(db.writes, [], "nenhuma escrita");
}

{
  use();
  const result = await core.listSharedGroups.handler(
    { include_inactive: true },
    ctx,
  );
  equal(result.structuredContent.returned_count, 4, "inclui inativo");
  const inactive = result.structuredContent.groups.find(
    (item) => item.id === groupInactive,
  );
  equal(inactive.is_active, false, "inativo factual");
  equal(inactive.current_user_role, "admin", "papel admin");
  equal(inactive.can_manage, true, "admin pode gerenciar conforme RLS/frontend");
  check(inactive.warnings.includes("GROUP_INACTIVE"), "warning inativo");
}

{
  use();
  const result = await core.listSharedGroups.handler(
    { include_invite_code: true, include_inactive: true },
    ctx,
  );
  equal(
    result.structuredContent.groups.find((item) => item.id === groupOwner)
      .invite_code,
    "OWNER1",
    "owner recebe convite por opt-in",
  );
  equal(
    result.structuredContent.groups.find((item) => item.id === groupInactive)
      .invite_code,
    "ADMIN1",
    "admin recebe convite por opt-in",
  );
  const memberGroup = result.structuredContent.groups.find(
    (item) => item.id === groupMember,
  );
  check(!("invite_code" in memberGroup), "member não recebe convite");
  check(
    memberGroup.warnings.includes("INVITE_CODE_NOT_AVAILABLE"),
    "member recebe warning seguro",
  );
  check(!result.content[0].text.includes("MEMBER1"), "convite member fora do content");
  check(!result.content[0].text.includes("ORPHAN1"), "convite órfão fora do content");
}

{
  const empty = base({
    shared_groups: [],
    shared_group_members: [],
    profiles: [],
  });
  use(empty);
  const result = await core.listSharedGroups.handler({}, ctx);
  equal(result.structuredContent.groups, [], "sem grupos");
  check(
    result.structuredContent.warnings.includes("NO_SHARED_GROUPS"),
    "warning sem grupos",
  );
  equal(result.structuredContent.data_complete, true, "vazio completo");
}

{
  const tables = base();
  tables.shared_group_members.push(
    membership({
      id: "69000000-0000-4000-8000-000000000009",
      role: "member",
      joined_at: "2026-06-07T12:00:00.000Z",
    }),
  );
  use(tables);
  const result = await core.listSharedGroups.handler({}, ctx);
  const owner = result.structuredContent.groups.find(
    (item) => item.id === groupOwner,
  );
  equal(owner.current_user_role, "member", "duplicidade usa menor privilégio");
  equal(owner.can_manage, false, "duplicidade reduz permissão");
  check(
    owner.warnings.includes("DUPLICATE_MEMBERSHIP_DETECTED"),
    "warning membership duplicada",
  );
  equal(
    result.structuredContent.groups.filter((item) => item.id === groupOwner)
      .length,
    1,
    "grupo não duplicado",
  );
}

for (const invalid of [
  { user_id: userA },
  { created_by: userA },
  { invite_code: "OWNER1" },
  { role: "owner" },
  { include_inactive: "sim" },
]) {
  use();
  errorCode(
    await core.listSharedGroups.handler(invalid, ctx),
    "INVALID_INPUT",
    `groups rejeita ${Object.keys(invalid)[0]}`,
  );
}

{
  const db = use();
  const result = await core.listSharedGroupMembers.handler(
    { group_id: groupOwner },
    ctx,
  );
  const data = result.structuredContent;
  equal(data.resource_type, "shared_group_member_collection", "resource members");
  equal(data.group.id, groupOwner, "grupo correto");
  equal(data.group.name, "Casa", "nome correto");
  equal(data.group.current_user_role, "owner", "papel atual");
  equal(data.group.member_count, 3, "member_count");
  equal(data.returned_count, 3, "três membros");
  equal(
    data.members.map((item) => item.membership_id),
    [membershipAOwner, membershipBAdmin, membershipCMember],
    "ordem por entrada e membership",
  );
  equal(data.members[0].display_name, "João", "nome do perfil");
  equal(data.members[0].role, "owner", "role membro");
  equal(data.members[0].is_current_user, true, "usuário atual");
  equal(data.members[1].is_current_user, false, "outro usuário");
  equal(
    data.members.filter((item) => item.display_name === "Alex").length,
    2,
    "nomes duplicados preservados",
  );
  check(result.content[0].text.includes(groupOwner), "content group id");
  check(result.content[0].text.includes(membershipAOwner), "content membership id");
  check(result.content[0].text.includes("João"), "content nome público");
  check(result.content[0].text.includes("is_current_user=true"), "content usuário atual");
  check(!serialized(result).includes(userA), "members sem user_id atual");
  check(!serialized(result).includes(userB), "members sem outro user_id");
  check(!serialized(result).includes("@"), "members sem email");
  check(!serialized(result).includes("OWNER1"), "members sem convite");
  check(
    !db.calls.some((call) => call.method === "rpc"),
    "RPC com email não usada",
  );
  equal(db.writes, [], "members sem escrita");
}

{
  const tables = base();
  tables.profiles = tables.profiles.filter((profile) => profile.user_id !== userC);
  tables.shared_group_members.push(
    membership({
      id: "69000000-0000-4000-8000-000000000009",
      user_id: userB,
      role: "member",
      joined_at: "2026-06-08T12:00:00.000Z",
    }),
  );
  use(tables);
  const result = await core.listSharedGroupMembers.handler(
    { group_id: groupOwner },
    ctx,
  );
  equal(result.structuredContent.returned_count, 3, "join duplicado removido");
  check(
    result.structuredContent.warnings.includes("DUPLICATE_MEMBERSHIP_DETECTED"),
    "warning join duplicado",
  );
  check(
    result.structuredContent.warnings.includes("MEMBER_PROFILE_INCOMPLETE"),
    "warning perfil incompleto",
  );
  const fallback = result.structuredContent.members.find(
    (item) => item.membership_id === membershipCMember,
  );
  equal(fallback.display_name, "Membro", "fallback não identificador");
  check(!serialized(result).includes(userC), "fallback sem UUID");
  check(!serialized(result).includes("private@example.com"), "fallback sem email");
  equal(result.structuredContent.data_complete, false, "duplicidade incompleta");
}

{
  use();
  const result = await core.listSharedGroupMembers.handler(
    { group_id: groupInactive },
    ctx,
  );
  equal(result.structuredContent.group.is_active, false, "membros grupo inativo");
  check(
    result.structuredContent.warnings.includes("GROUP_INACTIVE"),
    "warning grupo inativo",
  );
}

{
  use();
  const result = await core.listSharedGroupMembers.handler(
    { group_id: groupOrphan },
    ctx,
  );
  equal(result.structuredContent.group.current_user_role, null, "órfão sem papel");
  equal(result.structuredContent.members, [], "RLS não inventa membros");
  check(
    result.structuredContent.warnings.includes("OWNER_MEMBERSHIP_MISSING"),
    "membros warning owner ausente",
  );
  equal(result.structuredContent.data_complete, false, "órfão incompleto");
}

for (const target of [
  groupAlien,
  "59000000-0000-4000-8000-000000000009",
]) {
  use();
  errorCode(
    await core.listSharedGroupMembers.handler({ group_id: target }, ctx),
    "RESOURCE_NOT_FOUND",
    "alheio e inexistente indistinguíveis",
  );
}
for (const invalid of [
  {},
  { group_id: "x" },
  { group_id: groupOwner, user_id: userA },
  { group_id: groupOwner, include_email: true },
  { group_id: groupOwner, role: "owner" },
]) {
  use();
  errorCode(
    await core.listSharedGroupMembers.handler(invalid, ctx),
    "INVALID_INPUT",
    `members rejeita ${Object.keys(invalid).at(-1) ?? "vazio"}`,
  );
}

{
  use(base(), { failTable: "shared_groups" });
  const result = await core.listSharedGroups.handler({}, ctx);
  errorCode(result, "READ_FAILED", "erro de leitura seguro");
  check(!serialized(result).includes("database"), "erro sem detalhe interno");
}

for (const tool of [core.listSharedGroups, core.listSharedGroupMembers]) {
  equal(tool.annotations.readOnlyHint, true, `${tool.name} read-only`);
  equal(tool.annotations.destructiveHint, false, `${tool.name} não destrutiva`);
  equal(tool.annotations.idempotentHint, true, `${tool.name} idempotente`);
  equal(tool.annotations.openWorldHint, false, `${tool.name} mundo fechado`);
}

const sourceFiles = [
  "src/lib/mcp/shared/shared-group-read.ts",
  "src/lib/mcp/tools/list-shared-groups.ts",
  "src/lib/mcp/tools/list-shared-group-members.ts",
];
for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  check(source.includes("supabaseForUser") || file.includes("/tools/"), `${file} usa helper autenticado`);
  check(!source.includes("service_role"), `${file} sem service role`);
  check(!source.includes('from "@/'), `${file} sem alias`);
  check(!source.includes(".insert("), `${file} sem insert`);
  check(!source.includes(".update("), `${file} sem update`);
  check(!source.includes(".delete("), `${file} sem delete`);
  check(!source.includes(".upsert("), `${file} sem upsert`);
}
const helperSource = await readFile(
  "src/lib/mcp/shared/shared-group-read.ts",
  "utf8",
);
check(!helperSource.includes(".rpc("), "RPC com email não usada");
check(
  helperSource.includes('.from("profiles")'),
  "nomes obtidos de profiles sob RLS",
);
check(
  helperSource.includes('.from("shared_group_members")'),
  "membros obtidos sob RLS",
);

const manifest = JSON.parse(
  await readFile(".lovable/mcp/manifest.json", "utf8"),
);
const tools = manifest.mcp.tools;
equal(tools.length, 47, "manifest 47 tools");
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
  23,
  "23 read-only",
);
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint === false).length,
  24,
  "24 write",
);
for (const name of ["list_shared_groups", "list_shared_group_members"]) {
  const tool = tools.find((candidate) => candidate.name === name);
  check(tool, `${name} registrada`);
  equal(tool.inputSchema.additionalProperties, false, `${name} input fechado`);
  equal(tool.outputSchema.additionalProperties, false, `${name} output fechado`);
  equal(tool.annotations.readOnlyHint, true, `${name} manifest read`);
  equal(tool.annotations.destructiveHint, false, `${name} manifest não destrutiva`);
  check(!("user_id" in tool.inputSchema.properties), `${name} input sem user_id`);
  check(!serialized(tool.outputSchema).includes("user_id"), `${name} schema sem user_id`);
  check(!serialized(tool.outputSchema).includes("created_by"), `${name} schema sem created_by`);
  check(!serialized(tool.outputSchema).includes("email"), `${name} schema sem email`);
}
const groupsManifest = tools.find(
  (tool) => tool.name === "list_shared_groups",
);
equal(
  groupsManifest.outputSchema.properties.groups.items.additionalProperties,
  false,
  "item de grupo fechado",
);
const membersManifest = tools.find(
  (tool) => tool.name === "list_shared_group_members",
);
equal(
  membersManifest.outputSchema.properties.members.items.additionalProperties,
  false,
  "item de membro fechado",
);
equal(
  membersManifest.outputSchema.properties.group.additionalProperties,
  false,
  "resumo de grupo fechado",
);
check(
  !("include_email" in membersManifest.inputSchema.properties),
  "sem opção de email",
);

const bundleSource = await readFile(
  "supabase/functions/mcp/index.ts",
  "utf8",
);
check(bundleSource.includes("Deno.serve"), "bundle contém Deno.serve");
check(bundleSource.includes('name: "list_shared_groups"'), "bundle groups");
check(
  bundleSource.includes('name: "list_shared_group_members"'),
  "bundle members",
);
check(!bundleSource.includes('from "@/'), "bundle sem alias");
check(!bundleSource.includes("npm:@/"), "bundle sem npm alias");
check(
  !/[A-Za-z]:[\\/](?:Users|home)[\\/]/u.test(bundleSource),
  "bundle sem caminho absoluto",
);
equal(
  execFileSync(
    "git",
    ["diff", "--name-only", "--", "supabase/functions"],
    { encoding: "utf8" },
  ).trim(),
  "supabase/functions/mcp/index.ts",
  "somente Edge Function MCP",
);
equal(
  execFileSync(
    "git",
    ["status", "--porcelain", "--", "supabase/migrations"],
    { encoding: "utf8" },
  ).trim(),
  "",
  "nenhuma migration",
);

console.log(`Phase MCP 1.2F-A: ${checks} checks passed.`);
