import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { build } from "esbuild";
import { z } from "zod";

const mockPlugin = {
  name: "phase-1.2d-b1-supabase-mock",
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
      export { default as createCard } from "./src/lib/mcp/tools/create-card.ts";
      export { default as updateCard } from "./src/lib/mcp/tools/update-card.ts";
      export * from "./src/lib/mcp/shared/card-write.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2d-b1-entry.ts",
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
const cardId = "30000000-0000-4000-8000-000000000003";
const otherCardId = "40000000-0000-4000-8000-000000000004";
const t0 = "2026-07-01T12:00:00.000Z";
const t1 = "2026-07-01T12:00:01.000Z";
const defaultBilling = core.deriveBillingDays(10, 10);

const card = (overrides = {}) => ({
  id: cardId,
  user_id: userA,
  name: "Principal",
  card_type: "credit",
  color: "#FFA500",
  card_limit: 5000,
  opening_day: defaultBilling.opening_day,
  closing_day: defaultBilling.closing_day,
  due_day: 10,
  days_before_due: 10,
  is_active: true,
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: t0,
  ...overrides,
});
const baseTables = (overrides = {}) => ({
  cards: [card()],
  expenses: [
    {
      id: "50000000-0000-4000-8000-000000000005",
      user_id: userA,
      card_id: cardId,
      expense_date: "2026-07-01",
      installment_group_id: null,
      card_name: "Principal",
      card_color: "#FFA500",
    },
    {
      id: "60000000-0000-4000-8000-000000000006",
      user_id: userA,
      card_id: cardId,
      expense_date: "2099-08-01",
      installment_group_id: "70000000-0000-4000-8000-000000000007",
      card_name: "Principal",
      card_color: "#FFA500",
    },
    {
      id: "80000000-0000-4000-8000-000000000008",
      user_id: userB,
      card_id: cardId,
      expense_date: "2026-07-01",
      installment_group_id: null,
    },
  ],
  recurring_expenses: [
    {
      id: "90000000-0000-4000-8000-000000000009",
      user_id: userA,
      card_id: cardId,
      is_active: true,
      card_name: "Principal",
      card_color: "#FFA500",
    },
    {
      id: "a0000000-0000-4000-8000-000000000010",
      user_id: userB,
      card_id: cardId,
      is_active: true,
    },
  ],
  credit_card_configs: [
    {
      id: "b0000000-0000-4000-8000-000000000011",
      user_id: userA,
      opening_day: 16,
      closing_day: 15,
    },
  ],
  incomes: [{ id: "c0000000-0000-4000-8000-000000000012" }],
  ...overrides,
});

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.columns = null;
    this.mode = "select";
    this.payload = null;
    this.head = false;
  }
  record(method, ...args) {
    this.db.calls.push({ table: this.table, method, args });
  }
  select(columns, options = {}) {
    this.record("select", columns, options);
    this.columns = columns.split(",").map((value) => value.trim());
    this.head = options.head === true;
    return this;
  }
  insert(payload) {
    this.record("insert", payload);
    this.mode = "insert";
    this.payload = Array.isArray(payload) ? payload[0] : payload;
    return this;
  }
  update(payload) {
    this.record("update", payload);
    this.mode = "update";
    this.payload = payload;
    return this;
  }
  eq(column, value) {
    this.record("eq", column, value);
    this.filters.push((row) => row[column] === value);
    return this;
  }
  lte(column, value) {
    this.record("lte", column, value);
    this.filters.push((row) => row[column] <= value);
    return this;
  }
  gt(column, value) {
    this.record("gt", column, value);
    this.filters.push((row) => row[column] > value);
    return this;
  }
  not(column, operator, value) {
    this.record("not", column, operator, value);
    if (operator === "is" && value === null) {
      this.filters.push((row) => row[column] !== null);
    }
    return this;
  }
  visible(row) {
    if (this.table === "cards") return row.user_id === this.db.userId;
    return true;
  }
  project(row) {
    if (!this.columns) return structuredClone(row);
    return Object.fromEntries(
      this.columns.map((column) => [column, row[column] ?? null]),
    );
  }
  matching() {
    let rows = (this.db.tables[this.table] ?? []).filter((row) => this.visible(row));
    for (const filter of this.filters) rows = rows.filter(filter);
    return rows;
  }
  execute(single) {
    if (this.db.writeError && this.mode !== "select") {
      return { data: null, error: { message: "synthetic SQL detail" }, count: null };
    }
    if (
      this.db.raceOnUpdate &&
      this.mode === "update" &&
      !this.db.raceApplied
    ) {
      const target = this.db.tables.cards.find((row) => row.id === cardId);
      if (target) target.updated_at = "2026-07-01T12:00:00.500Z";
      this.db.raceApplied = true;
    }
    if (this.mode === "insert") {
      const row = {
        id: this.db.nextId(),
        created_at: t0,
        updated_at: t0,
        ...structuredClone(this.payload),
      };
      this.db.tables.cards.push(row);
      this.db.writes.push({ table: this.table, mode: "insert", id: row.id });
      return { data: this.project(row), error: null, count: null };
    }
    const matched = this.matching();
    if (this.mode === "select") {
      return {
        data: this.head
          ? null
          : single
            ? matched.length === 1
              ? this.project(matched[0])
              : null
            : matched.map((row) => this.project(row)),
        error: null,
        count: this.head ? matched.length : null,
      };
    }
    const owned = matched.filter((row) => row.user_id === this.db.userId);
    if (owned.length !== 1) return { data: null, error: null, count: null };
    const row = owned[0];
    Object.assign(row, structuredClone(this.payload), { updated_at: t1 });
    this.db.writes.push({ table: this.table, mode: "update", id: row.id });
    return { data: this.project(row), error: null, count: null };
  }
  async maybeSingle() {
    return this.execute(true);
  }
  async single() {
    return this.execute(true);
  }
  then(resolve, reject) {
    return Promise.resolve(this.execute(false)).then(resolve, reject);
  }
}
class DB {
  constructor(tables, options = {}) {
    this.tables = structuredClone(tables);
    this.userId = userA;
    this.calls = [];
    this.writes = [];
    this.writeError = options.writeError ?? false;
    this.raceOnUpdate = options.raceOnUpdate ?? false;
    this.raceApplied = false;
    this.sequence = 13;
  }
  nextId() {
    return `d0000000-0000-4000-8000-${String(this.sequence++).padStart(12, "0")}`;
  }
  from(table) {
    return new Query(this, table);
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
const creditInput = (overrides = {}) => ({
  name: "  Cartão Azul  ",
  card_type: "credit",
  due_day: 10,
  days_before_due: 10,
  card_limit: 3000,
  color: "#3B82F6",
  ...overrides,
});
const updateInput = (changes, overrides = {}) => ({
  card_id: cardId,
  expected_updated_at: t0,
  changes,
  ...overrides,
});

{
  const db = use();
  const result = await core.createCard.handler(creditInput(), ctx);
  equal(result.structuredContent.created, true, "crédito criado");
  equal(result.structuredContent.card.name, "Cartão Azul", "nome normalizado");
  equal(result.structuredContent.card.card_type, "credit", "tipo crédito");
  equal(result.structuredContent.card.color, "#3B82F6", "cor");
  equal(result.structuredContent.card.card_limit, 3000, "limite");
  equal(result.structuredContent.card.due_day, 10, "vencimento");
  equal(result.structuredContent.card.days_before_due, 10, "antecedência");
  equal(result.structuredContent.card.is_active, true, "ativo default");
  check(result.structuredContent.card.opening_day !== null, "opening derivado");
  check(result.structuredContent.card.closing_day !== null, "closing derivado");
  check(result.structuredContent.warnings.includes("CARD_CREATED"), "warning create");
  check(!("user_id" in result.structuredContent.card), "output sem user");
  equal(db.writes.length, 1, "um insert");
  equal(db.tables.expenses.length, 3, "nenhuma expense criada");
  equal(db.tables.recurring_expenses.length, 2, "nenhum template criado");
  equal(db.tables.credit_card_configs.length, 1, "legado intacto");
  check(result.content[0].text.includes("Nenhuma despesa, parcela"), "content preservação");
  check(result.content[0].text.includes("Nenhuma ação foi enviada ao banco emissor"), "content emissor");
  check(result.content[0].text.includes("não representa saldo bancário nem limite disponível"), "content limite");
}
{
  use();
  const result = await core.createCard.handler(
    { name: "Débito", card_type: "debit" },
    ctx,
  );
  equal(result.structuredContent.card.card_type, "debit", "débito criado");
  equal(result.structuredContent.card.color, "#FFA500", "cor default");
  equal(result.structuredContent.card.card_limit, null, "limite omitido");
  equal(result.structuredContent.card.opening_day, null, "débito sem opening");
  equal(result.structuredContent.card.closing_day, null, "débito sem closing");
  equal(result.structuredContent.card.due_day, null, "débito sem due");
  equal(result.structuredContent.card.days_before_due, null, "débito sem antecedência");
  check(result.structuredContent.warnings.includes("CARD_WITHOUT_LIMIT"), "warning sem limite");
}
{
  use();
  const result = await core.createCard.handler(
    { name: "Ambos", card_type: "both", due_day: 31 },
    ctx,
  );
  equal(result.structuredContent.card.card_type, "both", "tipo both");
  equal(result.structuredContent.card.days_before_due, 10, "default antecedência");
  check(result.structuredContent.warnings.includes("BILLING_DAY_MAY_BE_ADJUSTED"), "warning dia 31");
}
for (const dueDay of [29, 30, 31]) {
  use();
  const result = await core.createCard.handler(
    { name: `Dia ${dueDay}`, card_type: "credit", due_day: dueDay },
    ctx,
  );
  equal(result.structuredContent.card.due_day, dueDay, `dia ${dueDay} aceito`);
  check(result.structuredContent.warnings.includes("BILLING_DAY_MAY_BE_ADJUSTED"), `dia ${dueDay} warning`);
}
for (const invalid of [
  { name: "   ", card_type: "debit" },
  { name: "x".repeat(101), card_type: "debit" },
  { name: "X", card_type: "unknown" },
  { name: "X", card_type: "credit", due_day: 0 },
  { name: "X", card_type: "credit", due_day: 32 },
  { name: "X", card_type: "credit", due_day: 10, days_before_due: 0 },
  { name: "X", card_type: "credit", due_day: 10, days_before_due: 29 },
  { name: "X", card_type: "credit", due_day: 10, color: "#000000" },
  { name: "X", card_type: "credit", due_day: 10, card_limit: 0 },
  { name: "X", card_type: "credit", due_day: 10, card_limit: -1 },
  { name: "X", card_type: "credit", due_day: 10, card_limit: Number.NaN },
  { name: "X", card_type: "credit", due_day: 10, card_limit: Number.POSITIVE_INFINITY },
]) {
  const db = use();
  const result = await core.createCard.handler(invalid, ctx);
  errorCode(result, "INVALID_INPUT", `create inválido ${JSON.stringify(invalid)}`);
  equal(db.writes.length, 0, "create inválido sem write");
}
{
  use();
  errorCode(
    await core.createCard.handler({ name: "Crédito", card_type: "credit" }, ctx),
    "INVALID_CARD_CONFIGURATION",
    "crédito incompleto",
  );
}
for (const field of ["card_limit", "due_day", "days_before_due"]) {
  use();
  const result = await core.createCard.handler(
    { name: "Débito", card_type: "debit", [field]: 10 },
    ctx,
  );
  errorCode(result, "INVALID_CARD_CONFIGURATION", `débito rejeita ${field}`);
}
for (const forbidden of [
  "user_id",
  "shared_group_id",
  "card_number",
  "cvv",
  "current_balance",
  "available_limit",
  "extra",
]) {
  use();
  const result = await core.createCard.handler(
    { name: "Débito", card_type: "debit", [forbidden]: "secret" },
    ctx,
  );
  errorCode(result, "INVALID_INPUT", `create rejeita ${forbidden}`);
}
{
  use();
  const result = await core.createCard.handler(
    { name: "Inativo", card_type: "debit", is_active: false },
    ctx,
  );
  equal(result.structuredContent.card.is_active, false, "criado inativo");
  check(result.structuredContent.warnings.includes("CARD_CREATED_INACTIVE"), "warning inativo");
}
{
  use();
  const result = await core.createCard.handler(
    { name: "Sem limite", card_type: "debit", card_limit: null },
    ctx,
  );
  equal(result.structuredContent.card.card_limit, null, "null aceito");
}
{
  const db = use();
  await core.createCard.handler({ name: "Principal", card_type: "debit" }, ctx);
  await core.createCard.handler({ name: "Principal", card_type: "debit" }, ctx);
  equal(db.tables.cards.length, 3, "nomes duplicados permitidos");
}

for (const [changes, field, expected] of [
  [{ name: "  Novo Nome  " }, "name", "Novo Nome"],
  [{ color: "#9333EA" }, "color", "#9333EA"],
  [{ card_limit: 8000 }, "card_limit", 8000],
  [{ card_limit: null }, "card_limit", null],
  [{ due_day: 15 }, "due_day", 15],
  [{ days_before_due: 12 }, "days_before_due", 12],
]) {
  const db = use();
  const result = await core.updateCard.handler(updateInput(changes), ctx);
  equal(result.structuredContent.applied, true, `update ${field}`);
  equal(result.structuredContent.after[field], expected, `after ${field}`);
  check(result.structuredContent.changed_fields.includes(field), `changed ${field}`);
  equal(result.structuredContent.updated_at_before, t0, `before timestamp ${field}`);
  equal(result.structuredContent.updated_at_after, t1, `after timestamp ${field}`);
  equal(db.writes.length, 1, `um update ${field}`);
}
{
  const db = use();
  const result = await core.updateCard.handler(
    updateInput({ name: "Principal", color: "#FFA500", card_limit: 5000 }),
    ctx,
  );
  equal(result.structuredContent.applied, false, "no-op");
  equal(result.structuredContent.changed_fields, [], "no-op campos");
  equal(result.structuredContent.updated_at_after, t0, "no-op timestamp");
  check(result.structuredContent.warnings.includes("NO_EFFECTIVE_CHANGES"), "warning no-op");
  equal(db.writes.length, 0, "no-op sem update");
}
{
  use();
  const result = await core.updateCard.handler(
    updateInput({ name: "Novo", color: "#10B981", card_limit: 9000 }),
    ctx,
  );
  equal(result.structuredContent.changed_fields, ["name", "color", "card_limit"], "patch múltiplo");
  equal(result.structuredContent.before.name, "Principal", "before real");
  equal(result.structuredContent.after.name, "Novo", "after real");
  check(result.structuredContent.warnings.includes("CARD_UPDATED"), "warning update");
  check(result.content[0].text.includes('"Principal" -> "Novo"'), "content autossuficiente");
}
{
  const db = use(baseTables({
    cards: [card({ card_limit: 234.56 })],
  }));
  const result = await core.updateCard.handler(
    updateInput({ card_type: "debit" }),
    ctx,
  );
  equal(result.structuredContent.after.card_type, "debit", "crédito para débito");
  for (const field of ["card_limit", "opening_day", "closing_day", "due_day", "days_before_due"]) {
    equal(result.structuredContent.after[field], null, `${field} limpo`);
    check(result.structuredContent.changed_fields.includes(field), `${field} registrado`);
  }
  equal(result.structuredContent.before.card_limit, 234.56, "before mantém limite real");
  equal(db.tables.expenses.length, 3, "transição preserva despesas");
  equal(db.tables.recurring_expenses.length, 2, "transição preserva recorrências");
  check(result.structuredContent.warnings.includes("CARD_TYPE_CHANGED"), "warning tipo");
}
{
  use(baseTables({
    cards: [card({ card_type: "both", card_limit: 900 })],
  }));
  const result = await core.updateCard.handler(
    updateInput({ card_type: "debit" }),
    ctx,
  );
  equal(result.structuredContent.after.card_type, "debit", "both para débito");
  for (const field of ["card_limit", "opening_day", "closing_day", "due_day", "days_before_due"]) {
    equal(result.structuredContent.after[field], null, `both limpa ${field}`);
  }
}
{
  const db = use();
  const result = await core.updateCard.handler(
    updateInput({
      card_type: "debit",
      card_limit: 500,
      due_day: 10,
      days_before_due: 10,
    }),
    ctx,
  );
  errorCode(result, "INVALID_CARD_CONFIGURATION", "patch debit incompatível rejeitado");
  equal(db.writes.length, 0, "rejeição debit integral");
  equal(db.tables.cards[0].card_type, "credit", "tipo preservado após rejeição");
  equal(db.tables.cards[0].card_limit, 5000, "limite preservado após rejeição");
}
{
  use(baseTables({ cards: [card({
    card_type: "debit",
    opening_day: null,
    closing_day: null,
    due_day: null,
    days_before_due: null,
  })] }));
  const result = await core.updateCard.handler(
    updateInput({ card_type: "credit", due_day: 20 }),
    ctx,
  );
  equal(result.structuredContent.after.card_type, "credit", "débito para crédito");
  equal(result.structuredContent.after.due_day, 20, "due exigido");
  equal(result.structuredContent.after.days_before_due, 10, "default real");
  check(result.structuredContent.after.opening_day !== null, "opening derivado transição");
}
{
  use(baseTables({ cards: [card({
    card_type: "debit",
    opening_day: null,
    closing_day: null,
    due_day: null,
    days_before_due: null,
  })] }));
  const result = await core.updateCard.handler(
    updateInput({ card_type: "credit" }),
    ctx,
  );
  errorCode(result, "INVALID_CARD_CONFIGURATION", "débito para crédito incompleto");
}
{
  use(baseTables({ cards: [card({
    due_day: null,
    days_before_due: 10,
    opening_day: 16,
    closing_day: 15,
  })] }));
  const result = await core.updateCard.handler(updateInput({ name: "Legado editado" }), ctx);
  equal(result.structuredContent.after.opening_day, 16, "legado opening preservado");
  equal(result.structuredContent.after.closing_day, 15, "legado closing preservado");
  equal(result.structuredContent.after.due_day, null, "legado sem due preservado");
}
{
  use();
  const result = await core.updateCard.handler(
    updateInput({ due_day: null }),
    ctx,
  );
  errorCode(result, "INVALID_CARD_CONFIGURATION", "não cria legado incompleto");
}
{
  use();
  const result = await core.updateCard.handler(
    updateInput({ days_before_due: null }),
    ctx,
  );
  errorCode(result, "INVALID_CARD_CONFIGURATION", "null explícito não vira default");
}
{
  use();
  const result = await core.updateCard.handler(
    updateInput({ name: "X" }, { expected_updated_at: t1 }),
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "timestamp antigo");
  check(result.content[0].text.includes("list_cards"), "conflito orienta releitura");
}
{
  const db = use(baseTables(), { raceOnUpdate: true });
  const result = await core.updateCard.handler(updateInput({ name: "X" }), ctx);
  errorCode(result, "CONCURRENT_MODIFICATION", "corrida update");
  equal(db.writes.length, 0, "corrida sem write");
}
{
  use(baseTables({ cards: [] }));
  errorCode(
    await core.updateCard.handler(updateInput({ name: "X" }), ctx),
    "RESOURCE_NOT_FOUND",
    "cartão inexistente",
  );
}
{
  use(baseTables({ cards: [card({ user_id: userB })] }));
  errorCode(
    await core.updateCard.handler(updateInput({ name: "X" }), ctx),
    "RESOURCE_NOT_FOUND",
    "cartão alheio genérico",
  );
}
for (const invalid of [
  updateInput({}, {}),
  updateInput({ user_id: userA }),
  updateInput({ shared_group_id: null }),
  updateInput({ card_number: "1234" }),
  updateInput({ color: "#000000" }),
  updateInput({ card_limit: 0 }),
  updateInput({ name: "X" }, { card_id: "invalid" }),
  updateInput({ name: "X" }, { expected_updated_at: "invalid" }),
]) {
  use();
  const result = await core.updateCard.handler(invalid, ctx);
  const topLevelFailure =
    invalid.card_id === "invalid" ||
    invalid.expected_updated_at === "invalid";
  errorCode(result, topLevelFailure ? "INVALID_INPUT" : "INVALID_PATCH", "update input inválido");
}
{
  const db = use();
  const result = await core.updateCard.handler(updateInput({ is_active: false }), ctx);
  equal(result.structuredContent.after.is_active, false, "desativado");
  check(result.structuredContent.warnings.includes("CARD_DEACTIVATED"), "warning desativado");
  check(result.structuredContent.warnings.includes("HISTORICAL_CARD_REFERENCES_PRESERVED"), "warning histórico");
  check(result.structuredContent.warnings.includes("FUTURE_INSTALLMENTS_PRESERVED"), "warning parcelas");
  check(result.structuredContent.warnings.includes("ACTIVE_RECURRING_TEMPLATES_REFERENCE_CARD"), "warning recorrente");
  equal(result.structuredContent.reference_summary, {
    historical_expense_count: 1,
    future_materialized_expense_count: 1,
    active_recurring_template_count: 1,
  }, "reference summary próprio");
  equal(db.tables.expenses.length, 3, "expenses preservadas");
  equal(db.tables.recurring_expenses.length, 2, "recorrências preservadas");
  equal(db.tables.expenses[0].card_id, cardId, "card_id preservado");
  equal(db.tables.expenses[0].card_name, "Principal", "snapshot nome preservado");
  equal(db.tables.expenses[0].card_color, "#FFA500", "snapshot cor preservado");
  equal(db.tables.credit_card_configs.length, 1, "legado preservado");
  check(result.content[0].text.includes("não ativa, bloqueia nem cancela"), "content status emissor");
}
{
  use(baseTables({ cards: [card({ is_active: false })] }));
  const result = await core.updateCard.handler(updateInput({ is_active: true }), ctx);
  check(result.structuredContent.warnings.includes("CARD_REACTIVATED"), "warning reativado");
  equal(result.structuredContent.reference_summary.historical_expense_count, null, "reativação sem consulta desnecessária");
}
{
  use();
  const result = await core.updateCard.handler(updateInput({ is_active: true }), ctx);
  equal(result.structuredContent.applied, false, "status no-op");
}
{
  const db = use(baseTables(), { writeError: true });
  const result = await core.updateCard.handler(updateInput({ name: "Falha" }), ctx);
  errorCode(result, "WRITE_FAILED", "erro write sanitizado");
  check(!result.content[0].text.includes("synthetic SQL"), "sem SQL interno");
  equal(db.tables.expenses.length, 3, "falha sem transação parcial");
}

for (const [tool, kind] of [
  [core.createCard, "create"],
  [core.updateCard, "update"],
]) {
  equal(tool.annotations.readOnlyHint, false, `${kind} write`);
  equal(tool.annotations.destructiveHint, kind === "update", `${kind} destructive`);
  equal(tool.annotations.idempotentHint, false, `${kind} não idempotente`);
  equal(tool.annotations.openWorldHint, false, `${kind} closed world`);
  check(!JSON.stringify(tool.inputSchema).includes("user_id"), `${kind} input sem user`);
  check(!JSON.stringify(tool.inputSchema).includes("shared_group_id"), `${kind} sem grupo`);
  check(!JSON.stringify(tool.inputSchema).includes("card_number"), `${kind} sem número`);
  check(!JSON.stringify(tool.inputSchema).includes("cvv"), `${kind} sem CVV`);
  check(!JSON.stringify(tool.outputSchema).includes("user_id"), `${kind} output sem user`);
}
use();
const sampleCreate = await core.createCard.handler(creditInput(), ctx);
check(
  z.object(core.createCard.outputSchema).strict().safeParse(sampleCreate.structuredContent).success,
  "outputSchema real create",
);
check(core.updateCard.inputSchema.expected_updated_at !== undefined, "expected obrigatório");
check(core.updateCard.inputSchema.changes !== undefined, "changes presente");

const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const tools = manifest.mcp.tools;
equal(tools.length, 48, "manifest 48 tools");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
  23, "23 read-only");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === false).length, 25, "25 write");
for (const [name, destructive] of [
  ["create_card", false],
  ["update_card", true],
]) {
  const tool = tools.find((entry) => entry.name === name);
  check(tool, `${name} registrado`);
  equal(tool.annotations.readOnlyHint, false, `${name} write`);
  equal(tool.annotations.destructiveHint, destructive, `${name} destructive`);
  equal(tool.annotations.idempotentHint, false, `${name} idempotência`);
  equal(tool.inputSchema.additionalProperties, false, `${name} input fechado`);
  equal(tool.outputSchema.additionalProperties, false, `${name} output fechado`);
  check(!JSON.stringify(tool.inputSchema).includes("user_id"), `${name} sem user`);
  check(!JSON.stringify(tool.outputSchema).includes("user_id"), `${name} output seguro`);
}
const updateManifest = tools.find((entry) => entry.name === "update_card");
check(updateManifest.inputSchema.required.includes("expected_updated_at"), "manifest expected");
equal(updateManifest.inputSchema.properties.changes.additionalProperties, false, "manifest changes fechado");

const sourceFiles = [
  "src/lib/mcp/tools/create-card.ts",
  "src/lib/mcp/tools/update-card.ts",
  "src/lib/mcp/shared/card-write.ts",
];
const source = (
  await Promise.all(sourceFiles.map((file) => readFile(file, "utf8")))
).join("\n");
check(source.includes("supabaseForUser(ctx)"), "usa supabaseForUser");
check(source.includes('.eq("user_id", userId)'), "propriedade explícita");
check(source.includes('.eq("updated_at", input.expected_updated_at)'), "concorrência atômica");
check(!source.includes("service_role"), "sem service role");
check(!source.includes('.from("credit_card_configs")'), "sem escrita ou consulta legada");
check(!source.includes('.update({ card_name'), "sem reescrever snapshots");
check(!source.includes('.from("expenses").update'), "sem update de expenses");
check(!source.includes('.from("recurring_expenses").update'), "sem update recorrente");
check(!source.includes(".delete()"), "sem exclusão");

const migrationFiles = await readdir("supabase/migrations");
check(migrationFiles.length > 0, "migrations existentes");
const edgeBundle = await readFile("supabase/functions/mcp/index.ts", "utf8");
check(edgeBundle.includes("Deno.serve"), "Deno.serve");
check(!edgeBundle.includes('from "@/'), "sem alias");
check(!edgeBundle.includes("npm:@/"), "sem npm alias");
check(!/[A-Za-z]:\\\\/.test(edgeBundle), "sem caminho Windows");

console.log(
  `Fase MCP 1.2D-B1: ${checks} verificações diretas, regressivas e de contrato concluídas.`,
);
