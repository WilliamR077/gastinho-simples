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
  name: "phase-1.2e-b-supabase",
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
      export { default as deleteExpenseCategory } from "./src/lib/mcp/tools/delete-expense-category.ts";
      export { default as deleteIncomeCategory } from "./src/lib/mcp/tools/delete-income-category.ts";
      export * from "./src/lib/mcp/shared/category-delete.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2e-b-entry.ts",
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
const expenseId = "30000000-0000-4000-8000-000000000003";
const incomeId = "40000000-0000-4000-8000-000000000004";
const t0 = "2026-07-01T12:00:00.000Z";
const category = (kind, overrides = {}) => ({
  id: kind === "expense" ? expenseId : incomeId,
  user_id: userA,
  name: kind === "expense" ? "Viagem" : "Freelance",
  icon: kind === "expense" ? "✈️" : "💻",
  color: kind === "expense" ? "#6366f1" : "#10b981",
  is_default: false,
  is_active: false,
  display_order: 10,
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: t0,
  ...overrides,
});
const base = (overrides = {}) => ({
  user_categories: [category("expense")],
  user_income_categories: [category("income")],
  expenses: [],
  incomes: [],
  recurring_expenses: [],
  recurring_incomes: [],
  budget_goals: [],
  ...overrides,
});

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.columns = null;
    this.mode = "select";
  }
  select(columns) {
    this.columns = columns.split(",").map((item) => item.trim());
    this.db.calls.push({ table: this.table, method: "select", columns });
    return this;
  }
  delete() {
    this.mode = "delete";
    this.db.calls.push({ table: this.table, method: "delete" });
    return this;
  }
  eq(column, value) {
    this.filters.push((row) => row[column] === value);
    this.db.calls.push({ table: this.table, method: "eq", column, value });
    return this;
  }
  visible(row) {
    return !["user_categories", "user_income_categories"].includes(this.table) ||
      row.user_id === this.db.userId;
  }
  rows() {
    let rows = (this.db.tables[this.table] ?? []).filter((row) =>
      this.visible(row),
    );
    for (const filter of this.filters) rows = rows.filter(filter);
    return rows;
  }
  project(row) {
    if (!this.columns) return structuredClone(row);
    return Object.fromEntries(
      this.columns.map((column) => [column, row[column] ?? null]),
    );
  }
  race() {
    if (this.mode !== "delete" || this.db.raceApplied || !this.db.race) return;
    const row = (this.db.tables[this.table] ?? []).find(
      (item) => item.id === this.db.race.id,
    );
    if (this.db.race.type === "updated" && row) {
      row.updated_at = "2026-07-01T12:00:00.500Z";
    }
    if (this.db.race.type === "reactivated" && row) row.is_active = true;
    if (this.db.race.type === "removed" && row) {
      this.db.tables[this.table].splice(
        this.db.tables[this.table].indexOf(row),
        1,
      );
    }
    this.db.raceApplied = true;
  }
  execute(single) {
    this.race();
    if (this.mode === "delete" && this.db.fkRace) {
      return { data: null, error: { code: "23503", message: "constraint" } };
    }
    const rows = this.rows();
    if (this.mode === "delete") {
      if (rows.length !== 1) return { data: null, error: null };
      const removed = structuredClone(rows[0]);
      this.db.tables[this.table].splice(
        this.db.tables[this.table].indexOf(rows[0]),
        1,
      );
      this.db.writes.push({ table: this.table, mode: "delete", id: removed.id });
      return { data: this.project(removed), error: null };
    }
    return {
      data: single
        ? rows.length === 1
          ? this.project(rows[0])
          : null
        : rows.map((row) => this.project(row)),
      error: null,
    };
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
    this.userId = userA;
    this.calls = [];
    this.writes = [];
    this.race = options.race ?? null;
    this.raceApplied = false;
    this.fkRace = options.fkRace ?? false;
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
const use = (tables = base(), options) => {
  const db = new DB(tables, options);
  globalThis.__MCP_TEST_SUPABASE__ = db;
  return db;
};
const input = (kind, overrides = {}) => ({
  category_id: kind === "expense" ? expenseId : incomeId,
  expected_updated_at: t0,
  confirm_delete: true,
  ...overrides,
});

for (const [kind, tool, table] of [
  ["expense", core.deleteExpenseCategory, "user_categories"],
  ["income", core.deleteIncomeCategory, "user_income_categories"],
]) {
  const db = use();
  const before = structuredClone(db.tables);
  const result = await tool.handler(input(kind), ctx);
  equal(result.structuredContent.deleted, true, `${kind} excluída`);
  equal(result.structuredContent.deletion_mode, "permanent", `${kind} permanente`);
  equal(result.structuredContent.category_kind, kind, `${kind} factual`);
  equal(result.structuredContent.deleted_category.id, input(kind).category_id, `${kind} linha real`);
  equal(result.structuredContent.deleted_category.is_active, false, `${kind} inativa`);
  check(!("user_id" in result.structuredContent.deleted_category), `${kind} sem user_id`);
  check(Number.isFinite(Date.parse(result.structuredContent.operation_completed_at)), `${kind} timestamp`);
  equal(result.structuredContent.reference_summary.total_reference_count, 0, `${kind} refs zero`);
  check(result.structuredContent.warnings.includes("PERMANENT_DELETION"), `${kind} warning permanente`);
  check(result.structuredContent.warnings.includes("FINANCIAL_DATA_UNAFFECTED"), `${kind} dados intactos`);
  check(result.content[0].text.includes("Não há restauração"), `${kind} content restauração`);
  check(result.content[0].text.includes("Nenhuma transação"), `${kind} content integridade`);
  equal(db.writes, [{ table, mode: "delete", id: input(kind).category_id }], `${kind} só tabela alvo`);
  for (const related of ["expenses", "incomes", "recurring_expenses", "recurring_incomes", "budget_goals"]) {
    equal(db.tables[related], before[related], `${kind} preserva ${related}`);
  }
  errorCode(await tool.handler(input(kind), ctx), "RESOURCE_NOT_FOUND", `${kind} segunda tentativa`);
}

{
  use();
  const result = await core.deleteExpenseCategory.handler(input("expense"), ctx);
  equal(result.structuredContent.deleted_category.goal_reference, expenseId, "goal_reference no sucesso");
}

for (const [kind, tool] of [
  ["expense", core.deleteExpenseCategory],
  ["income", core.deleteIncomeCategory],
]) {
  for (const confirmation of [false, undefined]) {
    const db = use();
    const candidate = input(kind);
    if (confirmation === undefined) delete candidate.confirm_delete;
    else candidate.confirm_delete = confirmation;
    errorCode(await tool.handler(candidate, ctx), confirmation === undefined ? "INVALID_INPUT" : "CONFIRMATION_REQUIRED", `${kind} confirmação`);
    equal(db.writes.length, 0, `${kind} sem delete sem confirmação`);
  }
  const activeTables = base();
  const table = kind === "expense" ? "user_categories" : "user_income_categories";
  activeTables[table][0].is_active = true;
  const db = use(activeTables);
  const active = await tool.handler(input(kind), ctx);
  errorCode(active, "CATEGORY_MUST_BE_INACTIVE", `${kind} ativa bloqueada`);
  check(active.content[0].text.includes(`update_${kind}_category`), `${kind} orientação update`);
  equal(db.writes.length, 0, `${kind} não desativa`);

  use();
  errorCode(
    await tool.handler(input(kind, { expected_updated_at: "2026-07-01T12:00:01.000Z" }), ctx),
    "CONCURRENT_MODIFICATION",
    `${kind} stale`,
  );
  const race = use(base(), { race: { id: input(kind).category_id, type: "updated" } });
  errorCode(await tool.handler(input(kind), ctx), "CONCURRENT_MODIFICATION", `${kind} corrida`);
  equal(race.writes.length, 0, `${kind} corrida sem escrita`);
}

for (const [kind, tool, table] of [
  ["expense", core.deleteExpenseCategory, "user_categories"],
  ["income", core.deleteIncomeCategory, "user_income_categories"],
]) {
  for (const protectedRow of [
    { name: "Outros", is_default: true, display_order: 8 },
    { name: "Fallback renomeado", is_default: true, display_order: 8 },
  ]) {
    const tables = base();
    Object.assign(tables[table][0], protectedRow);
    const db = use(tables);
    errorCode(await tool.handler(input(kind), ctx), "CATEGORY_NOT_DELETABLE", `${kind} fallback protegida`);
    equal(db.writes.length, 0, `${kind} protegida sem delete`);
  }
  const tables = base();
  Object.assign(tables[table][0], { is_default: true, display_order: 2 });
  use(tables);
  const allowed = await tool.handler(input(kind), ctx);
  equal(allowed.structuredContent.deleted, true, `${kind} outra default segue frontend`);
}

{
  const tables = base();
  tables.user_categories[0].user_id = userB;
  use(tables);
  errorCode(await core.deleteExpenseCategory.handler(input("expense"), ctx), "RESOURCE_NOT_FOUND", "expense alheia");
  use(base({ user_categories: [] }));
  errorCode(await core.deleteExpenseCategory.handler(input("expense"), ctx), "RESOURCE_NOT_FOUND", "expense inexistente");
}
{
  const tables = base();
  tables.user_income_categories[0].user_id = userB;
  use(tables);
  errorCode(await core.deleteIncomeCategory.handler(input("income"), ctx), "RESOURCE_NOT_FOUND", "income alheia");
}

{
  const tables = base({
    expenses: [
      { id: "51000000-0000-4000-8000-000000000001", user_id: userA, category_id: expenseId, expense_date: "2026-07-01", installment_group_id: null, installment_number: null, total_installments: null },
      { id: "51000000-0000-4000-8000-000000000002", user_id: userA, category_id: expenseId, expense_date: "2026-08-01", installment_group_id: "52000000-0000-4000-8000-000000000001", installment_number: 2, total_installments: 4 },
      { id: "51000000-0000-4000-8000-000000000003", user_id: userB, category_id: expenseId, expense_date: "2026-07-01", installment_group_id: null, installment_number: null, total_installments: null },
    ],
    recurring_expenses: [
      { id: "53000000-0000-4000-8000-000000000001", user_id: userA, category_id: expenseId, is_active: true },
      { id: "53000000-0000-4000-8000-000000000002", user_id: userA, category_id: expenseId, is_active: false },
    ],
    budget_goals: [
      { id: "54000000-0000-4000-8000-000000000001", user_id: userA, type: "category", category: expenseId },
      { id: "54000000-0000-4000-8000-000000000002", user_id: userA, type: "category", category: "alimentacao" },
    ],
  });
  tables.user_categories[0].name = "Alimentação";
  const before = structuredClone(tables);
  const db = use(tables);
  const result = await core.deleteExpenseCategory.handler(input("expense"), ctx);
  errorCode(result, "CATEGORY_HAS_REFERENCES", "refs expense bloqueiam");
  const summary = result.structuredContent.reference_summary;
  equal(summary.historical_expense_count, 1, "histórica distinta");
  equal(summary.future_expense_count, 1, "futura distinta");
  equal(summary.installment_expense_count, 1, "parcela sobreposta não duplica");
  equal(summary.active_recurring_expense_count, 1, "recorrente ativa");
  equal(summary.inactive_recurring_expense_count, 1, "recorrente inativa");
  equal(summary.uuid_goal_count, 1, "meta UUID");
  equal(summary.legacy_goal_count, 1, "meta legada");
  equal(summary.total_goal_count, 2, "metas distintas");
  equal(summary.total_expense_reference_count, 2, "transações distintas");
  equal(summary.total_recurring_reference_count, 2, "templates distintos");
  equal(summary.total_reference_count, 6, "total distinto");
  equal(db.writes.length, 0, "nenhuma escrita refs expense");
  equal(db.tables, before, "nenhum dado expense alterado");
  check(result.content[0].text.includes("Contagens="), "bloqueio autossuficiente");
}

{
  const tables = base({
    incomes: [
      { id: "61000000-0000-4000-8000-000000000001", user_id: userA, income_category_id: incomeId, income_date: "2026-07-29T02:30:00.000Z" },
      { id: "61000000-0000-4000-8000-000000000002", user_id: userA, income_category_id: incomeId, income_date: "2026-08-01T03:00:00.000Z" },
    ],
    recurring_incomes: [
      { id: "62000000-0000-4000-8000-000000000001", user_id: userA, income_category_id: incomeId, is_active: true },
      { id: "62000000-0000-4000-8000-000000000002", user_id: userA, income_category_id: incomeId, is_active: false },
    ],
    budget_goals: [
      { id: "63000000-0000-4000-8000-000000000001", user_id: userA, type: "income_category", category: incomeId },
      { id: "63000000-0000-4000-8000-000000000002", user_id: userA, type: "category", category: incomeId },
    ],
  });
  const before = structuredClone(tables);
  const db = use(tables);
  const result = await core.deleteIncomeCategory.handler(input("income"), ctx);
  errorCode(result, "CATEGORY_HAS_REFERENCES", "refs income bloqueiam");
  const summary = result.structuredContent.reference_summary;
  equal(summary.historical_income_count, 1, "income histórica SP");
  equal(summary.future_income_count, 1, "income futura");
  equal(summary.active_recurring_income_count, 1, "income recorrente ativa");
  equal(summary.inactive_recurring_income_count, 1, "income recorrente inativa");
  equal(summary.goal_count, 1, "somente meta income_category");
  equal(summary.total_income_reference_count, 2, "income distintas");
  equal(summary.total_recurring_reference_count, 2, "recorrências distintas");
  equal(summary.total_reference_count, 5, "total income distinto");
  equal(db.writes.length, 0, "nenhuma escrita refs income");
  equal(db.tables, before, "nenhum dado income alterado");
}

{
  const db = use(base(), { fkRace: true });
  const result = await core.deleteExpenseCategory.handler(input("expense"), ctx);
  errorCode(result, "CATEGORY_HAS_REFERENCES", "FK race segura");
  check(!JSON.stringify(result).includes("constraint"), "sem constraint exposta");
  equal(db.writes.length, 0, "FK race sem cleanup");
}
for (const raceType of ["removed", "reactivated"]) {
  const db = use(base(), { race: { id: expenseId, type: raceType } });
  const result = await core.deleteExpenseCategory.handler(input("expense"), ctx);
  errorCode(
    result,
    raceType === "removed" ? "RESOURCE_NOT_FOUND" : "CONCURRENT_MODIFICATION",
    `race ${raceType}`,
  );
  equal(db.writes.length, 0, `race ${raceType} sem escrita`);
}

for (const [tool, kind] of [
  [core.deleteExpenseCategory, "expense"],
  [core.deleteIncomeCategory, "income"],
]) {
  for (const extra of [
    { user_id: userA },
    { force: true },
    { replacement_category_id: expenseId },
    { clear_references: true },
    { name: "Viagem" },
  ]) {
    use();
    errorCode(await tool.handler({ ...input(kind), ...extra }, ctx), "INVALID_INPUT", `${kind} rejeita ${Object.keys(extra)[0]}`);
  }
  for (const invalid of [
    { category_id: "x" },
    { expected_updated_at: "ontem" },
  ]) {
    use();
    errorCode(await tool.handler({ ...input(kind), ...invalid }, ctx), "INVALID_INPUT", `${kind} input inválido`);
  }
  equal(tool.annotations.readOnlyHint, false, `${kind} write`);
  equal(tool.annotations.destructiveHint, true, `${kind} destrutiva`);
  equal(tool.annotations.idempotentHint, false, `${kind} não idempotente`);
  equal(tool.annotations.openWorldHint, false, `${kind} mundo fechado`);
}

const source = await readFile("src/lib/mcp/shared/category-delete.ts", "utf8");
check(source.includes("supabaseForUser(ctx)"), "supabase por request");
check(source.includes('.eq("user_id", userId)'), "propriedade explícita");
check(source.includes('.eq("updated_at", input.expected_updated_at)'), "versão atômica");
check(source.includes('.eq("is_active", false)'), "estado atômico");
check(!source.includes("service_role"), "sem service role");
check(!source.includes(".update("), "sem reatribuição");
check(!source.includes("replacement_category"), "sem substituta");

const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const tools = manifest.mcp.tools;
equal(tools.length, 47, "47 tools");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
  23, "23 read-only");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === false).length, 24, "24 write");
for (const name of ["delete_expense_category", "delete_income_category"]) {
  const tool = tools.find((candidate) => candidate.name === name);
  check(tool, `${name} registrada`);
  equal(tool.inputSchema.additionalProperties, false, `${name} input fechado`);
  equal(tool.outputSchema.additionalProperties, false, `${name} output fechado`);
  for (const required of ["category_id", "expected_updated_at", "confirm_delete"]) {
    check(tool.inputSchema.required.includes(required), `${name} exige ${required}`);
  }
  equal(tool.annotations.destructiveHint, true, `${name} manifest destrutiva`);
}

const bundle = await readFile("supabase/functions/mcp/index.ts", "utf8");
check(bundle.includes("Deno.serve"), "Deno.serve");
check(!bundle.includes('from "@/'), "sem alias");
check(!bundle.includes("npm:@/"), "sem npm alias");
check(!/[A-Za-z]:[\\/](?:Users|home)[\\/]/u.test(bundle), "sem caminho absoluto");
equal(
  execFileSync("git", ["diff", "--name-only", "--", "supabase/functions"], { encoding: "utf8" }).trim(),
  "supabase/functions/mcp/index.ts",
  "somente Edge MCP",
);
equal(
  execFileSync("git", ["status", "--porcelain", "--", "supabase/migrations"], { encoding: "utf8" }).trim(),
  "",
  "nenhuma migration",
);

console.log(`Phase MCP 1.2E-B: ${checks} checks passed.`);
