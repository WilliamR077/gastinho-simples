import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { build } from "esbuild";
import { z } from "zod";

const mockPlugin = {
  name: "phase-1.2a-supabase-mock",
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
      export { default as updateExpense } from "./src/lib/mcp/tools/update-expense.ts";
      export { default as updateIncome } from "./src/lib/mcp/tools/update-income.ts";
      export * from "./src/lib/mcp/shared/transaction-update.ts";
      export { expenseItem, incomeItem } from "./src/lib/mcp/shared/transaction-query.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2a-entry.ts",
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
const groupA = "30000000-0000-4000-8000-000000000003";
const expenseId = "40000000-0000-4000-8000-000000000004";
const siblingId = "40000000-0000-4000-8000-000000000005";
const incomeId = "50000000-0000-4000-8000-000000000005";
const expenseCategoryId = "60000000-0000-4000-8000-000000000006";
const otherExpenseCategoryId = "60000000-0000-4000-8000-000000000007";
const incomeCategoryId = "70000000-0000-4000-8000-000000000007";
const otherIncomeCategoryId = "70000000-0000-4000-8000-000000000008";
const creditCardId = "80000000-0000-4000-8000-000000000008";
const debitCardId = "80000000-0000-4000-8000-000000000009";
const otherCardId = "80000000-0000-4000-8000-000000000010";
const inactiveCardId = "80000000-0000-4000-8000-000000000011";
const installmentGroupId = "90000000-0000-4000-8000-000000000009";
const t0 = "2026-07-01T12:00:00.000Z";

const expense = (overrides = {}) => ({
  id: expenseId,
  user_id: userA,
  description: "Mercado",
  amount: 100,
  expense_date: "2026-07-10",
  category_id: null,
  category_name: null,
  category_icon: null,
  payment_method: "pix",
  card_id: null,
  card_name: null,
  card_color: null,
  shared_group_id: null,
  is_shared: false,
  installment_group_id: null,
  installment_number: null,
  total_installments: null,
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: t0,
  ...overrides,
});
const income = (overrides = {}) => ({
  id: incomeId,
  user_id: userA,
  description: "Salário",
  amount: 3000,
  income_date: "2026-07-10T03:00:00.000Z",
  income_category_id: null,
  category_name: null,
  category_icon: null,
  shared_group_id: null,
  installment_group_id: null,
  installment_number: null,
  total_installments: null,
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: t0,
  ...overrides,
});
const baseTables = (overrides = {}) => ({
  expenses: [expense()],
  incomes: [income()],
  user_categories: [
    {
      id: expenseCategoryId,
      user_id: userA,
      name: "Alimentação",
      icon: "🍔",
      is_active: true,
    },
    {
      id: otherExpenseCategoryId,
      user_id: userB,
      name: "Privada",
      icon: "🔒",
      is_active: true,
    },
  ],
  user_income_categories: [
    {
      id: incomeCategoryId,
      user_id: userA,
      name: "Salário",
      icon: "💰",
      is_active: true,
    },
    {
      id: otherIncomeCategoryId,
      user_id: userB,
      name: "Privada",
      icon: "🔒",
      is_active: true,
    },
  ],
  cards: [
    {
      id: creditCardId,
      user_id: userA,
      name: "Crédito",
      color: "#111111",
      card_type: "credit",
      is_active: true,
    },
    {
      id: debitCardId,
      user_id: userA,
      name: "Débito",
      color: "#222222",
      card_type: "debit",
      is_active: true,
    },
    {
      id: otherCardId,
      user_id: userB,
      name: "Alheio",
      color: "#333333",
      card_type: "credit",
      is_active: true,
    },
    {
      id: inactiveCardId,
      user_id: userA,
      name: "Antigo",
      color: "#444444",
      card_type: "credit",
      is_active: false,
    },
  ],
  ...overrides,
});

class Query {
  constructor(db, table, call) {
    this.db = db;
    this.table = table;
    this.call = call;
    this.filters = [];
    this.columns = null;
    this.patch = null;
  }
  op(method, ...args) {
    this.call.operations.push({ method, args });
  }
  select(columns) {
    this.op("select", columns);
    this.columns = columns.split(",").map((column) => column.trim());
    return this;
  }
  update(patch) {
    this.op("update", patch);
    this.patch = { ...patch };
    return this;
  }
  eq(column, value) {
    this.op("eq", column, value);
    this.filters.push((row) => row[column] === value);
    return this;
  }
  async maybeSingle() {
    return this.execute();
  }
  visible(row) {
    if (["user_categories", "user_income_categories", "cards"].includes(this.table)) {
      return row.user_id === this.db.userId;
    }
    return row.user_id === this.db.userId || row.shared_group_id === groupA;
  }
  project(row) {
    if (!this.columns) return { ...row };
    return Object.fromEntries(this.columns.map((column) => [column, row[column]]));
  }
  async execute() {
    const rows = this.db.tables[this.table] ?? [];
    if (this.patch && this.db.raceOnUpdate && !this.db.raceApplied) {
      const target = rows.find((row) => row.id === this.db.raceId);
      if (target) target.updated_at = "2026-07-01T12:00:01.000Z";
      this.db.raceApplied = true;
    }
    let matched = rows.filter((row) => this.visible(row));
    for (const filter of this.filters) matched = matched.filter(filter);
    if (this.patch) {
      matched = matched.filter((row) => row.user_id === this.db.userId);
      for (const row of matched) {
        Object.assign(row, this.patch);
        row.updated_at = this.db.nextTimestamp();
        this.db.updatedIds.push(row.id);
      }
    }
    return {
      data: matched.length === 1 ? this.project(matched[0]) : null,
      error: null,
    };
  }
}

class DB {
  constructor(tables, options = {}) {
    this.tables = structuredClone(tables);
    this.userId = userA;
    this.calls = [];
    this.updatedIds = [];
    this.tick = 1;
    this.raceOnUpdate = options.raceOnUpdate ?? false;
    this.raceId = options.raceId ?? expenseId;
    this.raceApplied = false;
  }
  nextTimestamp() {
    return `2026-07-01T12:00:${String(this.tick++).padStart(2, "0")}.000Z`;
  }
  from(table) {
    const call = { table, operations: [] };
    this.calls.push(call);
    return new Query(this, table, call);
  }
}

const ctx = {
  isAuthenticated: () => true,
  getUserId: () => userA,
  getToken: () => "synthetic",
};
const use = (tables = baseTables(), options) => {
  const db = new DB(tables, options);
  globalThis.__MCP_TEST_SUPABASE__ = db;
  return db;
};
const expenseInput = (changes, overrides = {}) => ({
  expense_id: expenseId,
  expected_updated_at: t0,
  changes,
  ...overrides,
});
const incomeInput = (changes, overrides = {}) => ({
  income_id: incomeId,
  expected_updated_at: t0,
  changes,
  ...overrides,
});

async function expenseCase(changes, rowOverrides = {}, inputOverrides = {}) {
  const db = use(baseTables({ expenses: [expense(rowOverrides)] }));
  const result = await core.updateExpense.handler(
    expenseInput(changes, inputOverrides),
    ctx,
  );
  return { db, result };
}
async function incomeCase(changes, rowOverrides = {}, inputOverrides = {}) {
  const db = use(baseTables({ incomes: [income(rowOverrides)] }));
  const result = await core.updateIncome.handler(
    incomeInput(changes, inputOverrides),
    ctx,
  );
  return { db, result };
}

{
  const { result } = await expenseCase({ description: "Feira" });
  equal(result.structuredContent.after.description, "Feira", "expense descrição");
  equal(result.structuredContent.before.description, "Mercado", "expense before");
  equal(result.structuredContent.changed_fields, ["description"], "expense changed_fields");
  check(result.structuredContent.applied, "expense aplicada");
  check(result.structuredContent.updated_at_after !== t0, "expense updated_at alterado");
}
{
  const { result } = await expenseCase({ amount: 125.5 });
  equal(result.structuredContent.after.amount, 125.5, "expense valor");
  equal(result.structuredContent.changed_fields, ["amount"], "expense campo valor");
}
{
  const { result } = await expenseCase(
    { expense_date: "2026-08-01" },
    { expense_date: "2026-07-01T00:00:00.000Z" },
  );
  equal(result.structuredContent.before.expense_date, "2026-07-01", "DATE anterior civil");
  equal(result.structuredContent.after.expense_date, "2026-08-01", "DATE novo civil");
  check(!result.content[0].text.includes("2026-07-31"), "DATE sem deslocamento");
}
{
  const { result } = await expenseCase({ category_id: expenseCategoryId });
  equal(result.structuredContent.after.category_id, expenseCategoryId, "categoria aplicada");
  equal(result.structuredContent.after.category_name, "Alimentação", "snapshot nome");
  equal(result.structuredContent.after.category_icon, "🍔", "snapshot ícone");
  check(result.structuredContent.warnings.includes("CATEGORY_SNAPSHOT_UPDATED"), "warning categoria");
}
{
  const { result } = await expenseCase(
    { category_id: null },
    {
      category_id: expenseCategoryId,
      category_name: "Alimentação",
      category_icon: "🍔",
    },
  );
  equal(result.structuredContent.after.category_id, null, "categoria limpa");
  equal(result.structuredContent.after.category_name, null, "snapshot categoria limpo");
}
{
  const { result } = await expenseCase({ payment_method: "cash" });
  equal(result.structuredContent.after.payment_method, "cash", "método atualizado");
}
{
  const { result } = await expenseCase({
    payment_method: "credit",
    card_id: creditCardId,
  });
  equal(result.structuredContent.after.card_id, creditCardId, "cartão aplicado");
  equal(result.structuredContent.after.card_name, "Crédito", "snapshot cartão");
  check(result.structuredContent.warnings.includes("CARD_REFERENCE_UPDATED"), "warning cartão");
}
{
  const { result } = await expenseCase(
    { payment_method: "pix" },
    {
      payment_method: "credit",
      card_id: creditCardId,
      card_name: "Crédito",
      card_color: "#111111",
    },
  );
  equal(result.structuredContent.after.card_id, null, "cartão limpo pelo método");
  check(result.structuredContent.changed_fields.includes("card_id"), "limpeza em changed_fields");
}
{
  const { result } = await expenseCase({
    payment_method: "credit",
    card_id: otherCardId,
  });
  errorCode(result, "CARD_NOT_FOUND", "cartão de outro usuário");
}
{
  const { result } = await expenseCase({ category_id: otherExpenseCategoryId });
  errorCode(result, "CATEGORY_NOT_FOUND", "categoria de outro usuário");
}
{
  const { result } = await expenseCase({
    description: "Mercado mensal",
    amount: 210,
    expense_date: "2026-08-02",
  });
  equal(result.structuredContent.changed_fields, ["description", "amount", "expense_date"], "patch múltiplo");
  equal(result.structuredContent.after.payment_method, "pix", "campo omitido preservado");
  equal(result.structuredContent.after.category_id, null, "categoria omitida preservada");
}
{
  const { db, result } = await expenseCase({ description: "Mercado" });
  equal(result.structuredContent.applied, false, "no-op");
  equal(result.structuredContent.changed_fields, [], "no-op sem campos");
  equal(result.structuredContent.updated_at_after, t0, "no-op preserva updated_at");
  check(result.structuredContent.warnings.includes("NO_EFFECTIVE_CHANGES"), "warning no-op");
  equal(db.updatedIds, [], "no-op sem update");
  check(result.content[0].text.includes("nenhuma mudança efetiva"), "content no-op");
}

for (const [changes, code, label] of [
  [{ amount: -1 }, "INVALID_PATCH", "valor negativo"],
  [{ amount: Number.NaN }, "INVALID_PATCH", "NaN"],
  [{ amount: Number.POSITIVE_INFINITY }, "INVALID_PATCH", "Infinity"],
  [{ expense_date: "2026-02-30" }, "INVALID_PATCH", "data inexistente"],
  [{ expense_date: "01/08/2026" }, "INVALID_PATCH", "data ambígua"],
  [{ extra: true }, "INVALID_PATCH", "campo extra"],
  [{ user_id: userB }, "INVALID_PATCH", "user_id"],
  [{ shared_group_id: groupA }, "INVALID_PATCH", "compartilhamento"],
  [{ installment_number: 2 }, "INVALID_PATCH", "metadado parcela"],
  [{ description: "" }, "INVALID_PATCH", "descrição vazia"],
  [{ description: "x".repeat(201) }, "INVALID_PATCH", "descrição longa"],
]) {
  const db = use();
  const result = await core.updateExpense.handler(expenseInput(changes), ctx);
  errorCode(result, code, `expense rejeita ${label}`);
  equal(db.updatedIds, [], `${label} não atualiza`);
}
{
  use();
  const result = await core.updateExpense.handler(
    expenseInput({ description: "x" }, { expense_id: "inválido" }),
    ctx,
  );
  errorCode(result, "INVALID_INPUT", "UUID inválido");
}
{
  use();
  const result = await core.updateExpense.handler(
    expenseInput({ description: "x" }, { expected_updated_at: "ontem" }),
    ctx,
  );
  errorCode(result, "INVALID_INPUT", "timestamp de concorrência inválido");
}
{
  use(baseTables({ expenses: [] }));
  const result = await core.updateExpense.handler(expenseInput({ amount: 2 }), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "expense inexistente");
}
for (const row of [
  expense({ user_id: userB, shared_group_id: null }),
  expense({ user_id: userB, shared_group_id: groupA, is_shared: true }),
]) {
  use(baseTables({ expenses: [row] }));
  const result = await core.updateExpense.handler(expenseInput({ amount: 2 }), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "expense alheia indistinguível");
  check(!result.content[0].text.includes(userB), "sem proprietário no erro");
}
{
  const { result } = await expenseCase(
    { amount: 101 },
    { shared_group_id: groupA, is_shared: true },
  );
  check(result.structuredContent.warnings.includes("SHARED_RECORD_UPDATED"), "warning compartilhada própria");
  equal(result.structuredContent.after.shared_group_id, groupA, "grupo preservado");
  equal(result.structuredContent.after.is_shared, true, "sharing preservado");
}
{
  const { db, result } = await expenseCase(
    { amount: 101 },
    {},
    { expected_updated_at: "2026-06-01T00:00:00.000Z" },
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "expected desatualizado");
  equal(db.updatedIds, [], "conflito inicial sem update");
}
{
  const db = use(baseTables(), { raceOnUpdate: true, raceId: expenseId });
  const result = await core.updateExpense.handler(
    expenseInput({ description: "corrida" }),
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "corrida no update");
  equal(db.updatedIds, [], "corrida não sobrescreve");
}
{
  const db = use();
  const result = await core.updateExpense.handler(
    expenseInput({ description: "não aplicar", category_id: otherExpenseCategoryId }),
    ctx,
  );
  errorCode(result, "CATEGORY_NOT_FOUND", "validação integral antes do write");
  equal(db.updatedIds, [], "sem atualização parcial");
  equal(db.tables.expenses[0].description, "Mercado", "descrição não aplicada parcialmente");
}
{
  const row = expense({
    installment_group_id: installmentGroupId,
    installment_number: 2,
    total_installments: 4,
  });
  const sibling = expense({
    id: siblingId,
    installment_group_id: installmentGroupId,
    installment_number: 3,
    total_installments: 4,
  });
  let db = use(baseTables({ expenses: [row, sibling] }));
  let result = await core.updateExpense.handler(
    expenseInput({ amount: 80 }),
    ctx,
  );
  errorCode(result, "CONFIRMATION_REQUIRED", "parcela exige confirmação");
  check(result.content[0].text.includes("Somente esta linha"), "content confirmação");
  equal(db.updatedIds, [], "sem confirmação não atualiza");

  db = use(baseTables({ expenses: [row, sibling] }));
  result = await core.updateExpense.handler(
    expenseInput(
      { amount: 80 },
      { confirm_single_installment_update: true },
    ),
    ctx,
  );
  equal(db.updatedIds, [expenseId], "somente parcela escolhida atualizada");
  equal(db.tables.expenses[1].amount, 100, "parcela irmã intacta");
  equal(result.structuredContent.after.installment_group_id, installmentGroupId, "grupo de parcela preservado");
  equal(result.structuredContent.after.installment_number, 2, "número preservado");
  equal(result.structuredContent.after.total_installments, 4, "total preservado");
  check(result.structuredContent.warnings.includes("ONLY_ONE_INSTALLMENT_UPDATED"), "warning parcela structured");
  check(result.content[0].text.includes("ONLY_ONE_INSTALLMENT_UPDATED"), "warning parcela content");
}
{
  const { result } = await expenseCase(
    { description: "Histórico" },
    {
      payment_method: "credit",
      card_id: inactiveCardId,
      card_name: "Antigo",
      card_color: "#444444",
    },
  );
  equal(result.structuredContent.after.card_id, inactiveCardId, "cartão histórico inativo preservado");
}
{
  const { result } = await expenseCase({
    payment_method: "credit",
    card_id: inactiveCardId,
  });
  errorCode(result, "CARD_NOT_FOUND", "nova atribuição inativa rejeitada");
}
{
  const { result } = await expenseCase({
    payment_method: "credit",
    card_id: debitCardId,
  });
  errorCode(result, "BUSINESS_RULE_VIOLATION", "cartão incompatível");
}
{
  const { result } = await expenseCase({
    payment_method: "pix",
    card_id: creditCardId,
  });
  errorCode(result, "BUSINESS_RULE_VIOLATION", "combinação impossível");
}

{
  const { result } = await incomeCase({ description: "Salário líquido" });
  equal(result.structuredContent.after.description, "Salário líquido", "income descrição");
  equal(result.structuredContent.changed_fields, ["description"], "income changed_fields");
  check(result.structuredContent.updated_at_after !== t0, "income updated_at alterado");
}
{
  const { result } = await incomeCase({ amount: 3200.75 });
  equal(result.structuredContent.after.amount, 3200.75, "income valor");
}
{
  const { db, result } = await incomeCase({ income_date: "2026-08-01" });
  equal(db.tables.incomes[0].income_date, "2026-08-01T03:00:00.000Z", "income meia-noite São Paulo");
  equal(result.structuredContent.changed_fields, ["income_date"], "income data alterada");
}
{
  const { result } = await incomeCase(
    { income_date: "2026-07-10" },
    { income_date: "2026-07-10T03:00:00.000Z" },
  );
  equal(result.structuredContent.applied, false, "mesma data civil é no-op");
}
{
  const { result } = await incomeCase({ income_category_id: incomeCategoryId });
  equal(result.structuredContent.after.income_category_id, incomeCategoryId, "categoria income");
  equal(result.structuredContent.after.category_name, "Salário", "snapshot income");
  check(result.structuredContent.warnings.includes("CATEGORY_SNAPSHOT_UPDATED"), "warning categoria income");
}
{
  const { result } = await incomeCase(
    { income_category_id: null },
    {
      income_category_id: incomeCategoryId,
      category_name: "Salário",
      category_icon: "💰",
    },
  );
  equal(result.structuredContent.after.income_category_id, null, "categoria income limpa");
  equal(result.structuredContent.after.category_name, null, "snapshot income limpo");
}
{
  const { result } = await incomeCase({
    description: "Bônus",
    amount: 500,
    income_date: "2026-08-02",
  });
  equal(result.structuredContent.changed_fields, ["description", "amount", "income_date"], "income patch múltiplo");
  equal(result.structuredContent.after.income_category_id, null, "income omitido preservado");
}
{
  const { db, result } = await incomeCase({ amount: 3000 });
  equal(result.structuredContent.applied, false, "income no-op");
  check(result.structuredContent.warnings.includes("NO_EFFECTIVE_CHANGES"), "income warning no-op");
  equal(db.updatedIds, [], "income no-op sem write");
  check(result.content[0].text.includes("Estado anterior seguro"), "income content no-op completo");
}
for (const [changes, label] of [
  [{ amount: 0 }, "valor inválido"],
  [{ income_date: "2026-13-01" }, "data inválida"],
  [{ income_category_id: otherIncomeCategoryId }, "categoria alheia"],
]) {
  const db = use();
  const result = await core.updateIncome.handler(incomeInput(changes), ctx);
  errorCode(
    result,
    label === "categoria alheia" ? "CATEGORY_NOT_FOUND" : "INVALID_PATCH",
    `income ${label}`,
  );
  equal(db.updatedIds, [], `income ${label} sem write`);
}
{
  use(baseTables({ incomes: [] }));
  const result = await core.updateIncome.handler(incomeInput({ amount: 2 }), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "income inexistente");
}
for (const row of [
  income({ user_id: userB, shared_group_id: null }),
  income({ user_id: userB, shared_group_id: groupA }),
]) {
  use(baseTables({ incomes: [row] }));
  const result = await core.updateIncome.handler(incomeInput({ amount: 2 }), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "income alheia indistinguível");
  check(!result.content[0].text.includes(userB), "income sem proprietário");
}
{
  const { result } = await incomeCase(
    { amount: 3100 },
    { shared_group_id: groupA },
  );
  check(result.structuredContent.warnings.includes("SHARED_RECORD_UPDATED"), "income compartilhada própria");
  equal(result.structuredContent.after.shared_group_id, groupA, "income grupo preservado");
}
{
  const { db, result } = await incomeCase(
    { amount: 3100 },
    {},
    { expected_updated_at: "2026-06-01T00:00:00.000Z" },
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "income expected desatualizado");
  equal(db.updatedIds, [], "income conflito sem write");
}
{
  const db = use(baseTables(), { raceOnUpdate: true, raceId: incomeId });
  const result = await core.updateIncome.handler(
    incomeInput({ description: "corrida" }),
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "income corrida");
  equal(db.updatedIds, [], "income corrida não sobrescreve");
}
{
  const db = use();
  const result = await core.updateIncome.handler(
    incomeInput({ description: "não aplicar", income_category_id: otherIncomeCategoryId }),
    ctx,
  );
  errorCode(result, "CATEGORY_NOT_FOUND", "income valida antes");
  equal(db.tables.incomes[0].description, "Salário", "income sem parcial");
}

for (const [tool, kind] of [
  [core.updateExpense, "expense"],
  [core.updateIncome, "income"],
]) {
  const output = z.object(tool.outputSchema).strict();
  const { result } =
    kind === "expense"
      ? await expenseCase({ amount: 111 })
      : await incomeCase({ amount: 3111 });
  check(output.safeParse(result.structuredContent).success, `${kind} outputSchema real`);
  check(!JSON.stringify(tool.inputSchema).includes("user_id"), `${kind} input sem user_id`);
  check(!JSON.stringify(tool.outputSchema).includes("user_id"), `${kind} output sem user_id`);
  equal(tool.annotations.readOnlyHint, false, `${kind} write`);
  equal(tool.annotations.destructiveHint, true, `${kind} destructive`);
  equal(tool.annotations.openWorldHint, false, `${kind} closed world`);
  check(!("idempotentHint" in tool.annotations), `${kind} sem idempotência incorreta`);
  check(result.content[0].text.includes("Alterações:"), `${kind} content alterações`);
  check(result.content[0].text.includes("Estado final confirmado pelo banco"), `${kind} content after`);
  check(!result.content[0].text.includes(userA), `${kind} content sem proprietário`);
}

const readExpense = core.expenseItem(expense({ updated_at: t0 }), userA);
const readIncome = core.incomeItem(income({ updated_at: t0 }), userA);
equal(readExpense.updated_at, t0, "list_expenses recebe updated_at");
equal(readIncome.updated_at, t0, "list_incomes recebe updated_at");

const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const tools = manifest.mcp.tools;
equal(tools.length, 40, "manifest 40 tools");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === true).length, 18, "18 read-only");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint !== true).length, 22, "22 write");
for (const name of ["update_expense", "update_income"]) {
  const tool = tools.find((candidate) => candidate.name === name);
  check(tool, `${name} no manifest`);
  equal(tool.annotations.readOnlyHint, false, `${name} manifest write`);
  equal(tool.annotations.destructiveHint, true, `${name} manifest destructive`);
  check(tool.inputSchema.required.includes("expected_updated_at"), `${name} expected obrigatório`);
  equal(tool.inputSchema.properties.changes.additionalProperties, false, `${name} changes fechado`);
  check(!("user_id" in tool.inputSchema.properties), `${name} manifest sem user_id`);
  check(!JSON.stringify(tool.outputSchema).includes("user_id"), `${name} manifest output seguro`);
}
for (const name of ["list_expenses", "list_incomes", "search_transactions"]) {
  const tool = tools.find((candidate) => candidate.name === name);
  check(JSON.stringify(tool.outputSchema).includes("updated_at"), `${name} expõe updated_at`);
}

const bundle = await readFile("supabase/functions/mcp/index.ts", "utf8");
check(bundle.includes('name: "update_expense"'), "bundle update_expense");
check(bundle.includes('name: "update_income"'), "bundle update_income");
check(bundle.includes("Deno.serve"), "bundle Deno.serve");
check(!bundle.includes("@/"), "bundle sem alias");
check(!bundle.includes("npm:@/"), "bundle sem npm alias");
check(!/(?:^|["'`(=\s])[A-Za-z]:[\\/]/mu.test(bundle), "bundle sem caminho Windows");
check(!/service_role|SERVICE_ROLE/u.test(bundle), "bundle sem service role");
check(bundle.includes("supabaseForUser(ctx)"), "tools usam supabaseForUser");

const migrationNames = await readdir("supabase/migrations");
check(migrationNames.every((name) => name.endsWith(".sql")), "nenhuma migration de teste");
const updateExpenseSource = await readFile("src/lib/mcp/tools/update-expense.ts", "utf8");
const updateIncomeSource = await readFile("src/lib/mcp/tools/update-income.ts", "utf8");
for (const source of [updateExpenseSource, updateIncomeSource]) {
  check(source.includes('.eq("user_id", userId)'), "filtro explícito de proprietário");
  check(source.includes('.eq("updated_at", input.expected_updated_at)'), "CAS por updated_at");
  check(!source.includes('.eq("installment_group_id"'), "sem update em lote");
}
check(updateExpenseSource.includes("confirm_single_installment_update"), "confirmação de parcela");
check(!updateIncomeSource.includes("service_role"), "income sem service role");

console.log(`Fase MCP 1.2A: ${checks} verificações diretas, regressivas e de contrato concluídas.`);
