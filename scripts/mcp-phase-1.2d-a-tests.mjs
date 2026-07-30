import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { build } from "esbuild";
import { z } from "zod";

const mockPlugin = {
  name: "phase-1.2d-a-supabase-mock",
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
      export { default as createGoal } from "./src/lib/mcp/tools/create-goal.ts";
      export { default as updateGoal } from "./src/lib/mcp/tools/update-goal.ts";
      export { default as deleteGoal } from "./src/lib/mcp/tools/delete-goal.ts";
      export * from "./src/lib/mcp/shared/goal-write.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2d-a-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [mockPlugin],
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
const groupA = "30000000-0000-4000-8000-000000000003";
const goalId = "40000000-0000-4000-8000-000000000004";
const incomeCategoryId = "50000000-0000-4000-8000-000000000005";
const alertId = "60000000-0000-4000-8000-000000000006";
const t0 = "2026-07-01T12:00:00.000Z";
const t1 = "2026-07-01T12:00:01.000Z";

const goal = (overrides = {}) => ({
  id: goalId,
  user_id: userA,
  type: "monthly_total",
  category: null,
  limit_amount: 1000,
  shared_group_id: null,
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: t0,
  ...overrides,
});
const baseTables = (overrides = {}) => ({
  budget_goals: [goal()],
  budget_goal_alerts: [],
  user_categories: [
    { id: "70000000-0000-4000-8000-000000000007", user_id: userA, name: "Alimentação", is_active: true },
    { id: "80000000-0000-4000-8000-000000000008", user_id: userA, name: "Saúde", is_active: true },
  ],
  user_income_categories: [
    { id: incomeCategoryId, user_id: userA, name: "Salário", is_active: true },
  ],
  shared_groups: [{ id: groupA }],
  expenses: [{ id: "90000000-0000-4000-8000-000000000009" }],
  incomes: [{ id: "a0000000-0000-4000-8000-000000000010" }],
  recurring_expenses: [{ id: "b0000000-0000-4000-8000-000000000011" }],
  recurring_incomes: [{ id: "c0000000-0000-4000-8000-000000000012" }],
  ...overrides,
});

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.columns = null;
    this.mode = "select";
    this.payload = null;
  }
  record(method, ...args) {
    this.db.calls.push({ table: this.table, method, args });
  }
  select(columns) {
    this.record("select", columns);
    this.columns = columns.split(",").map((value) => value.trim());
    return this;
  }
  insert(payload) {
    this.record("insert", payload);
    this.mode = "insert";
    this.payload = payload;
    return this;
  }
  update(payload) {
    this.record("update", payload);
    this.mode = "update";
    this.payload = payload;
    return this;
  }
  delete() {
    this.record("delete");
    this.mode = "delete";
    return this;
  }
  eq(column, value) {
    this.record("eq", column, value);
    this.filters.push((row) => row[column] === value);
    return this;
  }
  visible(row) {
    if (this.table === "budget_goals") {
      return row.user_id === this.db.userId || row.shared_group_id === groupA;
    }
    if (this.table === "user_categories" || this.table === "user_income_categories") {
      return row.user_id === this.db.userId;
    }
    if (this.table === "shared_groups") return row.id === groupA;
    if (this.table === "budget_goal_alerts") return row.user_id === this.db.userId;
    return true;
  }
  project(row) {
    if (!this.columns) return structuredClone(row);
    return Object.fromEntries(
      this.columns.map((column) => [column, row[column] ?? null]),
    );
  }
  matching() {
    let rows = (this.db.tables[this.table] ?? []).filter((row) => this.visible(row));
    for (const filter of this.filters) rows = rows.filter(filter);
    return rows;
  }
  execute(single) {
    if (this.db.writeError && this.mode !== "select") {
      return { data: null, error: { message: "synthetic SQL detail" } };
    }
    if (
      this.db.raceMode === this.mode &&
      !this.db.raceApplied &&
      this.table === "budget_goals"
    ) {
      const target = this.db.tables.budget_goals.find((row) => row.id === goalId);
      if (target) target.updated_at = "2026-07-01T12:00:00.500Z";
      this.db.raceApplied = true;
    }
    if (this.mode === "insert") {
      const row = {
        id: this.db.nextGoalId(),
        created_at: t0,
        updated_at: t0,
        ...structuredClone(this.payload),
      };
      this.db.tables[this.table].push(row);
      this.db.writes.push({ table: this.table, mode: "insert", id: row.id });
      return { data: this.project(row), error: null };
    }
    const matched = this.matching();
    if (this.mode === "select") {
      return {
        data: single ? (matched.length === 1 ? this.project(matched[0]) : null) : matched.map((row) => this.project(row)),
        error: null,
      };
    }
    const owned = matched.filter((row) => row.user_id === this.db.userId);
    if (owned.length !== 1) return { data: single ? null : [], error: null };
    const row = owned[0];
    if (this.mode === "update") {
      Object.assign(row, structuredClone(this.payload), { updated_at: t1 });
      this.db.writes.push({ table: this.table, mode: "update", id: row.id });
      return { data: this.project(row), error: null };
    }
    const removed = structuredClone(row);
    this.db.tables[this.table].splice(this.db.tables[this.table].indexOf(row), 1);
    if (this.table === "budget_goals") {
      this.db.tables.budget_goal_alerts = this.db.tables.budget_goal_alerts.filter(
        (alert) => alert.goal_id !== row.id,
      );
    }
    this.db.writes.push({ table: this.table, mode: "delete", id: row.id });
    return { data: this.project(removed), error: null };
  }
  async maybeSingle() {
    return this.execute(true);
  }
  async single() {
    return this.execute(true);
  }
  then(resolve, reject) {
    return Promise.resolve(this.execute(false)).then(resolve, reject);
  }
}
class DB {
  constructor(tables, options = {}) {
    this.tables = structuredClone(tables);
    this.userId = userA;
    this.calls = [];
    this.writes = [];
    this.writeError = options.writeError ?? false;
    this.raceMode = options.raceMode ?? null;
    this.raceApplied = false;
    this.sequence = 13;
  }
  nextGoalId() {
    const suffix = String(this.sequence++).padStart(12, "0");
    return `d0000000-0000-4000-8000-${suffix}`;
  }
  from(table) {
    return new Query(this, table);
  }
}
const ctx = {
  isAuthenticated: () => true,
  getUserId: () => userA,
  getToken: () => "synthetic",
};
const use = (tables = baseTables(), options) => {
  const db = new DB(tables, options);
  globalThis.__MCP_TEST_SUPABASE__ = db;
  return db;
};
const updateInput = (changes, overrides = {}) => ({
  goal_id: goalId,
  expected_updated_at: t0,
  changes,
  ...overrides,
});
const deleteInput = (overrides = {}) => ({
  goal_id: goalId,
  expected_updated_at: t0,
  confirm_delete: true,
  ...overrides,
});

const creationCases = [
  ["monthly_total", null, 1000, "maximum"],
  ["category", "alimentacao", 500, "maximum"],
  ["income_monthly_total", null, 5000, "minimum"],
  ["income_category", incomeCategoryId, 2500, "minimum"],
  ["balance_target", null, 1500, "minimum"],
];
for (const [type, category, limitAmount, direction] of creationCases) {
  const db = use();
  const input = { type, limit_amount: limitAmount };
  if (category) input.category = category;
  const result = await core.createGoal.handler(input, ctx);
  equal(result.structuredContent.created, true, `${type} criada`);
  equal(result.structuredContent.goal.type, type, `${type} persistido`);
  equal(result.structuredContent.goal.category_reference, category, `${type} categoria`);
  equal(result.structuredContent.goal.limit_amount, limitAmount, `${type} valor`);
  equal(result.structuredContent.goal.target_direction, direction, `${type} direção`);
  check(!("user_id" in result.structuredContent.goal), `${type} output sem user_id`);
  check(result.structuredContent.warnings.includes("MONTHLY_GOAL_ONLY"), `${type} warning mensal`);
  check(result.content[0].text.includes("Nenhuma despesa, receita"), `${type} content transações`);
  check(result.content[0].text.includes("não é conta de investimento"), `${type} content natureza`);
  equal(db.writes.length, 1, `${type} um insert`);
}

for (const invalidAmount of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
  const db = use();
  const result = await core.createGoal.handler(
    { type: "monthly_total", limit_amount: invalidAmount },
    ctx,
  );
  errorCode(result, "INVALID_INPUT", `valor inválido ${invalidAmount}`);
  equal(db.writes.length, 0, "valor inválido sem write");
}
for (const type of ["category", "income_category"]) {
  const result = await core.createGoal.handler({ type, limit_amount: 10 }, ctx);
  errorCode(result, "INVALID_GOAL_CONFIGURATION", `${type} exige categoria`);
}
for (const type of ["monthly_total", "income_monthly_total", "balance_target"]) {
  const result = await core.createGoal.handler(
    { type, limit_amount: 10, category: "alimentacao" },
    ctx,
  );
  errorCode(result, "INVALID_GOAL_CONFIGURATION", `${type} rejeita categoria`);
}
{
  const db = use();
  const result = await core.createGoal.handler(
    { type: "category", category: "nao_existe", limit_amount: 10 },
    ctx,
  );
  errorCode(result, "CATEGORY_NOT_FOUND", "slug de despesa inexistente");
  equal(db.writes.length, 0, "categoria inexistente sem insert");
}
{
  const tables = baseTables({ user_categories: [{ id: "x", user_id: userB, name: "Alimentação", is_active: true }] });
  use(tables);
  const result = await core.createGoal.handler(
    { type: "category", category: "alimentacao", limit_amount: 10 },
    ctx,
  );
  errorCode(result, "CATEGORY_NOT_FOUND", "categoria expense de outro usuário");
}
{
  const result = await core.createGoal.handler(
    { type: "income_category", category: goalId, limit_amount: 10 },
    ctx,
  );
  errorCode(result, "CATEGORY_NOT_FOUND", "categoria income inexistente");
}
for (const forbidden of ["user_id", "is_shared", "unexpected"]) {
  const result = await core.createGoal.handler(
    { type: "monthly_total", limit_amount: 10, [forbidden]: userA },
    ctx,
  );
  errorCode(result, "INVALID_INPUT", `create rejeita ${forbidden}`);
}
{
  const db = use();
  const result = await core.createGoal.handler(
    { type: "monthly_total", limit_amount: 10, shared_group_id: groupA },
    ctx,
  );
  equal(result.structuredContent.goal.is_shared, true, "criação compartilhada");
  equal(result.structuredContent.goal.shared_group_id, groupA, "grupo preservado");
  check(result.structuredContent.warnings.includes("SHARED_GOAL_CREATED"), "warning shared create");
  equal(db.writes.length, 1, "shared um insert");
}
{
  const result = await core.createGoal.handler(
    { type: "monthly_total", limit_amount: 10, shared_group_id: goalId },
    ctx,
  );
  errorCode(result, "RESOURCE_NOT_FOUND", "grupo inacessível genérico");
}
{
  const db = use();
  await core.createGoal.handler({ type: "monthly_total", limit_amount: 1000 }, ctx);
  await core.createGoal.handler({ type: "monthly_total", limit_amount: 1000 }, ctx);
  equal(db.tables.budget_goals.length, 3, "duplicidade permitida pelo modelo");
}

{
  const db = use();
  const result = await core.updateGoal.handler(updateInput({ limit_amount: 1250 }), ctx);
  equal(result.structuredContent.applied, true, "update aplicado");
  equal(result.structuredContent.changed_fields, ["limit_amount"], "campo alterado");
  equal(result.structuredContent.before.limit_amount, 1000, "before banco");
  equal(result.structuredContent.after.limit_amount, 1250, "after banco");
  equal(result.structuredContent.updated_at_before, t0, "timestamp anterior");
  equal(result.structuredContent.updated_at_after, t1, "trigger avança timestamp");
  equal(db.writes, [{ table: "budget_goals", mode: "update", id: goalId }], "um update da meta");
  check(result.content[0].text.includes("1000 -> 1250"), "content detalha mudança");
  equal(db.tables.expenses.length, 1, "expense intacta");
  equal(db.tables.incomes.length, 1, "income intacta");
}
{
  const db = use();
  const result = await core.updateGoal.handler(updateInput({ limit_amount: 1000 }), ctx);
  equal(result.structuredContent.applied, false, "no-op factual");
  equal(result.structuredContent.changed_fields, [], "no-op sem campos");
  equal(result.structuredContent.updated_at_after, t0, "no-op preserva timestamp");
  check(result.structuredContent.warnings.includes("NO_EFFECTIVE_CHANGES"), "warning no-op");
  equal(db.writes.length, 0, "no-op sem update");
}
{
  use();
  const result = await core.updateGoal.handler(
    updateInput({ type: "category", category: "saude", limit_amount: 200 }),
    ctx,
  );
  equal(result.structuredContent.changed_fields, ["type", "category", "limit_amount"], "patch múltiplo");
  equal(result.structuredContent.after.target_direction, "maximum", "direção derivada");
  check(result.structuredContent.warnings.includes("GOAL_TYPE_CHANGED"), "warning tipo");
  check(result.structuredContent.warnings.includes("CATEGORY_REFERENCE_UPDATED"), "warning categoria");
}
{
  use();
  const result = await core.updateGoal.handler(updateInput({ type: "category" }), ctx);
  errorCode(result, "INVALID_GOAL_CONFIGURATION", "monthly para category exige referência");
}
{
  use(baseTables({ budget_goals: [goal({ type: "category", category: "alimentacao" })] }));
  const result = await core.updateGoal.handler(updateInput({ type: "monthly_total" }), ctx);
  equal(result.structuredContent.after.category_reference, null, "category para total limpa categoria");
  equal(result.structuredContent.changed_fields, ["type", "category"], "limpeza registrada");
}
{
  use(baseTables({ budget_goals: [goal({ type: "income_category", category: incomeCategoryId })] }));
  const result = await core.updateGoal.handler(updateInput({ type: "income_monthly_total" }), ctx);
  equal(result.structuredContent.after.category_reference, null, "income category para total limpa");
}
{
  use();
  const result = await core.updateGoal.handler(
    updateInput({ type: "income_category", category: incomeCategoryId }),
    ctx,
  );
  equal(result.structuredContent.after.type, "income_category", "transição income válida");
}
{
  use();
  const result = await core.updateGoal.handler(
    updateInput({ type: "income_category", category: "alimentacao" }),
    ctx,
  );
  errorCode(result, "CATEGORY_NOT_FOUND", "expense slug rejeitado em income");
}
{
  use();
  const result = await core.updateGoal.handler(
    updateInput({ type: "category", category: incomeCategoryId }),
    ctx,
  );
  errorCode(result, "CATEGORY_NOT_FOUND", "income UUID rejeitado em expense");
}
{
  use();
  const result = await core.updateGoal.handler(
    updateInput({ limit_amount: 2 }, { expected_updated_at: t1 }),
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "timestamp antigo");
}
{
  const db = use(baseTables(), { raceMode: "update" });
  const result = await core.updateGoal.handler(updateInput({ limit_amount: 2 }), ctx);
  errorCode(result, "CONCURRENT_MODIFICATION", "corrida no update");
  equal(db.writes.length, 0, "corrida sem update");
}
{
  use(baseTables({ budget_goals: [] }));
  const result = await core.updateGoal.handler(updateInput({ limit_amount: 2 }), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "meta inexistente");
}
{
  use(baseTables({ budget_goals: [goal({ user_id: userB })] }));
  const result = await core.updateGoal.handler(updateInput({ limit_amount: 2 }), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "meta alheia genérica");
}
{
  use(baseTables({ budget_goals: [goal({ shared_group_id: groupA })] }));
  const result = await core.updateGoal.handler(updateInput({ limit_amount: 2 }), ctx);
  equal(result.structuredContent.after.shared_group_id, groupA, "shared preservado");
  check(result.structuredContent.warnings.includes("SHARED_GOAL_UPDATED"), "warning shared update");
}
{
  use(baseTables({ budget_goals: [goal({ user_id: userB, shared_group_id: groupA })] }));
  const result = await core.updateGoal.handler(updateInput({ limit_amount: 2 }), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "meta visível de membro não editável");
}
for (const changes of [{}, { shared_group_id: null }, { user_id: userA }, { current_value: 1 }]) {
  use();
  const result = await core.updateGoal.handler(updateInput(changes), ctx);
  errorCode(result, "INVALID_PATCH", `patch rejeitado ${JSON.stringify(changes)}`);
}

for (const confirm of [undefined, false]) {
  const db = use(baseTables({ budget_goal_alerts: [{ id: alertId, user_id: userA, goal_id: goalId }] }));
  const input = deleteInput({ confirm_delete: confirm });
  if (confirm === undefined) delete input.confirm_delete;
  const result = await core.deleteGoal.handler(input, ctx);
  errorCode(result, "CONFIRMATION_REQUIRED", `confirmação ${confirm}`);
  check(result.content[0].text.includes("excluir permanentemente"), "confirmação explica permanência");
  check(result.content[0].text.includes("1 alerta"), "confirmação informa alertas");
  check(result.content[0].text.includes("Nenhuma transação"), "confirmação preserva transações");
  equal(db.writes.length, 0, "sem confirmação sem delete");
}
{
  const db = use(baseTables({ budget_goal_alerts: [{ id: alertId, user_id: userA, goal_id: goalId }] }));
  const result = await core.deleteGoal.handler(deleteInput(), ctx);
  equal(result.structuredContent.deleted, true, "delete confirmado");
  equal(result.structuredContent.deletion_mode, "permanent", "delete permanente");
  equal(result.structuredContent.deleted_goal.id, goalId, "linha removida retornada");
  check(result.structuredContent.warnings.includes("PERMANENT_DELETION"), "warning permanente");
  check(result.structuredContent.warnings.includes("GOAL_DELETED"), "warning deleted");
  check(result.structuredContent.warnings.includes("GOAL_ALERTS_DELETED"), "warning cascade");
  equal(db.tables.budget_goals.length, 0, "meta removida");
  equal(db.tables.budget_goal_alerts.length, 0, "alerta removido por cascade sintético");
  equal(db.writes, [{ table: "budget_goals", mode: "delete", id: goalId }], "nenhuma cascata manual");
  equal(db.tables.expenses.length, 1, "delete preserva expenses");
  equal(db.tables.incomes.length, 1, "delete preserva incomes");
  equal(db.tables.user_categories.length, 2, "delete preserva categorias");
  equal(db.tables.shared_groups.length, 1, "delete preserva grupo");
  check(result.content[0].text.includes("histórico financeiro permanece intacto"), "content histórico");
  const second = await core.deleteGoal.handler(deleteInput(), ctx);
  errorCode(second, "RESOURCE_NOT_FOUND", "segunda exclusão não encontrada");
}
{
  use(baseTables({ budget_goals: [goal({ shared_group_id: groupA })] }));
  const result = await core.deleteGoal.handler(deleteInput(), ctx);
  check(result.structuredContent.warnings.includes("SHARED_GOAL_DELETED"), "warning shared delete");
}
{
  use();
  const result = await core.deleteGoal.handler(deleteInput({ expected_updated_at: t1 }), ctx);
  errorCode(result, "CONCURRENT_MODIFICATION", "delete timestamp antigo");
}
{
  const db = use(baseTables(), { raceMode: "delete" });
  const result = await core.deleteGoal.handler(deleteInput(), ctx);
  errorCode(result, "CONCURRENT_MODIFICATION", "corrida delete");
  equal(db.writes.length, 0, "corrida delete sem write");
}
{
  use(baseTables({ budget_goals: [goal({ user_id: userB, shared_group_id: groupA })] }));
  const result = await core.deleteGoal.handler(deleteInput(), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "delete membro alheio genérico");
}
for (const bad of [
  { goal_id: "invalid" },
  { expected_updated_at: "not-a-timestamp" },
  { user_id: userA },
  { extra: true },
]) {
  const result = await core.deleteGoal.handler(deleteInput(bad), ctx);
  errorCode(result, "INVALID_INPUT", `delete input inválido ${JSON.stringify(bad)}`);
}

for (const [tool, kind] of [
  [core.createGoal, "create"],
  [core.updateGoal, "update"],
  [core.deleteGoal, "delete"],
]) {
  equal(tool.annotations.readOnlyHint, false, `${kind} write`);
  equal(tool.annotations.idempotentHint, false, `${kind} não idempotente`);
  equal(tool.annotations.openWorldHint, false, `${kind} closed world`);
  equal(tool.annotations.destructiveHint, kind !== "create", `${kind} destructive correto`);
  check(!JSON.stringify(tool.inputSchema).includes("user_id"), `${kind} input sem user_id`);
  check(!JSON.stringify(tool.outputSchema).includes("user_id"), `${kind} output sem user_id`);
  check(!JSON.stringify(tool.outputSchema).toLowerCase().includes("owner_name"), `${kind} sem proprietário`);
}
const sampleCreate = await core.createGoal.handler(
  { type: "monthly_total", limit_amount: 50 },
  ctx,
);
check(
  z.object(core.createGoal.outputSchema).strict().safeParse(sampleCreate.structuredContent).success,
  "outputSchema real create",
);
check(
  core.updateGoal.inputSchema.expected_updated_at !== undefined,
  "update exige expected",
);
check(core.deleteGoal.inputSchema.confirm_delete !== undefined, "delete exige confirmação");
check(
  core.updateGoal.inputSchema.changes !== undefined,
  "changes presente no contrato",
);

const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const tools = manifest.mcp.tools;
equal(tools.length, 48, "manifest 48 tools");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
  23, "23 read-only");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === false).length, 25, "25 write");
for (const [name, destructive] of [
  ["create_goal", false],
  ["update_goal", true],
  ["delete_goal", true],
]) {
  const tool = tools.find((entry) => entry.name === name);
  check(tool, `${name} registrado`);
  equal(tool.annotations.readOnlyHint, false, `${name} manifest write`);
  equal(tool.annotations.destructiveHint, destructive, `${name} destructive`);
  equal(tool.annotations.idempotentHint, false, `${name} não idempotente`);
  equal(tool.annotations.openWorldHint, false, `${name} closed world`);
  equal(tool.inputSchema.additionalProperties, false, `${name} input fechado`);
  equal(tool.outputSchema.additionalProperties, false, `${name} output fechado`);
  check(!JSON.stringify(tool.inputSchema).includes("user_id"), `${name} manifest sem user`);
  check(!JSON.stringify(tool.outputSchema).includes("user_id"), `${name} output manifest sem user`);
}
const updateManifest = tools.find((entry) => entry.name === "update_goal");
const deleteManifest = tools.find((entry) => entry.name === "delete_goal");
check(updateManifest.inputSchema.required.includes("expected_updated_at"), "update expected obrigatório");
check(deleteManifest.inputSchema.required.includes("expected_updated_at"), "delete expected obrigatório");
check(deleteManifest.inputSchema.required.includes("confirm_delete"), "delete confirm obrigatório");
equal(updateManifest.inputSchema.properties.changes.additionalProperties, false, "changes fechado no manifest");

const sourceFiles = [
  "src/lib/mcp/tools/create-goal.ts",
  "src/lib/mcp/tools/update-goal.ts",
  "src/lib/mcp/tools/delete-goal.ts",
  "src/lib/mcp/shared/goal-write.ts",
];
const source = (
  await Promise.all(sourceFiles.map((file) => readFile(file, "utf8")))
).join("\n");
check(source.includes("supabaseForUser(ctx)"), "usa supabaseForUser");
check(!source.includes("service_role"), "sem service role");
check(!source.includes(".from(\"expenses\").insert"), "não cria expense");
check(!source.includes(".from(\"incomes\").insert"), "não cria income");
check(!source.includes(".from(\"recurring_"), "não altera recorrências");
check(!source.includes(".delete().from(\"budget_goal_alerts\")"), "sem cascade manual");
check(source.includes('.eq("user_id", userId)'), "propriedade explícita");
check(source.includes('.eq("updated_at", input.expected_updated_at)'), "concorrência atômica");

const migrations = await readdir("supabase/migrations");
equal(migrations.length > 0, true, "migrations existentes inspecionáveis");
const statusSnapshot = await readFile("supabase/functions/mcp/index.ts", "utf8");
check(statusSnapshot.includes("Deno.serve"), "bundle com Deno.serve");
check(!statusSnapshot.includes('from "@/'), "bundle sem alias");
check(!statusSnapshot.includes("npm:@/"), "bundle sem npm alias");
check(!/[A-Za-z]:\\\\/.test(statusSnapshot), "bundle sem caminho absoluto Windows");

console.log(
  `Fase MCP 1.2D-A: ${checks} verificações diretas, regressivas e de contrato concluídas.`,
);
