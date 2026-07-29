import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { build } from "esbuild";
import { z } from "zod";

const mockPlugin = {
  name: "phase-1.2b-supabase-mock",
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
      export { default as deleteExpense } from "./src/lib/mcp/tools/delete-expense.ts";
      export { default as deleteIncome } from "./src/lib/mcp/tools/delete-income.ts";
      export * from "./src/lib/mcp/shared/transaction-delete.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2b-entry.ts",
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
const expenseSiblingId = "40000000-0000-4000-8000-000000000005";
const incomeId = "50000000-0000-4000-8000-000000000005";
const incomeSiblingId = "50000000-0000-4000-8000-000000000006";
const categoryId = "60000000-0000-4000-8000-000000000006";
const incomeCategoryId = "70000000-0000-4000-8000-000000000007";
const cardId = "80000000-0000-4000-8000-000000000008";
const installmentGroupId = "90000000-0000-4000-8000-000000000009";
const t0 = "2026-07-01T12:00:00.000Z";

const expense = (overrides = {}) => ({
  id: expenseId,
  user_id: userA,
  description: "Mercado",
  amount: 100,
  expense_date: "2026-07-10",
  category_id: categoryId,
  category_name: "Alimentação",
  category_icon: "🍔",
  payment_method: "credit",
  card_id: cardId,
  card_name: "Cartão",
  card_color: "#111111",
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
  income_category_id: incomeCategoryId,
  category_name: "Salário",
  category_icon: "💰",
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
  expense_splits: [
    {
      id: "a0000000-0000-4000-8000-000000000001",
      expense_id: expenseId,
      user_id: userA,
    },
  ],
  cards: [{ id: cardId, user_id: userA, name: "Cartão" }],
  user_categories: [{ id: categoryId, user_id: userA, name: "Alimentação" }],
  user_income_categories: [
    { id: incomeCategoryId, user_id: userA, name: "Salário" },
  ],
  shared_groups: [{ id: groupA, owner_id: userA, name: "Casa" }],
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
    if (!["expenses", "incomes"].includes(this.table)) return true;
    return row.user_id === this.db.userId || row.shared_group_id === groupA;
  }
  project(row) {
    if (!this.columns) return structuredClone(row);
    return Object.fromEntries(this.columns.map((column) => [column, row[column]]));
  }
  async maybeSingle() {
    return this.execute();
  }
  async execute() {
    const rows = this.db.tables[this.table] ?? [];
    if (this.deleting && this.db.deleteError) {
      return { data: null, error: { message: "synthetic constraint detail" } };
    }
    if (this.deleting && this.db.raceOnDelete && !this.db.raceApplied) {
      const target = rows.find((row) => row.id === this.db.raceId);
      if (target) target.updated_at = "2026-07-01T12:00:01.000Z";
      this.db.raceApplied = true;
    }
    if (this.deleting && this.db.removeBeforeDelete && !this.db.removeApplied) {
      const targetIndex = rows.findIndex((row) => row.id === this.db.raceId);
      if (targetIndex >= 0) rows.splice(targetIndex, 1);
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
    const index = rows.findIndex((row) => row === removed);
    rows.splice(index, 1);
    this.db.deletedIds.push(removed.id);
    if (this.table === "expenses") {
      this.db.tables.expense_splits = (this.db.tables.expense_splits ?? []).filter(
        (split) => split.expense_id !== removed.id,
      );
    }
    return { data: this.project(removed), error: null };
  }
}
class DB {
  constructor(tables, options = {}) {
    this.tables = structuredClone(tables);
    this.userId = userA;
    this.calls = [];
    this.deletedIds = [];
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
  expense_id: expenseId,
  expected_updated_at: t0,
  confirm_delete: true,
  ...overrides,
});
const incomeInput = (overrides = {}) => ({
  income_id: incomeId,
  expected_updated_at: t0,
  confirm_delete: true,
  ...overrides,
});

{
  const db = use();
  const result = await core.deleteExpense.handler(expenseInput(), ctx);
  equal(result.structuredContent.resource_type, "expense", "expense tipo");
  equal(result.structuredContent.id, expenseId, "expense id");
  equal(result.structuredContent.deleted, true, "expense deleted");
  equal(result.structuredContent.deletion_mode, "permanent", "expense permanente");
  equal(db.deletedIds, [expenseId], "expense removida");
  equal(db.tables.expenses.length, 0, "linha ausente");
  equal(result.structuredContent.deleted_record.description, "Mercado", "registro retornado pelo banco");
  equal(result.structuredContent.deleted_record.amount, 100, "valor removido");
  equal(result.structuredContent.deleted_record.expense_date, "2026-07-10", "data removida");
  equal(result.structuredContent.deleted_record.card_id, cardId, "cartão factual");
  equal(result.structuredContent.deleted_record.category_id, categoryId, "categoria factual");
  check(!("user_id" in result.structuredContent.deleted_record), "expense output sem user_id");
  check(result.structuredContent.warnings.includes("PERMANENT_DELETION"), "warning permanente");
  check(Number.isFinite(Date.parse(result.structuredContent.operation_completed_at)), "horário da operação");
  equal(db.tables.cards.length, 1, "cartão não excluído");
  equal(db.tables.user_categories.length, 1, "categoria não excluída");
  equal(db.tables.shared_groups.length, 1, "grupo não excluído");
  equal(db.tables.expense_splits.length, 0, "cascade real de splits");
  check(db.calls.every((call) => call.table !== "expense_splits"), "sem cascade manual");
}

for (const confirmation of [undefined, false]) {
  const db = use();
  const input = expenseInput();
  if (confirmation === undefined) delete input.confirm_delete;
  else input.confirm_delete = confirmation;
  const result = await core.deleteExpense.handler(input, ctx);
  errorCode(result, "CONFIRMATION_REQUIRED", `expense confirmação ${String(confirmation)}`);
  equal(db.deletedIds, [], "expense não exclui sem confirmação");
  equal(db.tables.expenses[0].updated_at, t0, "expense confirmação não altera updated_at");
  check(result.content[0].text.includes("Nada foi excluído"), "content bloqueio");
  check(result.content[0].text.includes("definitiva"), "content informa permanência");
  check(result.content[0].text.includes("Mercado"), "content reconhecível");
}
{
  const db = use();
  const result = await core.deleteExpense.handler(
    expenseInput({ expected_updated_at: "2026-06-01T00:00:00.000Z" }),
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "expense versão antiga");
  equal(db.deletedIds, [], "expense conflito sem delete");
  check(result.content[0].text.includes("Releia"), "expense conflito orienta releitura");
}
{
  const db = use(baseTables(), { raceOnDelete: true, raceId: expenseId });
  const result = await core.deleteExpense.handler(expenseInput(), ctx);
  errorCode(result, "CONCURRENT_MODIFICATION", "expense corrida");
  equal(db.deletedIds, [], "expense corrida protegida");
  equal(db.tables.expenses.length, 1, "expense corrida preserva linha");
}
{
  const db = use(baseTables(), { removeBeforeDelete: true, raceId: expenseId });
  const result = await core.deleteExpense.handler(expenseInput(), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "expense removida antes do delete");
  equal(db.deletedIds, [], "zero linhas por remoção anterior");
}
{
  use(baseTables({ expenses: [] }));
  const result = await core.deleteExpense.handler(expenseInput(), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "expense inexistente");
}
for (const row of [
  expense({ user_id: userB, shared_group_id: null }),
  expense({ user_id: userB, shared_group_id: groupA, is_shared: true }),
]) {
  const db = use(baseTables({ expenses: [row] }));
  const result = await core.deleteExpense.handler(expenseInput(), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "expense alheia genérica");
  equal(db.deletedIds, [], "expense alheia preservada");
  check(!result.content[0].text.includes(userB), "expense sem proprietário");
}
{
  const db = use(baseTables({
    expenses: [expense({ shared_group_id: groupA, is_shared: true })],
  }));
  const result = await core.deleteExpense.handler(expenseInput(), ctx);
  check(result.structuredContent.warnings.includes("SHARED_RECORD_DELETED"), "expense shared warning");
  check(result.content[0].text.includes("deixará de aparecer no grupo"), "expense shared content");
  equal(db.tables.shared_groups.length, 1, "grupo compartilhado preservado");
}

for (const [override, label] of [
  [{ expense_id: "inválido" }, "UUID"],
  [{ expected_updated_at: "ontem" }, "timestamp"],
  [{ extra: true }, "campo extra"],
  [{ user_id: userA }, "user_id"],
  [{ shared_group_id: groupA }, "shared_group_id"],
  [{ delete_series: true }, "delete_series"],
  [{ delete_all_installments: true }, "delete_all_installments"],
  [{ force: true }, "force"],
]) {
  const db = use();
  const result = await core.deleteExpense.handler(expenseInput(override), ctx);
  errorCode(result, "INVALID_INPUT", `expense rejeita ${label}`);
  equal(db.deletedIds, [], `expense ${label} sem delete`);
}
{
  const db = use(baseTables(), { deleteError: true });
  const result = await core.deleteExpense.handler(expenseInput(), ctx);
  errorCode(result, "WRITE_FAILED", "expense FK/regra bloqueia");
  check(!result.content[0].text.includes("constraint"), "expense sem constraint");
  check(!result.content[0].text.includes("synthetic"), "expense sem SQL bruto");
  equal(db.deletedIds, [], "expense erro sem parcial");
}

{
  const selected = expense({
    installment_group_id: installmentGroupId,
    installment_number: 2,
    total_installments: 4,
  });
  const sibling = expense({
    id: expenseSiblingId,
    installment_group_id: installmentGroupId,
    installment_number: 3,
    total_installments: 4,
  });
  let db = use(baseTables({ expenses: [selected, sibling] }));
  let result = await core.deleteExpense.handler(expenseInput(), ctx);
  errorCode(result, "CONFIRMATION_REQUIRED", "parcela expense exige confirmação");
  equal(db.deletedIds, [], "parcela expense bloqueada");
  check(result.content[0].text.includes("parcela=2") || result.content[0].text.includes("installment_number=2"), "parcela factual");
  check(result.content[0].text.includes("total_installments=4"), "total factual");

  db = use(baseTables({ expenses: [selected, sibling] }));
  result = await core.deleteExpense.handler(
    expenseInput({ confirm_single_installment_delete: true }),
    ctx,
  );
  equal(db.deletedIds, [expenseId], "somente expense_id removido");
  equal(db.tables.expenses.length, 1, "parcela irmã preservada");
  equal(db.tables.expenses[0].id, expenseSiblingId, "irmã correta");
  equal(db.tables.expenses[0].installment_group_id, installmentGroupId, "grupo irmã preservado");
  equal(db.tables.expenses[0].installment_number, 3, "número irmã preservado");
  equal(db.tables.expenses[0].total_installments, 4, "total irmã preservado");
  check(result.structuredContent.warnings.includes("ONLY_ONE_INSTALLMENT_DELETED"), "warning parcela expense");
  check(result.content[0].text.includes("nenhuma outra parcela foi removida"), "content parcela expense");
  check(result.content[0].text.includes("poderá ficar incompleta"), "content série incompleta");
  check(db.calls.every((call) => call.operations.every((op) =>
    !(op.method === "eq" && op.args[0] === "installment_group_id"))), "sem filtro por série");
}

{
  const db = use();
  const result = await core.deleteIncome.handler(incomeInput(), ctx);
  equal(result.structuredContent.resource_type, "income", "income tipo");
  equal(result.structuredContent.deleted, true, "income deleted");
  equal(result.structuredContent.deletion_mode, "permanent", "income permanente");
  equal(db.deletedIds, [incomeId], "income removida");
  equal(result.structuredContent.deleted_record.description, "Salário", "income registro real");
  equal(result.structuredContent.deleted_record.amount, 3000, "income valor");
  equal(result.structuredContent.deleted_record.income_date, "2026-07-10T03:00:00.000Z", "income data");
  check(!("user_id" in result.structuredContent.deleted_record), "income sem user_id");
  check(result.structuredContent.warnings.includes("PERMANENT_DELETION"), "income permanente warning");
  check(result.content[0].text.includes("definitivamente"), "income content permanente");
}
for (const confirmation of [undefined, false]) {
  const db = use();
  const input = incomeInput();
  if (confirmation === undefined) delete input.confirm_delete;
  else input.confirm_delete = confirmation;
  const result = await core.deleteIncome.handler(input, ctx);
  errorCode(result, "CONFIRMATION_REQUIRED", `income confirmação ${String(confirmation)}`);
  equal(db.deletedIds, [], "income não exclui sem confirmação");
  equal(db.tables.incomes[0].updated_at, t0, "income confirmação não altera");
  check(result.content[0].text.includes("Nada foi excluído"), "income bloqueio content");
}
{
  const db = use();
  const result = await core.deleteIncome.handler(
    incomeInput({ expected_updated_at: "2026-06-01T00:00:00.000Z" }),
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "income versão antiga");
  equal(db.deletedIds, [], "income conflito sem delete");
}
{
  const db = use(baseTables(), { raceOnDelete: true, raceId: incomeId });
  const result = await core.deleteIncome.handler(incomeInput(), ctx);
  errorCode(result, "CONCURRENT_MODIFICATION", "income corrida");
  equal(db.deletedIds, [], "income corrida protegida");
}
{
  const db = use(baseTables(), { removeBeforeDelete: true, raceId: incomeId });
  const result = await core.deleteIncome.handler(incomeInput(), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "income removida antes");
  equal(db.deletedIds, [], "income anterior sem delete");
}
{
  use(baseTables({ incomes: [] }));
  const result = await core.deleteIncome.handler(incomeInput(), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "income inexistente");
}
for (const row of [
  income({ user_id: userB, shared_group_id: null }),
  income({ user_id: userB, shared_group_id: groupA }),
]) {
  const db = use(baseTables({ incomes: [row] }));
  const result = await core.deleteIncome.handler(incomeInput(), ctx);
  errorCode(result, "RESOURCE_NOT_FOUND", "income alheia genérica");
  equal(db.deletedIds, [], "income alheia preservada");
  check(!result.content[0].text.includes(userB), "income sem proprietário");
}
{
  const db = use(baseTables({ incomes: [income({ shared_group_id: groupA })] }));
  const result = await core.deleteIncome.handler(incomeInput(), ctx);
  check(result.structuredContent.warnings.includes("SHARED_RECORD_DELETED"), "income shared warning");
  check(result.content[0].text.includes("deixará de aparecer no grupo"), "income shared content");
  equal(db.tables.shared_groups.length, 1, "income grupo preservado");
}
for (const [override, label] of [
  [{ income_id: "inválido" }, "UUID"],
  [{ expected_updated_at: "ontem" }, "timestamp"],
  [{ extra: true }, "campo extra"],
  [{ user_id: userA }, "user_id"],
  [{ delete_series: true }, "delete_series"],
]) {
  const db = use();
  const result = await core.deleteIncome.handler(incomeInput(override), ctx);
  errorCode(result, "INVALID_INPUT", `income rejeita ${label}`);
  equal(db.deletedIds, [], `income ${label} sem delete`);
}
{
  const selected = income({
    installment_group_id: installmentGroupId,
    installment_number: 1,
    total_installments: 3,
  });
  const sibling = income({
    id: incomeSiblingId,
    installment_group_id: installmentGroupId,
    installment_number: 2,
    total_installments: 3,
  });
  let db = use(baseTables({ incomes: [selected, sibling] }));
  let result = await core.deleteIncome.handler(incomeInput(), ctx);
  errorCode(result, "CONFIRMATION_REQUIRED", "parcela income exige confirmação");
  equal(db.deletedIds, [], "parcela income bloqueada");

  db = use(baseTables({ incomes: [selected, sibling] }));
  result = await core.deleteIncome.handler(
    incomeInput({ confirm_single_installment_delete: true }),
    ctx,
  );
  equal(db.deletedIds, [incomeId], "somente income_id removido");
  equal(db.tables.incomes.length, 1, "income irmã preservada");
  equal(db.tables.incomes[0].id, incomeSiblingId, "income irmã correta");
  equal(db.tables.incomes[0].installment_group_id, installmentGroupId, "income grupo preservado");
  equal(db.tables.incomes[0].installment_number, 2, "income número preservado");
  equal(db.tables.incomes[0].total_installments, 3, "income total preservado");
  check(result.structuredContent.warnings.includes("ONLY_ONE_INSTALLMENT_DELETED"), "warning parcela income");
  check(result.content[0].text.includes("nenhuma outra parcela foi removida"), "content parcela income");
}

for (const [tool, type] of [
  [core.deleteExpense, "expense"],
  [core.deleteIncome, "income"],
]) {
  const db = use();
  const result =
    type === "expense"
      ? await tool.handler(expenseInput(), ctx)
      : await tool.handler(incomeInput(), ctx);
  check(z.object(tool.outputSchema).strict().safeParse(result.structuredContent).success, `${type} output fechado`);
  equal(tool.annotations.readOnlyHint, false, `${type} write`);
  equal(tool.annotations.destructiveHint, true, `${type} destrutiva`);
  equal(tool.annotations.idempotentHint, false, `${type} não idempotente`);
  equal(tool.annotations.openWorldHint, false, `${type} closed world`);
  check(!JSON.stringify(tool.inputSchema).includes("user_id"), `${type} input sem user_id`);
  check(!JSON.stringify(tool.outputSchema).includes("user_id"), `${type} output sem user_id`);
  check(result.content[0].text.includes("operation_completed_at="), `${type} content horário`);
  check(result.content[0].text.includes("Cartão, categoria, grupo"), `${type} content preservação`);
  check(!result.content[0].text.includes(userA), `${type} content sem proprietário`);
  check(db.calls.some((call) => call.operations.some((op) => op.method === "delete")), `${type} usa delete`);
}

const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const tools = manifest.mcp.tools;
equal(tools.length, 44, "manifest 44 tools");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === true).length, 20, "20 read-only");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint !== true).length, 24, "24 write");
for (const name of ["delete_expense", "delete_income"]) {
  const tool = tools.find((candidate) => candidate.name === name);
  check(tool, `${name} no manifest`);
  equal(tool.inputSchema.additionalProperties, false, `${name} input fechado`);
  check(tool.inputSchema.required.includes("confirm_delete"), `${name} confirmação obrigatória`);
  check(tool.inputSchema.required.includes("expected_updated_at"), `${name} expected obrigatório`);
  check(!("user_id" in tool.inputSchema.properties), `${name} sem user_id input`);
  check(!JSON.stringify(tool.outputSchema).includes("user_id"), `${name} sem user_id output`);
  equal(tool.outputSchema.additionalProperties, false, `${name} output fechado`);
  equal(tool.annotations.readOnlyHint, false, `${name} manifest write`);
  equal(tool.annotations.destructiveHint, true, `${name} manifest destrutiva`);
  equal(tool.annotations.idempotentHint, false, `${name} manifest não idempotente`);
}

const bundle = await readFile("supabase/functions/mcp/index.ts", "utf8");
check(bundle.includes('name: "delete_expense"'), "bundle delete_expense");
check(bundle.includes('name: "delete_income"'), "bundle delete_income");
check(bundle.includes("Deno.serve"), "bundle Deno.serve");
check(!bundle.includes("@/"), "bundle sem alias");
check(!bundle.includes("npm:@/"), "bundle sem npm alias");
check(!/(?:^|["'`(=\s])[A-Za-z]:[\\/]/mu.test(bundle), "bundle sem caminho Windows");
check(!/service_role|SERVICE_ROLE/u.test(bundle), "bundle sem service role");
check(bundle.includes("supabaseForUser(ctx)"), "bundle usa supabaseForUser");

const expenseSource = await readFile("src/lib/mcp/tools/delete-expense.ts", "utf8");
const incomeSource = await readFile("src/lib/mcp/tools/delete-income.ts", "utf8");
for (const source of [expenseSource, incomeSource]) {
  check(source.includes('.eq("user_id", userId)'), "delete filtra proprietário");
  check(source.includes('.eq("updated_at", input.expected_updated_at)'), "delete filtra versão");
  check(!source.includes('.eq("installment_group_id"'), "sem delete por série");
  check(!source.includes("service_role"), "sem service role");
}

const migrationNames = await readdir("supabase/migrations");
check(migrationNames.every((name) => name.endsWith(".sql")), "nenhuma migration criada");

console.log(`Fase MCP 1.2B: ${checks} verificações diretas, regressivas e de contrato concluídas.`);
