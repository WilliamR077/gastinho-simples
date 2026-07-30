import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const mockPlugin = {
  name: "phase-1.2c-b-supabase-mock",
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
      export { default as deleteRecurringExpense } from "./src/lib/mcp/tools/delete-recurring-expense.ts";
      export { default as deleteRecurringIncome } from "./src/lib/mcp/tools/delete-recurring-income.ts";
      export * from "./src/lib/mcp/shared/recurring-delete.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2c-b-entry.ts",
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
const incomeId = "50000000-0000-4000-8000-000000000005";
const categoryId = "60000000-0000-4000-8000-000000000006";
const incomeCategoryId = "70000000-0000-4000-8000-000000000007";
const cardId = "80000000-0000-4000-8000-000000000008";
const t0 = "2026-07-01T12:00:00.000Z";

const recurringExpense = (overrides = {}) => ({
  id: expenseId,
  user_id: userA,
  description: "Academia",
  amount: 120,
  day_of_month: 15,
  start_date: "2026-08-01",
  end_date: "2026-12-31",
  is_active: true,
  category_id: categoryId,
  category_name: "Saúde",
  category_icon: "S",
  payment_method: "credit",
  card_id: cardId,
  card_name: "Principal",
  card_color: "#111111",
  shared_group_id: null,
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: t0,
  ...overrides,
});
const recurringIncome = (overrides = {}) => ({
  id: incomeId,
  user_id: userA,
  description: "Salário",
  amount: 3000,
  day_of_month: 5,
  start_date: "2026-08-01",
  end_date: "2026-12-31",
  is_active: true,
  income_category_id: incomeCategoryId,
  category_name: "Salário",
  category_icon: "I",
  shared_group_id: null,
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: t0,
  ...overrides,
});
const baseTables = (overrides = {}) => ({
  recurring_expenses: [recurringExpense()],
  recurring_incomes: [recurringIncome()],
  expenses: [{ id: "90000000-0000-4000-8000-000000000009", description: "Real" }],
  incomes: [{ id: "a0000000-0000-4000-8000-000000000010", description: "Real" }],
  cards: [{ id: cardId, user_id: userA, name: "Principal" }],
  user_categories: [{ id: categoryId, user_id: userA, name: "Saúde" }],
  user_income_categories: [{ id: incomeCategoryId, user_id: userA, name: "Salário" }],
  shared_groups: [{ id: groupA, name: "Casa" }],
  ...overrides,
});

class Query {
  constructor(db, table, call) {
    this.db = db;
    this.table = table;
    this.call = call;
    this.filters = [];
    this.columns = null;
    this.deleting = false;
  }
  op(method, ...args) {
    this.call.operations.push({ method, args });
  }
  select(columns) {
    this.op("select", columns);
    this.columns = columns.split(",").map((column) => column.trim());
    return this;
  }
  delete() {
    this.op("delete");
    this.deleting = true;
    return this;
  }
  eq(column, value) {
    this.op("eq", column, value);
    this.filters.push((row) => row[column] === value);
    return this;
  }
  visible(row) {
    if (!["recurring_expenses", "recurring_incomes"].includes(this.table)) {
      return true;
    }
    return row.user_id === this.db.userId || row.shared_group_id === groupA;
  }
  project(row) {
    if (!this.columns) return structuredClone(row);
    return Object.fromEntries(
      this.columns.map((column) => [column, row[column] ?? null]),
    );
  }
  async maybeSingle() {
    const rows = this.db.tables[this.table] ?? [];
    if (this.deleting && this.db.deleteError) {
      return { data: null, error: { message: "synthetic SQL constraint" } };
    }
    if (this.deleting && this.db.raceOnDelete && !this.db.raceApplied) {
      const target = rows.find((row) => row.id === this.db.raceId);
      if (target) target.updated_at = "2026-07-01T12:00:00.500Z";
      this.db.raceApplied = true;
    }
    if (this.deleting && this.db.removeBeforeDelete && !this.db.removeApplied) {
      const index = rows.findIndex((row) => row.id === this.db.raceId);
      if (index >= 0) rows.splice(index, 1);
      this.db.removeApplied = true;
    }
    let matched = rows.filter((row) => this.visible(row));
    for (const filter of this.filters) matched = matched.filter(filter);
    if (!this.deleting) {
      return {
        data: matched.length === 1 ? this.project(matched[0]) : null,
        error: null,
      };
    }
    matched = matched.filter((row) => row.user_id === this.db.userId);
    if (matched.length !== 1) return { data: null, error: null };
    const removed = matched[0];
    rows.splice(rows.indexOf(removed), 1);
    this.db.deleted.push({ table: this.table, id: removed.id });
    return { data: this.project(removed), error: null };
  }
}
class DB {
  constructor(tables, options = {}) {
    this.tables = structuredClone(tables);
    this.userId = userA;
    this.calls = [];
    this.deleted = [];
    this.raceOnDelete = options.raceOnDelete ?? false;
    this.removeBeforeDelete = options.removeBeforeDelete ?? false;
    this.deleteError = options.deleteError ?? false;
    this.raceId = options.raceId ?? expenseId;
    this.raceApplied = false;
    this.removeApplied = false;
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
const expenseInput = (overrides = {}) => ({
  recurring_expense_id: expenseId,
  expected_updated_at: t0,
  confirm_delete: true,
  ...overrides,
});
const incomeInput = (overrides = {}) => ({
  recurring_income_id: incomeId,
  expected_updated_at: t0,
  confirm_delete: true,
  ...overrides,
});

{
  const db = use();
  const result = await core.deleteRecurringExpense.handler(expenseInput(), ctx);
  equal(result.structuredContent.resource_type, "recurring_expense", "expense tipo");
  equal(result.structuredContent.id, expenseId, "expense id");
  equal(result.structuredContent.deleted, true, "expense deleted");
  equal(result.structuredContent.deletion_mode, "permanent", "expense permanente");
  equal(db.deleted, [{ table: "recurring_expenses", id: expenseId }], "somente template expense removido");
  equal(db.tables.recurring_expenses.length, 0, "linha expense removida");
  equal(result.structuredContent.deleted_template.description, "Academia", "descrição do banco");
  equal(result.structuredContent.deleted_template.amount, 120, "valor do banco");
  equal(result.structuredContent.deleted_template.day_of_month, 15, "dia do banco");
  equal(result.structuredContent.deleted_template.start_date, "2026-08-01", "start do banco");
  equal(result.structuredContent.deleted_template.end_date, "2026-12-31", "end do banco");
  equal(result.structuredContent.deleted_template.payment_method, "credit", "método do banco");
  equal(result.structuredContent.deleted_template.card_id, cardId, "cartão factual");
  equal(result.structuredContent.deleted_template.category_id, categoryId, "categoria factual");
  check(!("user_id" in result.structuredContent.deleted_template), "expense output sem user");
  for (const warning of ["PERMANENT_DELETION", "RECURRING_TEMPLATE_DELETED", "FORECAST_WILL_CHANGE"]) {
    check(result.structuredContent.warnings.includes(warning), `expense ${warning}`);
  }
  check(Number.isFinite(Date.parse(result.structuredContent.operation_completed_at)), "timestamp operação expense");
  check(result.content[0].text.includes("Nenhuma despesa ou receita real foi excluída ou alterada"), "content garante lançamentos");
  check(result.content[0].text.includes("forecasts futuros"), "content forecast");
  check(result.content[0].text.includes("externa ao aplicativo foi cancelado"), "content compromisso externo");
  equal(db.tables.expenses.length, 1, "expense real preservada");
  equal(db.tables.incomes.length, 1, "income real preservada");
  equal(db.tables.cards.length, 1, "cartão preservado");
  equal(db.tables.user_categories.length, 1, "categoria preservada");
  equal(db.tables.shared_groups.length, 1, "grupo preservado");
}

for (const confirm of [undefined, false]) {
  const db = use();
  const input = expenseInput({ confirm_delete: confirm });
  if (confirm === undefined) delete input.confirm_delete;
  const result = await core.deleteRecurringExpense.handler(input, ctx);
  errorCode(result, "CONFIRMATION_REQUIRED", `expense confirmação ${confirm}`);
  equal(db.deleted.length, 0, `expense nada removido ${confirm}`);
  check(result.content[0].text.includes("Nada foi removido"), "content confirmação expense");
  check(result.content[0].text.includes("confirm_delete=true"), "orientação confirmação expense");
  check(result.content[0].text.includes("nenhuma despesa, receita"), "confirmação protege reais");
}
for (const [input, code, label] of [
  [expenseInput({ expected_updated_at: "2026-01-01T00:00:00Z" }), "CONCURRENT_MODIFICATION", "expense conflito"],
  [{ ...expenseInput(), recurring_expense_id: "inválido" }, "INVALID_INPUT", "expense UUID"],
  [{ ...expenseInput(), expected_updated_at: "ontem" }, "INVALID_INPUT", "expense timestamp"],
  [{ ...expenseInput(), extra: true }, "INVALID_INPUT", "expense extra"],
  [{ ...expenseInput(), user_id: userA }, "INVALID_INPUT", "expense user"],
  [{ ...expenseInput(), force: true }, "INVALID_INPUT", "expense force"],
  [{ ...expenseInput(), delete_all: true }, "INVALID_INPUT", "expense batch"],
]) {
  const db = use();
  errorCode(await core.deleteRecurringExpense.handler(input, ctx), code, label);
  equal(db.deleted.length, 0, `${label} sem delete`);
}
{
  use(baseTables({ recurring_expenses: [] }));
  errorCode(await core.deleteRecurringExpense.handler(expenseInput(), ctx), "RESOURCE_NOT_FOUND", "expense inexistente");
  use(baseTables({ recurring_expenses: [recurringExpense({ user_id: userB })] }));
  errorCode(await core.deleteRecurringExpense.handler(expenseInput(), ctx), "RESOURCE_NOT_FOUND", "expense alheio");
  use(baseTables({ recurring_expenses: [recurringExpense({ user_id: userB, shared_group_id: groupA })] }));
  errorCode(await core.deleteRecurringExpense.handler(expenseInput(), ctx), "RESOURCE_NOT_FOUND", "expense shared alheio");
}
{
  const db = use(baseTables({ recurring_expenses: [recurringExpense({ shared_group_id: groupA })] }));
  const result = await core.deleteRecurringExpense.handler(expenseInput(), ctx);
  check(result.structuredContent.warnings.includes("SHARED_TEMPLATE_DELETED"), "warning shared expense");
  check(result.content[0].text.includes("projeções do grupo"), "content shared expense");
  equal(db.tables.shared_groups.length, 1, "grupo não removido");
}
{
  const db = use(baseTables(), { raceOnDelete: true });
  errorCode(await core.deleteRecurringExpense.handler(expenseInput(), ctx), "CONCURRENT_MODIFICATION", "corrida expense");
  equal(db.deleted.length, 0, "corrida expense sem delete");
}
{
  use(baseTables(), { removeBeforeDelete: true });
  errorCode(await core.deleteRecurringExpense.handler(expenseInput(), ctx), "RESOURCE_NOT_FOUND", "removido durante corrida expense");
}
{
  use(baseTables(), { deleteError: true });
  const result = await core.deleteRecurringExpense.handler(expenseInput(), ctx);
  errorCode(result, "WRITE_FAILED", "erro write expense");
  check(!result.content[0].text.includes("synthetic SQL"), "erro sem SQL expense");
}
{
  const db = use();
  await core.deleteRecurringExpense.handler(expenseInput(), ctx);
  errorCode(await core.deleteRecurringExpense.handler(expenseInput(), ctx), "RESOURCE_NOT_FOUND", "segunda chamada expense");
}

{
  const db = use();
  const result = await core.deleteRecurringIncome.handler(incomeInput(), ctx);
  equal(result.structuredContent.resource_type, "recurring_income", "income tipo");
  equal(result.structuredContent.id, incomeId, "income id");
  equal(result.structuredContent.deleted, true, "income deleted");
  equal(result.structuredContent.deletion_mode, "permanent", "income permanente");
  equal(db.deleted, [{ table: "recurring_incomes", id: incomeId }], "somente template income removido");
  equal(result.structuredContent.deleted_template.description, "Salário", "income descrição banco");
  equal(result.structuredContent.deleted_template.amount, 3000, "income valor banco");
  equal(result.structuredContent.deleted_template.income_category_id, incomeCategoryId, "income categoria");
  check(!("user_id" in result.structuredContent.deleted_template), "income sem user");
  for (const warning of ["PERMANENT_DELETION", "RECURRING_TEMPLATE_DELETED", "FORECAST_WILL_CHANGE"]) {
    check(result.structuredContent.warnings.includes(warning), `income ${warning}`);
  }
  check(result.content[0].text.includes("template mensal de receita"), "income content tipo");
  check(result.content[0].text.includes("Nenhuma despesa ou receita real"), "income content reais");
  equal(db.tables.expenses.length, 1, "income delete preserva expenses");
  equal(db.tables.incomes.length, 1, "income delete preserva incomes");
}
for (const confirm of [undefined, false]) {
  const db = use();
  const input = incomeInput({ confirm_delete: confirm });
  if (confirm === undefined) delete input.confirm_delete;
  const result = await core.deleteRecurringIncome.handler(input, ctx);
  errorCode(result, "CONFIRMATION_REQUIRED", `income confirmação ${confirm}`);
  equal(db.deleted.length, 0, `income sem delete ${confirm}`);
  check(result.content[0].text.includes("Nada foi removido"), "income confirmação content");
}
for (const [input, code, label] of [
  [incomeInput({ expected_updated_at: "2026-01-01T00:00:00Z" }), "CONCURRENT_MODIFICATION", "income conflito"],
  [{ ...incomeInput(), recurring_income_id: "inválido" }, "INVALID_INPUT", "income UUID"],
  [{ ...incomeInput(), expected_updated_at: "ontem" }, "INVALID_INPUT", "income timestamp"],
  [{ ...incomeInput(), extra: true }, "INVALID_INPUT", "income extra"],
  [{ ...incomeInput(), user_id: userA }, "INVALID_INPUT", "income user"],
  [{ ...incomeInput(), bulk: true }, "INVALID_INPUT", "income batch"],
]) {
  const db = use();
  errorCode(await core.deleteRecurringIncome.handler(input, ctx), code, label);
  equal(db.deleted.length, 0, `${label} sem delete`);
}
{
  use(baseTables({ recurring_incomes: [] }));
  errorCode(await core.deleteRecurringIncome.handler(incomeInput(), ctx), "RESOURCE_NOT_FOUND", "income inexistente");
  use(baseTables({ recurring_incomes: [recurringIncome({ user_id: userB })] }));
  errorCode(await core.deleteRecurringIncome.handler(incomeInput(), ctx), "RESOURCE_NOT_FOUND", "income alheio");
  use(baseTables({ recurring_incomes: [recurringIncome({ user_id: userB, shared_group_id: groupA })] }));
  errorCode(await core.deleteRecurringIncome.handler(incomeInput(), ctx), "RESOURCE_NOT_FOUND", "income shared alheio");
}
{
  const db = use(baseTables({ recurring_incomes: [recurringIncome({ shared_group_id: groupA })] }));
  const result = await core.deleteRecurringIncome.handler(incomeInput(), ctx);
  check(result.structuredContent.warnings.includes("SHARED_TEMPLATE_DELETED"), "warning shared income");
  equal(db.tables.shared_groups.length, 1, "grupo income preservado");
}
{
  const db = use(baseTables(), { raceOnDelete: true, raceId: incomeId });
  errorCode(await core.deleteRecurringIncome.handler(incomeInput(), ctx), "CONCURRENT_MODIFICATION", "corrida income");
  equal(db.deleted.length, 0, "corrida income sem delete");
}
{
  use(baseTables(), { removeBeforeDelete: true, raceId: incomeId });
  errorCode(await core.deleteRecurringIncome.handler(incomeInput(), ctx), "RESOURCE_NOT_FOUND", "removido durante corrida income");
}
{
  use(baseTables(), { deleteError: true });
  const result = await core.deleteRecurringIncome.handler(incomeInput(), ctx);
  errorCode(result, "WRITE_FAILED", "erro write income");
  check(!result.content[0].text.includes("synthetic SQL"), "erro sem SQL income");
}

for (const [tool, table, idField] of [
  [core.deleteRecurringExpense, "recurring_expenses", "recurring_expense_id"],
  [core.deleteRecurringIncome, "recurring_incomes", "recurring_income_id"],
]) {
  const db = use();
  await tool.handler(
    idField === "recurring_expense_id" ? expenseInput() : incomeInput(),
    ctx,
  );
  const call = db.calls.find(
    (candidate) =>
      candidate.table === table &&
      candidate.operations.some((operation) => operation.method === "delete"),
  );
  check(call, `${table} delete executado`);
  for (const [column, value] of [
    ["id", idField === "recurring_expense_id" ? expenseId : incomeId],
    ["user_id", userA],
    ["updated_at", t0],
  ]) {
    check(
      call.operations.some(
        (operation) =>
          operation.method === "eq" &&
          operation.args[0] === column &&
          operation.args[1] === value,
      ),
      `${table} CAS ${column}`,
    );
  }
  equal(
    db.calls.filter((candidate) =>
      ["expenses", "incomes", "cards", "user_categories", "user_income_categories", "shared_groups"].includes(candidate.table),
    ).length,
    0,
    `${table} não alcança outros recursos`,
  );
}

const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const tools = manifest.mcp.tools;
equal(tools.length, 51, "manifest 51 tools");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
  25, "25 read-only");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === false).length,
  26, "26 write");
for (const name of ["delete_recurring_expense", "delete_recurring_income"]) {
  const tool = tools.find((candidate) => candidate.name === name);
  check(tool, `${name} registrado`);
  equal(tool.annotations.readOnlyHint, false, `${name} write`);
  equal(tool.annotations.destructiveHint, true, `${name} destrutiva`);
  equal(tool.annotations.idempotentHint, false, `${name} não idempotente`);
  equal(tool.annotations.openWorldHint, false, `${name} mundo fechado`);
  equal(tool.inputSchema.additionalProperties, false, `${name} input fechado`);
  equal(tool.outputSchema.additionalProperties, false, `${name} output fechado`);
  check(tool.inputSchema.required.includes("confirm_delete"), `${name} confirmação obrigatória`);
  check(tool.inputSchema.required.includes("expected_updated_at"), `${name} timestamp obrigatório`);
  check(!("user_id" in tool.inputSchema.properties), `${name} sem user_id`);
  check(!JSON.stringify(tool.outputSchema).includes("user_id"), `${name} output sem user_id`);
}

const expenseSource = await readFile(
  "src/lib/mcp/tools/delete-recurring-expense.ts",
  "utf8",
);
const incomeSource = await readFile(
  "src/lib/mcp/tools/delete-recurring-income.ts",
  "utf8",
);
const helperSource = await readFile(
  "src/lib/mcp/shared/recurring-delete.ts",
  "utf8",
);
for (const [source, expectedTable, forbiddenTable] of [
  [expenseSource, "recurring_expenses", "recurring_incomes"],
  [incomeSource, "recurring_incomes", "recurring_expenses"],
]) {
  check(source.includes(`from("${expectedTable}")`), `${expectedTable} alcançada`);
  check(!source.includes(`from("${forbiddenTable}")`), `${forbiddenTable} não alcançada`);
  check(!/from\(["'](?:expenses|incomes|cards|user_categories|user_income_categories|shared_groups)["']\)/u.test(source), "sem outros recursos");
  check(!/service_role|SERVICE_ROLE/u.test(source), "sem service role");
  check(/supabaseForUser\(ctx\)/u.test(source), "supabase por usuário");
  check(!/description.*(?:eq|ilike)/u.test(source), "sem busca por descrição");
}
check(!/stack|constraint|SQL/u.test(helperSource), "content sem detalhes internos");
check(!/materializ|deduplic/u.test(expenseSource + incomeSource), "sem materialização/deduplicação");

const bundleSource = await readFile("supabase/functions/mcp/index.ts", "utf8");
check(!/(?:from\s*["']@\/|import\s*\(\s*["']@\/|npm:@\/)/u.test(bundleSource), "bundle sem alias");
check(!/(?:^|["'`(=\s])[A-Za-z]:[\\/]/mu.test(bundleSource), "bundle sem caminho absoluto");
check(/Deno\.serve/u.test(bundleSource), "Deno.serve");
check(bundleSource.includes('name: "delete_recurring_expense"'), "expense no bundle");
check(bundleSource.includes('name: "delete_recurring_income"'), "income no bundle");

console.log(
  `Fase MCP 1.2C-B: ${checks} verificações diretas, regressivas e de contrato concluídas.`,
);
