import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { z } from "zod";

const supabaseMockPlugin = {
  name: "phase-1.1c-c1-supabase-mock",
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
      export * from "./src/lib/mcp/shared/cashflow.ts";
      export { default as cashflowTool } from "./src/lib/mcp/tools/get-cashflow-series.ts";
      export { default as categoryTool } from "./src/lib/mcp/tools/get-category-usage.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.1c-c1-test-entry.ts",
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
const toolSource = await readFile("src/lib/mcp/tools/get-cashflow-series.ts", "utf8");
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
const groupB = "40000000-0000-4000-8000-000000000004";
const id = (number) =>
  `50000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

function contextFor(userId = userA) {
  return {
    isAuthenticated: () => true,
    getUserId: () => userId,
    getToken: () => "synthetic-token",
  };
}
function expense(overrides = {}) {
  return {
    id: id(1),
    user_id: userA,
    amount: 100,
    expense_date: "2026-01-01",
    shared_group_id: null,
    installment_number: null,
    total_installments: null,
    ...overrides,
  };
}
function income(overrides = {}) {
  return {
    id: id(100),
    user_id: userA,
    amount: 500,
    income_date: "2026-01-05T12:00:00Z",
    shared_group_id: null,
    installment_number: null,
    total_installments: null,
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
    this.rowRange = null;
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
  lt(column, value) {
    this.operation("lt", column, value);
    this.filters.push((row) => row[column] < value);
    return this;
  }
  order(column, options = {}) {
    this.operation("order", column, options);
    this.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }
  range(from, to) {
    this.operation("range", from, to);
    this.rowRange = [from, to];
    return this;
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
        if (left[order.column] === right[order.column]) continue;
        return (left[order.column] < right[order.column] ? -1 : 1) *
          (order.ascending ? 1 : -1);
      }
      return 0;
    });
    if (this.rowRange) rows = rows.slice(this.rowRange[0], this.rowRange[1] + 1);
    if (this.columns) {
      rows = rows.map((row) =>
        Object.fromEntries(this.columns.map((column) => [column, row[column]])));
    }
    return { data: rows, error: null };
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

const expenses = [
  expense(),
  expense({ id: id(2), amount: -5, expense_date: "2026-01-15" }),
  expense({
    id: id(3),
    amount: 30,
    expense_date: "2026-01-20",
    installment_number: 1,
    total_installments: 3,
  }),
  expense({ id: id(4), amount: 50, expense_date: "2026-02-02" }),
  expense({ id: id(5), amount: 999, expense_date: "2026-08-01" }),
  expense({
    id: id(6),
    user_id: userB,
    amount: 40,
    expense_date: "2026-01-10",
    shared_group_id: groupA,
  }),
  expense({
    id: id(7),
    user_id: userB,
    amount: 888,
    expense_date: "2026-01-10",
    shared_group_id: groupB,
  }),
];
const incomes = [
  income(),
  income({
    id: id(101),
    amount: 200,
    income_date: "2026-02-01T01:30:00Z",
  }),
  income({
    id: id(102),
    amount: 25,
    income_date: "2026-01-15-bad",
  }),
  income({
    id: id(103),
    amount: 1000,
    income_date: "2026-08-01T12:00:00Z",
  }),
  income({
    id: id(104),
    user_id: userB,
    amount: 100,
    income_date: "2026-01-12T12:00:00Z",
    shared_group_id: groupA,
  }),
];
function baseTables(overrides = {}) {
  return {
    expenses,
    incomes,
    recurring_expenses: [{ id: id(800), user_id: userA }],
    recurring_incomes: [{ id: id(801), user_id: userA }],
    ...overrides,
  };
}
const baseInput = {
  start_date: "2026-01-01",
  end_date: "2026-02-28",
};

{
  const database = useDatabase(baseTables());
  const response = await core.cashflowTool.handler(baseInput, contextFor());
  const result = response.structuredContent;
  equal(result.scope, "personal", "escopo pessoal padrão");
  equal(result.granularity, "month", "granularidade mensal padrão");
  equal(result.total_income, 700, "receitas pessoais realizadas");
  equal(result.total_expenses, 175, "despesas e parcela realizada");
  equal(result.total_balance, 525, "saldo realizado do intervalo");
  equal(result.transaction_count, 6, "data inválida e outros usuários excluídos");
  equal(result.series.length, 2, "série mensal");
  equal(result.series[0].realized_balance, 575, "primeiro mês");
  equal(result.series[0].cumulative_balance, 575, "acumulado inicial");
  equal(result.series[1].realized_balance, -50, "segundo mês");
  equal(result.series[1].cumulative_balance, 525, "acumulado final");
  equal(result.closing_cumulative_balance, 525, "fechamento igual ao total");
  check(result.warnings.includes("NEGATIVE_EXPENSE_VALUE"), "valor negativo preservado");
  check(result.warnings.includes("INVALID_TRANSACTION_DATE"), "data inválida sinalizada");
  equal(result.data_complete, false, "data inválida não é apresentada como cobertura completa");
  check(
    database.calls.every(
      (call) => call.table === "expenses" || call.table === "incomes",
    ),
    "não consulta recorrências, cartões ou metas",
  );
  const expenseCall = database.calls.find((call) => call.table === "expenses");
  check(hasOperation(expenseCall, "eq", "user_id", userA), "personal filtra user_id");
  check(
    z.object(core.cashflowTool.outputSchema).safeParse(result).success,
    "outputSchema real aceita structuredContent",
  );
  check(
    response.content[0].text.includes("opening_cumulative_balance=0") &&
      response.content[0].text.includes("não representa saldo de conta bancária") &&
      response.content[0].text.includes("Pontos detalhados="),
    "content autossuficiente",
  );
}

{
  useDatabase(baseTables());
  const shared = await core.cashflowTool.handler({
    ...baseInput,
    scope: "shared",
  }, contextFor());
  equal(shared.structuredContent.total_income, 100, "shared inclui receita acessível");
  equal(shared.structuredContent.total_expenses, 40, "shared inclui despesa acessível");
  useDatabase(baseTables());
  const all = await core.cashflowTool.handler({
    ...baseInput,
    scope: "all_accessible",
  }, contextFor());
  equal(all.structuredContent.total_income, 800, "all_accessible combina pessoal e grupo");
  equal(all.structuredContent.total_expenses, 215, "RLS exclui grupo inacessível");
  const database = useDatabase(baseTables());
  const grouped = await core.cashflowTool.handler({
    ...baseInput,
    scope: "all_accessible",
    group_id: groupA,
  }, contextFor());
  equal(grouped.structuredContent.total_balance, 60, "group_id restringe grupo");
  check(
    database.calls.every((call) =>
      hasOperation(call, "eq", "shared_group_id", groupA)),
    "group_id aplicado às duas fontes",
  );
}

{
  useDatabase(baseTables({
    expenses: [expense({ expense_date: "2026-01-01" })],
    incomes: [],
  }));
  const withEmpty = await core.cashflowTool.handler({
    start_date: "2026-01-01",
    end_date: "2026-01-03",
    granularity: "day",
  }, contextFor());
  equal(withEmpty.structuredContent.series.length, 3, "day inclui períodos vazios");
  equal(withEmpty.structuredContent.series[1].transaction_count, 0, "dia vazio zerado");
  useDatabase(baseTables({
    expenses: [expense({ expense_date: "2026-01-01" })],
    incomes: [],
  }));
  const withoutEmpty = await core.cashflowTool.handler({
    start_date: "2026-01-01",
    end_date: "2026-01-03",
    granularity: "day",
    include_empty_periods: false,
  }, contextFor());
  equal(withoutEmpty.structuredContent.series.length, 1, "períodos vazios omitidos");
}

{
  useDatabase(baseTables({ expenses: [], incomes: [] }));
  const weekly = await core.cashflowTool.handler({
    start_date: "2026-01-01",
    end_date: "2026-01-20",
    granularity: "week",
  }, contextFor());
  equal(weekly.structuredContent.series[0].period_end, "2026-01-04", "semana segunda-domingo cortada");
  check(weekly.structuredContent.warnings.includes("PARTIAL_FIRST_PERIOD"), "primeira semana parcial");
  check(weekly.structuredContent.warnings.includes("PARTIAL_LAST_PERIOD"), "última semana parcial");
  useDatabase(baseTables({ expenses: [], incomes: [] }));
  const monthly = await core.cashflowTool.handler({
    start_date: "2025-12-15",
    end_date: "2026-02-10",
    granularity: "month",
  }, contextFor());
  equal(
    monthly.structuredContent.series.map((point) => point.label),
    ["2025-12", "2026-01", "2026-02"],
    "virada de mês e ano",
  );
  check(monthly.structuredContent.warnings.includes("PARTIAL_FIRST_PERIOD"), "primeiro mês parcial");
  check(monthly.structuredContent.warnings.includes("PARTIAL_LAST_PERIOD"), "último mês parcial");
}

{
  useDatabase(baseTables({ expenses: [], incomes: [] }));
  const truncated = await core.cashflowTool.handler({
    start_date: "2026-07-01",
    end_date: "2026-08-05",
  }, contextFor());
  equal(truncated.structuredContent.effective_period.end_date, "2026-07-28", "fim cortado em hoje");
  check(
    truncated.structuredContent.warnings.includes("PERIOD_TRUNCATED_TO_TODAY"),
    "warning de truncamento",
  );
  useDatabase(baseTables({ expenses: [], incomes: [] }));
  const future = await core.cashflowTool.handler({
    start_date: "2026-08-01",
    end_date: "2026-08-03",
    granularity: "day",
  }, contextFor());
  equal(future.structuredContent.effective_period, null, "futuro sem cobertura efetiva");
  equal(future.structuredContent.series.length, 3, "futuro retorna série zerada");
  check(
    future.structuredContent.series.every((point) => point.transaction_count === 0),
    "todos os pontos futuros zerados",
  );
  check(
    future.structuredContent.warnings.includes("FUTURE_PERIOD_NO_REALIZED_DATA"),
    "warning de período futuro",
  );
}

equal(
  core.saoPauloCivilDate("2026-02-01T01:30:00Z"),
  "2026-01-31",
  "timestamp próximo da meia-noite normalizado em São Paulo",
);
equal(
  core.zonedMidnightUtc("2026-01-01"),
  "2026-01-01T03:00:00.000Z",
  "meia-noite civil de São Paulo",
);

{
  useDatabase(baseTables({
    expenses: [expense({ amount: -10 })],
    incomes: [income({ amount: -20 })],
  }));
  const response = await core.cashflowTool.handler({
    start_date: "2026-01-01",
    end_date: "2026-01-31",
  }, contextFor());
  equal(response.structuredContent.total_income, -20, "receita negativa preservada");
  equal(response.structuredContent.total_expenses, -10, "despesa negativa preservada");
  check(response.structuredContent.warnings.includes("NEGATIVE_INCOME_VALUE"), "warning de receita negativa");
  check(response.structuredContent.warnings.includes("NEGATIVE_EXPENSE_VALUE"), "warning de despesa negativa");
}

{
  useDatabase(baseTables({ expenses: [], incomes: [] }));
  const accepted = await core.cashflowTool.handler({
    start_date: "2024-01-01",
    end_date: "2024-12-31",
    granularity: "day",
  }, contextFor());
  equal(accepted.structuredContent.series.length, 366, "366 pontos diários");
  useDatabase(baseTables({ expenses: [], incomes: [] }));
  const rejected = await core.cashflowTool.handler({
    start_date: "2023-01-01",
    end_date: "2024-01-02",
  }, contextFor());
  equal(rejected.structuredContent.error.code, "DATE_RANGE_TOO_LARGE", "367 dias rejeitados");
  useDatabase(baseTables({ expenses: [], incomes: [] }));
  const zero = await core.cashflowTool.handler({
    start_date: "2026-01-01",
    end_date: "2026-01-31",
  }, contextFor());
  equal(zero.structuredContent.total_balance, 0, "total zero seguro");
  equal(zero.structuredContent.closing_cumulative_balance, 0, "acumulado zero");
}

{
  const tooMany = Array.from({ length: 10_001 }, (_, index) =>
    expense({ id: id(1000 + index), amount: 1 }),
  );
  useDatabase(baseTables({ expenses: tooMany, incomes: [] }));
  const response = await core.cashflowTool.handler({
    start_date: "2026-01-01",
    end_date: "2026-01-31",
  }, contextFor());
  equal(response.structuredContent.error.code, "RESULT_SET_TOO_LARGE", "hard cap sem parcial");
}

{
  useDatabase(baseTables({ expenses: [], incomes: [] }));
  const response = await core.cashflowTool.handler({
    start_date: "2026-01-01",
    end_date: "2026-02-09",
    granularity: "day",
  }, contextFor());
  check(response.content[0].text.includes("Pontos compactos restantes=["), "mais de 31 pontos resumidos");
  check(response.content[0].text.includes('"period_start":"2026-02-01"'), "restantes identificáveis");
}

{
  const categories = Array.from({ length: 14 }, (_, index) => ({
    id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    user_id: userA,
    name: `Categoria ${String(index + 1).padStart(2, "0")}`,
    icon: "circle",
    color: null,
    is_active: true,
    is_default: false,
  }));
  useDatabase({
    user_categories: categories,
    user_income_categories: [],
    expenses: [],
    incomes: [],
  });
  const response = await core.categoryTool.handler({
    kind: "expense",
    start_date: "2026-01-01",
    end_date: "2026-01-31",
  }, contextFor());
  for (const category of categories) {
    check(response.content[0].text.includes(category.name), `${category.name} presente no content`);
  }
  check(response.content[0].text.includes("detailed_category_count=10"), "dez detalhadas");
  check(response.content[0].text.includes("compact_category_count=4"), "quatro compactas");
  check(response.content[0].text.includes("total_category_count=14"), "total textual");
  check(response.content[0].text.includes("content_categories_omitted=0"), "nenhuma omitida do texto");
}

const tools = manifest.mcp.tools;
equal(tools.length, 22, "manifest contém exatamente 22 tools");
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
  18,
  "manifest contém 18 tools read-only",
);
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint !== true).length,
  4,
  "manifest mantém 4 tools write",
);
const manifestTool = tools.find((tool) => tool.name === "get_cashflow_series");
check(manifestTool, "get_cashflow_series registrada");
check(manifestTool.annotations.readOnlyHint === true, "get_cashflow_series read-only");
check(manifestTool.outputSchema.additionalProperties === false, "outputSchema fechado");
check(!("user_id" in manifestTool.inputSchema.properties), "não aceita user_id");
check(!JSON.stringify(manifestTool.outputSchema).includes("user_id"), "não retorna user_id");
check(
  !/service_role|SERVICE_ROLE/u.test(toolSource),
  "usa contexto do usuário sem service_role",
);
check(
  !/recurring_expenses|recurring_incomes|budget_goals/u.test(toolSource),
  "fontes restritas a expenses e incomes",
);
check(
  bundleSource.includes('name: "get_cashflow_series"') &&
    !bundleSource.includes("@/") &&
    !bundleSource.includes("npm:@/"),
  "bundle contém a tool sem aliases",
);

console.log(
  `Fase MCP 1.1C-C1: ${checks} verificações diretas e de contrato concluídas.`,
);
