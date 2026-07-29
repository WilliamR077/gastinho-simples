import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { mock } from "node:test";
import { build } from "esbuild";

process.env.MCP_CURSOR_SECRET =
  "phase-1.2e-a-deterministic-cursor-secret-with-safe-length";

mock.timers.enable({
  apis: ["Date"],
  now: new Date("2026-07-29T12:00:00-03:00"),
});

const mockPlugin = {
  name: "phase-1.2e-a-supabase-mock",
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
      export { default as createExpenseCategory } from "./src/lib/mcp/tools/create-expense-category.ts";
      export { default as updateExpenseCategory } from "./src/lib/mcp/tools/update-expense-category.ts";
      export { default as createIncomeCategory } from "./src/lib/mcp/tools/create-income-category.ts";
      export { default as updateIncomeCategory } from "./src/lib/mcp/tools/update-income-category.ts";
      export { default as listCategories } from "./src/lib/mcp/tools/list-categories.ts";
      export { default as createGoal } from "./src/lib/mcp/tools/create-goal.ts";
      export { default as updateGoal } from "./src/lib/mcp/tools/update-goal.ts";
      export { default as listGoals } from "./src/lib/mcp/tools/list-goals.ts";
      export * from "./src/lib/mcp/shared/category-write.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2e-a-entry.ts",
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
const expenseCategoryId = "30000000-0000-4000-8000-000000000003";
const incomeCategoryId = "40000000-0000-4000-8000-000000000004";
const t0 = "2026-07-01T12:00:00.000Z";
const t1 = "2026-07-01T12:00:01.000Z";
const createdAt = "2026-06-01T12:00:00.000Z";

const expenseCategory = (overrides = {}) => ({
  id: expenseCategoryId,
  user_id: userA,
  name: "Viagem",
  icon: "✈️",
  color: "#6366f1",
  is_default: false,
  is_active: true,
  display_order: 3,
  created_at: createdAt,
  updated_at: t0,
  ...overrides,
});
const incomeCategory = (overrides = {}) => ({
  id: incomeCategoryId,
  user_id: userA,
  name: "Freelance",
  icon: "💻",
  color: "#10b981",
  is_default: false,
  is_active: true,
  display_order: 2,
  created_at: createdAt,
  updated_at: t0,
  ...overrides,
});
const tables = (overrides = {}) => ({
  user_categories: [
    expenseCategory(),
    expenseCategory({
      id: "31000000-0000-4000-8000-000000000003",
      user_id: userB,
      name: "Privada",
    }),
  ],
  user_income_categories: [
    incomeCategory(),
    incomeCategory({
      id: "41000000-0000-4000-8000-000000000004",
      user_id: userB,
      name: "Privada",
    }),
  ],
  expenses: [],
  incomes: [],
  recurring_expenses: [],
  recurring_incomes: [],
  budget_goals: [],
  expense_categories: [{ id: "global", name: "Catálogo legado" }],
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
    this.ordering = null;
    this.rowLimit = null;
  }
  select(columns) {
    this.columns = columns.split(",").map((item) => item.trim());
    this.db.calls.push({ table: this.table, method: "select", columns });
    return this;
  }
  insert(payload) {
    this.mode = "insert";
    this.payload = Array.isArray(payload) ? payload[0] : payload;
    this.db.calls.push({ table: this.table, method: "insert", payload });
    return this;
  }
  update(payload) {
    this.mode = "update";
    this.payload = payload;
    this.db.calls.push({ table: this.table, method: "update", payload });
    return this;
  }
  eq(column, value) {
    this.filters.push((row) => row[column] === value);
    this.db.calls.push({ table: this.table, method: "eq", column, value });
    return this;
  }
  order(column, options = {}) {
    this.ordering = { column, ascending: options.ascending !== false };
    return this;
  }
  limit(value) {
    this.rowLimit = value;
    return this;
  }
  visible(row) {
    if (
      this.table === "user_categories" ||
      this.table === "user_income_categories"
    ) {
      return row.user_id === this.db.userId;
    }
    return true;
  }
  rows() {
    let result = (this.db.tables[this.table] ?? []).filter((row) =>
      this.visible(row),
    );
    for (const filter of this.filters) result = result.filter(filter);
    if (this.ordering) {
      const { column, ascending } = this.ordering;
      result = [...result].sort((a, b) =>
        ascending ? a[column] - b[column] : b[column] - a[column],
      );
    }
    if (this.rowLimit !== null) result = result.slice(0, this.rowLimit);
    return result;
  }
  project(row) {
    if (!this.columns) return structuredClone(row);
    return Object.fromEntries(
      this.columns.map((column) => [column, row[column] ?? null]),
    );
  }
  createRow() {
    const rows = this.db.tables[this.table];
    const isExpense = this.table === "user_categories";
    if (
      isExpense &&
      rows.some(
        (row) =>
          row.user_id === this.payload.user_id &&
          row.name === this.payload.name,
      )
    ) {
      return { data: null, error: { code: "23505" } };
    }
    const sequence = this.db.insertSequence++;
    const row = {
      ...structuredClone(this.payload),
      id: `${isExpense ? "50000000" : "60000000"}-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
      created_at: t1,
      updated_at: t1,
    };
    rows.push(row);
    this.db.writes.push({ table: this.table, mode: "insert", row });
    return { data: this.project(row), error: null };
  }
  applyRace() {
    if (this.mode !== "update" || !this.db.race || this.db.raceApplied) return;
    const row = (this.db.tables[this.table] ?? []).find((item) =>
      item.id === this.db.race.id
    );
    if (row) row.updated_at = "2026-07-01T12:00:00.500Z";
    this.db.raceApplied = true;
  }
  execute(single) {
    if (this.mode === "insert") return this.createRow();
    this.applyRace();
    const matched = this.rows();
    if (this.mode === "update") {
      if (matched.length !== 1) return { data: null, error: null };
      Object.assign(matched[0], structuredClone(this.payload), {
        updated_at: t1,
      });
      this.db.writes.push({
        table: this.table,
        mode: "update",
        id: matched[0].id,
        payload: structuredClone(this.payload),
      });
      return { data: this.project(matched[0]), error: null };
    }
    return {
      data: single
        ? matched.length === 1
          ? this.project(matched[0])
          : null
        : matched.map((row) => this.project(row)),
      error: null,
    };
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
  constructor(initial, options = {}) {
    this.tables = structuredClone(initial);
    this.userId = userA;
    this.calls = [];
    this.writes = [];
    this.insertSequence = 1;
    this.race = options.race ?? null;
    this.raceApplied = false;
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
const use = (initial = tables(), options) => {
  const db = new DB(initial, options);
  globalThis.__MCP_TEST_SUPABASE__ = db;
  return db;
};
const updateInput = (id, changes, overrides = {}) => ({
  category_id: id,
  expected_updated_at: t0,
  changes,
  ...overrides,
});

{
  const db = use();
  const result = await core.createExpenseCategory.handler(
    { name: "  Mercado  " },
    ctx,
  );
  equal(result.structuredContent.created, true, "cria categoria de despesa");
  equal(result.structuredContent.category_kind, "expense", "tipo despesa");
  equal(
    result.structuredContent.category.goal_reference,
    result.structuredContent.category.id,
    "goal_reference canônica é o UUID",
  );
  equal(result.structuredContent.category.name, "Mercado", "nome normalizado");
  equal(result.structuredContent.category.icon, "📦", "ícone default do app");
  equal(result.structuredContent.category.color, "#6366f1", "cor default");
  equal(result.structuredContent.category.is_default, false, "não default");
  equal(result.structuredContent.category.is_active, true, "ativa");
  equal(result.structuredContent.category.display_order, 4, "ordem max + 1");
  check(result.structuredContent.warnings.includes("CATEGORY_CREATED"), "warning criação");
  check(result.structuredContent.warnings.includes("CATEGORY_NAME_NORMALIZED"), "warning trim");
  check(result.content[0].text.includes("Mercado"), "content autossuficiente");
  check(!JSON.stringify(result).includes(userA), "não expõe user_id");
  equal(db.writes.length, 1, "uma escrita");
  equal(db.tables.expense_categories.length, 1, "catálogo legado intocado");
}
{
  const db = use(tables({ user_categories: [], budget_goals: [] }));
  const created = await core.createExpenseCategory.handler(
    { name: "  TESTE MCP 1.2E Á DESPESA  ", icon: "🎨" },
    ctx,
  );
  const category = created.structuredContent.category;
  equal(category.name, "TESTE MCP 1.2E Á DESPESA", "nome complexo preservado");
  equal(category.goal_reference, category.id, "referência copiável");

  const listed = await core.listCategories.handler(
    { kind: "expense", include_inactive: true },
    ctx,
  );
  equal(
    listed.structuredContent.categories[0].goal_reference,
    category.goal_reference,
    "list_categories repete referência",
  );

  const goalResult = await core.createGoal.handler(
    {
      type: "category",
      limit_amount: 1.23,
      category: category.goal_reference,
    },
    ctx,
  );
  equal(goalResult.structuredContent.created, true, "create_goal aceita UUID");
  equal(
    goalResult.structuredContent.goal.category_reference,
    category.goal_reference,
    "goal retorna referência canônica",
  );
  equal(
    db.tables.budget_goals[0].category,
    category.goal_reference,
    "meta persiste exatamente goal_reference",
  );
  check(
    goalResult.content[0].text.includes(category.name) &&
      goalResult.content[0].text.includes(category.goal_reference),
    "content da meta informa nome e referência",
  );

  const goals = await core.listGoals.handler(
    { scope: "personal", type: "category", limit: 20 },
    ctx,
  );
  equal(goals.structuredContent.count, 1, "list_goals encontra meta");
  equal(
    goals.structuredContent.goals[0].category_reference,
    category.goal_reference,
    "list_goals preserva vínculo UUID",
  );
  check(!JSON.stringify(goalResult).includes(userA), "goal sem user_id");
}
{
  const legacy = tables({
    user_categories: [
      expenseCategory({ name: "Alimentação", is_default: true }),
    ],
    budget_goals: [],
  });
  const db = use(legacy);
  const result = await core.createGoal.handler(
    { type: "category", limit_amount: 10, category: "alimentacao" },
    ctx,
  );
  equal(result.structuredContent.created, true, "slug legado aceito");
  equal(db.tables.budget_goals[0].category, "alimentacao", "slug legado preservado");
  check(result.content[0].text.includes("Alimentação"), "nome legado no content");
}
{
  const db = use(tables({
    budget_goals: [
      {
        id: "65000000-0000-4000-8000-000000000001",
        user_id: userA,
        type: "monthly_total",
        category: null,
        limit_amount: 100,
        shared_group_id: null,
        created_at: createdAt,
        updated_at: t0,
      },
    ],
  }));
  const result = await core.updateGoal.handler(
    {
      goal_id: "65000000-0000-4000-8000-000000000001",
      expected_updated_at: t0,
      changes: {
        type: "category",
        category: expenseCategoryId,
      },
    },
    ctx,
  );
  equal(result.structuredContent.applied, true, "update_goal aceita UUID expense");
  equal(
    result.structuredContent.after.category_reference,
    expenseCategoryId,
    "update_goal persiste referência canônica",
  );
  equal(db.tables.budget_goals[0].category, expenseCategoryId, "linha da meta atualizada");
}
for (const [initial, reference, message] of [
  [
    tables({
      user_categories: [
        expenseCategory({ user_id: userB }),
      ],
      budget_goals: [],
    }),
    expenseCategoryId,
    "categoria alheia",
  ],
  [
    tables({
      user_categories: [
        expenseCategory({ is_active: false }),
      ],
      budget_goals: [],
    }),
    expenseCategoryId,
    "categoria inativa",
  ],
  [tables({ user_categories: [], budget_goals: [] }), expenseCategoryId, "UUID inexistente"],
  [
    tables({ user_categories: [expenseCategory()], budget_goals: [] }),
    "Viagem",
    "nome de exibição não é referência",
  ],
]) {
  use(initial);
  errorCode(
    await core.createGoal.handler(
      { type: "category", limit_amount: 1, category: reference },
      ctx,
    ),
    "CATEGORY_NOT_FOUND",
    message,
  );
}
{
  use(tables({ user_categories: [expenseCategory({ name: "Mercado" })] }));
  errorCode(
    await core.createExpenseCategory.handler({ name: "Mercado" }, ctx),
    "CATEGORY_NAME_CONFLICT",
    "duplicata exata de despesa rejeitada",
  );
}
{
  const db = use(tables({ user_categories: [expenseCategory({ name: "Mercado" })] }));
  const result = await core.createExpenseCategory.handler(
    { name: "mercado", icon: "🛒" },
    ctx,
  );
  equal(result.structuredContent.created, true, "variante de caixa segue unicidade real");
  equal(db.writes.length, 1, "variante inserida");
}
{
  use();
  const longName = `Categoria ${"á".repeat(500)}`;
  const result = await core.createExpenseCategory.handler(
    { name: longName, icon: "🎨" },
    ctx,
  );
  equal(result.structuredContent.category.name, longName, "TEXT sem limite artificial");
  equal(result.structuredContent.category.icon, "🎨", "caractere válido preservado");
}
for (const [input, message] of [
  [{ name: "" }, "nome vazio"],
  [{ name: "A\u0000B" }, "controle"],
  [{ name: "Nova", icon: "X" }, "ícone fora da lista"],
  [{ name: "Nova", user_id: userA }, "user_id proibido"],
  [{ name: "Nova", color: "#000000" }, "cor não editável"],
  [{ name: "Nova", display_order: 99 }, "ordem não editável"],
  [{ name: "Nova", id: expenseCategoryId }, "id gerado pelo banco"],
  [{ name: "Nova", shared_group_id: expenseCategoryId }, "grupo não suportado"],
  [{ name: "Nova", is_active: false }, "criação inativa não suportada no app"],
]) {
  use();
  errorCode(
    await core.createExpenseCategory.handler(input, ctx),
    "INVALID_INPUT",
    message,
  );
}
{
  const db = use(tables({
    user_income_categories: [
      incomeCategory({ name: "Freelance" }),
      incomeCategory({
        id: "42000000-0000-4000-8000-000000000004",
        name: "Freelance",
      }),
    ],
  }));
  const result = await core.createIncomeCategory.handler(
    { name: "Freelance", icon: "💻" },
    ctx,
  );
  equal(result.structuredContent.created, true, "income aceita duplicata conforme banco");
  equal(result.structuredContent.category.color, "#10b981", "cor de receita");
  check(
    !("goal_reference" in result.structuredContent.category),
    "contrato de criação income preservado",
  );
  equal(result.structuredContent.category.display_order, 3, "ordem de receita");
  equal(db.writes.length, 1, "inserção de receita");
}
{
  const db = use(tables({ budget_goals: [] }));
  const result = await core.createGoal.handler(
    {
      type: "income_category",
      limit_amount: 50,
      category: incomeCategoryId,
    },
    ctx,
  );
  equal(result.structuredContent.created, true, "meta de receita preservada");
  equal(
    result.structuredContent.goal.category_reference,
    incomeCategoryId,
    "receita continua por UUID",
  );
  equal(db.tables.budget_goals[0].category, incomeCategoryId, "UUID income persistido");
}
for (const [input, message] of [
  [{ name: " " }, "income nome vazio"],
  [{ name: "Nova", icon: "https://example.com/icon.svg" }, "income URL de ícone"],
  [{ name: "Nova", id: incomeCategoryId }, "income UUID fornecido"],
  [{ name: "Nova", user_id: userA }, "income user_id"],
  [{ name: "Nova", color: "#10b981" }, "income cor não editável"],
]) {
  use();
  errorCode(
    await core.createIncomeCategory.handler(input, ctx),
    "INVALID_INPUT",
    message,
  );
}

{
  const initial = tables({
    expenses: [
      {
        id: "70000000-0000-4000-8000-000000000001",
        user_id: userA,
        category_id: expenseCategoryId,
        expense_date: "2026-07-01",
        installment_group_id: null,
        installment_number: null,
        total_installments: null,
      },
      {
        id: "70000000-0000-4000-8000-000000000002",
        user_id: userA,
        category_id: expenseCategoryId,
        expense_date: "2026-08-01T00:00:00.000Z",
        installment_group_id: "71000000-0000-4000-8000-000000000001",
        installment_number: 2,
        total_installments: 4,
      },
    ],
    recurring_expenses: [
      { id: "72000000-0000-4000-8000-000000000001", user_id: userA, category_id: expenseCategoryId, is_active: true },
      { id: "72000000-0000-4000-8000-000000000002", user_id: userA, category_id: expenseCategoryId, is_active: false },
    ],
    budget_goals: [
      { id: "73000000-0000-4000-8000-000000000001", user_id: userA, type: "category", category: "alimentacao" },
    ],
  });
  initial.user_categories[0].name = "Alimentação";
  const db = use(initial);
  const result = await core.updateExpenseCategory.handler(
    updateInput(expenseCategoryId, { is_active: false }),
    ctx,
  );
  equal(result.structuredContent.applied, true, "desativa categoria");
  equal(result.structuredContent.changed_fields, ["is_active"], "campo alterado");
  equal(result.structuredContent.before.is_active, true, "before real");
  equal(result.structuredContent.after.is_active, false, "after real");
  equal(result.structuredContent.updated_at_before, t0, "timestamp anterior");
  equal(result.structuredContent.updated_at_after, t1, "trigger atualiza timestamp");
  equal(result.structuredContent.reference_summary.historical_expense_count, 1, "histórica");
  equal(result.structuredContent.reference_summary.future_expense_count, 1, "futura");
  equal(result.structuredContent.reference_summary.installment_expense_count, 1, "parcela");
  equal(result.structuredContent.reference_summary.active_recurring_expense_count, 1, "recorrente ativa");
  equal(result.structuredContent.reference_summary.inactive_recurring_expense_count, 1, "recorrente inativa");
  equal(result.structuredContent.reference_summary.active_goal_count, 1, "meta por slug");
  equal(result.structuredContent.reference_summary.total_reference_count, 5, "total refs");
  for (const warning of [
    "CATEGORY_UPDATED",
    "CATEGORY_DEACTIVATED",
    "HISTORICAL_CATEGORY_REFERENCES_PRESERVED",
    "ACTIVE_RECURRING_TEMPLATES_REFERENCE_CATEGORY",
    "ACTIVE_GOALS_REFERENCE_CATEGORY",
  ]) {
    check(result.structuredContent.warnings.includes(warning), `warning ${warning}`);
  }
  check(result.content[0].text.includes("Desativar não elimina"), "content explica histórico");
  equal(db.tables.expenses, initial.expenses, "despesas intocadas");
  equal(db.tables.recurring_expenses, initial.recurring_expenses, "recorrências intocadas");
  equal(db.tables.budget_goals, initial.budget_goals, "metas intocadas");
  equal(db.writes.length, 1, "somente categoria escrita");
}
{
  const initial = tables({
    budget_goals: [
      { id: "73000000-0000-4000-8000-000000000001", user_id: userA, type: "category", category: "alimentacao" },
    ],
  });
  initial.user_categories[0].name = "Alimentação";
  use(initial);
  errorCode(
    await core.updateExpenseCategory.handler(
      updateInput(expenseCategoryId, { name: "Comida" }),
      ctx,
    ),
    "BUSINESS_RULE_VIOLATION",
    "rename com meta textual bloqueado",
  );
}
{
  const initial = tables({
    budget_goals: [
      {
        id: "73000000-0000-4000-8000-000000000001",
        user_id: userA,
        type: "category",
        category: expenseCategoryId,
      },
    ],
  });
  const goalsBefore = structuredClone(initial.budget_goals);
  use(initial);
  const result = await core.updateExpenseCategory.handler(
    updateInput(expenseCategoryId, { name: "Viagem Renomeada" }),
    ctx,
  );
  equal(result.structuredContent.applied, true, "rename com meta UUID permitido");
  equal(
    result.structuredContent.after.goal_reference,
    expenseCategoryId,
    "goal_reference UUID preservada no rename",
  );
  check(
    result.structuredContent.warnings.includes("ACTIVE_GOALS_REFERENCE_CATEGORY"),
    "warning de meta UUID vinculada",
  );
  equal(
    globalThis.__MCP_TEST_SUPABASE__.tables.budget_goals,
    goalsBefore,
    "rename não reescreve meta UUID",
  );
}
{
  const initial = tables({
    budget_goals: [
      {
        id: "73000000-0000-4000-8000-000000000001",
        user_id: userA,
        type: "category",
        category: "alimentacao",
      },
    ],
  });
  initial.user_categories[0].name = "Alimentação";
  const db = use(initial);
  db.tables.budget_goals.splice(0, 1);
  const result = await core.updateExpenseCategory.handler(
    updateInput(expenseCategoryId, { name: "Comida" }),
    ctx,
  );
  equal(result.structuredContent.applied, true, "rename liberado sem meta legada");
  equal(db.tables.budget_goals.length, 0, "meta removida não é recriada");
}
{
  const db = use();
  const result = await core.updateExpenseCategory.handler(
    updateInput(expenseCategoryId, {
      name: "Férias",
      icon: "🏖️",
      is_active: false,
    }),
    ctx,
  );
  equal(result.structuredContent.applied, true, "patch múltiplo");
  equal(
    result.structuredContent.changed_fields,
    ["name", "icon", "is_active"],
    "changed_fields completos",
  );
  equal(result.structuredContent.after.name, "Férias", "nome real");
  equal(result.structuredContent.after.icon, "🏖️", "ícone real");
  equal(result.structuredContent.after.color, "#6366f1", "cor preservada");
  equal(result.structuredContent.after.display_order, 3, "ordem preservada");
  equal(db.writes[0].payload.color, undefined, "não reescreve cor");
  equal(db.writes[0].payload.display_order, undefined, "não reescreve ordem");
}
{
  const initial = tables();
  initial.user_categories[0].is_active = false;
  use(initial);
  const result = await core.updateExpenseCategory.handler(
    updateInput(expenseCategoryId, { is_active: true }),
    ctx,
  );
  check(!result.isError, `reativação de despesa: ${JSON.stringify(result)}`);
  equal(result.structuredContent.after.is_active, true, "reativa despesa");
  check(result.structuredContent.warnings.includes("CATEGORY_REACTIVATED"), "warning reativação despesa");
}
{
  const db = use();
  const result = await core.updateExpenseCategory.handler(
    updateInput(expenseCategoryId, { name: "Viagem" }),
    ctx,
  );
  equal(result.structuredContent.applied, false, "no-op");
  equal(result.structuredContent.changed_fields, [], "sem campos");
  equal(result.structuredContent.updated_at_after, t0, "timestamp preservado");
  equal(db.writes.length, 0, "sem update no-op");
  check(result.structuredContent.warnings.includes("NO_EFFECTIVE_CHANGES"), "warning no-op");
  check(result.content[0].text.includes("não alterada"), "content no-op");
}
{
  use();
  errorCode(
    await core.updateExpenseCategory.handler(
      updateInput(expenseCategoryId, { icon: "✈️" }, { expected_updated_at: t1 }),
      ctx,
    ),
    "CONCURRENT_MODIFICATION",
    "expected stale",
  );
}
{
  const db = use(tables(), { race: { id: expenseCategoryId } });
  errorCode(
    await core.updateExpenseCategory.handler(
      updateInput(expenseCategoryId, { icon: "🏖️" }),
      ctx,
    ),
    "CONCURRENT_MODIFICATION",
    "corrida atômica",
  );
  equal(db.writes.length, 0, "corrida não escreve");
}
{
  const initial = tables();
  initial.user_categories[0].user_id = userB;
  use(initial);
  errorCode(
    await core.updateExpenseCategory.handler(
      updateInput(expenseCategoryId, { icon: "🏖️" }),
      ctx,
    ),
    "RESOURCE_NOT_FOUND",
    "outro usuário genérico",
  );
}
{
  use(tables({ user_categories: [] }));
  errorCode(
    await core.updateExpenseCategory.handler(
      updateInput(expenseCategoryId, { icon: "🏖️" }),
      ctx,
    ),
    "RESOURCE_NOT_FOUND",
    "inexistente genérico",
  );
}
{
  use(tables({ user_categories: [expenseCategory({ name: "Outros", is_default: true })] }));
  errorCode(
    await core.updateExpenseCategory.handler(
      updateInput(expenseCategoryId, { is_active: false }),
      ctx,
    ),
    "CATEGORY_NOT_EDITABLE",
    "Outros protegida",
  );
}
{
  const initial = tables();
  initial.user_categories.push(
    expenseCategory({
      id: "32000000-0000-4000-8000-000000000003",
      name: "Mercado",
    }),
  );
  use(initial);
  errorCode(
    await core.updateExpenseCategory.handler(
      updateInput(expenseCategoryId, { name: "Mercado" }),
      ctx,
    ),
    "CATEGORY_NAME_CONFLICT",
    "rename duplicado despesa",
  );
}
for (const [input, code, message] of [
  [{ category_id: "x", expected_updated_at: t0, changes: { name: "A" } }, "INVALID_INPUT", "UUID"],
  [{ category_id: expenseCategoryId, changes: { name: "A" } }, "INVALID_INPUT", "expected obrigatório"],
  [updateInput(expenseCategoryId, {}), "INVALID_PATCH", "patch vazio"],
  [updateInput(expenseCategoryId, { user_id: userB }), "INVALID_PATCH", "user_id"],
  [updateInput(expenseCategoryId, { color: "#000000" }), "INVALID_PATCH", "color"],
  [updateInput(expenseCategoryId, { display_order: 0 }), "INVALID_PATCH", "ordem"],
  [updateInput(expenseCategoryId, { is_default: true }), "INVALID_PATCH", "default"],
  [updateInput(expenseCategoryId, { icon: "X" }), "INVALID_PATCH", "ícone"],
]) {
  use();
  errorCode(await core.updateExpenseCategory.handler(input, ctx), code, message);
}

{
  const initial = tables({
    incomes: [
      { id: "80000000-0000-4000-8000-000000000001", user_id: userA, income_category_id: incomeCategoryId, income_date: "2026-07-29T02:30:00.000Z" },
      { id: "80000000-0000-4000-8000-000000000002", user_id: userA, income_category_id: incomeCategoryId, income_date: "2026-08-01T03:00:00.000Z" },
    ],
    recurring_incomes: [
      { id: "81000000-0000-4000-8000-000000000001", user_id: userA, income_category_id: incomeCategoryId, is_active: true },
      { id: "81000000-0000-4000-8000-000000000002", user_id: userA, income_category_id: incomeCategoryId, is_active: false },
    ],
    budget_goals: [
      { id: "82000000-0000-4000-8000-000000000001", user_id: userA, type: "income_category", category: incomeCategoryId },
    ],
  });
  const db = use(initial);
  const result = await core.updateIncomeCategory.handler(
    updateInput(incomeCategoryId, { is_active: false }),
    ctx,
  );
  equal(result.structuredContent.applied, true, "desativa receita");
  equal(result.structuredContent.reference_summary.historical_income_count, 1, "income civil SP histórico");
  equal(result.structuredContent.reference_summary.future_income_count, 1, "income futuro");
  equal(result.structuredContent.reference_summary.active_recurring_income_count, 1, "template ativo");
  equal(result.structuredContent.reference_summary.inactive_recurring_income_count, 1, "template inativo");
  equal(result.structuredContent.reference_summary.active_goal_count, 1, "meta por UUID");
  equal(result.structuredContent.reference_summary.total_reference_count, 5, "total refs income");
  equal(db.tables.incomes, initial.incomes, "receitas intocadas");
  equal(db.tables.recurring_incomes, initial.recurring_incomes, "templates income intocados");
  equal(db.tables.budget_goals, initial.budget_goals, "metas income intocadas");
}
{
  const db = use();
  const result = await core.updateIncomeCategory.handler(
    updateInput(incomeCategoryId, { name: "Consultoria", icon: "🤝" }),
    ctx,
  );
  equal(result.structuredContent.changed_fields, ["name", "icon"], "patch income");
  equal(result.structuredContent.after.name, "Consultoria", "nome income");
  equal(result.structuredContent.after.icon, "🤝", "ícone income");
  equal(result.structuredContent.after.is_active, true, "status preservado");
  equal(db.writes.length, 1, "um update income");
}
{
  const initial = tables();
  initial.user_income_categories[0].is_active = false;
  use(initial);
  const result = await core.updateIncomeCategory.handler(
    updateInput(incomeCategoryId, { is_active: true }),
    ctx,
  );
  check(!result.isError, `reativação de receita: ${JSON.stringify(result)}`);
  equal(result.structuredContent.after.is_active, true, "reativa receita");
  check(result.structuredContent.warnings.includes("CATEGORY_REACTIVATED"), "warning reativação receita");
}
{
  use();
  errorCode(
    await core.updateIncomeCategory.handler(
      updateInput(incomeCategoryId, { icon: "💰" }, { expected_updated_at: "ontem" }),
      ctx,
    ),
    "INVALID_INPUT",
    "timestamp inválido",
  );
}
{
  const initial = tables();
  initial.user_income_categories.push(
    incomeCategory({
      id: "42000000-0000-4000-8000-000000000004",
      name: "Freelance",
    }),
  );
  const db = use(initial);
  const result = await core.updateIncomeCategory.handler(
    updateInput(incomeCategoryId, { name: "Freelance" }),
    ctx,
  );
  equal(result.structuredContent.applied, false, "mesmo nome no-op");
  equal(db.writes.length, 0, "sem escrita no-op income");
}

{
  const initial = tables();
  initial.user_categories.push(
    expenseCategory({
      id: "33000000-0000-4000-8000-000000000003",
      name: "Inativa",
      is_active: false,
      display_order: 4,
    }),
  );
  use(initial);
  const active = await core.listCategories.handler(
    { kind: "expense" },
    ctx,
  );
  equal(active.structuredContent.include_inactive, false, "default de inativas");
  equal(active.structuredContent.categories.length, 1, "lista padrão só ativas");
  check("updated_at" in active.structuredContent.categories[0], "lista expõe updated_at");
  const all = await core.listCategories.handler(
    { kind: "expense", include_inactive: true },
    ctx,
  );
  equal(all.structuredContent.categories.length, 2, "lista inclui inativas");
  equal(all.structuredContent.categories[1].is_active, false, "inativa factual");
  check(all.content[0].text.includes("updated_at"), "content lista autossuficiente");
  check(!JSON.stringify(all).includes(userA), "lista sem user_id");
}

equal(core.createExpenseCategory.annotations.readOnlyHint, false, "create expense write");
equal(core.updateExpenseCategory.annotations.readOnlyHint, false, "update expense write");
equal(core.createIncomeCategory.annotations.readOnlyHint, false, "create income write");
equal(core.updateIncomeCategory.annotations.readOnlyHint, false, "update income write");
equal(core.updateExpenseCategory.annotations.destructiveHint, true, "update expense destrutiva");
equal(core.updateIncomeCategory.annotations.destructiveHint, true, "update income destrutiva");
equal(core.createExpenseCategory.annotations.openWorldHint, false, "mundo fechado");
equal(core.updateIncomeCategory.annotations.openWorldHint, false, "mundo fechado update");

const sourceFiles = [
  "src/lib/mcp/shared/category-write.ts",
  "src/lib/mcp/tools/create-expense-category.ts",
  "src/lib/mcp/tools/update-expense-category.ts",
  "src/lib/mcp/tools/create-income-category.ts",
  "src/lib/mcp/tools/update-income-category.ts",
  "src/lib/mcp/tools/list-categories.ts",
];
for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  check(!source.includes("service_role"), `${file} sem service role`);
  check(!source.includes('from "@/'), `${file} sem alias`);
}
const helperSource = await readFile(
  "src/lib/mcp/shared/category-write.ts",
  "utf8",
);
check(helperSource.includes("supabaseForUser(ctx)"), "usa supabaseForUser");
check(helperSource.includes('.eq("user_id", userId)'), "filtro explícito de propriedade");
check(helperSource.includes('.eq("updated_at", input.expected_updated_at)'), "concorrência atômica");
check(!helperSource.includes(".delete("), "sem exclusão");
check(!helperSource.includes("expense_categories").valueOf(), "sem catálogo global");
for (const forbidden of [
  "shared_group_id",
  "is_shared",
  ".rpc(",
  ".upsert(",
]) {
  check(!helperSource.includes(forbidden), `helper sem ${forbidden}`);
}

const manifest = JSON.parse(
  await readFile(".lovable/mcp/manifest.json", "utf8"),
);
const tools = manifest.mcp.tools;
equal(tools.length, 42, "manifest 42 tools");
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
  18,
  "18 read-only",
);
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint === false).length,
  24,
  "24 write",
);
for (const name of [
  "create_expense_category",
  "update_expense_category",
  "create_income_category",
  "update_income_category",
]) {
  const tool = tools.find((candidate) => candidate.name === name);
  check(tool, `${name} no manifest`);
  equal(tool.annotations.readOnlyHint, false, `${name} write`);
  equal(tool.inputSchema.additionalProperties, false, `${name} input fechado`);
  equal(tool.outputSchema.additionalProperties, false, `${name} output fechado`);
}
const createExpenseCategoryManifest = tools.find(
  (tool) => tool.name === "create_expense_category",
);
check(
  "goal_reference" in
    createExpenseCategoryManifest.outputSchema.properties.category.properties,
  "create expense expõe goal_reference",
);
const updateExpenseCategoryManifest = tools.find(
  (tool) => tool.name === "update_expense_category",
);
check(
  "goal_reference" in
    updateExpenseCategoryManifest.outputSchema.properties.before.properties,
  "update expense expõe goal_reference",
);
const listCategoriesManifest = tools.find(
  (tool) => tool.name === "list_categories",
);
const listCategoryVariants =
  listCategoriesManifest.outputSchema.properties.categories.items.anyOf;
check(
  listCategoryVariants.some(
    (variant) => "goal_reference" in variant.properties,
  ),
  "list_categories expõe goal_reference",
);
for (const name of ["update_expense_category", "update_income_category"]) {
  const tool = tools.find((candidate) => candidate.name === name);
  check(tool.inputSchema.required.includes("expected_updated_at"), `${name} expected obrigatório`);
  equal(tool.inputSchema.properties.changes.additionalProperties, false, `${name} changes fechado`);
  check(!("user_id" in tool.inputSchema.properties), `${name} sem user_id`);
  check(!("user_id" in tool.outputSchema.properties), `${name} output sem user_id`);
}

const migrations = await readdir("supabase/migrations");
equal(
  migrations.filter((name) => name.includes("user_income_categories_updated_at_trigger")).length,
  1,
  "sem migration adicional ao pré-requisito",
);
const bundleSource = await readFile("supabase/functions/mcp/index.ts", "utf8");
check(bundleSource.includes("Deno.serve"), "bundle contém Deno.serve");
check(!bundleSource.includes('from "@/'), "bundle sem alias @/");
check(!bundleSource.includes("npm:@/"), "bundle sem npm:@/");
check(
  !/[A-Za-z]:[\\/](?:Users|home)[\\/]/u.test(bundleSource),
  "bundle sem caminho absoluto",
);
const changedFunctions = execFileSync(
  "git",
  ["diff", "--name-only", "--", "supabase/functions"],
  { encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/u)
  .filter(Boolean);
equal(
  changedFunctions,
  ["supabase/functions/mcp/index.ts"],
  "somente Edge Function MCP gerada",
);
const changedMigrations = execFileSync(
  "git",
  ["status", "--porcelain", "--", "supabase/migrations"],
  { encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/u)
  .filter(Boolean);
equal(changedMigrations, [], "nenhuma migration alterada");

console.log(`Phase MCP 1.2E-A: ${checks} checks passed.`);
