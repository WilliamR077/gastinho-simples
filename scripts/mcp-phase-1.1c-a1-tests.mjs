import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { z } from "zod";

const supabaseMockPlugin = {
  name: "phase-1.1c-a1-supabase-mock",
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
      export * from "./src/lib/mcp/shared/card-factual.ts";
      export * from "./src/lib/mcp/shared/dates.ts";
      export * from "./src/lib/mcp/shared/phase-1.1b-core.ts";
      export * from "./src/lib/mcp/shared/resource-cursor.ts";
      export { default as listCardsTool } from "./src/lib/mcp/tools/list-cards.ts";
      export { default as getCardInstallmentsTool } from "./src/lib/mcp/tools/get-card-installments.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.1c-a1-test-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  define: {
    "process.env.MCP_CURSOR_SECRET": JSON.stringify(
      "synthetic-1.1c-a1-secret-0123456789abcdef",
    ),
  },
  plugins: [supabaseMockPlugin],
});
const core = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`,
);

const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const listCardsSource = await readFile("src/lib/mcp/tools/list-cards.ts", "utf8");
const installmentsSource = await readFile(
  "src/lib/mcp/tools/get-card-installments.ts",
  "utf8",
);
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
const missingCard = "70000000-0000-4000-8000-000000000007";
const groupA = "50000000-0000-4000-8000-000000000005";
const groupB = "50000000-0000-4000-8000-000000000006";
const ids = Array.from(
  { length: 20 },
  (_, index) => `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const secret = "synthetic-1.1c-a1-secret-0123456789abcdef";

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
    color: "#000000",
    card_limit: 2_000,
    opening_day: 1,
    closing_day: 20,
    due_day: 27,
    days_before_due: 7,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

function expense(overrides = {}) {
  return {
    id: ids[0],
    user_id: userA,
    description: "Compra parcelada",
    amount: 50,
    expense_date: "2026-08-10",
    payment_method: "credit",
    card_id: cardA,
    card_name: "Cartão Principal",
    category_id: ids[18],
    category_name: "Compras",
    category_icon: "shopping-cart",
    installment_group_id: groupA,
    installment_number: 1,
    total_installments: 8,
    shared_group_id: null,
    ...overrides,
  };
}

function splitTopLevel(expression) {
  const parts = [];
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let start = 0;
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && character === "(") depth += 1;
    if (!quoted && character === ")") depth -= 1;
    if (!quoted && depth === 0 && character === ",") {
      parts.push(expression.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(expression.slice(start));
  return parts;
}

function parsePostgrestValue(raw, currentValue) {
  if (raw === "null") return null;
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return JSON.parse(raw);
  }
  if (typeof currentValue === "number") return Number(raw);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function evaluatePostgrestExpression(row, expression) {
  const normalized =
    expression.startsWith("(") && expression.endsWith(")")
      ? expression.slice(1, -1)
      : expression;
  const clauses = splitTopLevel(normalized);
  if (clauses.length > 1) {
    return clauses.some((clause) => evaluatePostgrestExpression(row, clause));
  }
  if (normalized.startsWith("and(") && normalized.endsWith(")")) {
    return splitTopLevel(normalized.slice(4, -1))
      .every((clause) => evaluatePostgrestExpression(row, clause));
  }
  const match = /^([a-z_]+)\.(not\.is|eq|gt|lt)\.(.+)$/u.exec(normalized);
  assert.ok(match, `Expressão PostgREST não suportada pelo mock: ${normalized}`);
  const [, column, operator, rawValue] = match;
  const currentValue = row[column];
  const value = parsePostgrestValue(rawValue, currentValue);
  if (operator === "not.is") return currentValue !== value;
  if (operator === "eq") return currentValue === value;
  if (operator === "gt") return currentValue > value;
  return currentValue < value;
}

class RecordingQuery {
  constructor(database, table, call) {
    this.database = database;
    this.table = table;
    this.call = call;
    this.filters = [];
    this.orders = [];
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

  neq(column, value) {
    this.operation("neq", column, value);
    this.filters.push((row) => row[column] !== value);
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

  gt(column, value) {
    this.operation("gt", column, value);
    this.filters.push((row) => row[column] > value);
    return this;
  }

  order(column, options = {}) {
    this.operation("order", column, options);
    this.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }

  limit(value) {
    this.operation("limit", value);
    this.requestedLimit = value;
    return this;
  }

  or(expression) {
    this.operation("or", expression);
    this.filters.push((row) => evaluatePostgrestExpression(row, expression));
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
    if (this.orders.length > 0) {
      rows.sort((left, right) => {
        for (const order of this.orders) {
          const direction = order.ascending ? 1 : -1;
          if (left[order.column] < right[order.column]) return -1 * direction;
          if (left[order.column] > right[order.column]) return 1 * direction;
        }
        return 0;
      });
    }
    if (this.requestedLimit !== null) rows = rows.slice(0, this.requestedLimit);
    if (this.selectedColumns) {
      rows = rows.map((row) =>
        Object.fromEntries(this.selectedColumns.map((column) => [column, row[column]])));
    }
    return {
      data: this.single ? (rows[0] ?? null) : rows,
      error: null,
    };
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

function operations(call, method) {
  return call.operations.filter((operation) => operation.method === method);
}

function hasOperation(call, method, ...args) {
  return call.operations.some(
    (operation) =>
      operation.method === method &&
      args.every((argument, index) => operation.args[index] === argument),
  );
}

function firstCall(database, table) {
  return database.calls.find((call) => call.table === table);
}

async function collectPages(tool, input, context, itemKey) {
  const items = [];
  const pages = [];
  let cursor;
  do {
    const response = await tool.handler(
      { ...input, ...(cursor ? { cursor } : {}) },
      context,
    );
    assert.equal(response.isError, undefined);
    pages.push(response);
    items.push(...response.structuredContent[itemKey]);
    cursor = response.structuredContent.next_cursor;
  } while (cursor);
  return { items, pages };
}

const ownCards = [
  card({ id: ids[0], name: "Alpha", created_at: "2026-01-05T00:00:00Z" }),
  card({ id: ids[1], name: "Mesmo nome", created_at: "2026-01-04T00:00:00Z" }),
  card({ id: ids[2], name: "Mesmo nome", created_at: "2026-01-03T00:00:00Z" }),
  card({
    id: ids[3],
    name: "Delta inativo",
    card_type: "debit",
    is_active: false,
    created_at: "2026-01-02T00:00:00Z",
  }),
  card({
    id: ids[4],
    name: "Ômega",
    card_type: "both",
    created_at: "2026-01-01T00:00:00Z",
  }),
];
const foreignCard = card({
  id: cardB,
  user_id: userB,
  name: "Cartão de outro usuário",
});

{
  const database = useDatabase({ cards: [...ownCards, foreignCard] });
  const response = await core.listCardsTool.handler({}, contextFor(userA));
  equal(database.calls.map((call) => call.table), ["cards"], "list_cards consulta cards");
  const call = database.calls[0];
  check(hasOperation(call, "eq", "user_id", userA), "list_cards filtra user_id");
  check(hasOperation(call, "eq", "is_active", true), "padrão filtra cartões ativos");
  equal(
    operations(call, "order").map((operation) => operation.args[0]),
    ["name", "id"],
    "ordenação padrão usa name + id",
  );
  check(
    response.structuredContent.cards.every((item) => item.id !== cardB),
    "cartão de outro usuário nunca aparece",
  );
  check(
    response.content[0].text.includes("Filtros aplicados:") &&
      response.content[0].text.includes("has_more=") &&
      response.content[0].text.includes("next_cursor=") &&
      response.content[0].text.includes("Alpha"),
    "content de list_cards é autossuficiente",
  );
  check(
    z.object(core.listCardsTool.outputSchema)
      .safeParse(response.structuredContent).success,
    "structuredContent real de list_cards valida no outputSchema",
  );
}

{
  const database = useDatabase({ cards: [...ownCards, foreignCard] });
  const response = await core.listCardsTool.handler(
    { include_inactive: true },
    contextFor(userA),
  );
  const call = database.calls[0];
  check(
    !hasOperation(call, "eq", "is_active", true),
    "include_inactive=true não filtra atividade",
  );
  check(
    response.structuredContent.cards.some((item) => !item.is_active),
    "include_inactive=true retorna cartão inativo próprio",
  );
}

for (const cardType of ["credit", "debit", "both"]) {
  const database = useDatabase({ cards: [...ownCards, foreignCard] });
  const response = await core.listCardsTool.handler(
    { include_inactive: true, card_type: cardType },
    contextFor(userA),
  );
  check(
    hasOperation(database.calls[0], "eq", "card_type", cardType),
    `card_type=${cardType} usa igualdade exata`,
  );
  check(
    response.structuredContent.cards.every((item) => item.card_type === cardType),
    `card_type=${cardType} não inclui outros tipos`,
  );
}

{
  const database = useDatabase({ cards: [...ownCards, foreignCard] });
  await core.listCardsTool.handler(
    { include_inactive: true, sort_by: "created_at", sort_order: "desc" },
    contextFor(userA),
  );
  equal(
    operations(database.calls[0], "order").map((operation) => operation.args[0]),
    ["created_at", "id"],
    "ordenação alternativa usa created_at + id",
  );
}

for (const sortOrder of ["asc", "desc"]) {
  useDatabase({ cards: [...ownCards, foreignCard] });
  const pageSet = await collectPages(
    core.listCardsTool,
    { include_inactive: true, sort_order: sortOrder, limit: 2 },
    contextFor(userA),
    "cards",
  );
  equal(pageSet.pages.length, 3, `list_cards percorre três páginas em ${sortOrder}`);
  equal(
    new Set(pageSet.items.map((item) => item.id)).size,
    ownCards.length,
    `list_cards não repete cartões em ${sortOrder}`,
  );
  equal(
    pageSet.items.length,
    ownCards.length,
    `list_cards não perde cartões em ${sortOrder}`,
  );
  equal(
    pageSet.items
      .filter((item) => item.name === "Mesmo nome")
      .map((item) => item.id),
    sortOrder === "asc" ? [ids[1], ids[2]] : [ids[2], ids[1]],
    `list_cards usa id para desempatar nomes iguais em ${sortOrder}`,
  );
}

const validCard = card({ id: cardA });
const inactiveCard = card({ id: cardA, is_active: false });
const installmentRows = [
  expense({ id: ids[5], expense_date: "2026-08-01", shared_group_id: groupA }),
  expense({ id: ids[6], expense_date: "2026-08-02", installment_number: 2 }),
  expense({ id: ids[7], expense_date: "2026-08-02", installment_number: 3 }),
  expense({ id: ids[8], expense_date: "2026-08-03", installment_number: 4 }),
  expense({ id: ids[9], expense_date: "2026-08-04", installment_number: 5 }),
  expense({
    id: ids[10],
    user_id: userB,
    expense_date: "2026-08-01",
    shared_group_id: groupA,
  }),
];

{
  const database = useDatabase({
    cards: [validCard],
    expenses: installmentRows,
  });
  const response = await core.getCardInstallmentsTool.handler(
    { card_id: cardA, time_scope: "all" },
    contextFor(userA),
  );
  equal(
    database.calls.map((call) => call.table),
    ["cards", "expenses"],
    "get_card_installments consulta cards antes de expenses",
  );
  const cardCall = database.calls[0];
  const expenseCall = database.calls[1];
  check(hasOperation(cardCall, "eq", "id", cardA), "valida cards.id");
  check(hasOperation(cardCall, "eq", "user_id", userA), "valida cards.user_id");
  check(hasOperation(expenseCall, "eq", "user_id", userA), "filtra expenses.user_id");
  check(hasOperation(expenseCall, "eq", "card_id", cardA), "filtra expenses.card_id");
  check(
    response.structuredContent.installments.some((item) => item.is_shared),
    "despesa própria compartilhada aparece",
  );
  check(
    !response.structuredContent.installments.some(
      (item) => item.transaction_id === ids[10],
    ),
    "despesa compartilhada de outro usuário não aparece",
  );
  equal(
    operations(expenseCall, "order").map((operation) => operation.args[0]),
    ["expense_date", "id"],
    "parcelas usam expense_date + id",
  );
  check(
    response.content[0].text.includes("Cartão Principal") &&
      response.content[0].text.includes("Filtros de data:") &&
      response.content[0].text.includes("has_more=") &&
      response.content[0].text.includes("next_cursor="),
    "content de get_card_installments é autossuficiente",
  );
  check(
    z.object(core.getCardInstallmentsTool.outputSchema)
      .safeParse(response.structuredContent).success,
    "structuredContent real de parcelas valida no outputSchema",
  );
}

{
  const database = useDatabase({
    cards: [validCard, card({ id: cardB, user_id: userB })],
    expenses: installmentRows,
  });
  const foreign = await core.getCardInstallmentsTool.handler(
    { card_id: cardB },
    contextFor(userA),
  );
  const missing = await core.getCardInstallmentsTool.handler(
    { card_id: missingCard },
    contextFor(userA),
  );
  equal(
    foreign.structuredContent,
    missing.structuredContent,
    "cartão alheio e inexistente têm o mesmo payload público",
  );
  equal(
    foreign.content,
    missing.content,
    "cartão alheio e inexistente têm a mesma mensagem pública",
  );
  equal(
    foreign.structuredContent.error.code,
    "RESOURCE_NOT_FOUND",
    "cartão inacessível retorna RESOURCE_NOT_FOUND",
  );
  check(
    database.calls.every((call) => call.table === "cards"),
    "expenses não é consultada após cartão inválido",
  );
}

{
  useDatabase({ cards: [inactiveCard], expenses: installmentRows });
  const response = await core.getCardInstallmentsTool.handler(
    { card_id: cardA, time_scope: "all" },
    contextFor(userA),
  );
  check(response.structuredContent.installments.length > 0, "cartão inativo mantém histórico");
  check(
    response.structuredContent.series_warnings.includes("INACTIVE_CARD"),
    "cartão inativo gera warning",
  );
  check(response.content[0].text.includes("inativo"), "content identifica cartão inativo");
}

for (const sortOrder of ["asc", "desc"]) {
  useDatabase({ cards: [validCard], expenses: installmentRows });
  const pageSet = await collectPages(
    core.getCardInstallmentsTool,
    { card_id: cardA, time_scope: "all", sort_order: sortOrder, limit: 2 },
    contextFor(userA),
    "installments",
  );
  equal(
    pageSet.pages.length,
    3,
    `get_card_installments percorre três páginas em ${sortOrder}`,
  );
  equal(
    new Set(pageSet.items.map((item) => item.transaction_id)).size,
    5,
    `parcelas não se repetem em ${sortOrder}`,
  );
  equal(pageSet.items.length, 5, `parcelas não são perdidas em ${sortOrder}`);
  equal(
    pageSet.items
      .filter((item) => item.date === "2026-08-02")
      .map((item) => item.transaction_id),
    sortOrder === "asc" ? [ids[6], ids[7]] : [ids[7], ids[6]],
    `parcelas com a mesma data usam id em ${sortOrder}`,
  );
}

{
  useDatabase({ cards: [validCard], expenses: installmentRows });
  const firstPage = await core.getCardInstallmentsTool.handler(
    { card_id: cardA, time_scope: "all", limit: 2 },
    contextFor(userA),
  );
  const cursor = firstPage.structuredContent.next_cursor;
  check(cursor, "primeira página de parcelas produz cursor");
  for (const changedInput of [
    { card_id: missingCard, time_scope: "all", cursor },
    { card_id: cardA, time_scope: "future", cursor },
  ]) {
    const response = await core.getCardInstallmentsTool.handler(
      changedInput,
      contextFor(userA),
    );
    equal(
      response.structuredContent.error.code,
      "INVALID_CURSOR",
      "mudança de card_id ou time_scope invalida cursor",
    );
  }
}

{
  useDatabase({ cards: [...ownCards] });
  const cardPage = await core.listCardsTool.handler(
    { include_inactive: true, limit: 2 },
    contextFor(userA),
  );
  useDatabase({ cards: [validCard], expenses: installmentRows });
  const response = await core.getCardInstallmentsTool.handler(
    {
      card_id: cardA,
      time_scope: "all",
      cursor: cardPage.structuredContent.next_cursor,
    },
    contextFor(userA),
  );
  equal(
    response.structuredContent.error.code,
    "INVALID_CURSOR",
    "cursor de list_cards é rejeitado por get_card_installments",
  );
}

const installmentCases = [
  {
    name: "1/8 com grupo",
    row: expense({ installment_group_id: groupA, installment_number: 1, total_installments: 8 }),
    included: true,
  },
  {
    name: "1/8 sem grupo e total=8",
    row: expense({ installment_group_id: null, installment_number: 1, total_installments: 8 }),
    included: true,
    warnings: ["MISSING_INSTALLMENT_GROUP_ID"],
  },
  {
    name: "5/8 com grupo",
    row: expense({ installment_group_id: groupA, installment_number: 5, total_installments: 8 }),
    included: true,
  },
  {
    name: "5/8 sem grupo",
    row: expense({ installment_group_id: null, installment_number: 5, total_installments: 8 }),
    included: true,
    warnings: ["MISSING_INSTALLMENT_GROUP_ID"],
  },
  {
    name: "compra comum sem metadados",
    row: expense({
      installment_group_id: null,
      installment_number: null,
      total_installments: null,
    }),
    included: false,
  },
  {
    name: "1/1 sem grupo",
    row: expense({ installment_group_id: null, installment_number: 1, total_installments: 1 }),
    included: false,
  },
  {
    name: "1/1 com grupo",
    row: expense({ installment_group_id: groupA, installment_number: 1, total_installments: 1 }),
    included: true,
    warnings: ["TOTAL_INSTALLMENTS_BELOW_TWO"],
  },
  {
    name: "número nulo e total=8",
    row: expense({ installment_group_id: null, installment_number: null, total_installments: 8 }),
    included: true,
    warnings: ["MISSING_INSTALLMENT_NUMBER", "MISSING_INSTALLMENT_GROUP_ID"],
  },
  {
    name: "número=3 e total nulo",
    row: expense({ installment_group_id: null, installment_number: 3, total_installments: null }),
    included: true,
    warnings: ["MISSING_TOTAL_INSTALLMENTS", "MISSING_INSTALLMENT_GROUP_ID"],
  },
  {
    name: "número maior que total",
    row: expense({ installment_number: 9, total_installments: 8 }),
    included: true,
    warnings: ["INSTALLMENT_NUMBER_EXCEEDS_TOTAL"],
  },
  {
    name: "forma de pagamento não crédito",
    row: expense({ payment_method: "debit" }),
    included: true,
    warnings: ["NON_CREDIT_PAYMENT_METHOD"],
  },
  {
    name: "categoria nula",
    row: expense({ category_id: null, category_name: null, category_icon: null }),
    included: true,
    warnings: ["MISSING_CATEGORY"],
  },
];

let productionInstallmentPredicate;
for (const testCase of installmentCases) {
  const database = useDatabase({ cards: [validCard], expenses: [testCase.row] });
  const response = await core.getCardInstallmentsTool.handler(
    { card_id: cardA, time_scope: "all" },
    contextFor(userA),
  );
  equal(
    response.structuredContent.installments.length,
    testCase.included ? 1 : 0,
    `${testCase.name}: handler aplica a classificação de produção`,
  );
  const predicate = operations(database.calls[1], "or")
    .map((operation) => operation.args[0])
    .find((value) => value.includes("installment_group_id.not.is.null"));
  check(predicate, `${testCase.name}: consulta contém predicado de parcelas`);
  productionInstallmentPredicate ??= predicate;
  equal(predicate, productionInstallmentPredicate, "predicado de parcelas é estável");
  equal(
    evaluatePostgrestExpression(testCase.row, predicate),
    core.hasInstallmentEvidence(testCase.row),
    `${testCase.name}: helper e predicado PostgREST permanecem equivalentes`,
  );
  if (testCase.included) {
    const item = response.structuredContent.installments[0];
    for (const warning of testCase.warnings ?? []) {
      check(item.data_warnings.includes(warning), `${testCase.name}: warning ${warning}`);
    }
    check(
      response.structuredContent.series_warnings.includes(
        "SERIES_COMPLETENESS_NOT_VERIFIED",
      ),
      `${testCase.name}: não afirma completude da série`,
    );
  }
}

{
  const sameDescription = [
    expense({ id: ids[11], description: "Mesmo texto", installment_group_id: groupA }),
    expense({ id: ids[12], description: "Mesmo texto", installment_group_id: groupB }),
  ];
  useDatabase({ cards: [validCard], expenses: sameDescription });
  const response = await core.getCardInstallmentsTool.handler(
    { card_id: cardA, time_scope: "all" },
    contextFor(userA),
  );
  equal(response.structuredContent.installments.length, 2, "duas séries com mesma descrição são preservadas");
  equal(
    new Set(
      response.structuredContent.installments.map((item) => item.installment_group_id),
    ).size,
    2,
    "descrição igual não mistura installment_group_id",
  );
}

{
  const database = useDatabase({ cards: [validCard], expenses: installmentRows });
  await core.getCardInstallmentsTool.handler(
    {
      card_id: cardA,
      time_scope: "all",
      start_date: "2026-08-02",
      end_date: "2026-08-03",
    },
    contextFor(userA),
  );
  const call = firstCall(database, "expenses");
  check(hasOperation(call, "gte", "expense_date", "2026-08-02"), "start_date usa gte");
  check(hasOperation(call, "lte", "expense_date", "2026-08-03"), "end_date usa lte");
}

const fingerprint = await core.filtersFingerprint("list_cards", {
  include_inactive: false,
  card_type: null,
  sort_by: "name",
  sort_order: "asc",
});
const cursor = await core.encodeResourceCursor(
  {
    context: "list_cards",
    sort_by: "name",
    sort_order: "asc",
    sort_value: 'Cartão, "Principal"',
    id: cardA,
    filters_fingerprint: fingerprint,
  },
  secret,
);
const expectation = {
  context: "list_cards",
  sort_by: "name",
  sort_order: "asc",
  filters_fingerprint: fingerprint,
};
check((await core.decodeResourceCursor(cursor, expectation, secret))?.id === cardA, "cursor válido");
const [cursorPayload, cursorSignature] = cursor.split(".");
const alteredSignature =
  `${cursorSignature[0] === "A" ? "B" : "A"}${cursorSignature.slice(1)}`;
check(
  (await core.decodeResourceCursor(
    `${cursorPayload}.${alteredSignature}`,
    expectation,
    secret,
  )) === null,
  "assinatura adulterada",
);
check(
  (await core.decodeResourceCursor(
    cursor,
    { ...expectation, context: "get_card_installments" },
    secret,
  )) === null,
  "cursor vinculado ao contexto",
);
const changedFingerprint = await core.filtersFingerprint("list_cards", {
  include_inactive: true,
  card_type: null,
  sort_by: "name",
  sort_order: "asc",
});
check(
  (await core.decodeResourceCursor(
    cursor,
    { ...expectation, filters_fingerprint: changedFingerprint },
    secret,
  )) === null,
  "cursor vinculado aos filtros",
);

const tools = manifest.mcp.tools;
const names = tools.map((tool) => tool.name);
equal(tools.length, 48, "manifest contém exatamente 48 tools");
equal(
  names.slice(10, 30),
  [
    "list_cards",
    "get_card_installments",
    "get_card_summary",
    "list_recurring_transactions",
    "get_recurring_forecast",
    "list_goals",
    "get_goal_progress",
    "get_category_usage",
    "get_cashflow_series",
    "get_cashflow_projection",
    "update_expense",
    "update_income",
    "delete_expense",
    "delete_income",
    "create_recurring_expense",
    "create_recurring_income",
    "update_recurring_expense",
    "update_recurring_income",
    "delete_recurring_expense",
    "delete_recurring_income",
  ],
  "ordem das tools factuais",
);
for (const name of ["list_cards", "get_card_installments"]) {
  const tool = tools.find((candidate) => candidate.name === name);
  check(tool?.annotations?.readOnlyHint === true, `${name} é read-only`);
  check(tool?.outputSchema?.additionalProperties === false, `${name} possui output fechado`);
  check(!("user_id" in tool.inputSchema.properties), `${name} não aceita user_id`);
}
const listSchema = tools.find((tool) => tool.name === "list_cards");
const installmentTool = tools.find((tool) => tool.name === "get_card_installments");
check(
  listSchema.inputSchema.properties.limit.minimum === 1 &&
    listSchema.inputSchema.properties.limit.maximum === 100,
  "limites de list_cards",
);
check(
  installmentTool.inputSchema.properties.limit.minimum === 1 &&
    installmentTool.inputSchema.properties.limit.maximum === 100,
  "limites de get_card_installments",
);
check(
  !("user_id" in listSchema.outputSchema.properties.cards.items.properties),
  "cartão público não contém user_id",
);
check(
  !("user_id" in installmentTool.outputSchema.properties.installments.items.properties),
  "parcela pública não contém user_id",
);
check(!/(available_limit|invoice_total|fatura_atual)/u.test(listCardsSource), "sem cálculos derivados");
check(!/recurring_/u.test(installmentsSource), "não consulta recorrências");
check(
  /slice\(0, 10\)/u.test(listCardsSource) &&
    /slice\(0, 10\)/u.test(installmentsSource),
  "content limitado a dez itens",
);
check(
  /list_cards/u.test(indexSource) && /get_card_installments/u.test(indexSource),
  "instruções MCP registram as tools",
);
check(
  !/service_role|SERVICE_ROLE/u.test(`${listCardsSource}${installmentsSource}`),
  "tools não usam service_role",
);
check(
  /name:\s*"list_cards"/u.test(bundleSource) &&
    /name:\s*"get_card_installments"/u.test(bundleSource),
  "bundle existente contém as duas tools",
);

console.log(
  `Fase MCP 1.1C-A1: ${checks} verificações diretas e de contrato concluídas.`,
);
