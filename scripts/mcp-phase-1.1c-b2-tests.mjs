import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { z } from "zod";

const supabaseMockPlugin = {
  name: "phase-1.1c-b2-supabase-mock",
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
      export * from "./src/lib/mcp/shared/category-usage.ts";
      export { default as usageTool } from "./src/lib/mcp/tools/get-category-usage.ts";
      export { default as progressTool } from "./src/lib/mcp/tools/get-goal-progress.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.1c-b2-test-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [supabaseMockPlugin],
});
const core = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`,
);
const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const usageSource = await readFile("src/lib/mcp/tools/get-category-usage.ts", "utf8");
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

const userA = "10000000-0000-4000-8000-000000000001";
const userB = "20000000-0000-4000-8000-000000000002";
const groupA = "30000000-0000-4000-8000-000000000003";
const catFood = "40000000-0000-4000-8000-000000000004";
const catInactive = "40000000-0000-4000-8000-000000000005";
const catUnused = "40000000-0000-4000-8000-000000000006";
const catDuplicate = "40000000-0000-4000-8000-000000000007";
const catDeleted = "40000000-0000-4000-8000-000000000008";
const incomeOne = "50000000-0000-4000-8000-000000000001";
const incomeTwo = "50000000-0000-4000-8000-000000000002";
const id = (number) =>
  `60000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

function contextFor(userId = userA) {
  return {
    isAuthenticated: () => true,
    getUserId: () => userId,
    getToken: () => "synthetic-token",
  };
}
function category(overrides = {}) {
  return {
    id: catFood,
    user_id: userA,
    name: "Alimentação",
    icon: "utensils",
    color: "#112233",
    is_active: true,
    is_default: true,
    ...overrides,
  };
}
function expense(overrides = {}) {
  return {
    id: id(1),
    user_id: userA,
    amount: 100,
    expense_date: "2026-01-15",
    category_id: catFood,
    category_name: "Alimentação",
    category_icon: "utensils",
    shared_group_id: null,
    ...overrides,
  };
}
function income(overrides = {}) {
  return {
    id: id(100),
    user_id: userA,
    amount: 1000,
    income_date: "2026-01-10",
    income_category_id: incomeOne,
    category_name: "Salário",
    category_icon: "wallet",
    shared_group_id: null,
    ...overrides,
  };
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
  order(column, options = {}) {
    this.operation("order", column, options);
    this.orders.push({ column, ascending: options.ascending !== false });
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
    let rows = (this.database.tables[this.table] ?? []).map((row) => ({ ...row }));
    for (const filter of this.filters) rows = rows.filter(filter);
    rows.sort((left, right) => {
      for (const order of this.orders) {
        if (left[order.column] === right[order.column]) continue;
        return (left[order.column] < right[order.column] ? -1 : 1) *
          (order.ascending ? 1 : -1);
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
  constructor(tables) {
    this.tables = tables;
    this.calls = [];
  }
  from(table) {
    const call = { table, operations: [] };
    this.calls.push(call);
    return new RecordingQuery(this, table, call);
  }
}
function useDatabase(tables) {
  const database = new RecordingSupabase(tables);
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

const expenseCategories = [
  category(),
  category({
    id: catInactive,
    name: "Antiga",
    icon: "archive",
    is_active: false,
    is_default: false,
  }),
  category({
    id: catUnused,
    name: "Sem uso",
    icon: "circle",
    is_default: false,
  }),
  category({
    id: catDuplicate,
    name: "Alimentação",
    icon: "apple",
    is_default: false,
  }),
  category({ id: id(900), user_id: userB, name: "Alheia" }),
];
const expenses = [
  expense(),
  expense({ id: id(2), amount: 50, expense_date: "2026-02-20" }),
  expense({
    id: id(3),
    amount: 20,
    category_id: catInactive,
    category_name: "Antiga",
    category_icon: "archive",
  }),
  expense({
    id: id(4),
    amount: 30,
    expense_date: "2026-02-22",
    category_id: null,
    category_name: null,
    category_icon: null,
  }),
  expense({
    id: id(5),
    amount: 40,
    expense_date: "2026-03-01",
    category_id: catDeleted,
    category_name: "Excluída",
    category_icon: "trash",
  }),
  expense({
    id: id(6),
    amount: 25,
    expense_date: "2026-03-15",
    category_id: catDuplicate,
    category_name: "Alimentação",
    category_icon: "apple",
  }),
  expense({ id: id(7), user_id: userB, amount: 999, shared_group_id: groupA }),
];
const incomeCategories = [
  category({
    id: incomeOne,
    name: "Salário",
    icon: "wallet",
  }),
  category({
    id: incomeTwo,
    name: "Salário",
    icon: "briefcase",
    is_default: false,
  }),
];
const incomes = [
  income(),
  income({
    id: id(101),
    amount: 500,
    income_category_id: incomeTwo,
    category_icon: "briefcase",
  }),
];
function baseTables(overrides = {}) {
  return {
    user_categories: expenseCategories,
    user_income_categories: incomeCategories,
    expenses,
    incomes,
    budget_goals: [],
    recurring_expenses: [],
    recurring_incomes: [],
    ...overrides,
  };
}
const baseInput = {
  kind: "expense",
  start_date: "2026-01-01",
  end_date: "2026-03-31",
};

{
  const database = useDatabase(baseTables());
  const response = await core.usageTool.handler(baseInput, contextFor());
  const result = response.structuredContent;
  equal(result.kind, "expense", "uso de despesas");
  equal(result.total_amount, 265, "total pessoal inclui todas as despesas elegíveis");
  equal(result.total_transaction_count, 6, "contagem exclui outro proprietário");
  equal(result.uncategorized, {
    transaction_count: 1,
    total: 30,
    percentage: 11.32,
  }, "categoria nula separada");
  equal(result.total_category_count, 5, "ativas, inativa, sem uso e snapshot");
  equal(result.returned_category_count, 5, "include_unused/include_inactive padrão");
  equal(result.categories_truncated, false, "sem truncamento");
  equal(result.data_complete, true, "dados completos");
  const food = result.categories.find((item) => item.category_id === catFood);
  equal(food.transaction_count, 2, "contagem da categoria");
  equal(food.total, 150, "total da categoria");
  equal(food.first_used_at, "2026-01-15", "primeiro uso");
  equal(food.last_used_at, "2026-02-20", "último uso");
  equal(food.monthly_average, 50, "média por três meses civis");
  equal(food.monthly_series, [
    { month: "2026-01", total: 100, transaction_count: 1 },
    { month: "2026-02", total: 50, transaction_count: 1 },
    { month: "2026-03", total: 0, transaction_count: 0 },
  ], "série mensal completa");
  check(
    result.categories.some((item) => item.category_id === catInactive),
    "categoria inativa incluída por padrão",
  );
  check(
    result.categories.some((item) => item.category_id === catUnused),
    "categoria não utilizada incluída por padrão",
  );
  const deleted = result.categories.find((item) => item.category_id === catDeleted);
  equal(deleted.name, "Excluída", "categoria inacessível usa snapshot");
  equal(deleted.icon, "trash", "ícone usa snapshot");
  check(result.warnings.includes("CATEGORY_REFERENCE_NOT_ACCESSIBLE"), "warning de referência");
  check(result.warnings.includes("STALE_CATEGORY_SNAPSHOT"), "warning de snapshot");
  check(result.warnings.includes("DUPLICATE_CATEGORY_NAME"), "warning de nomes duplicados");
  check(
    !result.categories.some((item) => item.name === "Alheia"),
    "categoria de outro usuário excluída",
  );
  const categoryCall = database.calls.find((call) => call.table === "user_categories");
  const expenseCall = database.calls.find((call) => call.table === "expenses");
  check(hasOperation(categoryCall, "eq", "user_id", userA), "categorias filtram user_id");
  check(hasOperation(expenseCall, "eq", "user_id", userA), "transações filtram user_id");
  check(
    z.object(core.usageTool.outputSchema).safeParse(result).success,
    "structuredContent valida no outputSchema real",
  );
  check(
    response.content[0].text.includes("2026-01-01 a 2026-03-31") &&
      response.content[0].text.includes("Sem classificação=") &&
      response.content[0].text.includes("monthly_series"),
    "content autossuficiente",
  );
}

{
  useDatabase(baseTables());
  const response = await core.usageTool.handler({
    ...baseInput,
    include_inactive: false,
    include_unused: false,
  }, contextFor());
  const ids = response.structuredContent.categories.map((item) => item.category_id);
  check(!ids.includes(catInactive), "include_inactive=false");
  check(!ids.includes(catUnused), "include_unused=false");
  check(ids.includes(catFood) && ids.includes(catDuplicate), "categorias ativas usadas mantidas");
  equal(response.structuredContent.total_amount, 265, "filtros não alteram total geral");
}

{
  useDatabase(baseTables());
  const response = await core.usageTool.handler({
    kind: "income",
    start_date: "2026-01-01",
    end_date: "2026-01-31",
  }, contextFor());
  equal(response.structuredContent.total_amount, 1500, "uso de receitas");
  equal(response.structuredContent.categories.length, 2, "nomes duplicados não são fundidos");
  equal(
    new Set(response.structuredContent.categories.map((item) => item.category_id)).size,
    2,
    "UUID preserva identidade das receitas",
  );
  check(
    response.structuredContent.warnings.includes("DUPLICATE_CATEGORY_NAME"),
    "warning de receita duplicada",
  );
}

{
  useDatabase(baseTables());
  const response = await core.usageTool.handler({
    ...baseInput,
    limit: 2,
  }, contextFor());
  equal(response.structuredContent.categories.length, 2, "limit restringe categorias");
  equal(response.structuredContent.total_category_count, 5, "contagem total antes do limite");
  equal(response.structuredContent.returned_category_count, 2, "contagem retornada");
  equal(response.structuredContent.categories_truncated, true, "truncamento informado");
  equal(response.structuredContent.total_amount, 265, "total não truncado");
}

{
  useDatabase(baseTables({ expenses: [] }));
  const response = await core.usageTool.handler(baseInput, contextFor());
  equal(response.structuredContent.total_amount, 0, "total zero");
  equal(response.structuredContent.uncategorized.percentage, 0, "percentual zero seguro");
  check(
    response.structuredContent.categories.every(
      (item) => item.percentage === 0 && Number.isFinite(item.monthly_average),
    ),
    "sem NaN ou Infinity",
  );
}

{
  useDatabase(baseTables({ expenses: [] }));
  const accepted = await core.usageTool.handler({
    kind: "expense",
    start_date: "2024-01-01",
    end_date: "2024-12-31",
  }, contextFor());
  equal(accepted.structuredContent.data_complete, true, "intervalo de 366 dias aceito");
  const rejected = await core.usageTool.handler({
    kind: "expense",
    start_date: "2023-01-01",
    end_date: "2024-01-02",
  }, contextFor());
  equal(rejected.structuredContent.error.code, "DATE_RANGE_TOO_LARGE", "367 dias rejeitados");
}

{
  const tooMany = Array.from({ length: 10_001 }, (_, index) =>
    expense({ id: id(1000 + index), amount: 1 }),
  );
  useDatabase(baseTables({ expenses: tooMany }));
  const response = await core.usageTool.handler(baseInput, contextFor());
  equal(response.structuredContent.error.code, "RESULT_SET_TOO_LARGE", "hard cap sem parcial");
}

{
  const goal = {
    id: id(800),
    user_id: userA,
    type: "monthly_total",
    category: null,
    limit_amount: 500,
    shared_group_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
  useDatabase(baseTables({
    budget_goals: [goal],
    expenses: [],
    incomes: [],
    recurring_expenses: [],
    recurring_incomes: [],
  }));
  const response = await core.progressTool.handler({
    goal_id: goal.id,
    reference_month: "2026-07",
    projection_mode: "recurring_templates",
  }, contextFor());
  equal(response.structuredContent.recurring_templates_considered, 0, "B1 considera zero templates");
  check(
    !response.structuredContent.projection_warnings.includes(
      "POTENTIAL_RECURRING_OVERLAP",
    ),
    "B1 não alerta sobreposição sem template participante",
  );
}

const tools = manifest.mcp.tools;
equal(tools.length, 36, "manifest contém exatamente 36 tools");
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
  18,
  "manifest contém 18 tools read-only",
);
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint !== true).length,
  18,
  "manifest mantém 18 tools write",
);
const manifestTool = tools.find((tool) => tool.name === "get_category_usage");
check(manifestTool, "get_category_usage registrada");
check(manifestTool.annotations.readOnlyHint === true, "get_category_usage read-only");
check(manifestTool.outputSchema.additionalProperties === false, "outputSchema fechado");
check(
  !["scope", "group_id", "user_id"].some(
    (name) => name in manifestTool.inputSchema.properties,
  ),
  "input não aceita escopo, grupo ou usuário",
);
check(
  !JSON.stringify(manifestTool.outputSchema).includes("user_id"),
  "output não expõe user_id",
);
check(
  manifestTool.inputSchema.properties.limit.minimum === 1 &&
    manifestTool.inputSchema.properties.limit.maximum === 100,
  "limit entre 1 e 100",
);
check(
  usageSource.includes('.eq("user_id", userId)') &&
    !/service_role|SERVICE_ROLE/u.test(usageSource),
  "isolamento explícito sem service_role",
);
check(
  !/(recomend(?:ação|ar)|aconselh|deveria|julga(?:mento|r))/iu.test(
    usageSource.replace("não recomendações ou julgamentos", ""),
  ),
  "sem aconselhamento financeiro",
);
check(
  bundleSource.includes('name: "get_category_usage"') &&
    !bundleSource.includes("@/") &&
    !bundleSource.includes("npm:@/"),
  "bundle contém a tool sem aliases",
);

console.log(
  `Fase MCP 1.1C-B2: ${checks} verificações diretas e de contrato concluídas.`,
);
