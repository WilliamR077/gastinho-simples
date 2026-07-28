import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { z } from "zod";

const supabaseMockPlugin = {
  name: "phase-1.1c-a3-supabase-mock",
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
      export * from "./src/lib/mcp/shared/recurring.ts";
      export * from "./src/lib/mcp/shared/dates.ts";
      export { default as listTool } from "./src/lib/mcp/tools/list-recurring-transactions.ts";
      export { default as forecastTool } from "./src/lib/mcp/tools/get-recurring-forecast.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.1c-a3-test-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  define: {
    "process.env.MCP_CURSOR_SECRET": JSON.stringify(
      "synthetic-1.1c-a3-secret-0123456789abcdef",
    ),
  },
  plugins: [supabaseMockPlugin],
});
const core = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`,
);

const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const listSource = await readFile(
  "src/lib/mcp/tools/list-recurring-transactions.ts",
  "utf8",
);
const forecastSource = await readFile(
  "src/lib/mcp/tools/get-recurring-forecast.ts",
  "utf8",
);
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
const categoryA = "50000000-0000-4000-8000-000000000005";
const rowId = (number) =>
  `60000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

function contextFor(userId) {
  return {
    isAuthenticated: () => true,
    getUserId: () => userId,
    getToken: () => "synthetic-token",
  };
}
function recurringExpense(overrides = {}) {
  return {
    id: rowId(1),
    user_id: userA,
    description: "Aluguel",
    amount: 100,
    day_of_month: 5,
    start_date: "2024-01-01",
    end_date: null,
    is_active: true,
    category_id: categoryA,
    category_name: "Moradia",
    shared_group_id: null,
    created_at: "2024-01-01T12:00:00Z",
    updated_at: "2024-01-02T12:00:00Z",
    payment_method: "pix",
    card_id: null,
    card_name: null,
    ...overrides,
  };
}
function recurringIncome(overrides = {}) {
  return {
    id: rowId(2),
    user_id: userA,
    description: "Salário",
    amount: 1000,
    day_of_month: 5,
    start_date: "2024-01-01",
    end_date: null,
    is_active: true,
    income_category_id: categoryA,
    category_name: "Salário",
    shared_group_id: null,
    created_at: "2024-01-01T12:00:00Z",
    updated_at: "2024-01-02T12:00:00Z",
    ...overrides,
  };
}

function evaluateOr(row, expression) {
  if (expression.includes(".ilike.")) {
    return expression.split(",").some((clause) => {
      const match = /^([a-z_]+)\.ilike\.%(.*)%$/u.exec(clause);
      return match && String(row[match[1]] ?? "").toLocaleLowerCase("pt-BR")
        .includes(match[2].toLocaleLowerCase("pt-BR"));
    });
  }
  const cursor = /^day_of_month\.gt\.(\d+),and\(day_of_month\.eq\.(\d+),id\.gt\.([^)]+)\)$/u
    .exec(expression);
  if (cursor) {
    const day = Number(cursor[1]);
    return row.day_of_month > day ||
      (row.day_of_month === Number(cursor[2]) && row.id > cursor[3]);
  }
  assert.fail(`Expressão PostgREST não suportada: ${expression}`);
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
  gt(column, value) {
    this.operation("gt", column, value);
    this.filters.push((row) => row[column] > value);
    return this;
  }
  or(expression) {
    this.operation("or", expression);
    this.filters.push((row) => evaluateOr(row, expression));
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
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
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
        const direction = order.ascending ? 1 : -1;
        if (left[order.column] < right[order.column]) return -direction;
        if (left[order.column] > right[order.column]) return direction;
      }
      return 0;
    });
    if (this.rowLimit !== null) rows = rows.slice(0, this.rowLimit);
    if (this.columns) {
      rows = rows.map((row) =>
        Object.fromEntries(this.columns.map((column) => [column, row[column]])));
    }
    return { data: rows, error: null };
  }
}
class RecordingSupabase {
  constructor(tables, userId, accessibleGroups) {
    this.tables = tables;
    this.userId = userId;
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
  const database = new RecordingSupabase(tables, userA, accessibleGroups);
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

const baseExpenses = [
  recurringExpense(),
  recurringExpense({
    id: rowId(3),
    user_id: userB,
    description: "Energia compartilhada",
    day_of_month: 10,
    shared_group_id: groupA,
  }),
  recurringExpense({
    id: rowId(4),
    user_id: userB,
    description: "Template inacessível",
    day_of_month: 11,
    shared_group_id: groupB,
  }),
  recurringExpense({
    id: rowId(5),
    description: "Inativo",
    day_of_month: 12,
    is_active: false,
  }),
];
const baseIncomes = [recurringIncome()];

{
  const database = useDatabase({
    recurring_expenses: baseExpenses,
    recurring_incomes: baseIncomes,
  });
  const response = await core.listTool.handler({}, contextFor(userA));
  equal(response.structuredContent.items.length, 2, "padrão personal ativo inclui dois tipos");
  equal(
    response.structuredContent.items.map((item) => item.transaction_type),
    ["expense", "income"],
    "transaction_type=all e desempate por tipo",
  );
  check(
    response.structuredContent.items.every((item) => item.is_owner),
    "personal retorna somente templates próprios",
  );
  check(
    hasOperation(database.calls[0], "eq", "user_id", userA) &&
      hasOperation(database.calls[1], "eq", "user_id", userA),
    "personal aplica user_id nas duas tabelas",
  );
  check(
    response.content[0].text.includes(
      "templates mensais e não lançamentos financeiros já realizados",
    ) && response.content[0].text.includes("next_cursor="),
    "content de listagem é autossuficiente",
  );
  check(
    z.object(core.listTool.outputSchema).safeParse(response.structuredContent).success,
    "listagem valida no outputSchema real",
  );
}

{
  const database = useDatabase({
    recurring_expenses: baseExpenses,
    recurring_incomes: baseIncomes,
  });
  const shared = await core.listTool.handler(
    { scope: "shared", group_id: groupA },
    contextFor(userA),
  );
  equal(shared.structuredContent.items.length, 1, "shared retorna template de grupo acessível");
  check(!shared.structuredContent.items[0].is_owner, "shared não oculta autoria booleana");
  check(
    database.calls.every((call) =>
      hasOperation(call, "eq", "shared_group_id", groupA)),
    "group_id permanece filtro adicional sob RLS",
  );
  const all = await core.listTool.handler(
    { scope: "all_accessible" },
    contextFor(userA),
  );
  equal(all.structuredContent.items.length, 3, "all_accessible combina pessoal e compartilhado");
  check(
    !all.structuredContent.items.some((item) => item.id === rowId(4)),
    "RLS sintética exclui template de grupo inacessível",
  );
}

for (const transactionType of ["expense", "income"]) {
  const database = useDatabase({
    recurring_expenses: baseExpenses,
    recurring_incomes: baseIncomes,
  });
  const response = await core.listTool.handler(
    { transaction_type: transactionType },
    contextFor(userA),
  );
  check(
    response.structuredContent.items.every(
      (item) => item.transaction_type === transactionType,
    ),
    `filtro ${transactionType}`,
  );
  equal(database.calls.length, 1, `${transactionType} consulta uma tabela`);
}

{
  useDatabase({ recurring_expenses: baseExpenses, recurring_incomes: baseIncomes });
  const inactive = await core.listTool.handler(
    { status: "inactive" },
    contextFor(userA),
  );
  equal(inactive.structuredContent.items.map((item) => item.id), [rowId(5)], "status inativo");
  const queried = await core.listTool.handler(
    { query: "salário" },
    contextFor(userA),
  );
  equal(queried.structuredContent.items.length, 1, "query textual");
  equal(queried.structuredContent.items[0].transaction_type, "income", "query encontra receita");
}

{
  const expenses = Array.from({ length: 5 }, (_, index) =>
    recurringExpense({
      id: rowId(20 + index),
      day_of_month: index < 2 ? 5 : 6 + index,
      description: `Item ${index}`,
    }),
  );
  useDatabase({ recurring_expenses: expenses, recurring_incomes: [recurringIncome({ id: rowId(30) })] });
  const seen = [];
  let cursor;
  for (let page = 0; page < 4; page += 1) {
    const response = await core.listTool.handler(
      { scope: "all_accessible", status: "all", limit: 2, ...(cursor ? { cursor } : {}) },
      contextFor(userA),
    );
    seen.push(...response.structuredContent.items.map((item) => item.id));
    cursor = response.structuredContent.next_cursor;
    if (!cursor) break;
  }
  equal(seen.length, 6, "paginação percorre todos os templates");
  equal(new Set(seen).size, 6, "paginação não repete templates");
}

{
  useDatabase({
    recurring_expenses: baseExpenses,
    recurring_incomes: baseIncomes,
  });
  const first = await core.listTool.handler(
    { scope: "all_accessible", limit: 1 },
    contextFor(userA),
  );
  const changed = await core.listTool.handler(
    { scope: "shared", limit: 1, cursor: first.structuredContent.next_cursor },
    contextFor(userA),
  );
  equal(changed.structuredContent.error.code, "INVALID_CURSOR", "cursor vinculado aos filtros");
}

const forecastTemplates = [
  recurringExpense({ id: rowId(40), description: "Dia 28", day_of_month: 28, amount: 10 }),
  recurringExpense({ id: rowId(41), description: "Dia 29", day_of_month: 29, amount: 20 }),
  recurringExpense({ id: rowId(42), description: "Dia 30", day_of_month: 30, amount: 30 }),
  recurringExpense({ id: rowId(43), description: "Dia 31", day_of_month: 31, amount: 40 }),
  recurringExpense({
    id: rowId(44),
    description: "Fallback",
    day_of_month: 15,
    start_date: null,
    created_at: "2024-02-10T12:00:00Z",
    amount: 5,
  }),
  recurringExpense({
    id: rowId(45),
    description: "Intervalo inválido",
    day_of_month: 10,
    start_date: "2024-04-01",
    end_date: "2024-03-01",
  }),
  recurringExpense({ id: rowId(46), description: "Dia inválido", day_of_month: 32 }),
  recurringExpense({ id: rowId(47), description: "Valor inválido", day_of_month: 20, amount: -50 }),
];

{
  const database = useDatabase({
    recurring_expenses: forecastTemplates,
    recurring_incomes: [recurringIncome({ id: rowId(48), day_of_month: 5 })],
  });
  const response = await core.forecastTool.handler(
    {
      start_date: "2024-02-01",
      end_date: "2024-03-31",
      scope: "all_accessible",
      granularity: "month",
    },
    contextFor(userA),
  );
  equal(response.structuredContent.templates_considered, 9, "templates ativos considerados");
  check(
    response.structuredContent.occurrences.some(
      (item) => item.date === "2024-02-29" && item.description === "Dia 29",
    ),
    "fevereiro bissexto contém dia 29",
  );
  check(
    !response.structuredContent.occurrences.some(
      (item) => item.date === "2024-02-30" || item.date === "2024-02-31",
    ),
    "dias inexistentes não são ajustados",
  );
  check(
    response.structuredContent.warnings.includes("DAY_NOT_PRESENT_IN_MONTH"),
    "dia ausente no mês gera warning",
  );
  check(
    response.structuredContent.warnings.includes("MISSING_START_DATE_USING_CREATED_AT"),
    "fallback de start_date gera warning",
  );
  check(
    response.structuredContent.warnings.includes("END_DATE_BEFORE_START_DATE") &&
      response.structuredContent.warnings.includes("INVALID_DAY_OF_MONTH"),
    "configurações inválidas são sinalizadas",
  );
  check(
    response.structuredContent.occurrences.some(
      (item) =>
        item.description === "Valor inválido" &&
        item.data_warnings.includes("NON_POSITIVE_AMOUNT"),
    ),
    "valor inválido permanece factual na ocorrência",
  );
  check(
    response.structuredContent.projected_expenses === 140 &&
      response.structuredContent.projected_income === 2000 &&
      response.structuredContent.projected_balance === 1860,
    "totais excluem valor negativo sem reinterpretá-lo",
  );
  equal(response.structuredContent.series.length, 2, "granularidade mensal");
  check(
    response.content[0].text.includes(
      "projeção baseada somente nos templates recorrentes",
    ) &&
      response.content[0].text.includes(
        "não inclui lançamentos reais nem parcelas futuras já materializadas",
      ) &&
      response.content[0].text.includes("projected_balance="),
    "content de forecast é autossuficiente",
  );
  check(
    z.object(core.forecastTool.outputSchema)
      .safeParse(response.structuredContent).success,
    "forecast valida no outputSchema real",
  );
  check(
    database.calls.every(
      (call) =>
        call.table === "recurring_expenses" ||
        call.table === "recurring_incomes",
    ),
    "forecast consulta somente tabelas de templates",
  );
}

{
  useDatabase({
    recurring_expenses: [recurringExpense({ day_of_month: 29 })],
    recurring_incomes: [],
  });
  const commonFebruary = await core.forecastTool.handler(
    { start_date: "2023-02-01", end_date: "2023-02-28" },
    contextFor(userA),
  );
  equal(commonFebruary.structuredContent.occurrences.length, 0, "fevereiro comum omite dia 29");
  check(
    commonFebruary.structuredContent.warnings.includes("DAY_NOT_PRESENT_IN_MONTH"),
    "fevereiro comum sinaliza dia ausente",
  );
}

{
  useDatabase({
    recurring_expenses: [recurringExpense({ day_of_month: 31 })],
    recurring_incomes: [recurringIncome({ day_of_month: 1 })],
  });
  const yearTurn = await core.forecastTool.handler(
    { start_date: "2024-12-01", end_date: "2025-01-31" },
    contextFor(userA),
  );
  check(
    yearTurn.structuredContent.occurrences.some((item) => item.date === "2025-01-01"),
    "virada de ano",
  );
}

for (const granularity of ["day", "week", "month"]) {
  useDatabase({
    recurring_expenses: [recurringExpense({ day_of_month: 5 })],
    recurring_incomes: [],
  });
  const response = await core.forecastTool.handler(
    { start_date: "2024-03-01", end_date: "2024-03-31", granularity },
    contextFor(userA),
  );
  equal(
    response.structuredContent.series.length,
    granularity === "day" ? 31 : granularity === "week" ? 5 : 1,
    `granularidade ${granularity}`,
  );
}

{
  useDatabase({
    recurring_expenses: [recurringExpense()],
    recurring_incomes: [],
  });
  const accepted = await core.forecastTool.handler(
    { start_date: "2024-01-01", end_date: "2024-12-31", include_occurrences: false },
    contextFor(userA),
  );
  equal(accepted.structuredContent.effective_period.days, 366, "intervalo de 366 dias aceito");
  equal(accepted.structuredContent.occurrences, [], "include_occurrences=false omite lista");
  check(accepted.structuredContent.projected_expenses > 0, "totais continuam calculados");
  const rejected = await core.forecastTool.handler(
    { start_date: "2024-01-01", end_date: "2025-01-01" },
    contextFor(userA),
  );
  equal(rejected.structuredContent.error.code, "DATE_RANGE_TOO_LARGE", "367 dias rejeitados");
}

{
  const tooMany = Array.from({ length: 101 }, (_, index) =>
    recurringExpense({ id: rowId(100 + index), day_of_month: 1 }),
  );
  useDatabase({ recurring_expenses: tooMany, recurring_incomes: [] });
  const response = await core.forecastTool.handler(
    { start_date: "2024-01-01", end_date: "2024-01-31" },
    contextFor(userA),
  );
  equal(response.structuredContent.error.code, "RESULT_SET_TOO_LARGE", "hard cap de templates");
}

{
  const hundred = Array.from({ length: 100 }, (_, index) =>
    recurringExpense({ id: rowId(300 + index), day_of_month: 1 }),
  );
  useDatabase({ recurring_expenses: hundred, recurring_incomes: [] });
  const response = await core.forecastTool.handler(
    { start_date: "2024-01-01", end_date: "2024-12-31" },
    contextFor(userA),
  );
  equal(response.structuredContent.error.code, "RESULT_SET_TOO_LARGE", "hard cap de ocorrências");
}

equal(
  core.todayIso(new Date("2026-01-01T01:30:00Z")),
  "2025-12-31",
  "America/Sao_Paulo na virada UTC",
);

const tools = manifest.mcp.tools;
equal(tools.length, 19, "manifest contém exatamente 19 tools");
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
  17,
  "manifest contém 17 tools read-only",
);
for (const name of ["list_recurring_transactions", "get_recurring_forecast"]) {
  const tool = tools.find((candidate) => candidate.name === name);
  check(tool, `${name} registrado`);
  check(tool.annotations.readOnlyHint === true, `${name} read-only`);
  check(tool.outputSchema.additionalProperties === false, `${name} output fechado`);
  check(!("user_id" in tool.inputSchema.properties), `${name} não aceita user_id`);
  check(!JSON.stringify(tool.outputSchema).includes("user_id"), `${name} não retorna user_id`);
}
check(
  !/\.from\(["'](?:expenses|incomes)["']\)/u.test(`${listSource}${forecastSource}`),
  "tools não consultam lançamentos reais",
);
check(!/service_role|SERVICE_ROLE/u.test(`${listSource}${forecastSource}`), "sem service_role");
check(!bundleSource.includes("@/") && !bundleSource.includes("npm:@/"), "bundle sem alias @/");
check(
  bundleSource.includes('name: "list_recurring_transactions"') &&
    bundleSource.includes('name: "get_recurring_forecast"'),
  "bundle contém as duas tools",
);

console.log(
  `Fase MCP 1.1C-A3: ${checks} verificações diretas e de contrato concluídas.`,
);
