import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { z } from "zod";

const mockPlugin = {
  name: "c2-supabase-mock",
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
      export * from "./src/lib/mcp/shared/cashflow-projection.ts";
      export * from "./src/lib/mcp/shared/cashflow.ts";
      export { default as tool } from "./src/lib/mcp/tools/get-cashflow-projection.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "c2-entry.ts",
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
const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const source = await readFile("src/lib/mcp/tools/get-cashflow-projection.ts", "utf8");
const bundle = await readFile("supabase/functions/mcp/index.ts", "utf8");
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
const id = (n) => `50000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ctx = {
  isAuthenticated: () => true,
  getUserId: () => userA,
  getToken: () => "synthetic",
};
const expense = (overrides = {}) => ({
  id: id(1),
  user_id: userA,
  amount: 100,
  expense_date: "2026-07-10",
  shared_group_id: null,
  installment_number: null,
  total_installments: null,
  ...overrides,
});
const income = (overrides = {}) => ({
  id: id(100),
  user_id: userA,
  amount: 300,
  income_date: "2026-07-20T12:00:00Z",
  shared_group_id: null,
  ...overrides,
});
const recurringExpense = (overrides = {}) => ({
  id: id(200),
  user_id: userA,
  description: "Aluguel",
  amount: 200,
  day_of_month: 5,
  start_date: "2026-01-01",
  end_date: null,
  is_active: true,
  category_id: null,
  category_name: "Moradia",
  shared_group_id: null,
  created_at: "2026-01-01T12:00:00Z",
  updated_at: "2026-01-01T12:00:00Z",
  payment_method: "pix",
  card_id: null,
  card_name: null,
  ...overrides,
});
const recurringIncome = (overrides = {}) => ({
  id: id(300),
  user_id: userA,
  description: "Salário",
  amount: 1000,
  day_of_month: 10,
  start_date: "2026-01-01",
  end_date: null,
  is_active: true,
  income_category_id: null,
  category_name: "Salário",
  shared_group_id: null,
  created_at: "2026-01-01T12:00:00Z",
  updated_at: "2026-01-01T12:00:00Z",
  ...overrides,
});

class Query {
  constructor(db, table, call) {
    this.db = db; this.table = table; this.call = call;
    this.filters = []; this.orders = []; this.columns = null;
    this.rowRange = null; this.rowLimit = null;
  }
  op(method, ...args) { this.call.operations.push({ method, args }); }
  select(value) { this.op("select", value); this.columns = value.split(",").map((v) => v.trim()); return this; }
  eq(key, value) { this.op("eq", key, value); this.filters.push((r) => r[key] === value); return this; }
  not(key, op, value) { this.op("not", key, op, value); this.filters.push((r) => r[key] !== value); return this; }
  gte(key, value) { this.op("gte", key, value); this.filters.push((r) => r[key] >= value); return this; }
  lte(key, value) { this.op("lte", key, value); this.filters.push((r) => r[key] <= value); return this; }
  lt(key, value) { this.op("lt", key, value); this.filters.push((r) => r[key] < value); return this; }
  order(key, options = {}) { this.op("order", key, options); this.orders.push({ key, asc: options.ascending !== false }); return this; }
  range(from, to) { this.op("range", from, to); this.rowRange = [from, to]; return this; }
  limit(value) { this.op("limit", value); this.rowLimit = value; return this; }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
  async execute() {
    let rows = (this.db.tables[this.table] ?? [])
      .filter((r) => r.user_id === this.db.userId ||
        (r.shared_group_id !== null && this.db.groups.has(r.shared_group_id)))
      .map((r) => ({ ...r }));
    for (const filter of this.filters) rows = rows.filter(filter);
    rows.sort((a, b) => {
      for (const order of this.orders) {
        if (a[order.key] === b[order.key]) continue;
        return (a[order.key] < b[order.key] ? -1 : 1) * (order.asc ? 1 : -1);
      }
      return 0;
    });
    if (this.rowRange) rows = rows.slice(this.rowRange[0], this.rowRange[1] + 1);
    if (this.rowLimit !== null) rows = rows.slice(0, this.rowLimit);
    if (this.columns) rows = rows.map((r) =>
      Object.fromEntries(this.columns.map((key) => [key, r[key]])));
    return { data: rows, error: null };
  }
}
class DB {
  constructor(tables, groups = [groupA]) {
    this.tables = tables; this.userId = userA;
    this.groups = new Set(groups); this.calls = [];
  }
  from(table) {
    const call = { table, operations: [] };
    this.calls.push(call);
    return new Query(this, table, call);
  }
}
function use(tables, groups = [groupA]) {
  const db = new DB(tables, groups);
  globalThis.__MCP_TEST_SUPABASE__ = db;
  return db;
}
function called(call, method, ...args) {
  return call.operations.some((op) => op.method === method &&
    args.every((arg, i) => op.args[i] === arg));
}

const expenses = [
  expense(),
  expense({ id: id(2), amount: 200, expense_date: "2026-08-05", installment_number: 2, total_installments: 3 }),
  expense({ id: id(3), user_id: userB, amount: 50, expense_date: "2026-07-15", shared_group_id: groupA }),
  expense({ id: id(4), user_id: userB, amount: 80, expense_date: "2026-08-06", shared_group_id: groupA }),
  expense({ id: id(5), user_id: userB, amount: 999, expense_date: "2026-08-06", shared_group_id: groupB }),
];
const incomes = [
  income(),
  income({ id: id(101), amount: 500, income_date: "2026-08-07T12:00:00Z" }),
  income({ id: id(102), amount: 50, income_date: "2026-08-01T01:30:00Z" }),
  income({ id: id(103), user_id: userB, amount: 100, income_date: "2026-08-08T12:00:00Z", shared_group_id: groupA }),
];
const recurringExpenses = [
  recurringExpense(),
  recurringExpense({ id: id(201), amount: 40, day_of_month: 15, start_date: null, created_at: "2026-07-01T12:00:00Z" }),
  recurringExpense({ id: id(202), amount: 0, day_of_month: 20 }),
  recurringExpense({ id: id(203), amount: 30, day_of_month: 32 }),
];
const recurringIncomes = [recurringIncome()];
const tables = (overrides = {}) => ({
  expenses,
  incomes,
  recurring_expenses: recurringExpenses,
  recurring_incomes: recurringIncomes,
  ...overrides,
});
const crossing = { start_date: "2026-07-01", end_date: "2026-08-31" };

{
  const db = use(tables());
  const r = await core.tool.handler(crossing, ctx);
  const x = r.structuredContent;
  equal(x.scope, "personal", "personal padrão");
  equal(x.realized_period.end_date, "2026-07-28", "parte realizada");
  equal(x.future_projection_period.start_date, "2026-07-29", "parte futura");
  equal(x.realized, { income: 300, expenses: 100, balance: 200, income_count: 1, expense_count: 1, transaction_count: 2 }, "realizado separado");
  equal(x.future_materialized.income, 550, "receita futura materializada e timezone");
  equal(x.future_materialized.expenses, 200, "parcela futura materializada");
  equal(x.recurring_projection.income, 1000, "template de receita");
  equal(x.recurring_projection.expenses, 240, "templates de despesa válidos");
  equal(x.recurring_projection.occurrence_count, 3, "ocorrências válidas");
  equal(x.recurring_projection.templates_considered, 5, "templates ativos considerados");
  equal(x.combined_income, 1850, "income combinado");
  equal(x.combined_expenses, 540, "expense combinado sem deduplicação");
  equal(x.combined_balance, 1310, "balance combinado");
  equal(x.closing_cumulative_balance, 1310, "acumulado combinado");
  check(x.warnings.includes("POTENTIAL_RECURRING_OVERLAP"), "warning de overlap");
  check(x.warnings.includes("RECURRING_START_DATE_FALLBACK"), "fallback de início");
  check(x.warnings.includes("INVALID_RECURRING_TEMPLATE"), "template inválido");
  check(x.series.some((p) => p.future_materialized_expenses === 200 &&
    p.recurring_projected_expenses >= 200), "componentes coexistem sem deduplicação");
  check(db.calls.some((c) => c.table === "recurring_expenses"), "consulta templates");
  check(z.object(core.tool.outputSchema).safeParse(x).success, "outputSchema real");
  check(r.content[0].text.includes("não existe vínculo para deduplicação segura") &&
    r.content[0].text.includes("não uma previsão garantida") &&
    r.content[0].text.includes("não representa saldo anterior"), "content autossuficiente");
}

{
  use(tables());
  const past = await core.tool.handler({ start_date: "2026-01-01", end_date: "2026-01-31" }, ctx);
  equal(past.structuredContent.future_projection_period, null, "passado sem futuro");
  equal(past.structuredContent.future_materialized.transaction_count, 0, "futuro zerado");
  check(past.structuredContent.warnings.includes("PAST_PERIOD_NO_FUTURE_PROJECTION"), "warning passado");
  use(tables());
  const future = await core.tool.handler({ start_date: "2026-08-01", end_date: "2026-08-31" }, ctx);
  equal(future.structuredContent.realized_period, null, "futuro sem realizado");
  equal(future.structuredContent.realized.transaction_count, 0, "realizado zerado");
  check(future.structuredContent.warnings.includes("FUTURE_PERIOD_NO_REALIZED_DATA"), "warning futuro");
}

{
  use(tables());
  const shared = await core.tool.handler({ ...crossing, scope: "shared", include_recurring_templates: false }, ctx);
  equal(shared.structuredContent.realized.expenses, 50, "shared realizado sob RLS");
  equal(shared.structuredContent.future_materialized.balance, 20, "shared futuro sob RLS");
  use(tables());
  const all = await core.tool.handler({ ...crossing, scope: "all_accessible", include_recurring_templates: false }, ctx);
  equal(all.structuredContent.combined_expenses, 430, "all_accessible sem grupo inacessível");
  const db = use(tables());
  const group = await core.tool.handler({ ...crossing, scope: "all_accessible", group_id: groupA, include_recurring_templates: false }, ctx);
  equal(group.structuredContent.combined_balance, -30, "group_id");
  check(db.calls.every((c) => called(c, "eq", "shared_group_id", groupA)), "group_id em todas as fontes consultadas");
}

for (const [flag, expected] of [
  ["include_realized", "realized"],
  ["include_future_materialized", "future_materialized"],
  ["include_recurring_templates", "recurring_projection"],
]) {
  use(tables());
  const r = await core.tool.handler({ ...crossing, [flag]: false }, ctx);
  equal(r.structuredContent[expected].transaction_count, 0, `${flag}=false`);
}

{
  use(tables({ expenses: [expense()], incomes: [], recurring_expenses: [], recurring_incomes: [] }));
  const day = await core.tool.handler({ start_date: "2026-07-10", end_date: "2026-07-12", granularity: "day" }, ctx);
  equal(day.structuredContent.series.length, 3, "day com vazios");
  use(tables({ expenses: [expense()], incomes: [], recurring_expenses: [], recurring_incomes: [] }));
  const noEmpty = await core.tool.handler({ start_date: "2026-07-10", end_date: "2026-07-12", granularity: "day", include_empty_periods: false }, ctx);
  equal(noEmpty.structuredContent.series.length, 1, "vazios omitidos");
  use(tables({ expenses: [], incomes: [], recurring_expenses: [], recurring_incomes: [] }));
  const week = await core.tool.handler({ start_date: "2026-01-01", end_date: "2026-01-20", granularity: "week" }, ctx);
  equal(week.structuredContent.series[0].period_end, "2026-01-04", "week segunda-domingo");
  check(week.structuredContent.warnings.includes("PARTIAL_FIRST_PERIOD") &&
    week.structuredContent.warnings.includes("PARTIAL_LAST_PERIOD"), "semanas parciais");
  use(tables({ expenses: [], incomes: [], recurring_expenses: [], recurring_incomes: [] }));
  const month = await core.tool.handler({ start_date: "2025-12-15", end_date: "2026-02-10", granularity: "month" }, ctx);
  equal(month.structuredContent.series.map((p) => p.label), ["2025-12", "2026-01", "2026-02"], "virada mês/ano");
}

equal(core.saoPauloCivilDate("2026-08-01T01:30:00Z"), "2026-07-31", "America/Sao_Paulo");
{
  use(tables({
    expenses: [expense({ amount: -10 }), expense({ id: id(90), amount: 5, expense_date: "2026-07-xx" })],
    incomes: [
      income({ amount: -20 }),
      income({ id: id(91), amount: 5, income_date: "2026-07-15-bad" }),
    ],
    recurring_expenses: [],
    recurring_incomes: [],
  }));
  const r = await core.tool.handler({ start_date: "2026-07-01", end_date: "2026-07-31" }, ctx);
  check(r.structuredContent.warnings.includes("NEGATIVE_EXPENSE_VALUE"), "negative expense");
  check(r.structuredContent.warnings.includes("NEGATIVE_INCOME_VALUE"), "negative income");
  check(r.structuredContent.warnings.includes("INVALID_TRANSACTION_DATE"), "invalid date");
  equal(r.structuredContent.data_complete, false, "invalid date não completa");
}

{
  const leapTemplate = recurringExpense({ day_of_month: 29, start_date: "2020-01-01" });
  use(tables({ expenses: [], incomes: [], recurring_expenses: [leapTemplate], recurring_incomes: [] }));
  const leap = await core.tool.handler({ start_date: "2028-02-01", end_date: "2028-02-29" }, ctx);
  equal(leap.structuredContent.recurring_projection.occurrence_count, 1, "fevereiro bissexto");
  const unavailable = recurringExpense({ day_of_month: 30, start_date: "2020-01-01" });
  use(tables({ expenses: [], incomes: [], recurring_expenses: [unavailable], recurring_incomes: [] }));
  const r = await core.tool.handler({ start_date: "2027-02-01", end_date: "2027-02-28" }, ctx);
  equal(r.structuredContent.recurring_projection.occurrence_count, 0, "dia inexistente não ocorre");
  check(r.structuredContent.warnings.includes("RECURRING_DAY_NOT_AVAILABLE"), "warning dia indisponível");
}

{
  use(tables({ expenses: [], incomes: [], recurring_expenses: [], recurring_incomes: [] }));
  const accepted = await core.tool.handler({ start_date: "2026-01-01", end_date: "2027-01-01", granularity: "day" }, ctx);
  equal(accepted.structuredContent.series.length, 366, "366 dias");
  use(tables());
  const rejected = await core.tool.handler({ start_date: "2026-01-01", end_date: "2027-01-02" }, ctx);
  equal(rejected.structuredContent.error.code, "DATE_RANGE_TOO_LARGE", "367 dias rejeitados");
}

for (const table of ["expenses", "incomes"]) {
  const rows = Array.from({ length: 10_001 }, (_, i) =>
    table === "expenses"
      ? expense({ id: id(1000 + i), expense_date: "2026-07-10" })
      : income({ id: id(12000 + i), income_date: "2026-07-10T12:00:00Z" }));
  use(tables({ [table]: rows, recurring_expenses: [], recurring_incomes: [] }));
  const r = await core.tool.handler({ start_date: "2026-07-01", end_date: "2026-07-31" }, ctx);
  equal(r.structuredContent.error.code, "RESULT_SET_TOO_LARGE", `hard cap ${table}`);
}
{
  const templates = Array.from({ length: 101 }, (_, i) => recurringExpense({ id: id(30000 + i) }));
  use(tables({ expenses: [], incomes: [], recurring_expenses: templates, recurring_incomes: [] }));
  const r = await core.tool.handler({ start_date: "2026-08-01", end_date: "2026-08-31" }, ctx);
  equal(r.structuredContent.error.code, "RESULT_SET_TOO_LARGE", "hard cap templates");
}
{
  const templates = Array.from({ length: 100 }, (_, i) =>
    recurringExpense({ id: id(40000 + i), day_of_month: (i % 28) + 1, start_date: "2020-01-01" }));
  use(tables({ expenses: [], incomes: [], recurring_expenses: templates, recurring_incomes: [] }));
  const r = await core.tool.handler({ start_date: "2026-07-29", end_date: "2027-07-28" }, ctx);
  equal(r.structuredContent.error.code, "RESULT_SET_TOO_LARGE", "hard cap ocorrências");
}
{
  use(tables({ expenses: [], incomes: [], recurring_expenses: [], recurring_incomes: [] }));
  const r = await core.tool.handler({ start_date: "2026-01-01", end_date: "2026-01-30", granularity: "day" }, ctx);
  check(r.content[0].text.includes("Pontos compactos restantes=["), "mais de 24 pontos compactos");
  check(r.content[0].text.includes('"period_start":"2026-01-25"'), "nenhum período omitido silenciosamente");
}

const tools = manifest.mcp.tools;
equal(tools.length, 20, "manifest com 20 tools");
equal(tools.filter((t) => t.annotations?.readOnlyHint === true).length, 18, "18 read-only");
equal(tools.filter((t) => t.annotations?.readOnlyHint !== true).length, 2, "2 write");
const declared = tools.find((t) => t.name === "get_cashflow_projection");
check(declared?.annotations?.readOnlyHint === true, "tool read-only");
check(declared?.outputSchema?.additionalProperties === false, "schema fechado");
check(!("user_id" in declared.inputSchema.properties), "não aceita user_id");
check(!JSON.stringify(declared.outputSchema).includes("user_id"), "não retorna user_id");
check(!/service_role|SERVICE_ROLE/u.test(source), "sem service_role");
check(bundle.includes('name: "get_cashflow_projection"') &&
  !bundle.includes("@/") && !bundle.includes("npm:@/"), "bundle válido");

console.log(`Fase MCP 1.1C-C2: ${checks} verificações diretas e de contrato concluídas.`);
