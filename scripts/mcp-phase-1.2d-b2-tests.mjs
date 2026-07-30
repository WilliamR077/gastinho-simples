import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { mock } from "node:test";
import { build } from "esbuild";
import { z } from "zod";

const fixedNow = new Date("2026-07-29T15:00:00-03:00");
mock.timers.enable({ apis: ["Date"], now: fixedNow });

const mockPlugin = {
  name: "phase-1.2d-b2-supabase-mock",
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
      export { default as deleteCard } from "./src/lib/mcp/tools/delete-card.ts";
      export * from "./src/lib/mcp/shared/card-delete.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2d-b2-entry.ts",
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
const card = (overrides = {}) => ({
  id: cardId,
  user_id: userA,
  name: "Cartão inativo",
  card_type: "credit",
  color: "#FFA500",
  card_limit: 123.45,
  opening_day: 1,
  closing_day: 31,
  due_day: 10,
  days_before_due: 10,
  is_active: false,
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: t0,
  ...overrides,
});
const expense = (overrides = {}) => ({
  id: "50000000-0000-4000-8000-000000000005",
  user_id: userA,
  card_id: cardId,
  expense_date: "2026-07-20",
  installment_group_id: null,
  installment_number: null,
  total_installments: null,
  card_name: "snapshot",
  card_color: "#FFA500",
  ...overrides,
});
const recurring = (overrides = {}) => ({
  id: "60000000-0000-4000-8000-000000000006",
  user_id: userA,
  card_id: cardId,
  is_active: true,
  card_name: "snapshot",
  card_color: "#FFA500",
  ...overrides,
});
const baseTables = (overrides = {}) => ({
  cards: [
    card(),
    card({
      id: otherCardId,
      name: "Outro cartão",
      updated_at: "2026-07-02T12:00:00.000Z",
    }),
  ],
  expenses: [],
  recurring_expenses: [],
  credit_card_configs: [{ id: "70000000-0000-4000-8000-000000000007", user_id: userA }],
  incomes: [{ id: "80000000-0000-4000-8000-000000000008" }],
  recurring_incomes: [{ id: "90000000-0000-4000-8000-000000000009" }],
  ...overrides,
});

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.columns = null;
    this.mode = "select";
  }
  record(method, ...args) {
    this.db.calls.push({ table: this.table, method, args });
  }
  select(columns) {
    this.record("select", columns);
    this.columns = columns.split(",").map((value) => value.trim());
    return this;
  }
  delete() {
    this.record("delete");
    this.mode = "delete";
    return this;
  }
  eq(column, value) {
    this.record("eq", column, value);
    this.filters.push((row) => row[column] === value);
    return this;
  }
  visible(row) {
    return this.table !== "cards" || row.user_id === this.db.userId;
  }
  project(row) {
    if (!this.columns) return structuredClone(row);
    return Object.fromEntries(
      this.columns.map((column) => [column, row[column] ?? null]),
    );
  }
  matching() {
    let rows = (this.db.tables[this.table] ?? []).filter((row) =>
      this.visible(row)
    );
    for (const filter of this.filters) rows = rows.filter(filter);
    return rows;
  }
  applyRace() {
    if (this.mode !== "delete" || this.table !== "cards" || this.db.raceApplied) {
      return;
    }
    const target = this.db.tables.cards.find((row) => row.id === cardId);
    if (this.db.race === "updated" && target) {
      target.updated_at = "2026-07-01T12:00:00.500Z";
    }
    if (this.db.race === "reactivated" && target) target.is_active = true;
    if (this.db.race === "removed" && target) {
      this.db.tables.cards.splice(this.db.tables.cards.indexOf(target), 1);
    }
    this.db.raceApplied = this.db.race !== null;
  }
  execute(single) {
    this.applyRace();
    if (this.db.writeError && this.mode === "delete") {
      return { data: null, error: { message: "synthetic SQL detail" } };
    }
    const matched = this.matching();
    if (this.mode === "select") {
      return {
        data: single
          ? matched.length === 1
            ? this.project(matched[0])
            : null
          : matched.map((row) => this.project(row)),
        error: null,
      };
    }
    if (matched.length !== 1) return { data: null, error: null };
    const removed = structuredClone(matched[0]);
    this.db.tables.cards.splice(this.db.tables.cards.indexOf(matched[0]), 1);
    this.db.writes.push({ table: this.table, mode: "delete", id: removed.id });
    return { data: this.project(removed), error: null };
  }
  async maybeSingle() {
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
    this.race = options.race ?? null;
    this.raceApplied = false;
    this.writeError = options.writeError ?? false;
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
const input = (overrides = {}) => ({
  card_id: cardId,
  expected_updated_at: t0,
  confirm_delete: true,
  ...overrides,
});

{
  const db = use();
  const result = await core.deleteCard.handler(input(), ctx);
  equal(result.structuredContent.deleted, true, "exclusão válida");
  equal(result.structuredContent.deletion_mode, "permanent", "permanente");
  equal(result.structuredContent.deleted_card.name, "Cartão inativo", "linha real");
  equal(result.structuredContent.deleted_card.card_limit, 123.45, "limite factual");
  check(!("user_id" in result.structuredContent.deleted_card), "sem user_id");
  equal(result.structuredContent.reference_summary, core.emptyCardDeleteReferenceSummary(), "referências zeradas");
  check(Number.isFinite(Date.parse(result.structuredContent.operation_completed_at)), "timestamp válido");
  for (const warning of ["PERMANENT_DELETION", "CARD_DELETED", "BANK_ISSUER_UNAFFECTED"]) {
    check(result.structuredContent.warnings.includes(warning), `warning ${warning}`);
  }
  equal(db.writes, [{ table: "cards", mode: "delete", id: cardId }], "somente cards");
  const deleteCalls = db.calls.filter(
    (call) => call.table === "cards" && ["delete", "eq"].includes(call.method),
  );
  for (const [column, value] of [
    ["id", cardId],
    ["user_id", userA],
    ["updated_at", t0],
    ["is_active", false],
  ]) {
    check(
      deleteCalls.some(
        (call) => call.method === "eq" && call.args[0] === column &&
          call.args[1] === value,
      ),
      `delete filtrado por ${column}`,
    );
  }
  equal(db.tables.cards.length, 1, "outro cartão preservado");
  equal(db.tables.expenses.length, 0, "expenses preservada");
  equal(db.tables.recurring_expenses.length, 0, "recorrências preservadas");
  equal(db.tables.credit_card_configs.length, 1, "legado preservado");
  equal(db.tables.incomes.length, 1, "incomes preservada");
  equal(db.tables.recurring_incomes.length, 1, "recurring incomes preservada");
  check(result.content[0].text.includes("excluído permanentemente"), "content permanente");
  check(result.content[0].text.includes("Nenhuma despesa, parcela ou recorrência"), "content preservação");
  check(result.content[0].text.includes("não foi cancelado no banco emissor"), "content emissor");
  check(result.content[0].text.includes("nenhum dado bancário foi acessado"), "content dados bancários");
  const second = await core.deleteCard.handler(input(), ctx);
  errorCode(second, "RESOURCE_NOT_FOUND", "segunda exclusão");
}

for (const confirmDelete of [undefined, false]) {
  const db = use();
  const raw = input({ confirm_delete: confirmDelete });
  if (confirmDelete === undefined) delete raw.confirm_delete;
  const result = await core.deleteCard.handler(raw, ctx);
  errorCode(result, "CONFIRMATION_REQUIRED", `confirmação ${confirmDelete}`);
  equal(db.writes.length, 0, "sem delete sem confirmação");
  check(result.content[0].text.includes("Nada foi removido"), "content nada removido");
  check(result.content[0].text.includes("Não existe restauração"), "content sem restauração");
}

{
  const db = use();
  const result = await core.deleteCard.handler(
    input({ expected_updated_at: "2026-06-01T00:00:00.000Z" }),
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "expected antigo");
  equal(db.writes.length, 0, "conflito sem delete");
}
for (const [race, code] of [
  ["updated", "CONCURRENT_MODIFICATION"],
  ["reactivated", "CARD_MUST_BE_INACTIVE"],
  ["removed", "RESOURCE_NOT_FOUND"],
]) {
  const db = use(baseTables(), { race });
  const result = await core.deleteCard.handler(input(), ctx);
  errorCode(result, code, `corrida ${race}`);
  equal(db.writes.length, 0, `corrida ${race} sem delete`);
}

{
  const db = use(baseTables({ cards: [card({ is_active: true })] }));
  const result = await core.deleteCard.handler(input(), ctx);
  errorCode(result, "CARD_MUST_BE_INACTIVE", "ativo bloqueado");
  equal(db.writes.length, 0, "ativo sem update automático");
  equal(db.tables.cards[0].is_active, true, "ativo preservado");
  equal(db.tables.cards[0].updated_at, t0, "updated_at preservado");
  check(result.content[0].text.includes("update_card"), "orienta desativar");
  check(result.content[0].text.includes("banco emissor"), "sem ação no emissor");
}

const referenceCases = [
  ["histórica", { expenses: [expense()] }, "historical_expense_count", 1],
  ["futura", { expenses: [expense({ expense_date: "2026-08-01" })] }, "future_materialized_expense_count", 1],
  ["parcela histórica", { expenses: [expense({ installment_number: 1, total_installments: 3 })] }, "installment_expense_count", 1],
  ["parcela futura", { expenses: [expense({ expense_date: "2026-08-01", installment_group_id: otherCardId })] }, "installment_expense_count", 1],
  ["template ativo", { recurring_expenses: [recurring()] }, "active_recurring_template_count", 1],
  ["template inativo", { recurring_expenses: [recurring({ is_active: false })] }, "inactive_recurring_template_count", 1],
];
for (const [label, overrides, field, expected] of referenceCases) {
  const db = use(baseTables(overrides));
  const before = structuredClone(db.tables);
  const result = await core.deleteCard.handler(input(), ctx);
  errorCode(result, "CARD_HAS_REFERENCES", `${label} bloqueia`);
  check(result.content[0].text.includes("bloqueada para preservar o histórico"), `${label} content`);
  check(result.content[0].text.includes(`${field === "installment_expense_count" ? "parcelas" : ""}`), `${label} contagens`);
  equal(db.writes.length, 0, `${label} sem escrita`);
  equal(db.tables, before, `${label} sem alteração parcial`);
}

{
  const expenses = [
    expense(),
    expense({
      id: otherCardId,
      expense_date: "2026-08-01T00:00:00.000Z",
      installment_group_id: otherCardId,
      installment_number: 2,
      total_installments: 4,
    }),
    expense({ id: "a0000000-0000-4000-8000-000000000010", user_id: userB }),
  ];
  const templates = [
    recurring(),
    recurring({ id: otherCardId, is_active: false }),
    recurring({ id: "b0000000-0000-4000-8000-000000000011", user_id: userB }),
  ];
  const db = use(baseTables({ expenses, recurring_expenses: templates }));
  const result = await core.deleteCard.handler(input(), ctx);
  errorCode(result, "CARD_HAS_REFERENCES", "combinação bloqueada");
  const text = result.content[0].text;
  for (const expected of [
    "despesas históricas=1",
    "lançamentos futuros=1",
    "parcelas=1",
    "templates ativos=1",
    "templates inativos=1",
    "despesas distintas=2",
    "templates distintos=2",
    "total distinto=4",
  ]) check(text.includes(expected), `summary ${expected}`);
  equal(db.tables.expenses.length, 3, "nenhuma despesa removida");
  equal(db.tables.recurring_expenses.length, 3, "nenhum template removido");
  equal(db.tables.expenses[0].card_id, cardId, "card_id preservado");
  equal(db.tables.expenses[0].card_name, "snapshot", "snapshot preservado");
  equal(db.tables.recurring_expenses[0].card_id, cardId, "card_id recorrente preservado");
}

for (const invalid of [
  input({ card_id: "invalid" }),
  input({ expected_updated_at: "invalid" }),
  { ...input(), extra: true },
  { ...input(), user_id: userA },
  { ...input(), force: true },
  { ...input(), delete_transactions: true },
  { ...input(), clear_references: true },
  { ...input(), card_name: "Cartão inativo" },
]) {
  const db = use();
  const result = await core.deleteCard.handler(invalid, ctx);
  errorCode(result, "INVALID_INPUT", "input inválido");
  equal(db.writes.length, 0, "input inválido sem delete");
}
for (const tables of [
  baseTables({ cards: [] }),
  baseTables({ cards: [card({ user_id: userB })] }),
]) {
  use(tables);
  const result = await core.deleteCard.handler(input(), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "ausente ou alheio genérico");
}
{
  const db = use(baseTables(), { writeError: true });
  const result = await core.deleteCard.handler(input(), ctx);
  errorCode(result, "WRITE_FAILED", "erro de FK/escrita sanitizado");
  check(!result.content[0].text.includes("synthetic SQL"), "sem SQL bruto");
  equal(db.writes.length, 0, "erro sem delete");
}

use();
const sample = await core.deleteCard.handler(input(), ctx);
check(
  z.object(core.deleteCard.outputSchema).strict().safeParse(sample.structuredContent).success,
  "outputSchema real fechado",
);
check(core.deleteCard.inputSchema.card_id !== undefined, "card_id obrigatório");
check(core.deleteCard.inputSchema.expected_updated_at !== undefined, "expected obrigatório");
check(core.deleteCard.inputSchema.confirm_delete !== undefined, "confirmação obrigatória");

const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const tools = manifest.mcp.tools;
equal(tools.length, 48, "manifest 48 tools");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
  23, "23 read-only");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === false).length, 25, "25 write");
const declared = tools.find((tool) => tool.name === "delete_card");
check(declared, "delete_card registrada");
equal(declared.annotations.readOnlyHint, false, "write");
equal(declared.annotations.destructiveHint, true, "destrutiva");
equal(declared.annotations.idempotentHint, false, "não idempotente");
equal(declared.annotations.openWorldHint, false, "mundo fechado");
equal(declared.inputSchema.additionalProperties, false, "input fechado");
equal(declared.outputSchema.additionalProperties, false, "output fechado");
for (const required of ["card_id", "expected_updated_at", "confirm_delete"]) {
  check(declared.inputSchema.required.includes(required), `${required} obrigatório no manifest`);
}
check(!JSON.stringify(declared.inputSchema).includes("user_id"), "input sem user_id");
check(!JSON.stringify(declared.outputSchema).includes("user_id"), "output sem user_id");

const source = await readFile("src/lib/mcp/tools/delete-card.ts", "utf8");
const helper = await readFile("src/lib/mcp/shared/card-delete.ts", "utf8");
check(source.includes("supabaseForUser(ctx)"), "usa supabaseForUser");
check(source.includes('.eq("user_id", userId)'), "propriedade explícita");
check(source.includes('.eq("updated_at", input.expected_updated_at)'), "expected atômico");
check(source.includes('.eq("is_active", false)'), "inatividade atômica");
check(!source.includes("service_role"), "sem service role");
check(!source.includes('.from("credit_card_configs")'), "sem legado");
check(!source.includes(".update("), "sem updates");
check(!source.includes("delete_transactions"), "sem cascata opcional");
check(!helper.includes("user_id"), "content sem proprietário");

const migrations = await readdir("supabase/migrations");
check(migrations.length > 0, "migrations preexistentes");
const bundle = await readFile("supabase/functions/mcp/index.ts", "utf8");
check(bundle.includes("Deno.serve"), "Deno.serve");
check(bundle.includes('name: "delete_card"'), "bundle contém delete_card");
check(!bundle.includes("@/") && !bundle.includes("npm:@/"), "bundle sem aliases");
check(!/[A-Za-z]:\\\\/.test(bundle), "bundle sem caminho Windows");

mock.timers.reset();
console.log(
  `Fase MCP 1.2D-B2: ${checks} verificações diretas, regressivas e de contrato concluídas.`,
);
