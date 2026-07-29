import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mock } from "node:test";
import { build } from "esbuild";
import { z } from "zod";

const FIXED_NOW_JULY_28 = new Date("2026-07-29T01:30:00Z");
const FIXED_NOW_JULY_29 = new Date("2026-07-30T01:30:00Z");
mock.timers.enable({ apis: ["Date"], now: FIXED_NOW_JULY_28 });

const supabaseMockPlugin = {
  name: "phase-1.1c-b1-supabase-mock",
  setup(builder) {
    builder.onResolve({ filter: /supabase-client$/ }, () => ({
      path: "supabase-client",
      namespace: "mcp-test",
    }));
    builder.onLoad({ filter: /.*/, namespace: "mcp-test" }, () => ({
      contents:
        "export function supabaseForUser() { return globalThis.__MCP_TEST_SUPABASE__; }",
      loader: "js",
    }));
  },
};
const bundled = await build({
  stdin: {
    contents: `
      export * from "./src/lib/mcp/shared/goals.ts";
      export * from "./src/lib/mcp/shared/dates.ts";
      export { default as listTool } from "./src/lib/mcp/tools/list-goals.ts";
      export { default as progressTool } from "./src/lib/mcp/tools/get-goal-progress.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.1c-b1-test-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  define: {
    "process.env.MCP_CURSOR_SECRET": JSON.stringify(
      "synthetic-1.1c-b1-secret-0123456789abcdef",
    ),
  },
  plugins: [supabaseMockPlugin],
});
const core = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`,
);
const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const listSource = await readFile("src/lib/mcp/tools/list-goals.ts", "utf8");
const progressSource = await readFile("src/lib/mcp/tools/get-goal-progress.ts", "utf8");
const bundleSource = await readFile("supabase/functions/mcp/index.ts", "utf8");

let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks += 1;
}
function equal(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  checks += 1;
}

const GOAL_TYPES = [
  "monthly_total",
  "category",
  "income_monthly_total",
  "income_category",
  "balance_target",
];
const userA = "10000000-0000-4000-8000-000000000001";
const userB = "20000000-0000-4000-8000-000000000002";
const groupA = "30000000-0000-4000-8000-000000000003";
const groupB = "40000000-0000-4000-8000-000000000004";
const categoryA = "50000000-0000-4000-8000-000000000005";
const id = (number) =>
  `60000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

function contextFor(userId) {
  return {
    isAuthenticated: () => true,
    getUserId: () => userId,
    getToken: () => "synthetic-token",
  };
}
function goal(overrides = {}) {
  return {
    id: id(1),
    user_id: userA,
    type: "monthly_total",
    category: null,
    limit_amount: 200,
    shared_group_id: null,
    created_at: "2026-01-01T12:00:00Z",
    updated_at: "2026-01-02T12:00:00Z",
    ...overrides,
  };
}
function expense(overrides = {}) {
  return {
    id: id(100),
    user_id: userA,
    amount: 120,
    expense_date: "2026-07-10",
    category: "alimentacao",
    category_id: categoryA,
    category_name: "Alimentação",
    shared_group_id: null,
    ...overrides,
  };
}
function income(overrides = {}) {
  return {
    id: id(200),
    user_id: userA,
    amount: 1000,
    income_date: "2026-07-12",
    category: "salario",
    income_category_id: categoryA,
    category_name: "Salário",
    shared_group_id: null,
    ...overrides,
  };
}
function recurringExpense(overrides = {}) {
  return {
    id: id(300),
    user_id: userA,
    description: "Template de despesa",
    amount: 40,
    day_of_month: 5,
    start_date: "2026-01-01",
    end_date: null,
    is_active: true,
    category: "alimentacao",
    category_id: categoryA,
    category_name: "Alimentação",
    shared_group_id: null,
    created_at: "2026-01-01T12:00:00Z",
    updated_at: "2026-01-02T12:00:00Z",
    payment_method: "pix",
    card_id: null,
    card_name: null,
    ...overrides,
  };
}
function recurringIncome(overrides = {}) {
  return {
    id: id(400),
    user_id: userA,
    description: "Template de receita",
    amount: 200,
    day_of_month: 30,
    start_date: "2026-01-01",
    end_date: null,
    is_active: true,
    category: "salario",
    income_category_id: categoryA,
    category_name: "Salário",
    shared_group_id: null,
    created_at: "2026-01-01T12:00:00Z",
    updated_at: "2026-01-02T12:00:00Z",
    ...overrides,
  };
}

function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"' && value[index - 1] !== "\\") quoted = !quoted;
    if (!quoted && value[index] === "(") depth += 1;
    if (!quoted && value[index] === ")") depth -= 1;
    if (!quoted && depth === 0 && value[index] === ",") {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(value.slice(start));
  return parts;
}
function compareDb(column, left, operator, right) {
  if (operator === "is") return left === right;
  if (operator === "not.is") return left !== right;
  if (column === "type") {
    const comparison = GOAL_TYPES.indexOf(left) - GOAL_TYPES.indexOf(right);
    return operator === "eq" ? comparison === 0 : comparison > 0;
  }
  if (operator === "eq") return left === right;
  return left !== null && left > right;
}
function evaluateOr(row, expression) {
  if (expression.startsWith("and(") && expression.endsWith(")")) {
    return splitTopLevel(expression.slice(4, -1)).every((part) =>
      evaluateOr(row, part));
  }
  const parts = splitTopLevel(expression);
  if (parts.length > 1) return parts.some((part) => evaluateOr(row, part));
  const match = /^([a-z_]+)\.(not\.is|is|eq|gt)\.(.+)$/u.exec(expression);
  assert.ok(match, `Expressão não suportada: ${expression}`);
  const raw = match[3];
  const value =
    raw === "null" ? null :
      raw.startsWith('"') ? JSON.parse(raw) :
        raw;
  return compareDb(match[1], row[match[1]], match[2], value);
}

class RecordingQuery {
  constructor(database, table, call) {
    this.database = database;
    this.table = table;
    this.call = call;
    this.filters = [];
    this.orders = [];
    this.columns = null;
    this.rowLimit = null;
    this.rowRange = null;
    this.single = false;
  }
  operation(method, ...args) {
    this.call.operations.push({ method, args });
  }
  select(columns) {
    this.operation("select", columns);
    this.columns = columns.split(",").map((column) => column.trim());
    return this;
  }
  eq(column, value) {
    this.operation("eq", column, value);
    this.filters.push((row) => row[column] === value);
    return this;
  }
  is(column, value) {
    this.operation("is", column, value);
    this.filters.push((row) => row[column] === value);
    return this;
  }
  not(column, operator, value) {
    this.operation("not", column, operator, value);
    this.filters.push((row) => row[column] !== value);
    return this;
  }
  gte(column, value) {
    this.operation("gte", column, value);
    this.filters.push((row) => row[column] >= value);
    return this;
  }
  lte(column, value) {
    this.operation("lte", column, value);
    this.filters.push((row) => row[column] <= value);
    return this;
  }
  or(expression) {
    this.operation("or", expression);
    this.filters.push((row) => evaluateOr(row, expression));
    return this;
  }
  order(column, options = {}) {
    this.operation("order", column, options);
    this.orders.push({
      column,
      ascending: options.ascending !== false,
      nullsFirst: options.nullsFirst === true,
    });
    return this;
  }
  limit(value) {
    this.operation("limit", value);
    this.rowLimit = value;
    return this;
  }
  range(from, to) {
    this.operation("range", from, to);
    this.rowRange = [from, to];
    return this;
  }
  maybeSingle() {
    this.operation("maybeSingle");
    this.single = true;
    return this.execute();
  }
  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }
  async execute() {
    let rows = (this.database.tables[this.table] ?? [])
      .filter(
        (row) =>
          row.user_id === this.database.userId ||
          (row.shared_group_id !== null &&
            this.database.accessibleGroups.has(row.shared_group_id)),
      )
      .map((row) => ({ ...row }));
    for (const filter of this.filters) rows = rows.filter(filter);
    rows.sort((left, right) => {
      for (const order of this.orders) {
        const a = left[order.column];
        const b = right[order.column];
        if (a === b) continue;
        if (a === null) return order.nullsFirst ? -1 : 1;
        if (b === null) return order.nullsFirst ? 1 : -1;
        const direction = order.ascending ? 1 : -1;
        if (order.column === "type") {
          return (GOAL_TYPES.indexOf(a) - GOAL_TYPES.indexOf(b)) * direction;
        }
        return (a < b ? -1 : 1) * direction;
      }
      return 0;
    });
    if (this.rowRange) rows = rows.slice(this.rowRange[0], this.rowRange[1] + 1);
    if (this.rowLimit !== null) rows = rows.slice(0, this.rowLimit);
    if (this.columns) {
      rows = rows.map((row) =>
        Object.fromEntries(this.columns.map((column) => [column, row[column]])));
    }
    return { data: this.single ? (rows[0] ?? null) : rows, error: null };
  }
}
class RecordingSupabase {
  constructor(tables, accessibleGroups = [groupA]) {
    this.tables = tables;
    this.userId = userA;
    this.accessibleGroups = new Set(accessibleGroups);
    this.calls = [];
  }
  from(table) {
    const call = { table, operations: [] };
    this.calls.push(call);
    return new RecordingQuery(this, table, call);
  }
}
function useDatabase(tables, accessibleGroups = [groupA]) {
  const database = new RecordingSupabase(tables, accessibleGroups);
  globalThis.__MCP_TEST_SUPABASE__ = database;
  return database;
}
function hasOperation(call, method, ...args) {
  return call.operations.some(
    (operation) =>
      operation.method === method &&
      args.every((argument, index) => operation.args[index] === argument),
  );
}

const goals = [
  goal(),
  goal({ id: id(2), type: "category", category: "alimentacao", limit_amount: 100 }),
  goal({ id: id(3), type: "income_monthly_total", limit_amount: 1000 }),
  goal({ id: id(4), type: "income_category", category: categoryA, limit_amount: 500 }),
  goal({ id: id(5), type: "balance_target", limit_amount: 700 }),
  goal({ id: id(6), type: "monthly_total", shared_group_id: groupA }),
  goal({ id: id(7), user_id: userB, type: "monthly_total", shared_group_id: groupA }),
  goal({ id: id(8), user_id: userB, type: "monthly_total", shared_group_id: groupB }),
];

{
  const database = useDatabase({ budget_goals: goals });
  const personal = await core.listTool.handler({}, contextFor(userA));
  check(personal.structuredContent.goals.every((item) => item.is_owner), "listagem pessoal");
  check(hasOperation(database.calls[0], "eq", "user_id", userA), "personal filtra user_id");
  const shared = await core.listTool.handler({ scope: "shared" }, contextFor(userA));
  equal(shared.structuredContent.goals.length, 2, "listagem compartilhada sob RLS");
  const all = await core.listTool.handler({ scope: "all_accessible" }, contextFor(userA));
  equal(all.structuredContent.goals.length, 7, "all_accessible combina escopos");
  check(!all.structuredContent.goals.some((item) => item.id === id(8)), "meta inacessível omitida");
  check(
    personal.content[0].text.includes("metas ou limites mensais") &&
      personal.content[0].text.includes("Não representam contas de investimento"),
    "content da listagem é autossuficiente",
  );
  check(
    z.object(core.listTool.outputSchema).safeParse(personal.structuredContent).success,
    "outputSchema da listagem",
  );
}

{
  useDatabase({ budget_goals: goals });
  const seen = [];
  let cursor;
  for (let guard = 0; guard < 10; guard += 1) {
    const response = await core.listTool.handler(
      { scope: "all_accessible", limit: 2, ...(cursor ? { cursor } : {}) },
      contextFor(userA),
    );
    seen.push(...response.structuredContent.goals.map((item) => item.id));
    cursor = response.structuredContent.next_cursor;
    if (!cursor) break;
  }
  equal(seen.length, 7, "paginação percorre todas as metas");
  equal(new Set(seen).size, 7, "cursor não repete metas");
  useDatabase({ budget_goals: goals });
  const first = await core.listTool.handler(
    { scope: "all_accessible", limit: 2 },
    contextFor(userA),
  );
  const changed = await core.listTool.handler(
    { scope: "shared", limit: 2, cursor: first.structuredContent.next_cursor },
    contextFor(userA),
  );
  equal(changed.structuredContent.error.code, "INVALID_CURSOR", "cursor vinculado aos filtros");
}

const actualExpenses = [
  expense(),
  expense({ id: id(101), amount: 100, expense_date: "2026-07-20", category: "moradia", category_name: "Moradia" }),
  expense({ id: id(102), amount: 999, expense_date: "2026-07-30" }),
  expense({ id: id(103), amount: 30, shared_group_id: groupA }),
  expense({ id: id(104), user_id: userB, amount: 50, shared_group_id: groupA }),
];
const actualIncomes = [
  income(),
  income({ id: id(201), amount: 600, income_category_id: categoryA }),
  income({ id: id(202), user_id: userB, amount: 80, shared_group_id: groupA }),
];
function baseTables(goalRows = goals) {
  return {
    budget_goals: goalRows,
    expenses: actualExpenses,
    incomes: actualIncomes,
    recurring_expenses: [],
    recurring_incomes: [],
  };
}

const expectedByGoal = new Map([
  [id(1), { actual: 220, count: 2, direction: "maximum" }],
  [id(2), { actual: 120, count: 1, direction: "maximum" }],
  [id(3), { actual: 1600, count: 2, direction: "minimum" }],
  [id(4), { actual: 1600, count: 2, direction: "minimum" }],
  [id(5), { actual: 1380, count: 4, direction: "minimum" }],
]);
for (const [goalId, expected] of expectedByGoal) {
  useDatabase(baseTables());
  const response = await core.progressTool.handler(
    { goal_id: goalId, reference_month: "2026-07" },
    contextFor(userA),
  );
  equal(response.structuredContent.actual_value, expected.actual, `${goalId} valor por tipo`);
  equal(response.structuredContent.transaction_count, expected.count, `${goalId} contagem`);
  equal(response.structuredContent.target_direction, expected.direction, `${goalId} direção`);
  check(
    z.object(core.progressTool.outputSchema)
      .safeParse(response.structuredContent).success,
    `${goalId} outputSchema`,
  );
}

{
  useDatabase(baseTables());
  const response = await core.progressTool.handler(
    { goal_id: id(1), reference_month: "2026-07" },
    contextFor(userA),
  );
  equal(response.structuredContent.actual_percentage, 110, "percentual acima de 100%");
  equal(response.structuredContent.actual_remaining, 0, "remaining maximum");
  equal(response.structuredContent.actual_excess, 20, "excess maximum");
  equal(response.structuredContent.elapsed_days, 28, "mês atual até hoje em São Paulo");
  equal(response.structuredContent.remaining_days, 3, "dias restantes atuais");
  check(
    response.content[0].text.includes("Valor realizado=") &&
      response.content[0].text.includes("direção=maximum") &&
      response.content[0].text.includes("dias decorridos="),
    "content de progresso é autossuficiente",
  );
}

{
  mock.timers.setTime(FIXED_NOW_JULY_29.getTime());
  useDatabase(baseTables());
  const response = await core.progressTool.handler(
    { goal_id: id(1), reference_month: "2026-07" },
    contextFor(userA),
  );
  equal(response.structuredContent.elapsed_days, 29, "dia 29: mês atual parcial");
  equal(response.structuredContent.remaining_days, 2, "dia 29: dias restantes");
  equal(
    response.structuredContent.reference_period.effective_period.end_date,
    "2026-07-29",
    "dia 29 preservado em America/Sao_Paulo",
  );
  mock.timers.setTime(FIXED_NOW_JULY_28.getTime());
}

{
  useDatabase(baseTables());
  const past = await core.progressTool.handler(
    { goal_id: id(1), reference_month: "2026-06" },
    contextFor(userA),
  );
  equal(past.structuredContent.elapsed_days, 30, "mês passado completo");
  equal(past.structuredContent.remaining_days, 0, "mês passado sem dias restantes");
  const future = await core.progressTool.handler(
    { goal_id: id(1), reference_month: "2026-08" },
    contextFor(userA),
  );
  equal(future.structuredContent.actual_value, 0, "mês futuro realizado zero");
  equal(future.structuredContent.reference_period.effective_period, null, "mês futuro sem período efetivo");
  check(
    future.structuredContent.warnings.includes("FUTURE_MONTH_NO_ACTUAL_DATA"),
    "warning de mês futuro",
  );
}

for (const target of [0, -100]) {
  const targetGoal = goal({ id: id(20), limit_amount: target });
  useDatabase(baseTables([targetGoal]));
  const response = await core.progressTool.handler(
    { goal_id: targetGoal.id, reference_month: "2026-07" },
    contextFor(userA),
  );
  equal(response.structuredContent.actual_percentage, null, `target ${target} sem percentual`);
  check(
    response.structuredContent.warnings.includes("INVALID_GOAL_CONFIGURATION") &&
      response.structuredContent.warnings.includes("NON_POSITIVE_TARGET"),
    `target ${target} warnings`,
  );
}

{
  const negativeBalance = goal({ id: id(21), type: "balance_target", limit_amount: 500 });
  useDatabase({
    ...baseTables([negativeBalance]),
    expenses: [expense({ amount: 1200 })],
    incomes: [income({ amount: 1000 })],
  });
  const response = await core.progressTool.handler(
    { goal_id: negativeBalance.id, reference_month: "2026-07" },
    contextFor(userA),
  );
  equal(response.structuredContent.actual_value, -200, "balance_target negativo");
  equal(response.structuredContent.actual_remaining, 700, "restante com saldo negativo");
}

{
  const missingCategory = goal({
    id: id(22),
    type: "category",
    category: "categoria-inexistente",
  });
  useDatabase(baseTables([missingCategory]));
  const response = await core.progressTool.handler(
    { goal_id: missingCategory.id, reference_month: "2026-07" },
    contextFor(userA),
  );
  equal(response.structuredContent.actual_value, 0, "categoria sem correspondência");
  check(response.structuredContent.warnings.includes("CATEGORY_NOT_FOUND"), "warning de categoria");
}

{
  const database = useDatabase(baseTables());
  const foreign = await core.progressTool.handler(
    { goal_id: id(8), reference_month: "2026-07" },
    contextFor(userA),
  );
  const missing = await core.progressTool.handler(
    { goal_id: id(99), reference_month: "2026-07" },
    contextFor(userA),
  );
  equal(foreign.structuredContent, missing.structuredContent, "meta alheia e inexistente opacas");
  equal(foreign.structuredContent.error.code, "RESOURCE_NOT_FOUND", "recurso não encontrado");
  check(database.calls.every((call) => call.table === "budget_goals"), "não consulta dados após meta inválida");
}

{
  useDatabase({
    ...baseTables(),
    recurring_expenses: [
      recurringExpense(),
      recurringExpense({ id: id(301), day_of_month: 30, amount: 60 }),
      recurringExpense({ id: id(302), day_of_month: 29, amount: 500, is_active: false }),
    ],
  });
  const response = await core.progressTool.handler(
    {
      goal_id: id(1),
      reference_month: "2026-07",
      projection_mode: "recurring_templates",
    },
    contextFor(userA),
  );
  equal(response.structuredContent.actual_value, 220, "realizado permanece separado");
  equal(response.structuredContent.recurring_projected_value, 60, "somente recorrência futura ativa");
  equal(response.structuredContent.projected_value, 280, "projeção soma campo separado");
  equal(response.structuredContent.recurring_templates_considered, 2, "template inativo ignorado");
  check(
    response.structuredContent.projection_warnings.includes("POTENTIAL_RECURRING_OVERLAP"),
    "warning de sobreposição",
  );
  check(
    response.content[0].text.includes("Projeção recorrente separada") &&
      response.content[0].text.includes("pode contar um compromisso já lançado manualmente"),
    "content explica projeção separada",
  );
}

{
  useDatabase({
    ...baseTables(),
    recurring_expenses: [recurringExpense({ day_of_month: 30, amount: 60 })],
    recurring_incomes: [recurringIncome()],
  });
  const response = await core.progressTool.handler(
    {
      goal_id: id(5),
      reference_month: "2026-07",
      projection_mode: "recurring_templates",
    },
    contextFor(userA),
  );
  equal(response.structuredContent.recurring_projected_value, 140, "balance projection receita menos despesa");
  equal(response.structuredContent.projected_value, 1520, "balance projected_value");
}

{
  const sharedGoal = goal({ id: id(30), shared_group_id: groupA, limit_amount: 200 });
  const database = useDatabase(baseTables([sharedGoal]));
  const response = await core.progressTool.handler(
    { goal_id: sharedGoal.id, reference_month: "2026-07" },
    contextFor(userA),
  );
  equal(response.structuredContent.actual_value, 80, "meta compartilhada inclui membros sob RLS");
  const expenseCalls = database.calls.filter((call) => call.table === "expenses");
  check(
    expenseCalls.every((call) => hasOperation(call, "eq", "shared_group_id", groupA)),
    "escopo real da meta compartilhada",
  );
}

{
  const tooMany = Array.from({ length: 10_001 }, (_, index) =>
    expense({ id: id(1000 + index), amount: 1 }),
  );
  useDatabase({
    ...baseTables([goal()]),
    expenses: tooMany,
    incomes: [],
  });
  const response = await core.progressTool.handler(
    { goal_id: id(1), reference_month: "2026-07" },
    contextFor(userA),
  );
  equal(response.structuredContent.error.code, "RESULT_SET_TOO_LARGE", "hard cap de transações");
}

{
  const templates = Array.from({ length: 101 }, (_, index) =>
    recurringExpense({ id: id(12000 + index), day_of_month: 30 }),
  );
  useDatabase({
    ...baseTables([goal()]),
    recurring_expenses: templates,
  });
  const response = await core.progressTool.handler(
    {
      goal_id: id(1),
      reference_month: "2026-07",
      projection_mode: "recurring_templates",
    },
    contextFor(userA),
  );
  equal(response.structuredContent.error.code, "RESULT_SET_TOO_LARGE", "hard cap de templates");
}

{
  useDatabase(baseTables([goal()]));
  const response = await core.progressTool.handler(
    {
      goal_id: id(1),
      reference_month: "2026-07",
      projection_mode: "recurring_templates",
    },
    contextFor(userA),
  );
  equal(response.structuredContent.recurring_templates_considered, 0, "zero templates considerados");
  check(
    !response.structuredContent.projection_warnings.includes(
      "POTENTIAL_RECURRING_OVERLAP",
    ),
    "sem warning de sobreposição quando nenhum template participa",
  );
}

equal(
  core.todayIso(new Date("2026-01-01T01:30:00Z")),
  "2025-12-31",
  "America/Sao_Paulo",
);

const tools = manifest.mcp.tools;
equal(tools.length, 40, "manifest contém exatamente 40 tools");
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
  18,
  "manifest contém 18 tools read-only",
);
for (const name of ["list_goals", "get_goal_progress"]) {
  const tool = tools.find((candidate) => candidate.name === name);
  check(tool, `${name} registrado`);
  check(tool.annotations.readOnlyHint === true, `${name} read-only`);
  check(tool.outputSchema.additionalProperties === false, `${name} output fechado`);
  check(!("user_id" in tool.inputSchema.properties), `${name} não aceita user_id`);
  check(!JSON.stringify(tool.outputSchema).includes("user_id"), `${name} não retorna user_id`);
}
check(!/service_role|SERVICE_ROLE/u.test(`${listSource}${progressSource}`), "sem service_role");
check(
  !/(recomend[oa]|aconselh|rendimento|previsão de conclusão)/iu.test(progressSource),
  "sem aconselhamento ou promessa financeira",
);
check(!bundleSource.includes("@/") && !bundleSource.includes("npm:@/"), "bundle sem aliases");
check(
  bundleSource.includes('name: "list_goals"') &&
    bundleSource.includes('name: "get_goal_progress"'),
  "bundle contém as tools",
);

mock.timers.reset();
console.log(
  `Fase MCP 1.1C-B1: ${checks} verificações diretas e de contrato concluídas.`,
);
