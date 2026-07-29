import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const mockPlugin = {
  name: "phase-1.2c-a-supabase-mock",
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
      export { default as createRecurringExpense } from "./src/lib/mcp/tools/create-recurring-expense.ts";
      export { default as createRecurringIncome } from "./src/lib/mcp/tools/create-recurring-income.ts";
      export { default as updateRecurringExpense } from "./src/lib/mcp/tools/update-recurring-expense.ts";
      export { default as updateRecurringIncome } from "./src/lib/mcp/tools/update-recurring-income.ts";
      export * from "./src/lib/mcp/shared/recurring-write.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2c-a-entry.ts",
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
const groupB = "30000000-0000-4000-8000-000000000004";
const recurringExpenseId = "40000000-0000-4000-8000-000000000004";
const recurringIncomeId = "50000000-0000-4000-8000-000000000005";
const categoryId = "60000000-0000-4000-8000-000000000006";
const otherCategoryId = "60000000-0000-4000-8000-000000000007";
const incomeCategoryId = "70000000-0000-4000-8000-000000000007";
const otherIncomeCategoryId = "70000000-0000-4000-8000-000000000008";
const cardId = "80000000-0000-4000-8000-000000000008";
const inactiveCardId = "80000000-0000-4000-8000-000000000009";
const otherCardId = "80000000-0000-4000-8000-000000000010";
const t0 = "2026-07-01T12:00:00.000Z";
const t1 = "2026-07-01T12:00:01.000Z";

const recurringExpense = (overrides = {}) => ({
  id: recurringExpenseId,
  user_id: userA,
  description: "Academia",
  amount: 120,
  day_of_month: 15,
  start_date: "2026-07-01",
  end_date: null,
  is_active: true,
  category_id: categoryId,
  category_name: "Saúde",
  category_icon: "S",
  payment_method: "credit",
  card_id: cardId,
  card_name: "Principal",
  card_color: "#111111",
  shared_group_id: null,
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: t0,
  ...overrides,
});
const recurringIncome = (overrides = {}) => ({
  id: recurringIncomeId,
  user_id: userA,
  description: "Salário",
  amount: 3000,
  day_of_month: 5,
  start_date: "2026-07-01",
  end_date: null,
  is_active: true,
  income_category_id: incomeCategoryId,
  category_name: "Salário",
  category_icon: "I",
  shared_group_id: null,
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: t0,
  ...overrides,
});
const baseTables = (overrides = {}) => ({
  recurring_expenses: [recurringExpense()],
  recurring_incomes: [recurringIncome()],
  expenses: [],
  incomes: [],
  user_categories: [
    { id: categoryId, user_id: userA, name: "Saúde", icon: "S", is_active: true },
    { id: otherCategoryId, user_id: userB, name: "Outro", icon: "O", is_active: true },
  ],
  user_income_categories: [
    { id: incomeCategoryId, user_id: userA, name: "Salário", icon: "I", is_active: true },
    { id: otherIncomeCategoryId, user_id: userB, name: "Outro", icon: "O", is_active: true },
  ],
  cards: [
    { id: cardId, user_id: userA, name: "Principal", color: "#111111", card_type: "both", is_active: true },
    { id: inactiveCardId, user_id: userA, name: "Antigo", color: "#222222", card_type: "credit", is_active: false },
    { id: otherCardId, user_id: userB, name: "Alheio", color: "#333333", card_type: "credit", is_active: true },
  ],
  shared_groups: [
    { id: groupA, name: "Casa" },
    { id: groupB, name: "Inacessível", inaccessible: true },
  ],
  ...overrides,
});

class Query {
  constructor(db, table, call) {
    this.db = db;
    this.table = table;
    this.call = call;
    this.filters = [];
    this.columns = null;
    this.mode = "select";
    this.payload = null;
  }
  op(method, ...args) {
    this.call.operations.push({ method, args });
  }
  select(columns) {
    this.op("select", columns);
    this.columns = columns.split(",").map((column) => column.trim());
    return this;
  }
  insert(payload) {
    this.op("insert", payload);
    this.mode = "insert";
    this.payload = payload;
    return this;
  }
  update(payload) {
    this.op("update", payload);
    this.mode = "update";
    this.payload = payload;
    return this;
  }
  eq(column, value) {
    this.op("eq", column, value);
    this.filters.push((row) => row[column] === value);
    return this;
  }
  visible(row) {
    if (this.table === "shared_groups") return row.inaccessible !== true;
    if (["recurring_expenses", "recurring_incomes"].includes(this.table)) {
      return row.user_id === this.db.userId || row.shared_group_id === groupA;
    }
    return true;
  }
  project(row) {
    if (!this.columns) return structuredClone(row);
    return Object.fromEntries(this.columns.map((column) => [column, row[column] ?? null]));
  }
  async single() {
    return this.execute(true);
  }
  async maybeSingle() {
    return this.execute(false);
  }
  async execute(requireOne) {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    if (this.mode !== "select" && this.db.writeError) {
      return { data: null, error: { message: "synthetic SQL detail" } };
    }
    if (this.mode === "insert") {
      const sequence = this.table === "recurring_expenses" ? "41" : "51";
      const row = {
        id: `${sequence}000000-0000-4000-8000-000000000099`,
        created_at: t0,
        updated_at: t0,
        ...structuredClone(this.payload),
      };
      rows.push(row);
      this.db.inserted.push({ table: this.table, row: structuredClone(row) });
      return { data: this.project(row), error: null };
    }
    if (this.mode === "update" && this.db.raceOnUpdate && !this.db.raceApplied) {
      const target = rows.find((row) => row.id === this.db.raceId);
      if (target) target.updated_at = "2026-07-01T12:00:00.500Z";
      this.db.raceApplied = true;
    }
    let matched = rows.filter((row) => this.visible(row));
    for (const filter of this.filters) matched = matched.filter(filter);
    if (this.mode === "update") {
      matched = matched.filter((row) => row.user_id === this.db.userId);
      if (matched.length !== 1) return { data: null, error: null };
      Object.assign(matched[0], structuredClone(this.payload), { updated_at: t1 });
      this.db.updated.push({ table: this.table, id: matched[0].id, patch: structuredClone(this.payload) });
      return { data: this.project(matched[0]), error: null };
    }
    if (requireOne && matched.length !== 1) return { data: null, error: { message: "row count" } };
    return { data: matched.length === 1 ? this.project(matched[0]) : null, error: null };
  }
}
class DB {
  constructor(tables, options = {}) {
    this.tables = structuredClone(tables);
    this.userId = userA;
    this.calls = [];
    this.inserted = [];
    this.updated = [];
    this.writeError = options.writeError ?? false;
    this.raceOnUpdate = options.raceOnUpdate ?? false;
    this.raceId = options.raceId ?? recurringExpenseId;
    this.raceApplied = false;
  }
  from(table) {
    const call = { table, operations: [] };
    this.calls.push(call);
    return new Query(this, table, call);
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
const expenseCreate = (overrides = {}) => ({
  description: "Internet",
  amount: 99.9,
  day_of_month: 10,
  start_date: "2026-07-01",
  end_date: null,
  category_id: categoryId,
  payment_method: "credit",
  card_id: cardId,
  is_active: true,
  ...overrides,
});
const incomeCreate = (overrides = {}) => ({
  description: "Aluguel recebido",
  amount: 1500,
  day_of_month: 5,
  start_date: "2026-07-01",
  end_date: null,
  income_category_id: incomeCategoryId,
  is_active: true,
  ...overrides,
});
const expenseUpdate = (changes, overrides = {}) => ({
  recurring_expense_id: recurringExpenseId,
  expected_updated_at: t0,
  changes,
  ...overrides,
});
const incomeUpdate = (changes, overrides = {}) => ({
  recurring_income_id: recurringIncomeId,
  expected_updated_at: t0,
  changes,
  ...overrides,
});

{
  const db = use();
  const result = await core.createRecurringExpense.handler(expenseCreate(), ctx);
  equal(result.structuredContent.resource_type, "recurring_expense", "criação expense tipo");
  equal(result.structuredContent.created, true, "criação expense");
  equal(result.structuredContent.template.description, "Internet", "descrição expense");
  equal(result.structuredContent.template.amount, 99.9, "valor expense");
  equal(result.structuredContent.template.day_of_month, 10, "dia expense");
  equal(result.structuredContent.template.start_date, "2026-07-01", "start expense");
  equal(result.structuredContent.template.end_date, null, "end null expense");
  equal(result.structuredContent.template.is_active, true, "ativa expense");
  equal(result.structuredContent.template.category_id, categoryId, "categoria expense");
  equal(result.structuredContent.template.category_name, "Saúde", "snapshot categoria expense");
  equal(result.structuredContent.template.payment_method, "credit", "método expense");
  equal(result.structuredContent.template.card_id, cardId, "cartão expense");
  equal(result.structuredContent.template.card_name, "Principal", "snapshot cartão expense");
  check(!("user_id" in result.structuredContent.template), "expense output sem user_id");
  check(result.structuredContent.warnings.includes("RECURRING_TEMPLATE_ONLY"), "warning template");
  check(result.content[0].text.includes("Nenhuma despesa ou receita real foi criada ou alterada"), "content autossuficiente expense");
  equal(db.tables.expenses.length, 0, "nenhuma despesa real");
  equal(db.tables.cards.length, 3, "cartões preservados");
  equal(db.tables.user_categories.length, 2, "categorias preservadas");
}
for (const day of [28, 29, 30, 31]) {
  use();
  const result = await core.createRecurringExpense.handler(expenseCreate({ day_of_month: day }), ctx);
  equal(result.structuredContent.template.day_of_month, day, `dia ${day} preservado`);
  equal(result.structuredContent.warnings.includes("RECURRING_DAY_MAY_BE_SKIPPED"), day >= 29, `warning dia ${day}`);
  check(!result.content[0].text.includes("ajustado automaticamente") || day >= 29, `sem ajuste dia ${day}`);
}
{
  use();
  const result = await core.createRecurringExpense.handler(expenseCreate({ end_date: "2026-12-31", shared_group_id: groupA }), ctx);
  equal(result.structuredContent.template.end_date, "2026-12-31", "end válido");
  equal(result.structuredContent.template.is_shared, true, "shared derivado");
  check(result.structuredContent.warnings.includes("SHARED_TEMPLATE_CREATED"), "warning shared create");
}
for (const [overrides, code, label] of [
  [{ amount: 0 }, "INVALID_INPUT", "zero"],
  [{ amount: -1 }, "INVALID_INPUT", "negativo"],
  [{ amount: Infinity }, "INVALID_INPUT", "infinity"],
  [{ description: " " }, "INVALID_INPUT", "descrição vazia"],
  [{ description: "x".repeat(201) }, "INVALID_INPUT", "descrição longa"],
  [{ day_of_month: 0 }, "INVALID_INPUT", "dia zero"],
  [{ day_of_month: 32 }, "INVALID_INPUT", "dia 32"],
  [{ start_date: "2026-02-30" }, "INVALID_INPUT", "data inexistente"],
  [{ start_date: "01/07/2026" }, "INVALID_INPUT", "data ambígua"],
  [{ end_date: "2026-06-30" }, "INVALID_DATE_RANGE", "intervalo invertido"],
  [{ category_id: otherCategoryId }, "CATEGORY_NOT_FOUND", "categoria alheia"],
  [{ card_id: inactiveCardId }, "CARD_NOT_FOUND", "cartão inativo"],
  [{ card_id: otherCardId }, "CARD_NOT_FOUND", "cartão alheio"],
  [{ payment_method: "pix", card_id: cardId }, "BUSINESS_RULE_VIOLATION", "cartão com pix"],
  [{ shared_group_id: groupB }, "RESOURCE_NOT_FOUND", "grupo inacessível"],
  [{ user_id: userA }, "INVALID_INPUT", "user_id proibido"],
  [{ is_shared: true }, "INVALID_INPUT", "is_shared proibido"],
  [{ extra: true }, "INVALID_INPUT", "campo extra"],
]) {
  use();
  errorCode(await core.createRecurringExpense.handler(expenseCreate(overrides), ctx), code, label);
}
{
  use();
  const result = await core.createRecurringExpense.handler(
    expenseCreate({ payment_method: "pix", card_id: null, category_id: null }),
    ctx,
  );
  equal(result.structuredContent.template.card_id, null, "método sem cartão");
  equal(result.structuredContent.template.category_id, null, "categoria expense null");
}

{
  const db = use();
  const result = await core.createRecurringIncome.handler(incomeCreate(), ctx);
  equal(result.structuredContent.resource_type, "recurring_income", "criação income tipo");
  equal(result.structuredContent.created, true, "criação income");
  equal(result.structuredContent.template.description, "Aluguel recebido", "descrição income");
  equal(result.structuredContent.template.amount, 1500, "valor income");
  equal(result.structuredContent.template.day_of_month, 5, "dia income");
  equal(result.structuredContent.template.start_date, "2026-07-01", "start income");
  equal(result.structuredContent.template.end_date, null, "end income");
  equal(result.structuredContent.template.income_category_id, incomeCategoryId, "categoria income");
  equal(result.structuredContent.template.category_name, "Salário", "snapshot income");
  check(!("user_id" in result.structuredContent.template), "income output sem user_id");
  check(result.content[0].text.includes("somente um template mensal"), "content income");
  equal(db.tables.incomes.length, 0, "nenhuma receita real");
}
for (const day of [29, 30, 31]) {
  use();
  const result = await core.createRecurringIncome.handler(incomeCreate({ day_of_month: day }), ctx);
  equal(result.structuredContent.template.day_of_month, day, `income dia ${day}`);
  check(result.structuredContent.warnings.includes("RECURRING_DAY_MAY_BE_SKIPPED"), `income warning ${day}`);
}
for (const [overrides, code, label] of [
  [{ amount: NaN }, "INVALID_INPUT", "income NaN"],
  [{ description: "" }, "INVALID_INPUT", "income descrição"],
  [{ end_date: "2026-01-01" }, "INVALID_DATE_RANGE", "income intervalo"],
  [{ income_category_id: otherIncomeCategoryId }, "CATEGORY_NOT_FOUND", "income categoria alheia"],
  [{ card_id: cardId }, "INVALID_INPUT", "income sem card"],
  [{ user_id: userA }, "INVALID_INPUT", "income sem user"],
  [{ extra: true }, "INVALID_INPUT", "income extra"],
]) {
  use();
  errorCode(await core.createRecurringIncome.handler(incomeCreate(overrides), ctx), code, label);
}
{
  use();
  const result = await core.createRecurringIncome.handler(
    incomeCreate({ income_category_id: null, shared_group_id: groupA }),
    ctx,
  );
  equal(result.structuredContent.template.income_category_id, null, "income categoria null");
  equal(result.structuredContent.template.is_shared, true, "income shared");
  check(result.structuredContent.warnings.includes("SHARED_TEMPLATE_CREATED"), "income warning shared");
}

for (const [changes, field, expected] of [
  [{ description: "Academia nova" }, "description", "Academia nova"],
  [{ amount: 130 }, "amount", 130],
  [{ day_of_month: 31 }, "day_of_month", 31],
  [{ start_date: "2026-08-01" }, "start_date", "2026-08-01"],
  [{ end_date: "2026-12-31" }, "end_date", "2026-12-31"],
  [{ is_active: false }, "is_active", false],
]) {
  use();
  const result = await core.updateRecurringExpense.handler(expenseUpdate(changes), ctx);
  equal(result.structuredContent.applied, true, `expense update ${field}`);
  equal(result.structuredContent.after[field], expected, `expense after ${field}`);
  check(result.structuredContent.changed_fields.includes(field), `expense changed ${field}`);
  equal(result.structuredContent.updated_at_before, t0, `expense before timestamp ${field}`);
  equal(result.structuredContent.updated_at_after, t1, `expense after timestamp ${field}`);
}
{
  use();
  const result = await core.updateRecurringExpense.handler(
    expenseUpdate({ description: "Outra", amount: 222, end_date: "2026-12-31" }),
    ctx,
  );
  equal(result.structuredContent.changed_fields, ["description", "amount", "end_date"], "patch múltiplo expense");
  equal(result.structuredContent.after.day_of_month, 15, "campo omitido preservado");
  equal(result.structuredContent.before.description, "Academia", "before expense");
  equal(result.structuredContent.after.description, "Outra", "after expense");
}
{
  const db = use();
  const result = await core.updateRecurringExpense.handler(expenseUpdate({ description: "Academia" }), ctx);
  equal(result.structuredContent.applied, false, "no-op expense");
  equal(result.structuredContent.changed_fields, [], "no-op campos");
  equal(result.structuredContent.updated_at_after, t0, "no-op timestamp");
  equal(db.updated.length, 0, "no-op sem update");
  check(result.structuredContent.warnings.includes("NO_EFFECTIVE_CHANGES"), "no-op warning");
}
{
  use();
  const result = await core.updateRecurringExpense.handler(expenseUpdate({ category_id: null }), ctx);
  equal(result.structuredContent.after.category_id, null, "limpa categoria expense");
  equal(result.structuredContent.after.category_name, null, "limpa snapshot expense");
  check(result.structuredContent.warnings.includes("CATEGORY_SNAPSHOT_UPDATED"), "warning categoria expense");
}
{
  use();
  const result = await core.updateRecurringExpense.handler(expenseUpdate({ payment_method: "pix" }), ctx);
  equal(result.structuredContent.after.payment_method, "pix", "troca método");
  equal(result.structuredContent.after.card_id, null, "limpeza coerente cartão");
  check(result.structuredContent.changed_fields.includes("card_id"), "card changed implícito");
}
{
  use();
  errorCode(
    await core.updateRecurringExpense.handler(expenseUpdate({ card_id: inactiveCardId }), ctx),
    "CARD_NOT_FOUND",
    "nova atribuição inativa",
  );
  use();
  const historical = await core.updateRecurringExpense.handler(expenseUpdate({ description: "Histórico" }), ctx);
  equal(historical.structuredContent.applied, true, "cartão histórico preservado");
}
for (const [input, code, label] of [
  [expenseUpdate({ amount: -1 }), "INVALID_PATCH", "patch amount"],
  [expenseUpdate({ end_date: "2026-01-01" }), "INVALID_DATE_RANGE", "patch range"],
  [expenseUpdate({ category_id: otherCategoryId }), "CATEGORY_NOT_FOUND", "patch categoria"],
  [expenseUpdate({ user_id: userA }), "INVALID_PATCH", "patch user"],
  [expenseUpdate({ shared_group_id: groupA }), "INVALID_PATCH", "patch shared"],
  [expenseUpdate({}), "INVALID_PATCH", "patch vazio"],
  [{ ...expenseUpdate({ amount: 1 }), extra: true }, "INVALID_INPUT", "input extra"],
  [{ ...expenseUpdate({ amount: 1 }), expected_updated_at: "2026-01-01T00:00:00Z" }, "CONCURRENT_MODIFICATION", "conflito prévio"],
]) {
  use();
  errorCode(await core.updateRecurringExpense.handler(input, ctx), code, label);
}
{
  use(baseTables(), { raceOnUpdate: true });
  errorCode(
    await core.updateRecurringExpense.handler(expenseUpdate({ amount: 200 }), ctx),
    "CONCURRENT_MODIFICATION",
    "corrida expense",
  );
}
{
  use(baseTables({ recurring_expenses: [] }));
  errorCode(await core.updateRecurringExpense.handler(expenseUpdate({ amount: 200 }), ctx), "RESOURCE_NOT_FOUND", "expense inexistente");
  use(baseTables({ recurring_expenses: [recurringExpense({ user_id: userB })] }));
  errorCode(await core.updateRecurringExpense.handler(expenseUpdate({ amount: 200 }), ctx), "RESOURCE_NOT_FOUND", "expense alheio");
  use(baseTables({ recurring_expenses: [recurringExpense({ user_id: userB, shared_group_id: groupA })] }));
  errorCode(await core.updateRecurringExpense.handler(expenseUpdate({ amount: 200 }), ctx), "RESOURCE_NOT_FOUND", "expense compartilhado alheio");
}
{
  use(baseTables({ recurring_expenses: [recurringExpense({ shared_group_id: groupA })] }));
  const result = await core.updateRecurringExpense.handler(expenseUpdate({ amount: 200 }), ctx);
  equal(result.structuredContent.after.shared_group_id, groupA, "shared preservado expense");
  check(result.structuredContent.warnings.includes("SHARED_TEMPLATE_UPDATED"), "warning shared update expense");
}

for (const [changes, field, expected] of [
  [{ description: "Receita nova" }, "description", "Receita nova"],
  [{ amount: 3500 }, "amount", 3500],
  [{ day_of_month: 29 }, "day_of_month", 29],
  [{ start_date: "2026-08-01", end_date: "2026-12-31" }, "start_date", "2026-08-01"],
  [{ is_active: false }, "is_active", false],
]) {
  use();
  const result = await core.updateRecurringIncome.handler(incomeUpdate(changes), ctx);
  equal(result.structuredContent.applied, true, `income update ${field}`);
  equal(result.structuredContent.after[field], expected, `income after ${field}`);
  check(result.structuredContent.changed_fields.includes(field), `income changed ${field}`);
}
{
  use();
  const result = await core.updateRecurringIncome.handler(
    incomeUpdate({ description: "Outra", amount: 3200, income_category_id: null }),
    ctx,
  );
  equal(result.structuredContent.changed_fields, ["description", "amount", "income_category_id"], "patch múltiplo income");
  equal(result.structuredContent.after.income_category_id, null, "limpa categoria income");
  equal(result.structuredContent.after.category_name, null, "limpa snapshot income");
  equal(result.structuredContent.before.description, "Salário", "before income");
}
{
  const db = use();
  const result = await core.updateRecurringIncome.handler(incomeUpdate({ amount: 3000 }), ctx);
  equal(result.structuredContent.applied, false, "no-op income");
  equal(result.structuredContent.updated_at_after, t0, "no-op income timestamp");
  equal(db.updated.length, 0, "no-op income sem update");
}
for (const [tables, input, code, label] of [
  [baseTables(), incomeUpdate({ amount: 1 }, { expected_updated_at: "2026-01-01T00:00:00Z" }), "CONCURRENT_MODIFICATION", "income conflito"],
  [baseTables({ recurring_incomes: [] }), incomeUpdate({ amount: 1 }), "RESOURCE_NOT_FOUND", "income inexistente"],
  [baseTables({ recurring_incomes: [recurringIncome({ user_id: userB })] }), incomeUpdate({ amount: 1 }), "RESOURCE_NOT_FOUND", "income alheio"],
  [baseTables({ recurring_incomes: [recurringIncome({ user_id: userB, shared_group_id: groupA })] }), incomeUpdate({ amount: 1 }), "RESOURCE_NOT_FOUND", "income shared alheio"],
  [baseTables(), incomeUpdate({ income_category_id: otherIncomeCategoryId }), "CATEGORY_NOT_FOUND", "income categoria alheia update"],
  [baseTables(), incomeUpdate({ user_id: userA }), "INVALID_PATCH", "income user patch"],
  [baseTables(), incomeUpdate({}), "INVALID_PATCH", "income patch vazio"],
]) {
  use(tables);
  errorCode(await core.updateRecurringIncome.handler(input, ctx), code, label);
}
{
  use(baseTables(), { raceOnUpdate: true, raceId: recurringIncomeId });
  errorCode(await core.updateRecurringIncome.handler(incomeUpdate({ amount: 3200 }), ctx), "CONCURRENT_MODIFICATION", "corrida income");
}
{
  use(baseTables({ recurring_incomes: [recurringIncome({ shared_group_id: groupA })] }));
  const result = await core.updateRecurringIncome.handler(incomeUpdate({ amount: 3200 }), ctx);
  equal(result.structuredContent.after.shared_group_id, groupA, "shared preservado income");
  check(result.structuredContent.warnings.includes("SHARED_TEMPLATE_UPDATED"), "warning shared update income");
  equal(result.structuredContent.updated_at_after, t1, "updated_at income");
}
{
  const db = use();
  const result = await core.updateRecurringIncome.handler(incomeUpdate({ start_date: "2024-02-29", end_date: "2024-02-29" }), ctx);
  equal(result.structuredContent.after.start_date, "2024-02-29", "bissexto");
  equal(result.structuredContent.after.end_date, "2024-02-29", "datas iguais");
  equal(db.tables.expenses.length, 0, "update não cria expense");
  equal(db.tables.incomes.length, 0, "update não cria income");
}
for (const date of ["2023-02-29", "2026-02-30", "2026-13-01", "2026-01-01T00:00:00Z"]) {
  use();
  errorCode(
    await core.updateRecurringIncome.handler(
      incomeUpdate({ start_date: date }),
      ctx,
    ),
    "INVALID_PATCH",
    `data civil inválida ${date}`,
  );
}

const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const tools = manifest.mcp.tools;
equal(tools.length, 44, "manifest 44 tools");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === true).length, 20, "20 read-only");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === false).length, 24, "24 write");
for (const name of [
  "create_recurring_expense",
  "create_recurring_income",
  "update_recurring_expense",
  "update_recurring_income",
]) {
  const tool = tools.find((candidate) => candidate.name === name);
  check(tool, `${name} registrado`);
  equal(tool.annotations.readOnlyHint, false, `${name} write`);
  equal(tool.annotations.idempotentHint, false, `${name} não idempotente`);
  equal(tool.annotations.openWorldHint, false, `${name} mundo fechado`);
  equal(tool.inputSchema.additionalProperties, false, `${name} input fechado`);
  equal(tool.outputSchema.additionalProperties, false, `${name} output fechado`);
  check(!("user_id" in tool.inputSchema.properties), `${name} sem user_id`);
}
for (const name of ["create_recurring_expense", "create_recurring_income"]) {
  equal(tools.find((tool) => tool.name === name).annotations.destructiveHint, false, `${name} não destrutiva`);
}
for (const name of ["update_recurring_expense", "update_recurring_income"]) {
  const tool = tools.find((candidate) => candidate.name === name);
  equal(tool.annotations.destructiveHint, true, `${name} destrutiva`);
  check(tool.inputSchema.required.includes("expected_updated_at"), `${name} exige concorrência`);
  equal(tool.inputSchema.properties.changes.additionalProperties, false, `${name} changes fechado`);
}

const sourceFiles = [
  "src/lib/mcp/shared/recurring-write.ts",
  "src/lib/mcp/tools/create-recurring-expense.ts",
  "src/lib/mcp/tools/create-recurring-income.ts",
  "src/lib/mcp/tools/update-recurring-expense.ts",
  "src/lib/mcp/tools/update-recurring-income.ts",
];
const source = (
  await Promise.all(sourceFiles.map((file) => readFile(file, "utf8")))
).join("\n");
check(!/service_role|SERVICE_ROLE/u.test(source), "sem service role");
check(!/from\(["'](?:expenses|incomes)["']\)/u.test(source), "sem lançamentos reais");
check(!/insert\(\{[^}]*user_id:\s*rawInput/u.test(source), "user_id somente contexto");
check(/supabaseForUser\(ctx\)/u.test(source), "supabase por usuário");
check(!/next_occurrence|last_generated_at|installment_group_id/u.test(source), "sem materialização ou parcelas");
check(!/from\s+["']@\//u.test(source), "sem alias MCP");

const bundleSource = await readFile("supabase/functions/mcp/index.ts", "utf8");
check(!/(?:from\s*["']@\/|import\s*\(\s*["']@\/|npm:@\/)/u.test(bundleSource), "bundle sem alias");
check(
  !/(?:^|["'`(=\s])[A-Za-z]:[\\/]/mu.test(bundleSource),
  "bundle sem caminho absoluto",
);
check(/Deno\.serve/u.test(bundleSource), "Deno.serve");
for (const name of [
  "create_recurring_expense",
  "create_recurring_income",
  "update_recurring_expense",
  "update_recurring_income",
]) {
  check(bundleSource.includes(`name: "${name}"`), `${name} no bundle`);
}

console.log(`Fase MCP 1.2C-A: ${checks} verificações diretas, regressivas e de contrato concluídas.`);
