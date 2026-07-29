import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { z } from "zod";

const supabaseMockPlugin = {
  name: "phase-1.1c-a2-supabase-mock",
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
      export * from "./src/lib/mcp/shared/card-summary.ts";
      export * from "./src/lib/mcp/shared/dates.ts";
      export { default as getCardSummaryTool } from "./src/lib/mcp/tools/get-card-summary.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.1c-a2-test-entry.ts",
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
const source = await readFile("src/lib/mcp/tools/get-card-summary.ts", "utf8");
const indexSource = await readFile("src/lib/mcp/index.ts", "utf8");
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
const cardA = "30000000-0000-4000-8000-000000000003";
const cardB = "40000000-0000-4000-8000-000000000004";
const categoryA = "50000000-0000-4000-8000-000000000005";
const groupA = "60000000-0000-4000-8000-000000000006";
const missingCard = "70000000-0000-4000-8000-000000000007";
const expenseId = (number) =>
  `80000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

function contextFor(userId) {
  return {
    isAuthenticated: () => true,
    getUserId: () => userId,
    getToken: () => "synthetic-token",
  };
}

function card(overrides = {}) {
  return {
    id: cardA,
    user_id: userA,
    name: "Cartão Principal",
    card_type: "credit",
    is_active: true,
    card_limit: 2_000,
    opening_day: 21,
    closing_day: 20,
    due_day: 27,
    days_before_due: 7,
    ...overrides,
  };
}

function expense(overrides = {}) {
  return {
    id: expenseId(1),
    user_id: userA,
    description: "Compra comum",
    amount: 50,
    expense_date: "2026-07-22",
    payment_method: "credit",
    card_id: cardA,
    card_name: "Cartão Principal",
    category_id: categoryA,
    category_name: "Compras",
    installment_group_id: null,
    installment_number: 1,
    total_installments: 1,
    ...overrides,
  };
}

class RecordingQuery {
  constructor(database, table, call) {
    this.database = database;
    this.table = table;
    this.call = call;
    this.filters = [];
    this.selectedColumns = null;
    this.requestedLimit = null;
    this.single = false;
  }
  operation(method, ...args) {
    this.call.operations.push({ method, args });
  }
  select(columns) {
    this.operation("select", columns);
    this.selectedColumns = columns.split(",").map((column) => column.trim());
    return this;
  }
  eq(column, value) {
    this.operation("eq", column, value);
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
  limit(value) {
    this.operation("limit", value);
    this.requestedLimit = value;
    return this;
  }
  maybeSingle() {
    this.operation("maybeSingle");
    this.single = true;
    return this.execute();
  }
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }
  async execute() {
    let rows = (this.database.tables[this.table] ?? []).map((row) => ({ ...row }));
    for (const filter of this.filters) rows = rows.filter(filter);
    if (this.requestedLimit !== null) rows = rows.slice(0, this.requestedLimit);
    if (this.selectedColumns) {
      rows = rows.map((row) =>
        Object.fromEntries(this.selectedColumns.map((column) => [column, row[column]])));
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

const modernPeriod = core.resolveCardBillingPeriod("2026-07", card());
equal(
  modernPeriod,
  {
    billing_month: "2026-07",
    start_date: "2026-07-21",
    end_date: "2026-08-20",
    closing_date: "2026-08-20",
    due_date: "2026-08-27",
    calculation_mode: "due_date",
    configuration_warning: false,
  },
  "período atual reutiliza a semântica real",
);
equal(
  core.resolveCardBillingPeriod(
    "2026-07",
    card({ due_day: null, days_before_due: null }),
  ),
  {
    billing_month: "2026-07",
    start_date: "2026-06-21",
    end_date: "2026-07-20",
    closing_date: "2026-07-20",
    due_date: null,
    calculation_mode: "legacy_opening_closing",
    configuration_warning: true,
  },
  "fallback legado não inventa vencimento",
);
equal(
  core.resolveCardBillingPeriod(
    "2026-12",
    card({ due_day: 27, days_before_due: 7 }),
  )?.end_date,
  "2027-01-20",
  "virada de ano",
);
equal(
  core.resolveCardBillingPeriod(
    "2026-02",
    card({ due_day: 2, days_before_due: 7 }),
  )?.start_date,
  "2026-01-27",
  "virada de mês usa subtração real de dias",
);
equal(
  core.todayIso(new Date("2026-01-01T01:30:00Z")),
  "2025-12-31",
  "hoje respeita America/Sao_Paulo",
);

const rows = [
  expense({
    id: expenseId(1),
    description: "Compra parcelada",
    amount: 100,
    installment_group_id: groupA,
    installment_number: 2,
    total_installments: 4,
  }),
  expense({
    id: expenseId(2),
    description: "Compra futura",
    amount: 50,
    expense_date: "2026-08-01",
    category_name: null,
    category_id: null,
  }),
  expense({
    id: expenseId(3),
    description: "Outro membro",
    amount: 999,
    user_id: userB,
  }),
  expense({
    id: expenseId(4),
    description: "Débito",
    amount: 888,
    payment_method: "debit",
  }),
  expense({
    id: expenseId(5),
    description: "Fora do período",
    amount: 777,
    expense_date: "2026-08-21",
  }),
];

{
  const database = useDatabase({ cards: [card()], expenses: rows });
  const response = await core.getCardSummaryTool.handler(
    { card_id: cardA, billing_month: "2026-07", time_scope: "all" },
    contextFor(userA),
  );
  equal(
    database.calls.map((call) => call.table),
    ["cards", "expenses"],
    "valida cartão antes de despesas",
  );
  const cardCall = database.calls[0];
  const expenseCall = database.calls[1];
  check(hasOperation(cardCall, "eq", "id", cardA), "cartão filtrado por id");
  check(hasOperation(cardCall, "eq", "user_id", userA), "cartão filtrado por usuário");
  check(hasOperation(expenseCall, "eq", "user_id", userA), "despesas filtradas por usuário");
  check(hasOperation(expenseCall, "eq", "card_id", cardA), "despesas filtradas por cartão");
  check(hasOperation(expenseCall, "eq", "payment_method", "credit"), "somente crédito");
  check(hasOperation(expenseCall, "gte", "expense_date", "2026-07-21"), "início do período");
  check(hasOperation(expenseCall, "lte", "expense_date", "2026-08-20"), "fim do período");
  equal(response.structuredContent.metrics.registered_total, 150, "total registrado");
  equal(response.structuredContent.metrics.occurred_total, 100, "total ocorrido");
  equal(response.structuredContent.metrics.future_materialized_total, 50, "total futuro materializado");
  equal(response.structuredContent.metrics.transaction_count, 2, "contagem total");
  equal(response.structuredContent.metrics.occurred_transaction_count, 1, "contagem ocorrida");
  equal(response.structuredContent.metrics.future_transaction_count, 1, "contagem futura");
  equal(response.structuredContent.metrics.installment_total, 100, "total parcelado");
  equal(response.structuredContent.metrics.non_installment_total, 50, "total comum");
  equal(response.structuredContent.largest_transaction?.amount, 100, "maior transação");
  check(
    response.structuredContent.categories_summary.some(
      (category) => category.category_name === "Sem categoria" && category.total === 50,
    ),
    "categoria nula é identificada",
  );
  check(
    response.content[0].text.includes("Cartão Principal") &&
      response.content[0].text.includes("2026-07-21 a 2026-08-20") &&
      response.content[0].text.includes("Total registrado no Gastinho") &&
      response.content[0].text.includes("parte já ocorrida") &&
      response.content[0].text.includes("parte futura materializada") &&
      response.content[0].text.includes("Maior transação") &&
      response.content[0].text.includes("Principais categorias") &&
      response.content[0].text.includes("não existe tabela real de faturas"),
    "content é autossuficiente",
  );
  check(
    z.object(core.getCardSummaryTool.outputSchema)
      .safeParse(response.structuredContent).success,
    "structuredContent valida no outputSchema real",
  );
  check(response.structuredContent.data_complete, "resultado completo");
  check(
    response.structuredContent.warnings.includes("BILLING_TOTAL_IS_CALCULATED") &&
      response.structuredContent.warnings.includes("PAYMENT_STATUS_NOT_AVAILABLE"),
    "avisos impedem interpretação bancária",
  );
}

{
  useDatabase({ cards: [card({ is_active: false })], expenses: [] });
  const response = await core.getCardSummaryTool.handler(
    { card_id: cardA, billing_month: "2026-07" },
    contextFor(userA),
  );
  check(response.structuredContent.warnings.includes("INACTIVE_CARD"), "cartão inativo consultável");
  equal(response.structuredContent.metrics.registered_total, 0, "sem despesas total zero");
  equal(response.structuredContent.largest_transaction, null, "sem maior transação");
  equal(response.structuredContent.categories_summary, [], "sem categorias");
}

{
  useDatabase({
    cards: [card({ due_day: null, days_before_due: null })],
    expenses: [expense({ expense_date: "2026-07-10" })],
  });
  const response = await core.getCardSummaryTool.handler(
    { card_id: cardA, billing_month: "2026-07" },
    contextFor(userA),
  );
  equal(
    response.structuredContent.billing_period.calculation_mode,
    "legacy_opening_closing",
    "handler usa fallback legado",
  );
  equal(response.structuredContent.billing_period.due_date, null, "vencimento legado nulo");
  check(
    response.structuredContent.warnings.includes("INVALID_CARD_CONFIGURATION"),
    "fallback incompleto é sinalizado",
  );
}

{
  const database = useDatabase({
    cards: [card({ opening_day: null, closing_day: null, due_day: null, days_before_due: null })],
    expenses: rows,
  });
  const response = await core.getCardSummaryTool.handler(
    { card_id: cardA, billing_month: "2026-07" },
    contextFor(userA),
  );
  equal(response.structuredContent.error.code, "INVALID_DATA", "configuração insuficiente falha");
  equal(database.calls.length, 1, "configuração insuficiente não consulta despesas");
}

{
  const database = useDatabase({
    cards: [card(), card({ id: cardB, user_id: userB })],
    expenses: rows,
  });
  const foreign = await core.getCardSummaryTool.handler(
    { card_id: cardB, billing_month: "2026-07" },
    contextFor(userA),
  );
  const missing = await core.getCardSummaryTool.handler(
    { card_id: missingCard, billing_month: "2026-07" },
    contextFor(userA),
  );
  equal(foreign.structuredContent, missing.structuredContent, "cartão alheio e inexistente opacos");
  equal(foreign.content, missing.content, "mensagem opaca idêntica");
  equal(foreign.structuredContent.error.code, "RESOURCE_NOT_FOUND", "recurso não encontrado");
  check(database.calls.every((call) => call.table === "cards"), "não consulta despesas inacessíveis");
}

{
  const database = useDatabase({ cards: [card()], expenses: rows });
  const response = await core.getCardSummaryTool.handler(
    { card_id: cardA, billing_month: "2026-07", time_scope: "occurred" },
    contextFor(userA),
  );
  check(
    hasOperation(database.calls[1], "lte", "expense_date", core.todayIso()),
    "time_scope occurred aplica hoje",
  );
  equal(response.structuredContent.metrics.registered_total, 100, "occurred exclui materialização futura");
  equal(response.structuredContent.metrics.future_materialized_total, 0, "occurred não retorna futuro");
}

{
  const tooMany = Array.from({ length: 10_001 }, (_, index) =>
    expense({ id: expenseId(index + 1), amount: 1 }),
  );
  useDatabase({ cards: [card()], expenses: tooMany });
  const response = await core.getCardSummaryTool.handler(
    { card_id: cardA, billing_month: "2026-07" },
    contextFor(userA),
  );
  equal(response.structuredContent.error.code, "RESULT_SET_TOO_LARGE", "hard cap estruturado");
}

{
  const manyCategories = Array.from({ length: 12 }, (_, index) =>
    expense({
      id: expenseId(index + 1),
      category_id: expenseId(100 + index),
      category_name: `Categoria ${index + 1}`,
      amount: index + 1,
    }),
  );
  useDatabase({ cards: [card()], expenses: manyCategories });
  const response = await core.getCardSummaryTool.handler(
    { card_id: cardA, billing_month: "2026-07" },
    contextFor(userA),
  );
  equal(response.structuredContent.categories_summary.length, 10, "máximo dez categorias");
  equal(response.structuredContent.metrics.registered_total, 78, "totais incluem categorias omitidas");
}

const tools = manifest.mcp.tools;
equal(tools.length, 30, "manifest contém exatamente 30 tools");
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
  18,
  "manifest contém 18 tools read-only",
);
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint !== true).length,
  12,
  "manifest contém 12 tools write",
);
const manifestTool = tools.find((tool) => tool.name === "get_card_summary");
check(manifestTool, "get_card_summary está no manifest");
check(manifestTool.annotations.readOnlyHint === true, "get_card_summary é read-only");
check(manifestTool.outputSchema.additionalProperties === false, "outputSchema fechado");
check(!("user_id" in manifestTool.inputSchema.properties), "input não aceita user_id");
check(!JSON.stringify(manifestTool.outputSchema).includes("user_id"), "output não expõe user_id");
check(!/recurring_expenses/u.test(source), "não consulta recorrências");
check(!/service_role|SERVICE_ROLE/u.test(source), "não usa service_role");
check(/\.limit\(HARD_CAP \+ 1\)/u.test(source), "consulta aplica hard cap");
check(
  indexSource.includes("get_card_summary") &&
    indexSource.includes("list_cards") &&
    indexSource.includes("get_card_installments"),
  "instructions orientam as três tools",
);
check(
  bundleSource.includes('name: "get_card_summary"'),
  "bundle oficial contém get_card_summary",
);
check(
  !responseClaimsPayment(source),
  "implementação não afirma pagamento, quitação ou limite disponível",
);

function responseClaimsPayment(toolSource) {
  return /(?:fatura|pagamento)\s+(?:está|foi)\s+(?:paga|pago|em aberto)|limite (?:realmente )?disponível\s*[:=]\s*\d/iu
    .test(toolSource);
}

console.log(
  `Fase MCP 1.1C-A2: ${checks} verificações diretas e de contrato concluídas.`,
);
