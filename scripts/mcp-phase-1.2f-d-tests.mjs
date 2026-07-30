import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mock } from "node:test";
import { build } from "esbuild";

mock.timers.enable({
  apis: ["Date"],
  now: new Date("2026-07-30T12:00:00-03:00"),
});

const plugin = {
  name: "phase-1.2f-d-supabase",
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
      export { default as tool } from "./src/lib/mcp/tools/get-installment-series.ts";
      export * from "./src/lib/mcp/shared/installment-series-read.ts";
      export { expenseItem, incomeItem } from "./src/lib/mcp/shared/transaction-query.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2f-d-entry.ts",
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

const userId = "10000000-0000-4000-8000-000000000001";
const otherUserId = "20000000-0000-4000-8000-000000000002";
const expenseGroup = "30000000-0000-4000-8000-000000000003";
const incomeGroup = "40000000-0000-4000-8000-000000000004";
const sharedGroup = "50000000-0000-4000-8000-000000000005";
const cardId = "60000000-0000-4000-8000-000000000006";
const categoryId = "70000000-0000-4000-8000-000000000007";
const incomeCategoryId = "80000000-0000-4000-8000-000000000008";
const rowId = (number) =>
  `90000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

const expenseRow = (number, total = 3, overrides = {}) => ({
  id: rowId(number),
  user_id: userId,
  description: `Notebook (${number}/${total})`,
  amount: "33.33",
  expense_date: `2026-${String(number).padStart(2, "0")}-15`,
  category_id: categoryId,
  category_name: "Compras",
  category_icon: "🛍️",
  payment_method: "credit",
  card_id: cardId,
  card_name: "Principal",
  installment_group_id: expenseGroup,
  installment_number: number,
  total_installments: total,
  shared_group_id: sharedGroup,
  created_at: "2026-01-15T12:00:00.000Z",
  updated_at: `2026-07-${String(number).padStart(2, "0")}T12:00:00.000Z`,
  ...overrides,
});
const incomeRow = (number, total = 3, overrides = {}) => ({
  id: rowId(number + 100),
  user_id: userId,
  description: `Contrato (${number}/${total})`,
  amount: "10.00",
  income_date: `2026-${String(number).padStart(2, "0")}-20`,
  income_category_id: incomeCategoryId,
  category_name: "Freelance",
  category_icon: "💼",
  installment_group_id: incomeGroup,
  installment_number: number,
  total_installments: total,
  shared_group_id: null,
  created_at: "2026-01-20T12:00:00.000Z",
  updated_at: `2026-07-${String(number).padStart(2, "0")}T13:00:00.000Z`,
  ...overrides,
});

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.columns = null;
    this.max = Infinity;
  }
  select(columns) {
    this.columns = columns.split(",").map((column) => column.trim());
    this.db.calls.push({ table: this.table, method: "select", columns });
    return this;
  }
  eq(column, value) {
    this.filters.push({ column, value });
    return this;
  }
  order(column, options) {
    this.db.calls.push({ table: this.table, method: "order", column, options });
    return this;
  }
  limit(value) {
    this.max = value;
    this.db.calls.push({ table: this.table, method: "limit", value });
    return this;
  }
  rows() {
    if (this.db.failTable === this.table) {
      return { data: null, error: { message: "private SQL detail" } };
    }
    let rows = (this.db.tables[this.table] ?? []).filter(
      (row) => row.accessible !== false,
    );
    for (const filter of this.filters) {
      rows = rows.filter((row) => row[filter.column] === filter.value);
    }
    rows = rows.slice(0, this.max);
    if (this.columns) {
      rows = rows.map((row) =>
        Object.fromEntries(
          this.columns
            .filter((column) => column in row)
            .map((column) => [column, row[column]]),
        ),
      );
    }
    return { data: structuredClone(rows), error: null };
  }
  async maybeSingle() {
    const result = this.rows();
    return {
      data: result.data?.[0] ?? null,
      error: result.error,
    };
  }
  then(resolve, reject) {
    return Promise.resolve(this.rows()).then(resolve, reject);
  }
}

class DB {
  constructor(tables, failTable = null) {
    this.tables = structuredClone(tables);
    this.failTable = failTable;
    this.calls = [];
    this.writes = [];
  }
  from(table) {
    return new Query(this, table);
  }
  rpc() {
    throw new Error("RPC não deve ser usada");
  }
}

const ctx = {
  isAuthenticated: () => true,
  getUserId: () => userId,
  getToken: () => "synthetic",
};
const use = (tables, failTable = null) => {
  const db = new DB(tables, failTable);
  globalThis.__MCP_TEST_SUPABASE__ = db;
  return db;
};

// Input fechado, XOR e formatos reais.
for (const [input, valid, label] of [
  [{ transaction_type: "expense", installment_group_id: expenseGroup }, true, "expense/group"],
  [{ transaction_type: "income", transaction_id: rowId(101) }, true, "income/transaction"],
  [{ transaction_type: "expense" }, false, "sem referência"],
  [{ transaction_type: "expense", installment_group_id: expenseGroup, transaction_id: rowId(1) }, false, "duas referências"],
  [{ transaction_type: "other", installment_group_id: expenseGroup }, false, "tipo inválido"],
  [{ transaction_type: "expense", installment_group_id: "not-uuid" }, false, "grupo inválido"],
  [{ transaction_type: "income", transaction_id: "not-uuid" }, false, "transação inválida"],
  [{ transaction_type: "income", transaction_id: rowId(101), user_id: userId }, false, "campo extra"],
  [{ transaction_type: "income", transaction_id: rowId(101), card_id: cardId }, false, "card substituto"],
  [{ transaction_type: "expense", installment_group_id: expenseGroup, description: "Notebook" }, false, "descrição extra"],
]) {
  equal(core.installmentSeriesInputSchema.safeParse(input).success, valid, label);
}

// Série completa de despesa, ordem determinística e centavos.
{
  const rows = [
    expenseRow(3, 3, { amount: "33.34" }),
    expenseRow(1),
    expenseRow(2),
  ];
  const result = core.analyzeInstallmentSeries("expense", expenseGroup, rows);
  equal(result.resource_type, "installment_series", "resource type");
  equal(result.transaction_type, "expense", "tipo expense");
  equal(result.installment_group_id, expenseGroup, "grupo copiável");
  equal(result.series.materialized_installment_count, 3, "três materializadas");
  equal(result.series.declared_total_installments, 3, "total canônico");
  equal(result.series.observed_total_installments, [3], "total observado");
  equal(result.series.first_installment_number, 1, "primeiro número");
  equal(result.series.last_installment_number, 3, "último número");
  equal(result.series.first_installment_date, "2026-01-15", "primeira data civil");
  equal(result.series.last_installment_date, "2026-03-15", "última data civil");
  equal(result.series.total_series_amount, 100, "soma exata em centavos");
  equal(result.series.average_installment_amount, null, "média não representável omitida");
  equal(result.series.currency, "BRL", "moeda");
  equal(result.series.missing_installment_numbers, [], "sem lacunas");
  equal(result.series.duplicate_installment_numbers, [], "sem duplicidades");
  equal(result.series.out_of_range_installment_numbers, [], "sem fora da faixa");
  equal(result.series.integrity_status, "complete", "integridade completa");
  equal(result.series.is_complete, true, "série completa");
  equal(result.series.shared_group_id, sharedGroup, "grupo compartilhado consistente");
  equal(result.series.card_id, cardId, "cartão consistente");
  check(!result.series.warnings.includes("INSTALLMENT_DESCRIPTION_VARIES"), "sufixo padrão não gera warning");
  equal(result.data_complete, true, "variação informativa não invalida");
  equal(result.installments.map((row) => row.installment_number), [1, 2, 3], "ordem numérica");
  equal(result.installments.map((row) => row.amount), [33.33, 33.33, 33.34], "valores preservados");
  check(core.installmentSeriesOutputSchema.safeParse(result).success, "output expense válido");
  for (const [index, item] of result.installments.entries()) {
    const expected = index + 1;
    equal(item.id, rowId(expected), `expense ${expected} id`);
    equal(item.installment_group_id, expenseGroup, `expense ${expected} group`);
    equal(item.installment_number, expected, `expense ${expected} number`);
    equal(item.total_installments, 3, `expense ${expected} total`);
    equal(item.transaction_date, `2026-${String(expected).padStart(2, "0")}-15`, `expense ${expected} date`);
    equal(item.category_id, categoryId, `expense ${expected} category`);
    equal(item.card_id, cardId, `expense ${expected} card`);
    equal(item.shared_group_id, sharedGroup, `expense ${expected} shared`);
    equal(item.payment_method, "credit", `expense ${expected} payment`);
    check(item.updated_at.includes("2026-07"), `expense ${expected} updated`);
    check(!("income_category_id" in item), `expense ${expected} sem campo de receita`);
    check(!("user_id" in item), `expense ${expected} sem user`);
  }
}

// Receita completa não recebe campos artificiais de despesa.
{
  const result = core.analyzeInstallmentSeries(
    "income",
    incomeGroup,
    [incomeRow(2), incomeRow(3), incomeRow(1)],
  );
  equal(result.series.integrity_status, "complete", "income completa");
  equal(result.series.total_series_amount, 30, "income total");
  equal(result.series.average_installment_amount, 10, "income média exata");
  equal(result.series.shared_group_id, null, "income pessoal");
  check(!("card_id" in result.series), "resumo income sem card");
  check(core.installmentSeriesOutputSchema.safeParse(result).success, "output income válido");
  for (const [index, item] of result.installments.entries()) {
    const expected = index + 1;
    equal(item.installment_number, expected, `income ${expected} number`);
    equal(item.income_category_id, incomeCategoryId, `income ${expected} category`);
    equal(item.amount, 10, `income ${expected} amount`);
    equal(item.transaction_date, `2026-${String(expected).padStart(2, "0")}-20`, `income ${expected} date`);
    check(!("card_id" in item), `income ${expected} sem card`);
    check(!("payment_method" in item), `income ${expected} sem payment`);
    check(!("category_id" in item), `income ${expected} sem category expense`);
    check(!("user_id" in item), `income ${expected} sem user`);
  }
}

// income_date é timestamptz no modelo real e vira data civil de São Paulo.
{
  const result = core.analyzeInstallmentSeries("income", incomeGroup, [
    incomeRow(1, 2, { income_date: "2026-02-28T03:00:00.000Z" }),
    incomeRow(2, 2, { income_date: "2026-03-31T03:00:00.000Z" }),
  ]);
  equal(
    result.installments.map((item) => item.transaction_date),
    ["2026-02-28", "2026-03-31"],
    "timestamptz preserva data civil America/Sao_Paulo",
  );
  equal(result.series.first_installment_date, "2026-02-28", "primeira data civil income");
  equal(result.series.last_installment_date, "2026-03-31", "última data civil income");
  check(!result.warnings.includes("INSTALLMENT_DATE_INVALID"), "timestamp válido não gera warning");
}

// Incompletude, duplicidade, totais, referências, datas e versões.
const anomalyCases = [
  {
    label: "vazia",
    rows: [],
    warnings: ["INSTALLMENT_SERIES_INCOMPLETE", "INSTALLMENT_MATERIALIZED_COUNT_MISMATCH"],
    status: "incomplete",
  },
  {
    label: "uma de três",
    rows: [expenseRow(1)],
    warnings: ["INSTALLMENT_SERIES_INCOMPLETE", "INSTALLMENT_MATERIALIZED_COUNT_MISMATCH"],
    status: "incomplete",
  },
  {
    label: "lacuna",
    rows: [expenseRow(1), expenseRow(3)],
    warnings: ["INSTALLMENT_SERIES_INCOMPLETE", "INSTALLMENT_MATERIALIZED_COUNT_MISMATCH"],
    status: "incomplete",
  },
  {
    label: "duplicada",
    rows: [expenseRow(1), expenseRow(1, 3, { id: rowId(20) }), expenseRow(3)],
    warnings: ["INSTALLMENT_NUMBER_DUPLICATE", "INSTALLMENT_SERIES_INCOMPLETE"],
    status: "inconsistent",
  },
  {
    label: "número ausente",
    rows: [expenseRow(1), expenseRow(2, 3, { installment_number: null }), expenseRow(3)],
    warnings: ["INSTALLMENT_NUMBER_MISSING", "INSTALLMENT_SERIES_INCOMPLETE"],
    status: "inconsistent",
  },
  {
    label: "número zero",
    rows: [expenseRow(1), expenseRow(2, 3, { installment_number: 0 }), expenseRow(3)],
    warnings: ["INSTALLMENT_NUMBER_INVALID", "INSTALLMENT_SERIES_INCOMPLETE"],
    status: "inconsistent",
  },
  {
    label: "número negativo",
    rows: [expenseRow(1), expenseRow(2, 3, { installment_number: -2 }), expenseRow(3)],
    warnings: ["INSTALLMENT_NUMBER_INVALID", "INSTALLMENT_SERIES_INCOMPLETE"],
    status: "inconsistent",
  },
  {
    label: "acima do total",
    rows: [expenseRow(1), expenseRow(2), expenseRow(4)],
    warnings: ["INSTALLMENT_NUMBER_OUT_OF_RANGE", "INSTALLMENT_SERIES_INCOMPLETE"],
    status: "inconsistent",
  },
  {
    label: "totais distintos",
    rows: [expenseRow(1), expenseRow(2, 4), expenseRow(3)],
    warnings: ["INSTALLMENT_TOTAL_INCONSISTENT"],
    status: "inconsistent",
  },
  {
    label: "total ausente",
    rows: [expenseRow(1), expenseRow(2, 3, { total_installments: null }), expenseRow(3)],
    warnings: ["INSTALLMENT_TOTAL_INVALID"],
    status: "inconsistent",
  },
  {
    label: "total zero",
    rows: [expenseRow(1), expenseRow(2, 3, { total_installments: 0 }), expenseRow(3)],
    warnings: ["INSTALLMENT_TOTAL_INCONSISTENT", "INSTALLMENT_TOTAL_INVALID"],
    status: "inconsistent",
  },
  {
    label: "total unitário em série",
    rows: [expenseRow(1, 1)],
    warnings: ["INSTALLMENT_TOTAL_INVALID"],
    status: "inconsistent",
  },
  {
    label: "fora da faixa com totais distintos",
    rows: [expenseRow(1, 3), expenseRow(3, 3, { total_installments: 2 })],
    warnings: ["INSTALLMENT_TOTAL_INCONSISTENT", "INSTALLMENT_NUMBER_OUT_OF_RANGE"],
    status: "inconsistent",
  },
  {
    label: "referência ausente",
    rows: [expenseRow(1), expenseRow(2, 3, { installment_group_id: null }), expenseRow(3)],
    warnings: ["INSTALLMENT_SERIES_REFERENCE_INCONSISTENT"],
    status: "inconsistent",
  },
  {
    label: "referência diferente",
    rows: [expenseRow(1), expenseRow(2, 3, { installment_group_id: incomeGroup }), expenseRow(3)],
    warnings: ["INSTALLMENT_SERIES_REFERENCE_INCONSISTENT"],
    status: "inconsistent",
  },
  {
    label: "data inválida",
    rows: [expenseRow(1), expenseRow(2, 3, { expense_date: "2026-02-31" }), expenseRow(3)],
    warnings: ["INSTALLMENT_DATE_INVALID"],
    status: "inconsistent",
  },
  {
    label: "versão ausente",
    rows: [expenseRow(1), expenseRow(2, 3, { updated_at: null }), expenseRow(3)],
    warnings: ["INSTALLMENT_VERSION_MISSING"],
    status: "inconsistent",
  },
  {
    label: "cards mistos",
    rows: [expenseRow(1), expenseRow(2, 3, { card_id: null }), expenseRow(3)],
    warnings: ["INSTALLMENT_CARD_INCONSISTENT"],
    status: "inconsistent",
  },
  {
    label: "grupos mistos",
    rows: [expenseRow(1), expenseRow(2, 3, { shared_group_id: null }), expenseRow(3)],
    warnings: ["INSTALLMENT_GROUP_SCOPE_INCONSISTENT"],
    status: "inconsistent",
  },
  {
    label: "valor inválido",
    rows: [expenseRow(1), expenseRow(2, 3, { amount: "inválido" }), expenseRow(3)],
    warnings: ["INSTALLMENT_AMOUNT_INVALID"],
    status: "inconsistent",
  },
];
for (const testCase of anomalyCases) {
  const result = core.analyzeInstallmentSeries("expense", expenseGroup, testCase.rows);
  equal(result.series.integrity_status, testCase.status, `${testCase.label} status`);
  equal(result.data_complete, false, `${testCase.label} incompleta`);
  for (const warning of testCase.warnings) {
    check(result.warnings.includes(warning), `${testCase.label} ${warning}`);
  }
}

{
  const result = core.analyzeInstallmentSeries(
    "expense",
    expenseGroup,
    [
      expenseRow(1),
      expenseRow(2, 3, {
        description: "Notebook revisado (2/3)",
        category_id: null,
        payment_method: "pix",
      }),
      expenseRow(3),
    ],
  );
  check(result.warnings.includes("INSTALLMENT_DESCRIPTION_VARIES"), "descrição editada varia");
  check(result.warnings.includes("INSTALLMENT_CATEGORY_VARIES"), "categoria varia");
  check(result.warnings.includes("INSTALLMENT_PAYMENT_METHOD_VARIES"), "pagamento varia");
  equal(result.series.integrity_status, "complete", "diferenças informativas");
  equal(result.data_complete, true, "informativas não bloqueiam");
}

// Handler real: por grupo, por transação, erros seguros, RLS e cap.
{
  const db = use({ expenses: [expenseRow(3), expenseRow(1), expenseRow(2)], incomes: [] });
  const result = await core.tool.handler(
    { transaction_type: "expense", installment_group_id: expenseGroup },
    ctx,
  );
  equal(result.structuredContent.series.integrity_status, "complete", "handler expense");
  equal(result.structuredContent.installments.length, 3, "handler todas linhas");
  equal(db.writes, [], "handler sem escrita");
  equal(db.calls.filter((call) => call.method === "select").length, 1, "consulta direta por group");
  equal(db.calls.at(-1).value, 49, "cap consulta 49");
  check(result.content[0].text.includes(expenseGroup), "content group copiável");
  check(result.content[0].text.includes("materializadas=3"), "content quantidade");
  check(result.content[0].text.includes("total_declarado=3"), "content total");
  check(result.content[0].text.includes("total_factual=99.99"), "content valor");
  check(result.content[0].text.includes("updated_at="), "content versões");
  check(result.content[0].text.includes("Nenhuma transação foi criada"), "content read only");
  check(!JSON.stringify(result).includes(userId), "handler sem user_id");
}

{
  const db = use({ expenses: [], incomes: [incomeRow(1), incomeRow(2), incomeRow(3)] });
  const result = await core.tool.handler(
    { transaction_type: "income", transaction_id: rowId(101) },
    ctx,
  );
  equal(result.structuredContent.transaction_type, "income", "handler income");
  equal(result.structuredContent.installment_group_id, incomeGroup, "resolve group");
  equal(result.structuredContent.installments.length, 3, "carrega irmãos");
  equal(db.calls.filter((call) => call.method === "select").length, 2, "referência e série");
  equal(db.calls[0].table, "incomes", "somente tabela income");
  equal(db.calls[1].table, "incomes", "não mistura expense");
  check(!("card_id" in result.structuredContent.series), "handler income sem card");
}

{
  use({
    expenses: [expenseRow(1, 1, { installment_group_id: null, total_installments: 1 })],
    incomes: [],
  });
  const result = await core.tool.handler(
    { transaction_type: "expense", transaction_id: rowId(1) },
    ctx,
  );
  errorCode(result, "TRANSACTION_NOT_INSTALLMENT", "não parcelada");
  check(result.content[0].text.includes("não pertence"), "erro explica existência acessível");
  check(result.content[0].text.includes("Nenhuma alteração"), "erro read only");
}

{
  use({
    expenses: [expenseRow(1, 3, { installment_group_id: null })],
    incomes: [],
  });
  const result = await core.tool.handler(
    { transaction_type: "expense", transaction_id: rowId(1) },
    ctx,
  );
  errorCode(result, "INSTALLMENT_SERIES_REFERENCE_MISSING", "legado sem referência");
  check(result.content[0].text.includes("não foi inferida"), "não agrupa heurística");
}

for (const [tables, input, label] of [
  [{ expenses: [], incomes: [] }, { transaction_type: "expense", installment_group_id: expenseGroup }, "grupo inexistente"],
  [{ expenses: [expenseRow(1, 3, { accessible: false })], incomes: [] }, { transaction_type: "expense", installment_group_id: expenseGroup }, "grupo inacessível"],
  [{ expenses: [expenseRow(1, 3, { accessible: false })], incomes: [] }, { transaction_type: "expense", transaction_id: rowId(1) }, "transação inacessível"],
  [{ expenses: [], incomes: [incomeRow(1)] }, { transaction_type: "expense", transaction_id: rowId(101) }, "tipo errado"],
]) {
  use(tables);
  const result = await core.tool.handler(input, ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", label);
  check(!JSON.stringify(result).includes(otherUserId), `${label} sem identidade`);
}

{
  const rows = Array.from({ length: 49 }, (_, index) =>
    expenseRow(index + 1, 49, {
      id: rowId(index + 300),
      expense_date: "2026-01-01",
    }),
  );
  use({ expenses: rows, incomes: [] });
  const result = await core.tool.handler(
    { transaction_type: "expense", installment_group_id: expenseGroup },
    ctx,
  );
  errorCode(result, "RESULT_SET_TOO_LARGE", "cap 48");
  check(result.content[0].text.includes("48"), "cap documentado");
  check(result.content[0].text.includes("não foi analisada parcialmente"), "sem parcial");
}

{
  use({ expenses: [expenseRow(1)], incomes: [] }, "expenses");
  const result = await core.tool.handler(
    { transaction_type: "expense", installment_group_id: expenseGroup },
    ctx,
  );
  errorCode(result, "READ_FAILED", "falha de leitura sanitizada");
  check(!JSON.stringify(result).includes("private SQL"), "sem SQL bruto");
}

{
  use({ expenses: [expenseRow(1)], incomes: [] });
  const result = await core.tool.handler(
    { transaction_type: "expense", installment_group_id: expenseGroup },
    { isAuthenticated: () => false, getUserId: () => undefined },
  );
  errorCode(result, "UNAUTHENTICATED", "não autenticado");
}

for (const input of [
  { transaction_type: "expense" },
  { transaction_type: "expense", installment_group_id: expenseGroup, transaction_id: rowId(1) },
  { transaction_type: "expense", installment_group_id: expenseGroup, user_id: userId },
]) {
  use({ expenses: [expenseRow(1)], incomes: [] });
  const result = await core.getInstallmentSeries(input, ctx);
  errorCode(result, "INVALID_INPUT", "handler valida input fechado/XOR");
}

// Padronização dos payloads comuns sem alterar os fatos preexistentes.
{
  const raw = expenseRow(1, 1, { installment_group_id: null });
  const item = core.expenseItem(raw, userId);
  equal(item.installment_group_id, null, "expense simples group null");
  equal(item.installment_number, 1, "expense simples preserva number real");
  equal(item.total_installments, 1, "expense simples preserva total");
  equal(item.is_installment, false, "expense simples false");
  equal(item.updated_at, raw.updated_at, "expense updated");
}
{
  const raw = expenseRow(1);
  const item = core.expenseItem(raw, userId);
  equal(item.installment_group_id, expenseGroup, "expense parcelada group");
  equal(item.installment_number, 1, "expense parcelada number");
  equal(item.total_installments, 3, "expense parcelada total");
  equal(item.is_installment, true, "expense parcelada true");
  equal(item.updated_at, raw.updated_at, "expense parcelada updated");
}
{
  const raw = incomeRow(1, 1, { installment_group_id: null });
  const item = core.incomeItem(raw, userId);
  equal(item.installment_group_id, null, "income simples group null");
  equal(item.installment_number, 1, "income simples preserva number");
  equal(item.total_installments, 1, "income simples preserva total");
  equal(item.is_installment, false, "income simples false");
  equal(item.updated_at, raw.updated_at, "income updated");
}
{
  const raw = incomeRow(1);
  const item = core.incomeItem(raw, userId);
  equal(item.installment_group_id, incomeGroup, "income parcelada group");
  equal(item.installment_number, 1, "income parcelada number");
  equal(item.total_installments, 3, "income parcelada total");
  equal(item.is_installment, true, "income parcelada true");
  equal(item.updated_at, raw.updated_at, "income parcelada updated");
}

// Manifest, schemas fechados, bundle e ausência de campos sensíveis.
const manifest = JSON.parse(
  await readFile(".lovable/mcp/manifest.json", "utf8"),
);
const tools = manifest.mcp.tools;
equal(tools.length, 53, "manifest 53 tools");
equal(
  tools.filter((candidate) => candidate.annotations?.readOnlyHint === true).length,
  26,
  "26 read-only",
);
equal(
  tools.filter((candidate) => candidate.annotations?.readOnlyHint === false).length,
  27,
  "27 write",
);
const declared = tools.find((candidate) => candidate.name === "get_installment_series");
check(declared, "nova tool registrada");
equal(declared.annotations.readOnlyHint, true, "manifest read-only");
equal(declared.annotations.destructiveHint, false, "manifest não destrutiva");
equal(declared.annotations.idempotentHint, true, "manifest idempotente");
equal(declared.annotations.openWorldHint, false, "manifest mundo fechado");
equal(declared.inputSchema.additionalProperties, false, "input fechado");
equal(declared.outputSchema.additionalProperties, false, "output fechado");
for (const required of ["transaction_type"]) {
  check(declared.inputSchema.required.includes(required), `${required} obrigatório`);
}
for (const property of ["transaction_type", "installment_group_id", "transaction_id"]) {
  check(property in declared.inputSchema.properties, `${property} no input`);
}
for (const forbidden of ["user_id", "group_id", "card_id", "description", "email"]) {
  check(!(forbidden in declared.inputSchema.properties), `${forbidden} fora do input`);
}
const serializedOutput = JSON.stringify(declared.outputSchema);
for (const forbidden of ["user_id", "paid_by", "created_by", "email", "invite_code"]) {
  check(!serializedOutput.includes(forbidden), `${forbidden} fora do output`);
}
for (const requiredField of [
  "resource_type",
  "transaction_type",
  "installment_group_id",
  "series",
  "installments",
  "warnings",
  "data_complete",
  "generated_at",
  "updated_at",
  "integrity_status",
  "missing_installment_numbers",
  "duplicate_installment_numbers",
]) {
  check(serializedOutput.includes(requiredField), `${requiredField} no output`);
}

for (const name of ["list_expenses", "list_incomes", "search_transactions"]) {
  const schema = JSON.stringify(tools.find((candidate) => candidate.name === name)?.outputSchema);
  for (const field of [
    "installment_group_id",
    "installment_number",
    "total_installments",
    "is_installment",
    "updated_at",
  ]) {
    check(schema.includes(field), `${name} expõe ${field}`);
  }
}
{
  const schema = JSON.stringify(
    tools.find((candidate) => candidate.name === "get_card_installments")?.outputSchema,
  );
  for (const field of [
    "installment_group_id",
    "installment_number",
    "total_installments",
    "is_installment",
    "updated_at",
  ]) {
    check(schema.includes(field), `get_card_installments expõe ${field}`);
  }
}

const helperSource = await readFile(
  "src/lib/mcp/shared/installment-series-read.ts",
  "utf8",
);
const toolSource = await readFile(
  "src/lib/mcp/tools/get-installment-series.ts",
  "utf8",
);
const transactionSource = await readFile(
  "src/lib/mcp/shared/transaction-query.ts",
  "utf8",
);
const cardSource = await readFile(
  "src/lib/mcp/tools/get-card-installments.ts",
  "utf8",
);
check(helperSource.includes("supabaseForUser"), "usa cliente por usuário");
check(!helperSource.includes("service_role"), "sem service role");
check(!helperSource.includes(".insert("), "helper sem insert");
check(!helperSource.includes(".update("), "helper sem update");
check(!helperSource.includes(".delete("), "helper sem delete");
check(helperSource.includes(".limit(INSTALLMENT_SERIES_MAX_ROWS + 1)"), "cap defensivo");
check(toolSource.includes('name: "get_installment_series"'), "nome no source");
check(transactionSource.includes("installment_group_id"), "query comum seleciona grupo");
check(transactionSource.includes("hasInstallmentEvidence"), "marcador factual comum");
check(cardSource.includes("updated_at"), "card seleciona versão");
check(cardSource.includes("is_installment: true"), "card marca parcela");

const bundleSource = await readFile(
  "supabase/functions/mcp/index.ts",
  "utf8",
);
check(bundleSource.includes('name: "get_installment_series"'), "bundle contém tool");
check(!/[A-Z]:\\\\Users\\\\/u.test(bundleSource), "bundle sem caminho Windows");
check(!bundleSource.includes("service_role"), "bundle sem service role");

check(checks >= 195, `cobertura mínima de 195 verificações; obtidas ${checks}`);
console.log(`MCP Fase 1.2F-D: ${checks} verificações aprovadas.`);
