import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { mock } from "node:test";
import { build } from "esbuild";

mock.timers.enable({
  apis: ["Date"],
  now: new Date("2026-07-30T12:00:00-03:00"),
});

const plugin = {
  name: "phase-1.2f-c-supabase",
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
      export { default as updateSharedGroupTool } from "./src/lib/mcp/tools/update-shared-group.ts";
      export * from "./src/lib/mcp/shared/shared-group-write.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2f-c-entry.ts",
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
const serialized = (value) => JSON.stringify(value);

const userA = "10000000-0000-4000-8000-000000000001";
const userB = "20000000-0000-4000-8000-000000000002";
const userC = "30000000-0000-4000-8000-000000000003";
const userD = "40000000-0000-4000-8000-000000000004";
const groupA = "51000000-0000-4000-8000-000000000001";
const groupInactive = "52000000-0000-4000-8000-000000000002";
const groupAlien = "53000000-0000-4000-8000-000000000003";
const groupOrphan = "54000000-0000-4000-8000-000000000004";
const groupRoleBad = "55000000-0000-4000-8000-000000000005";
const memberA = "61000000-0000-4000-8000-000000000001";
const memberB = "62000000-0000-4000-8000-000000000002";
const memberC = "63000000-0000-4000-8000-000000000003";
const oldTimestamp = "2026-07-20T12:00:00.000Z";
const newTimestamp = "2026-07-30T15:00:00.000Z";

const group = (overrides = {}) => ({
  id: groupA,
  name: "Casa",
  description: "Despesas da casa",
  color: "#6366f1",
  created_by: userA,
  invite_code: "PRIVATE1",
  max_members: null,
  is_active: true,
  created_at: "2026-01-01T12:00:00.000Z",
  updated_at: oldTimestamp,
  ...overrides,
});
const membership = (overrides = {}) => ({
  id: memberA,
  group_id: groupA,
  user_id: userA,
  role: "owner",
  joined_at: "2026-01-01T12:00:00.000Z",
  ...overrides,
});
const base = (overrides = {}) => ({
  shared_groups: [
    group(),
    group({
      id: groupInactive,
      name: "Arquivo",
      invite_code: "PRIVATE2",
      is_active: false,
    }),
    group({
      id: groupAlien,
      name: "Alheio",
      created_by: userD,
      invite_code: "PRIVATE3",
    }),
    group({
      id: groupOrphan,
      name: "Família",
      invite_code: "PRIVATE4",
    }),
    group({
      id: groupRoleBad,
      name: "Família",
      invite_code: "PRIVATE5",
    }),
  ],
  shared_group_members: [
    membership(),
    membership({ id: memberB, user_id: userB, role: "admin" }),
    membership({ id: memberC, user_id: userC, role: "member" }),
    membership({
      id: "64000000-0000-4000-8000-000000000004",
      group_id: groupInactive,
    }),
    membership({
      id: "65000000-0000-4000-8000-000000000005",
      group_id: groupAlien,
      user_id: userD,
    }),
    membership({
      id: "66000000-0000-4000-8000-000000000006",
      group_id: groupRoleBad,
      role: "admin",
    }),
    membership({
      id: "67000000-0000-4000-8000-000000000007",
      group_id: groupRoleBad,
      user_id: userB,
      role: "owner",
    }),
  ],
  expenses: [{ id: "expense", amount: 100 }],
  incomes: [{ id: "income", amount: 200 }],
  recurring_expenses: [{ id: "recurring-expense" }],
  recurring_incomes: [{ id: "recurring-income" }],
  budget_goals: [{ id: "goal" }],
  expense_splits: [{ id: "split" }],
  ...overrides,
});

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.columns = null;
    this.max = Infinity;
    this.patch = null;
  }
  select(columns) {
    this.columns = columns.split(",").map((column) => column.trim());
    this.db.calls.push({ table: this.table, method: "select", columns });
    return this;
  }
  update(patch) {
    this.patch = structuredClone(patch);
    this.db.calls.push({ table: this.table, method: "update", patch: this.patch });
    return this;
  }
  eq(column, value) {
    this.filters.push({ column, value });
    return this;
  }
  limit(value) {
    this.max = value;
    return this;
  }
  isMember(groupId, candidate = this.db.userId) {
    return this.db.tables.shared_group_members.some(
      (row) => row.group_id === groupId && row.user_id === candidate,
    );
  }
  role(groupId, candidate = this.db.userId) {
    return this.db.tables.shared_group_members.find(
      (row) => row.group_id === groupId && row.user_id === candidate,
    )?.role;
  }
  canSeeGroup(row) {
    return row.created_by === this.db.userId || this.isMember(row.id);
  }
  applyRace() {
    if (!this.patch || this.db.raceApplied || !this.db.race) return;
    this.db.raceApplied = true;
    const row = this.db.tables.shared_groups.find((item) => item.id === groupA);
    if (this.db.race === "removed") {
      this.db.tables.shared_groups = this.db.tables.shared_groups.filter(
        (item) => item.id !== groupA,
      );
      this.db.tables.shared_group_members =
        this.db.tables.shared_group_members.filter(
          (item) => item.group_id !== groupA,
        );
    } else if (this.db.race === "concurrent" && row) {
      row.updated_at = "2026-07-30T14:59:59.000Z";
    } else if (this.db.race === "inactive" && row) {
      row.is_active = false;
      row.updated_at = "2026-07-30T14:59:59.000Z";
    } else if (this.db.race === "permission") {
      const current = this.db.tables.shared_group_members.find(
        (item) => item.group_id === groupA && item.user_id === this.db.userId,
      );
      if (current) current.role = "member";
    }
  }
  rows() {
    let rows = this.db.tables[this.table] ?? [];
    if (this.table === "shared_groups") {
      rows = rows.filter((row) => this.canSeeGroup(row));
      if (this.patch) {
        rows = rows.filter((row) =>
          ["owner", "admin"].includes(this.role(row.id) ?? ""),
        );
      }
    } else if (this.table === "shared_group_members") {
      rows = rows.filter((row) => this.isMember(row.group_id));
    }
    for (const filter of this.filters) {
      rows = rows.filter((row) => row[filter.column] === filter.value);
    }
    return rows.slice(0, this.max);
  }
  project(row) {
    if (!this.columns) return structuredClone(row);
    return Object.fromEntries(
      this.columns
        .filter((column) => column in row)
        .map((column) => [column, row[column]]),
    );
  }
  execute(single) {
    if (this.patch) this.applyRace();
    if (this.db.failTable === this.table) {
      return { data: null, error: { message: "private SQL constraint detail" } };
    }
    const rows = this.rows();
    if (this.patch && rows.length > 0) {
      for (const row of rows) {
        Object.assign(row, this.patch);
        row.updated_at = newTimestamp;
      }
      this.db.writes.push({
        table: this.table,
        patch: structuredClone(this.patch),
        filters: structuredClone(this.filters),
      });
    }
    const projected = rows.map((row) => this.project(row));
    return { data: single ? projected[0] ?? null : projected, error: null };
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
    this.race = options.race ?? null;
    this.raceApplied = false;
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

const ctxFor = (userId = userA) => ({
  isAuthenticated: () => true,
  getUserId: () => userId,
  getToken: () => "synthetic",
});
const use = (tables = base(), options = {}) => {
  const db = new DB(tables, options);
  globalThis.__MCP_TEST_SUPABASE__ = db;
  return db;
};
const input = (changes, overrides = {}) => ({
  group_id: groupA,
  expected_updated_at: oldTimestamp,
  changes,
  ...overrides,
});

// Owner, patch seguro, before/after e preservação integral.
{
  const tables = base();
  const protectedBefore = {
    created_by: tables.shared_groups[0].created_by,
    invite_code: tables.shared_groups[0].invite_code,
    max_members: tables.shared_groups[0].max_members,
    is_active: tables.shared_groups[0].is_active,
    created_at: tables.shared_groups[0].created_at,
  };
  const unrelatedBefore = structuredClone({
    memberships: tables.shared_group_members,
    expenses: tables.expenses,
    incomes: tables.incomes,
    recurring_expenses: tables.recurring_expenses,
    recurring_incomes: tables.recurring_incomes,
    goals: tables.budget_goals,
    splits: tables.expense_splits,
  });
  const db = use(tables);
  const result = await core.updateSharedGroupTool.handler(
    input({
      name: "  Família Árvore  ",
      description: "  Linha um\r\nLinha dois  ",
      color: "#8B5CF6",
    }),
    ctxFor(),
  );
  const data = result.structuredContent;
  equal(data.resource_type, "shared_group", "resource");
  equal(data.applied, true, "applied");
  equal(data.no_op, false, "não no-op");
  equal(data.current_user_role, "owner", "owner factual");
  equal(data.can_manage, true, "can_manage interno");
  equal(data.before.name, "Casa", "before");
  equal(data.after.name, "Família Árvore", "trim e Unicode");
  equal(data.after.description, "Linha um\nLinha dois", "quebras normalizadas");
  equal(data.after.color, "#8b5cf6", "cor normalizada");
  equal(data.after.updated_at, newTimestamp, "trigger sintético");
  equal(data.changed_fields, ["name", "description", "color"], "campos alterados");
  equal(
    data.warnings,
    [
      "GROUP_UPDATED",
      "GROUP_NAME_UPDATED",
      "GROUP_DESCRIPTION_UPDATED",
      "GROUP_COLOR_UPDATED",
    ],
    "warnings factuais",
  );
  check(!Number.isNaN(Date.parse(data.operation_completed_at)), "operation timestamp");
  equal(data.data_complete, true, "dados completos");
  equal(db.writes.length, 1, "uma escrita");
  equal(db.writes[0].table, "shared_groups", "somente shared_groups");
  equal(Object.keys(db.writes[0].patch), ["name", "description", "color"], "patch mínimo");
  check(
    db.writes[0].filters.some(
      (filter) => filter.column === "id" && filter.value === groupA,
    ),
    "update filtrado por id",
  );
  check(
    db.writes[0].filters.some(
      (filter) =>
        filter.column === "updated_at" && filter.value === oldTimestamp,
    ),
    "update filtrado por timestamp",
  );
  check(
    db.writes[0].filters.some(
      (filter) => filter.column === "is_active" && filter.value === true,
    ),
    "update filtrado por ativo",
  );
  const stored = db.tables.shared_groups.find((row) => row.id === groupA);
  for (const [field, value] of Object.entries(protectedBefore)) {
    equal(stored[field], value, `${field} protegido`);
  }
  equal(db.tables.shared_group_members, unrelatedBefore.memberships, "memberships intactas");
  equal(db.tables.expenses, unrelatedBefore.expenses, "despesas intactas");
  equal(db.tables.incomes, unrelatedBefore.incomes, "receitas intactas");
  equal(db.tables.recurring_expenses, unrelatedBefore.recurring_expenses, "recorrências despesa intactas");
  equal(db.tables.recurring_incomes, unrelatedBefore.recurring_incomes, "recorrências receita intactas");
  equal(db.tables.budget_goals, unrelatedBefore.goals, "metas intactas");
  equal(db.tables.expense_splits, unrelatedBefore.splits, "rateios intactos");
  check(result.content[0].text.includes(groupA), "content ID copiável");
  check(result.content[0].text.includes("Papel atual=owner"), "content papel");
  check(result.content[0].text.includes("name:"), "content mudanças");
  check(result.content[0].text.includes(newTimestamp), "content updated_at");
  check(result.content[0].text.includes("Membros, papéis, convite"), "content integridade");
  check(!serialized(result).includes(userA), "output sem user_id");
  check(!serialized(result).includes("PRIVATE1"), "output sem convite");
  check(!serialized(result).includes("@"), "output sem email");
}

// Admin possui exatamente a mesma permissão.
{
  const db = use(base(), { userId: userB });
  const result = await core.updateSharedGroupTool.handler(
    input({ name: "Casa Admin" }),
    ctxFor(userB),
  );
  equal(result.structuredContent.applied, true, "admin autorizado");
  equal(result.structuredContent.current_user_role, "admin", "papel admin");
  equal(result.structuredContent.can_manage, true, "admin can_manage");
  equal(db.writes.length, 1, "admin escreve grupo");
}

// Member acessa, mas não pode editar.
{
  const db = use(base(), { userId: userC });
  const result = await core.updateSharedGroupTool.handler(
    input({ name: "Tentativa" }),
    ctxFor(userC),
  );
  errorCode(result, "FORBIDDEN", "member bloqueado");
  equal(db.writes, [], "member sem escrita");
  check(result.content[0].text.includes("Nada foi alterado"), "content permissão seguro");
}

// Inexistente e alheio são indistinguíveis.
for (const target of [
  groupAlien,
  "59000000-0000-4000-8000-000000000009",
]) {
  const db = use();
  const result = await core.updateSharedGroupTool.handler(
    input({ name: "Tentativa" }, { group_id: target }),
    ctxFor(),
  );
  errorCode(result, "RESOURCE_NOT_FOUND", "alheio e inexistente iguais");
  equal(db.writes, [], "recurso oculto sem escrita");
  check(!serialized(result).includes(userD), "sem proprietário");
}

// Grupo inativo não pode ser editado nem reativado.
{
  const db = use();
  const result = await core.updateSharedGroupTool.handler(
    input({ name: "Arquivo novo" }, { group_id: groupInactive }),
    ctxFor(),
  );
  errorCode(result, "GROUP_INACTIVE", "inativo bloqueado");
  equal(db.writes, [], "inativo sem escrita");
  equal(
    db.tables.shared_groups.find((row) => row.id === groupInactive).updated_at,
    oldTimestamp,
    "timestamp inativo preservado",
  );
  check(result.content[0].text.includes("não reativa"), "content sem reativação");
}

// Inconsistências estruturais, incluindo o cenário Família.
for (const [tables, target, label] of [
  [base(), groupOrphan, "owner membership ausente"],
  [base(), groupRoleBad, "owner incompatível"],
  [
    (() => {
      const tables = base();
      tables.shared_group_members.push(
        membership({
          id: "68000000-0000-4000-8000-000000000008",
          role: "admin",
        }),
      );
      return tables;
    })(),
    groupA,
    "membership duplicada",
  ],
  [
    (() => {
      const tables = base();
      tables.shared_group_members.find((row) => row.user_id === userA).role =
        "unknown";
      return tables;
    })(),
    groupA,
    "papel indisponível",
  ],
]) {
  const db = use(tables);
  const original = structuredClone(
    db.tables.shared_groups.find((row) => row.id === target),
  );
  const result = await core.updateSharedGroupTool.handler(
    input({ name: "Não aplicar" }, { group_id: target }),
    ctxFor(),
  );
  errorCode(result, "GROUP_DATA_INCOMPLETE", label);
  equal(db.writes, [], `${label} sem escrita`);
  equal(
    db.tables.shared_groups.find((row) => row.id === target),
    original,
    `${label} intacto`,
  );
  check(result.content[0].text.includes("correção administrativa futura"), "orientação administrativa");
  check(!serialized(result).includes(userB), "erro sem outro UUID");
}

// Campos individuais, omitidos, duplicidade de nome e limpeza explícita.
for (const [changes, changedField, expected] of [
  [{ name: "Viagem" }, "name", "Viagem"],
  [{ description: "Descrição válida" }, "description", "Descrição válida"],
  [{ color: "#ec4899" }, "color", "#ec4899"],
]) {
  const db = use();
  const result = await core.updateSharedGroupTool.handler(input(changes), ctxFor());
  equal(result.structuredContent.changed_fields, [changedField], `somente ${changedField}`);
  equal(result.structuredContent.after[changedField], expected, `${changedField} aplicado`);
  for (const field of ["name", "description", "color"]) {
    if (field !== changedField) {
      equal(
        result.structuredContent.after[field],
        result.structuredContent.before[field],
        `${field} omitido preservado`,
      );
    }
  }
  equal(Object.keys(db.writes[0].patch), [changedField], `patch ${changedField}`);
}
{
  use();
  const result = await core.updateSharedGroupTool.handler(
    input({ description: null }),
    ctxFor(),
  );
  equal(result.structuredContent.after.description, null, "null limpa descrição");
  equal(result.structuredContent.changed_fields, ["description"], "limpeza explícita");
}
{
  const tables = base();
  tables.shared_groups.push(
    group({
      id: "56000000-0000-4000-8000-000000000006",
      name: "Duplicado",
      invite_code: "PRIVATE6",
    }),
  );
  const db = use(tables);
  const result = await core.updateSharedGroupTool.handler(
    input({ name: "Duplicado" }),
    ctxFor(),
  );
  equal(result.structuredContent.applied, true, "nome duplicado permitido");
  equal(db.calls.filter((call) => call.table === "shared_groups" && call.method === "select").length, 2, "nome não usado como identificador");
}

// Validação do nome.
for (const [name, valid, label] of [
  [" Árvore ", true, "Unicode e acento"],
  ["A", true, "mínimo real"],
  ["x".repeat(50), true, "máximo 50"],
  ["", false, "vazio"],
  ["   ", false, "somente espaços"],
  ["x".repeat(51), false, "acima 50"],
  ["Nome\nquebrado", false, "controle"],
  ["<b>Grupo</b>", false, "HTML"],
]) {
  const db = use();
  const result = await core.updateSharedGroupTool.handler(input({ name }), ctxFor());
  if (valid) {
    equal(result.structuredContent.after.name, name.trim(), label);
  } else {
    errorCode(result, "INVALID_INPUT", label);
    equal(db.writes, [], `${label} sem escrita`);
  }
}

// Validação da descrição.
for (const [description, valid, label] of [
  ["Descrição com ação", true, "Unicode descrição"],
  ["Linha 1\nLinha 2", true, "quebra permitida"],
  ["x".repeat(200), true, "máximo 200"],
  ["", false, "descrição vazia não vira null"],
  ["   ", false, "descrição espaços não vira null"],
  ["x".repeat(201), false, "acima 200"],
  ["texto\u0000oculto", false, "controle perigoso"],
  ["<script>alert(1)</script>", false, "HTML executável"],
]) {
  const db = use();
  const result = await core.updateSharedGroupTool.handler(
    input({ description }),
    ctxFor(),
  );
  if (valid) {
    equal(result.structuredContent.after.description, description.trim(), label);
  } else {
    errorCode(result, "INVALID_INPUT", label);
    equal(db.writes, [], `${label} sem escrita`);
  }
}

// Paleta fechada.
for (const color of core.SHARED_GROUP_COLORS) {
  const db = use();
  const current = db.tables.shared_groups[0];
  if (current.color === color) current.color = "#8b5cf6";
  const result = await core.updateSharedGroupTool.handler(input({ color }), ctxFor());
  equal(result.structuredContent.after.color, color, `paleta ${color}`);
}
for (const color of [
  "#fff",
  "#123456",
  "red",
  "var(--danger)",
  "url(javascript:alert(1))",
  "#6366f1;",
]) {
  const db = use();
  const result = await core.updateSharedGroupTool.handler(input({ color }), ctxFor());
  errorCode(result, "INVALID_INPUT", `cor inválida ${color}`);
  equal(db.writes, [], "cor inválida sem escrita");
}

// Inputs fechados e campos protegidos.
for (const invalid of [
  {},
  { group_id: groupA, changes: { name: "X" } },
  { expected_updated_at: oldTimestamp, changes: { name: "X" } },
  input({}),
  input({ name: "X" }, { user_id: userA }),
  input({ name: "X" }, { created_by: userA }),
  input({ name: "X" }, { role: "owner" }),
  input({ name: "X" }, { owner_id: userA }),
  input({ name: "X" }, { membership_id: memberA }),
  input({ name: "X" }, { invite_code: "NEW" }),
  input({ name: "X" }, { is_active: true }),
  input({ name: "X" }, { force: true }),
  input({ name: "X", created_by: userA }),
  input({ name: "X", role: "owner" }),
  input({ name: "X", invite_code: "NEW" }),
  input({ name: "X", max_members: 5 }),
  input({ name: "X", is_active: true }),
  input({ name: "X", members: [] }),
  input({ name: "X", email: "private@example.com" }),
]) {
  const db = use();
  const result = await core.updateSharedGroupTool.handler(invalid, ctxFor());
  errorCode(result, "INVALID_INPUT", "campo proibido rejeitado");
  equal(db.writes, [], "input inválido sem escrita");
}

// Concorrência inicial e corridas finais.
{
  const db = use();
  const result = await core.updateSharedGroupTool.handler(
    input({ name: "X" }, { expected_updated_at: "2026-07-01T00:00:00.000Z" }),
    ctxFor(),
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "timestamp antigo");
  equal(db.writes, [], "conflito inicial sem escrita");
  check(result.content[0].text.includes("list_shared_groups"), "orienta releitura");
}
{
  const db = use();
  const result = await core.updateSharedGroupTool.handler(
    input({ name: "X" }, { expected_updated_at: "ontem" }),
    ctxFor(),
  );
  errorCode(result, "INVALID_INPUT", "timestamp inválido");
  equal(db.writes, [], "timestamp inválido sem escrita");
}
for (const [race, code] of [
  ["concurrent", "CONCURRENT_MODIFICATION"],
  ["inactive", "GROUP_INACTIVE"],
  ["permission", "FORBIDDEN"],
  ["removed", "RESOURCE_NOT_FOUND"],
]) {
  const racingUser = race === "permission" ? userB : userA;
  const db = use(base(), { race, userId: racingUser });
  const result = await core.updateSharedGroupTool.handler(
    input({ name: `Corrida ${race}` }),
    ctxFor(racingUser),
  );
  errorCode(result, code, `corrida ${race}`);
  equal(db.writes, [], `corrida ${race} sem escrita parcial`);
  check(!serialized(result).includes(userB), `corrida ${race} sem UUID alheio`);
}
{
  const db = use(base(), { failTable: "shared_groups" });
  const result = await core.updateSharedGroupTool.handler(
    input({ name: "Falha" }),
    ctxFor(),
  );
  errorCode(result, "READ_FAILED", "falha inicial segura");
  check(!serialized(result).includes("SQL"), "erro sem SQL");
  check(!serialized(result).includes("constraint"), "erro sem constraint");
  equal(db.writes, [], "falha sem escrita");
}

// No-op valida concorrência, não toca timestamp e não escreve.
for (const changes of [
  { name: "Casa" },
  { name: "  Casa  " },
  { description: "Despesas da casa" },
  { color: "#6366F1" },
  {
    name: "Casa",
    description: "Despesas da casa",
    color: "#6366f1",
  },
]) {
  const db = use();
  const result = await core.updateSharedGroupTool.handler(input(changes), ctxFor());
  const data = result.structuredContent;
  equal(data.applied, false, "no-op não aplicado");
  equal(data.no_op, true, "no_op true");
  equal(data.changed_fields, [], "sem campos");
  equal(data.before, data.after, "before after equivalentes");
  equal(data.after.updated_at, oldTimestamp, "timestamp preservado");
  equal(data.warnings, ["NO_CHANGES_APPLIED"], "warning no-op");
  equal(db.writes, [], "no-op sem update");
  check(result.content[0].text.includes("nenhuma escrita foi executada"), "content no-op");
}
{
  const db = use();
  const result = await core.updateSharedGroupTool.handler(
    input(
      { name: "Casa" },
      { expected_updated_at: "2026-07-01T00:00:00.000Z" },
    ),
    ctxFor(),
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "concorrência antes do no-op");
  equal(db.writes, [], "stale no-op sem escrita");
}

// Annotations e implementação técnica.
const tool = core.updateSharedGroupTool;
equal(tool.annotations.readOnlyHint, false, "write");
equal(tool.annotations.destructiveHint, true, "destructive");
equal(tool.annotations.idempotentHint, false, "não idempotente");
equal(tool.annotations.openWorldHint, false, "mundo fechado");

const sourceFiles = [
  "src/lib/mcp/shared/shared-group-write.ts",
  "src/lib/mcp/tools/update-shared-group.ts",
];
for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  check(source.includes("supabaseForUser") || file.includes("/tools/"), `${file} cliente autenticado`);
  check(!source.includes("service_role"), `${file} sem service role`);
  check(!source.includes('from "@/'), `${file} sem alias`);
  check(!source.includes(".insert("), `${file} sem insert`);
  check(!source.includes(".delete("), `${file} sem delete`);
  check(!source.includes(".upsert("), `${file} sem upsert`);
  check(!source.includes(".rpc("), `${file} sem RPC`);
}
const helperSource = await readFile(
  "src/lib/mcp/shared/shared-group-write.ts",
  "utf8",
);
equal(
  (helperSource.match(/\.update\(/gu) ?? []).length,
  1,
  "um único ponto de update",
);
check(helperSource.includes('.from("shared_groups")'), "update shared_groups");
check(!helperSource.includes('.from("expenses")'), "sem despesas");
check(!helperSource.includes('.from("expense_splits")'), "sem splits");

// Manifest e bundle oficiais.
const manifest = JSON.parse(
  await readFile(".lovable/mcp/manifest.json", "utf8"),
);
const tools = manifest.mcp.tools;
equal(tools.length, 51, "manifest 51 tools");
equal(
  tools.filter((candidate) => candidate.annotations?.readOnlyHint === true)
    .length,
  25,
  "25 read-only",
);
equal(
  tools.filter((candidate) => candidate.annotations?.readOnlyHint === false)
    .length,
  26,
  "26 write",
);
const manifestTool = tools.find(
  (candidate) => candidate.name === "update_shared_group",
);
check(manifestTool, "tool registrada");
equal(manifestTool.inputSchema.additionalProperties, false, "input fechado");
equal(manifestTool.outputSchema.additionalProperties, false, "output fechado");
equal(
  manifestTool.inputSchema.properties.changes.additionalProperties,
  false,
  "changes fechado",
);
equal(manifestTool.annotations.readOnlyHint, false, "manifest write");
equal(manifestTool.annotations.destructiveHint, true, "manifest destructive");
equal(manifestTool.annotations.idempotentHint, false, "manifest não idempotente");
equal(manifestTool.annotations.openWorldHint, false, "manifest mundo fechado");
for (const forbidden of [
  "user_id",
  "created_by",
  "role",
  "owner_id",
  "membership_id",
  "invite_code",
  "is_active",
  "max_members",
]) {
  check(
    !(forbidden in manifestTool.inputSchema.properties.changes.properties),
    `changes sem ${forbidden}`,
  );
}
check(!serialized(manifestTool.outputSchema).includes("created_by"), "output sem created_by");
check(!serialized(manifestTool.outputSchema).includes("invite_code"), "output sem invite");
check(!serialized(manifestTool.outputSchema).includes("user_id"), "output sem user_id");
check(!serialized(manifestTool.outputSchema).includes("email"), "output sem email");

const bundleSource = await readFile(
  "supabase/functions/mcp/index.ts",
  "utf8",
);
check(bundleSource.includes("Deno.serve"), "bundle Deno.serve");
check(bundleSource.includes('name: "update_shared_group"'), "bundle tool");
check(!bundleSource.includes('from "@/'), "bundle sem alias");
check(!bundleSource.includes("npm:@/"), "bundle sem npm alias");
check(
  !/[A-Za-z]:[\\/](?:Users|home)[\\/]/u.test(bundleSource),
  "bundle sem caminho absoluto",
);
equal(
  execFileSync("git", ["diff", "--name-only", "--", "supabase/functions"], {
    encoding: "utf8",
  }).trim(),
  "supabase/functions/mcp/index.ts",
  "somente Edge Function MCP",
);
equal(
  execFileSync("git", ["status", "--porcelain", "--", "supabase/migrations"], {
    encoding: "utf8",
  }).trim(),
  "",
  "nenhuma migration",
);

console.log(`Phase MCP 1.2F-C: ${checks} checks passed.`);
