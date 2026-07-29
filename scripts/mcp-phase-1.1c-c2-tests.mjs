import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mock } from "node:test";
import { build } from "esbuild";
import { z } from "zod";

const FIXED_NOW_JULY_28 = new Date("2026-07-29T01:30:00Z");
const FIXED_NOW_JULY_29 = new Date("2026-07-30T01:30:00Z");
mock.timers.enable({ apis: ["Date"], now: FIXED_NOW_JULY_28 });

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
  gte(key, value) { this.op("gte", key, value); if (!this.db.ignoreDateFilters) this.filters.push((r) => r[key] >= value); return this; }
  lte(key, value) { this.op("lte", key, value); if (!this.db.ignoreDateFilters) this.filters.push((r) => r[key] <= value); return this; }
  lt(key, value) { this.op("lt", key, value); if (!this.db.ignoreDateFilters) this.filters.push((r) => r[key] < value); return this; }
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
  constructor(tables, groups = [groupA], ignoreDateFilters = false) {
    this.tables = tables; this.userId = userA;
    this.groups = new Set(groups); this.calls = [];
    this.ignoreDateFilters = ignoreDateFilters;
  }
  from(table) {
    const call = { table, operations: [] };
    this.calls.push(call);
    return new Query(this, table, call);
  }
}
function use(tables, groups = [groupA], ignoreDateFilters = false) {
  const db = new DB(tables, groups, ignoreDateFilters);
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
  mock.timers.setTime(FIXED_NOW_JULY_29.getTime());
  use(tables());
  const r = await core.tool.handler(crossing, ctx);
  equal(r.structuredContent.realized_period.end_date, "2026-07-29", "dia 29: corte realizado");
  equal(
    r.structuredContent.future_projection_period.start_date,
    "2026-07-30",
    "dia 29: futuro começa no dia civil seguinte",
  );
  mock.timers.setTime(FIXED_NOW_JULY_28.getTime());
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
equal(core.preserveSqlDate("2026-07-01"), "2026-07-01", "DATE preserva primeiro dia");
equal(core.preserveSqlDate("2026-08-01"), "2026-08-01", "DATE não desloca mês");
for (const serialized of [
  "2026-07-01",
  "2026-07-01T00:00:00.000Z",
  "2026-07-01T00:00:00+00:00",
  "2026-07-01 00:00:00+00",
]) {
  equal(
    core.preserveSqlDate(serialized),
    "2026-07-01",
    `DATE serializado preserva julho: ${serialized}`,
  );
}
for (const invalid of [
  "2026-02-30",
  "2026-13-01",
  "texto arbitrário",
  "01/08/2026",
  "2026-08-01 qualquer texto",
  {},
]) {
  equal(core.preserveSqlDate(invalid), null, `DATE inválido rejeitado: ${String(invalid)}`);
}
for (const invalid of [
  "2026-02-30",
  "2026-13-01",
  "texto arbitrário",
  "01/08/2026",
]) {
  use(
    tables({
      expenses: [expense({ expense_date: invalid })],
      incomes: [],
      recurring_expenses: [],
      recurring_incomes: [],
    }),
    [groupA],
    true,
  );
  const result = await core.tool.handler(
    { start_date: "2026-07-01", end_date: "2026-07-31" },
    ctx,
  );
  check(
    result.structuredContent.warnings.includes("INVALID_TRANSACTION_DATE"),
    `DATE inválido gera warning: ${invalid}`,
  );
  equal(result.structuredContent.data_complete, false, `DATE inválido torna dados incompletos: ${invalid}`);
}
equal(
  core.timestampToSaoPauloCivilDate("2026-08-01T01:30:00Z"),
  "2026-07-31",
  "TIMESTAMPTZ continua convertido para São Paulo",
);
{
  const boundaryExpenses = [
    expense({ id: id(500), amount: 100, expense_date: "2026-07-01" }),
    ...["2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01"].map(
      (date, index) =>
        expense({ id: id(501 + index), amount: 320.52, expense_date: date }),
    ),
    expense({ id: id(505), amount: 10, expense_date: "2026-12-31" }),
  ];
  use(tables({
    expenses: boundaryExpenses,
    incomes: [
      income({
        id: id(506),
        amount: 50,
        income_date: "2026-08-01T01:30:00Z",
      }),
    ],
    recurring_expenses: [],
    recurring_incomes: [],
  }));
  const r = await core.tool.handler(
    {
      start_date: "2026-07-01",
      end_date: "2026-12-31",
      granularity: "month",
    },
    ctx,
  );
  const x = r.structuredContent;
  const byMonth = new Map(x.series.map((point) => [point.label, point]));
  equal(byMonth.get("2026-07").realized_expenses, 100, "DATE 01/07 permanece em julho");
  for (const month of ["2026-08", "2026-09", "2026-10", "2026-11"]) {
    equal(
      byMonth.get(month).future_materialized_expenses,
      320.52,
      `parcela permanece em ${month}`,
    );
  }
  equal(byMonth.get("2026-07").future_materialized_expenses, 0, "agosto não retrocede para julho");
  equal(byMonth.get("2026-12").future_materialized_expenses, 10, "último dia incluído");
  equal(byMonth.get("2026-07").future_materialized_income, 50, "timestamp UTC vira 31/07 em São Paulo");
  const sum = (field) =>
    Math.round(
      x.series.reduce((total, point) => total + point[field], 0) * 100,
    ) / 100;
  equal(x.realized.income, sum("realized_income"), "invariante realized income");
  equal(x.realized.expenses, sum("realized_expenses"), "invariante realized expenses");
  equal(x.future_materialized.income, sum("future_materialized_income"), "invariante future income");
  equal(x.future_materialized.expenses, sum("future_materialized_expenses"), "invariante future expenses");
  equal(x.recurring_projection.income, sum("recurring_projected_income"), "invariante recurring income");
  equal(x.recurring_projection.expenses, sum("recurring_projected_expenses"), "invariante recurring expenses");
  equal(x.combined_income, x.realized.income + x.future_materialized.income + x.recurring_projection.income, "combined income");
  equal(x.combined_expenses, x.realized.expenses + x.future_materialized.expenses + x.recurring_projection.expenses, "combined expenses");
  equal(x.combined_balance, x.combined_income - x.combined_expenses, "combined balance");
  equal(x.closing_cumulative_balance, x.combined_balance, "fechamento acumulado");
  equal(x.realized.transaction_count, sum("realized_transaction_count"), "contagem realized");
  equal(x.future_materialized.transaction_count, sum("future_materialized_transaction_count"), "contagem future");
  equal(x.recurring_projection.occurrence_count, sum("recurring_occurrence_count"), "contagem recurring");
  equal(
    x.realized.transaction_count +
      x.future_materialized.transaction_count +
      x.recurring_projection.occurrence_count,
    boundaryExpenses.length + 1,
    "nenhuma transação válida perdida ou duplicada entre buckets",
  );
  check(core.cashflowProjectionInvariantsHold({
    realized: x.realized,
    future_materialized: x.future_materialized,
    recurring_projection: x.recurring_projection,
    combined_income: x.combined_income,
    combined_expenses: x.combined_expenses,
    combined_balance: x.combined_balance,
    opening_cumulative_balance: x.opening_cumulative_balance,
    closing_cumulative_balance: x.closing_cumulative_balance,
    series: x.series,
  }), "verificação interna de invariantes");
}
{
  const smokeExpenses = [
    expense({ id: id(520), amount: 100, expense_date: "2026-07-01" }),
    expense({ id: id(521), amount: 120, expense_date: "2026-07-10T00:00:00.000Z" }),
    expense({ id: id(522), amount: 130, expense_date: "2026-07-20T00:00:00+00:00" }),
    expense({ id: id(523), amount: 140.92, expense_date: "2026-07-28 00:00:00+00" }),
    expense({ id: id(524), amount: 320.52, expense_date: "2026-08-01T00:00:00.000Z" }),
    expense({ id: id(525), amount: 320.52, expense_date: "2026-09-01T00:00:00+00:00" }),
    expense({ id: id(526), amount: 320.52, expense_date: "2026-10-01 00:00:00+00" }),
    expense({ id: id(527), amount: 320.52, expense_date: "2026-11-01" }),
  ];
  use(tables({
    expenses: smokeExpenses,
    incomes: [],
    recurring_expenses: [],
    recurring_incomes: [],
  }));
  const result = await core.tool.handler(
    {
      start_date: "2026-07-01",
      end_date: "2026-12-31",
      granularity: "month",
      include_recurring_templates: false,
    },
    ctx,
  );
  const x = result.structuredContent;
  const byMonth = new Map(x.series.map((point) => [point.label, point]));
  equal(x.realized.expenses, 490.92, "smoke: despesas realizadas");
  equal(x.future_materialized.expenses, 1282.08, "smoke: despesas futuras");
  equal(x.future_materialized.expense_count, 4, "smoke: quatro despesas futuras");
  equal(byMonth.get("2026-07").future_materialized_expenses, 0, "smoke: nenhuma parcela futura em julho");
  for (const month of ["2026-08", "2026-09", "2026-10", "2026-11"]) {
    equal(
      byMonth.get(month).future_materialized_expenses,
      320.52,
      `smoke: parcela no mês ${month}`,
    );
  }
  equal(x.data_complete, true, "smoke: dados completos");
  const seriesExpenses = Math.round(
    x.series.reduce(
      (total, point) =>
        total + point.realized_expenses + point.future_materialized_expenses,
      0,
    ) * 100,
  ) / 100;
  equal(
    seriesExpenses,
    x.realized.expenses + x.future_materialized.expenses,
    "smoke: totais iguais à soma da série",
  );
  equal(
    x.combined_balance,
    x.closing_cumulative_balance,
    "smoke: saldo combinado igual ao fechamento",
  );
}
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
equal(tools.length, 36, "manifest com 36 tools");
equal(tools.filter((t) => t.annotations?.readOnlyHint === true).length, 18, "18 read-only");
equal(tools.filter((t) => t.annotations?.readOnlyHint !== true).length, 18, "18 write");
const declared = tools.find((t) => t.name === "get_cashflow_projection");
check(declared?.annotations?.readOnlyHint === true, "tool read-only");
check(declared?.outputSchema?.additionalProperties === false, "schema fechado");
check(!("user_id" in declared.inputSchema.properties), "não aceita user_id");
check(!JSON.stringify(declared.outputSchema).includes("user_id"), "não retorna user_id");
check(!/service_role|SERVICE_ROLE/u.test(source), "sem service_role");
check(bundle.includes('name: "get_cashflow_projection"') &&
  !bundle.includes("@/") && !bundle.includes("npm:@/"), "bundle válido");

mock.timers.reset();
console.log(`Fase MCP 1.1C-C2: ${checks} verificações diretas e de contrato concluídas.`);
