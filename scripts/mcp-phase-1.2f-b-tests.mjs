import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { mock } from "node:test";
import { build } from "esbuild";

mock.timers.enable({
  apis: ["Date"],
  now: new Date("2026-07-29T12:00:00-03:00"),
});

const plugin = {
  name: "phase-1.2f-b-supabase",
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
      export { default as expenseDetails } from "./src/lib/mcp/tools/get-expense-split-details.ts";
      export { default as memberSummary } from "./src/lib/mcp/tools/get-group-member-summary.ts";
      export { default as settlement } from "./src/lib/mcp/tools/get-group-settlement.ts";
      export * from "./src/lib/mcp/shared/group-split-analysis.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2f-b-entry.ts",
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
const serialized = (value) => JSON.stringify(value);

const userA = "10000000-0000-4000-8000-000000000001";
const userB = "20000000-0000-4000-8000-000000000002";
const userC = "30000000-0000-4000-8000-000000000003";
const userD = "40000000-0000-4000-8000-000000000004";
const groupA = "51000000-0000-4000-8000-000000000001";
const groupB = "52000000-0000-4000-8000-000000000002";
const memberA = "61000000-0000-4000-8000-000000000001";
const memberB = "62000000-0000-4000-8000-000000000002";
const memberC = "63000000-0000-4000-8000-000000000003";
const expense1 = "71000000-0000-4000-8000-000000000001";
const expense2 = "72000000-0000-4000-8000-000000000002";
const expense3 = "73000000-0000-4000-8000-000000000003";
const expensePersonal = "74000000-0000-4000-8000-000000000004";
const expenseAlien = "75000000-0000-4000-8000-000000000005";

const group = (overrides = {}) => ({
  id: groupA,
  name: "Casa",
  created_by: userA,
  is_active: true,
  updated_at: "2026-07-20T12:00:00.000Z",
  ...overrides,
});
const membership = (overrides = {}) => ({
  id: memberA,
  group_id: groupA,
  user_id: userA,
  role: "owner",
  joined_at: "2026-01-01T12:00:00.000Z",
  ...overrides,
});
const expense = (overrides = {}) => ({
  id: expense1,
  user_id: userA,
  description: "Mercado",
  amount: 10,
  expense_date: "2026-07-10",
  shared_group_id: groupA,
  is_shared: true,
  paid_by: userA,
  split_type: "equal",
  installment_group_id: null,
  installment_number: 1,
  total_installments: 1,
  created_at: "2026-07-10T12:00:00.000Z",
  updated_at: "2026-07-10T12:00:00.000Z",
  ...overrides,
});
const split = (overrides = {}) => ({
  id: "81000000-0000-4000-8000-000000000001",
  expense_id: expense1,
  user_id: userA,
  share_amount: 3.34,
  share_percentage: null,
  user_email: "private@example.com",
  created_at: "2026-07-10T12:00:00.000Z",
  ...overrides,
});
const base = (overrides = {}) => ({
  shared_groups: [
    group(),
    group({ id: groupB, name: "Alheio", created_by: userD }),
  ],
  shared_group_members: [
    membership(),
    membership({
      id: memberB,
      user_id: userB,
      role: "admin",
      joined_at: "2026-01-02T12:00:00.000Z",
    }),
    membership({
      id: memberC,
      user_id: userC,
      role: "member",
      joined_at: "2026-01-03T12:00:00.000Z",
    }),
    membership({
      id: "64000000-0000-4000-8000-000000000004",
      group_id: groupB,
      user_id: userD,
      role: "owner",
    }),
  ],
  profiles: [
    { user_id: userA, display_name: "João" },
    { user_id: userB, display_name: "Alex" },
    { user_id: userC, display_name: "Alex" },
    { user_id: userD, display_name: "Pessoa alheia" },
  ],
  expenses: [
    expense(),
    expense({
      id: expense2,
      user_id: userB,
      description: "Internet",
      amount: 20,
      expense_date: "2026-07-12",
      paid_by: userB,
      split_type: "percentage",
    }),
    expense({
      id: expense3,
      user_id: userC,
      description: "Limpeza",
      amount: 7,
      expense_date: "2026-07-15",
      paid_by: userC,
      split_type: "manual",
      installment_group_id: "76000000-0000-4000-8000-000000000006",
      installment_number: 2,
      total_installments: 3,
    }),
    expense({
      id: expensePersonal,
      description: "Não rateada",
      amount: 99,
      is_shared: false,
      split_type: null,
    }),
    expense({
      id: expenseAlien,
      user_id: userD,
      description: "Segredo",
      amount: 999,
      shared_group_id: groupB,
      paid_by: userD,
    }),
  ],
  expense_splits: [
    split(),
    split({
      id: "82000000-0000-4000-8000-000000000002",
      user_id: userB,
      share_amount: 3.33,
    }),
    split({
      id: "83000000-0000-4000-8000-000000000003",
      user_id: userC,
      share_amount: 3.33,
    }),
    split({
      id: "84000000-0000-4000-8000-000000000004",
      expense_id: expense2,
      user_id: userA,
      share_amount: 10,
      share_percentage: 50,
    }),
    split({
      id: "85000000-0000-4000-8000-000000000005",
      expense_id: expense2,
      user_id: userB,
      share_amount: 10,
      share_percentage: 50,
    }),
    split({
      id: "86000000-0000-4000-8000-000000000006",
      expense_id: expense3,
      user_id: userA,
      share_amount: 2,
    }),
    split({
      id: "87000000-0000-4000-8000-000000000007",
      expense_id: expense3,
      user_id: userC,
      share_amount: 5,
    }),
    split({
      id: "88000000-0000-4000-8000-000000000008",
      expense_id: expenseAlien,
      user_id: userD,
      share_amount: 999,
    }),
  ],
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
    this.filters.push((row) => row[column] === value);
    return this;
  }
  in(column, values) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  gte(column, value) {
    this.filters.push((row) => row[column] >= value);
    return this;
  }
  lte(column, value) {
    this.filters.push((row) => row[column] <= value);
    return this;
  }
  limit(value) {
    this.max = value;
    return this;
  }
  isGroupMember(groupId, candidate = this.db.userId) {
    return this.db.tables.shared_group_members.some(
      (row) => row.group_id === groupId && row.user_id === candidate,
    );
  }
  canSeeGroup(groupId) {
    const row = this.db.tables.shared_groups.find((item) => item.id === groupId);
    return row?.created_by === this.db.userId || this.isGroupMember(groupId);
  }
  canSeeExpense(row) {
    return (
      row.user_id === this.db.userId ||
      (row.shared_group_id && this.isGroupMember(row.shared_group_id))
    );
  }
  sharesGroup(left, right) {
    const groups = new Set(
      this.db.tables.shared_group_members
        .filter((row) => row.user_id === left)
        .map((row) => row.group_id),
    );
    return this.db.tables.shared_group_members.some(
      (row) => row.user_id === right && groups.has(row.group_id),
    );
  }
  rows() {
    let rows = structuredClone(this.db.tables[this.table] ?? []);
    if (this.table === "shared_groups") {
      rows = rows.filter((row) => this.canSeeGroup(row.id));
    } else if (this.table === "shared_group_members") {
      rows = rows.filter((row) => this.isGroupMember(row.group_id));
    } else if (this.table === "profiles") {
      rows = rows.filter(
        (row) =>
          row.user_id === this.db.userId ||
          this.sharesGroup(this.db.userId, row.user_id),
      );
    } else if (this.table === "expenses") {
      rows = rows.filter((row) => this.canSeeExpense(row));
    } else if (this.table === "expense_splits") {
      rows = rows.filter((row) => {
        const parent = this.db.tables.expenses.find(
          (expenseRow) => expenseRow.id === row.expense_id,
        );
        return parent && this.canSeeExpense(parent);
      });
    }
    for (const filter of this.filters) rows = rows.filter(filter);
    return rows.slice(0, this.max);
  }
  project(row) {
    if (!this.columns) return row;
    return Object.fromEntries(
      this.columns
        .filter((column) => column in row)
        .map((column) => [column, row[column]]),
    );
  }
  execute(single) {
    if (this.db.failTable === this.table) {
      return { data: null, error: { message: "private database detail" } };
    }
    const rows = this.rows().map((row) => this.project(row));
    return { data: single ? rows[0] ?? null : rows, error: null };
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
    this.userId = options.userId ?? userA;
    this.failTable = options.failTable ?? null;
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
  getUserId: () => userA,
  getToken: () => "synthetic",
};
const use = (tables = base(), options) => {
  const db = new DB(tables, options);
  globalThis.__MCP_TEST_SUPABASE__ = db;
  return db;
};

// Detalhes: equal, identidade pública, parcelas, centavos e content completo.
{
  const db = use();
  const result = await core.expenseDetails.handler({ expense_id: expense1 }, ctx);
  const data = result.structuredContent;
  equal(data.resource_type, "expense_split_details", "resource details");
  equal(data.expense.split_type, "equal", "tipo equal");
  equal(data.expense.amount, 10, "valor monetário");
  equal(data.expense.group_id, groupA, "grupo real");
  equal(data.expense.group_name, "Casa", "nome do grupo");
  equal(data.expense.paid_by_membership_id, memberA, "pagador membership");
  equal(data.expense.paid_by_display_name, "João", "pagador público");
  equal(data.expense.installment_number, 1, "parcela materializada");
  equal(data.expense.total_installments, 1, "total parcelas");
  equal(data.participant_count, 3, "três participantes");
  equal(data.allocated_amount_total, 10, "soma exata");
  equal(data.unallocated_amount, 0, "sem falta");
  equal(data.allocation_difference, 0, "diferença zero");
  equal(data.allocation_status, "balanced", "balanceado");
  equal(data.participants.map((item) => item.allocated_amount), [3.34, 3.33, 3.33], "10/3 persistido");
  equal(data.participants[0].is_current_user, true, "participante atual");
  equal(data.participants.filter((item) => item.display_name === "Alex").length, 2, "nomes iguais preservados");
  equal(new Set(data.participants.map((item) => item.membership_id)).size, 3, "memberships diferenciam");
  check(data.participants.every((item) => item.allocation_source === "persisted_split"), "fonte factual");
  check(result.content[0].text.includes("total_atribuído=10"), "content total");
  check(result.content[0].text.includes("Nenhum dado foi alterado"), "content read-only");
  check(!serialized(result).includes(userA), "JSON sem user A");
  check(!serialized(result).includes(userB), "JSON sem user B");
  check(!serialized(result).includes("@"), "JSON sem email");
  equal(db.writes, [], "detalhes sem escrita");
}

{
  use();
  const percentage = await core.expenseDetails.handler({ expense_id: expense2 }, ctx);
  equal(percentage.structuredContent.expense.split_type, "percentage", "tipo percentual");
  equal(
    percentage.structuredContent.participants.map((item) => item.percentage),
    [50, 50],
    "percentuais factuais",
  );
  equal(percentage.structuredContent.allocation_status, "balanced", "percentual balanceado");
  const manual = await core.expenseDetails.handler({ expense_id: expense3 }, ctx);
  equal(manual.structuredContent.expense.split_type, "manual", "tipo manual");
  equal(manual.structuredContent.expense.installment_number, 2, "parcela específica");
  equal(manual.structuredContent.expense.total_installments, 3, "metadado série");
  equal(manual.structuredContent.allocated_amount_total, 7, "manual total");
}

for (const target of [
  "79000000-0000-4000-8000-000000000009",
  expenseAlien,
]) {
  use();
  errorCode(
    await core.expenseDetails.handler({ expense_id: target }, ctx),
    "RESOURCE_NOT_FOUND",
    "despesa ausente e alheia indistinguíveis",
  );
}
{
  const tables = base();
  tables.expenses.push(
    expense({
      id: "79000000-0000-4000-8000-000000000008",
      shared_group_id: groupB,
      user_id: userA,
    }),
  );
  use(tables);
  errorCode(
    await core.expenseDetails.handler(
      { expense_id: "79000000-0000-4000-8000-000000000008" },
      ctx,
    ),
    "RESOURCE_NOT_FOUND",
    "grupo inacessível não é revelado por despesa própria",
  );
}
{
  use();
  errorCode(
    await core.expenseDetails.handler({ expense_id: expensePersonal }, ctx),
    "EXPENSE_NOT_SHARED",
    "despesa pessoal rejeitada",
  );
}
for (const invalid of [
  {},
  { expense_id: "x" },
  { expense_id: expense1, user_id: userA },
  { expense_id: expense1, group_id: groupA },
  { expense_id: expense1, include_email: true },
]) {
  use();
  errorCode(
    await core.expenseDetails.handler(invalid, ctx),
    "INVALID_INPUT",
    "input details fechado",
  );
}

{
  const tables = base();
  tables.expenses.find((row) => row.id === expense1).paid_by = null;
  use(tables);
  const result = await core.expenseDetails.handler({ expense_id: expense1 }, ctx);
  equal(result.structuredContent.expense.paid_by_membership_id, memberA, "fallback real para criador");
  check(!result.structuredContent.warnings.includes("PAYER_UNRESOLVED"), "fallback comprovado resolve pagador");
}
{
  const tables = base();
  tables.profiles = tables.profiles.filter((row) => row.user_id !== userC);
  use(tables);
  const result = await core.expenseDetails.handler({ expense_id: expense1 }, ctx);
  const missing = result.structuredContent.participants.find(
    (row) => row.membership_id === memberC,
  );
  equal(missing.display_name, "Membro", "perfil ausente usa Membro");
  check(result.structuredContent.warnings.includes("MEMBER_PROFILE_INCOMPLETE"), "warning perfil");
  equal(result.structuredContent.data_complete, false, "perfil incompleto");
}
{
  const tables = base();
  tables.shared_group_members = tables.shared_group_members.filter(
    (row) => row.user_id !== userC,
  );
  use(tables);
  const result = await core.expenseDetails.handler({ expense_id: expense1 }, ctx);
  const historical = result.structuredContent.participants.find(
    (row) => row.membership_id === null,
  );
  equal(historical.display_name, "Membro anterior", "membro removido seguro");
  check(result.structuredContent.warnings.includes("HISTORICAL_MEMBER_UNRESOLVED"), "warning histórico");
  equal(result.structuredContent.data_complete, false, "histórico incompleto");
}
{
  const tables = base();
  tables.expenses.find((row) => row.id === expense1).paid_by = userD;
  use(tables);
  const result = await core.expenseDetails.handler({ expense_id: expense1 }, ctx);
  equal(result.structuredContent.expense.paid_by_membership_id, null, "pagador sem membership");
  equal(result.structuredContent.expense.paid_by_display_name, "Membro anterior", "pagador seguro");
  check(result.structuredContent.warnings.includes("PAYER_UNRESOLVED"), "pagador unresolved");
}
{
  const tables = base();
  tables.expense_splits = tables.expense_splits.filter(
    (row) => row.expense_id !== expense1,
  );
  use(tables);
  const result = await core.expenseDetails.handler({ expense_id: expense1 }, ctx);
  equal(result.structuredContent.participants, [], "sem participantes inventados");
  equal(result.structuredContent.allocation_status, "no_split_rows", "status sem splits");
  equal(result.structuredContent.unallocated_amount, 10, "todo valor não atribuído");
  check(result.structuredContent.warnings.includes("SPLIT_DETAILS_MISSING"), "warning split ausente");
}
for (const [amounts, expectedStatus, warning] of [
  [[3, 3, 3], "under_allocated", "SPLIT_UNDER_ALLOCATED"],
  [[4, 4, 4], "over_allocated", "SPLIT_OVER_ALLOCATED"],
]) {
  const tables = base();
  tables.expense_splits
    .filter((row) => row.expense_id === expense1)
    .forEach((row, index) => {
      row.share_amount = amounts[index];
    });
  use(tables);
  const result = await core.expenseDetails.handler({ expense_id: expense1 }, ctx);
  equal(result.structuredContent.allocation_status, expectedStatus, expectedStatus);
  check(result.structuredContent.warnings.includes(warning), warning);
  equal(result.structuredContent.data_complete, false, "alocação inconsistente");
}
{
  const tables = base();
  tables.expense_splits
    .filter((row) => row.expense_id === expense2)
    .forEach((row, index) => {
      row.share_percentage = index === 0 ? 33.3333 : 66.6666;
    });
  use(tables);
  const result = await core.expenseDetails.handler({ expense_id: expense2 }, ctx);
  equal(result.structuredContent.allocation_status, "inconsistent", "percentual 99.9999 inválido");
  check(result.structuredContent.warnings.includes("SPLIT_PERCENTAGE_INVALID"), "warning percentual");
}
{
  const tables = base();
  tables.expenses.find((row) => row.id === expense1).amount = 0.01;
  tables.expense_splits = [
    split({ user_id: userA, share_amount: 0.01 }),
    split({
      id: "89000000-0000-4000-8000-000000000009",
      user_id: userB,
      share_amount: 0,
    }),
  ];
  use(tables);
  const result = await core.expenseDetails.handler({ expense_id: expense1 }, ctx);
  equal(
    result.structuredContent.participants.map((row) => row.allocated_amount),
    [0.01, 0],
    "R$ 0,01 por dois preserva centavo persistido",
  );
  equal(result.structuredContent.allocated_amount_total, 0.01, "um centavo exato");
  equal(result.structuredContent.allocation_status, "balanced", "um centavo balanceado");
}
{
  const tables = base();
  tables.expenses.find((row) => row.id === expense2).amount = 30;
  tables.expense_splits = [
    split({
      expense_id: expense2,
      user_id: userA,
      share_amount: 10,
      share_percentage: 33.3333,
    }),
    split({
      id: "89000000-0000-4000-8000-000000000010",
      expense_id: expense2,
      user_id: userB,
      share_amount: 10,
      share_percentage: 33.3333,
    }),
    split({
      id: "89000000-0000-4000-8000-000000000011",
      expense_id: expense2,
      user_id: userC,
      share_amount: 10,
      share_percentage: 33.3334,
    }),
  ];
  use(tables);
  const result = await core.expenseDetails.handler({ expense_id: expense2 }, ctx);
  equal(result.structuredContent.allocation_status, "balanced", "percentuais decimais somam 100");
  check(!result.structuredContent.warnings.includes("SPLIT_PERCENTAGE_INVALID"), "percentual decimal válido");
}

// Resumo: período civil, agregados exatos, parcelas individuais e isolamento.
{
  const db = use();
  const result = await core.memberSummary.handler({ group_id: groupA }, ctx);
  const data = result.structuredContent;
  equal(data.resource_type, "group_member_summary", "resource summary");
  equal(data.period.date_from, "2026-07-01", "default início mês SP");
  equal(data.period.date_to, "2026-07-31", "default fim mês SP");
  equal(data.period.days, 31, "31 dias inclusivos");
  equal(data.total_group_expenses, 37, "total despesas");
  equal(data.total_allocated, 37, "total rateado");
  equal(data.total_unallocated, 0, "nada sem rateio");
  equal(data.member_paid_total, 37, "pago membros");
  equal(data.member_allocated_total, 37, "alocado membros");
  equal(data.net_balance_sum, 0, "saldo soma zero");
  equal(data.expense_count, 3, "três despesas, parcela sem duplicar");
  equal(data.split_expense_count, 3, "três despesas com split");
  equal(data.incomplete_expense_count, 0, "nenhuma incompleta");
  equal(data.members.length, 3, "três membros");
  const a = data.members.find((row) => row.membership_id === memberA);
  const b = data.members.find((row) => row.membership_id === memberB);
  const c = data.members.find((row) => row.membership_id === memberC);
  equal([a.paid_amount, a.allocated_amount, a.net_balance], [10, 15.34, -5.34], "resumo A");
  equal([b.paid_amount, b.allocated_amount, b.net_balance], [20, 13.33, 6.67], "resumo B");
  equal([c.paid_amount, c.allocated_amount, c.net_balance], [7, 8.33, -1.33], "resumo C");
  equal([a.expense_count_paid, b.expense_count_paid, c.expense_count_paid], [1, 1, 1], "contagem pagador");
  equal([a.split_count, b.split_count, c.split_count], [3, 2, 2], "contagem splits");
  check(!result.content[0].text.includes("Mercado"), "content sem descrição individual");
  check(!result.content[0].text.includes("Internet"), "content sem outra descrição");
  check(result.content[0].text.includes("Nenhuma transação"), "content sem writes");
  check(!serialized(result).includes(userA), "summary sem user id");
  check(!serialized(result).includes("@"), "summary sem email");
  equal(db.writes, [], "summary sem escrita");
}
{
  use();
  const result = await core.memberSummary.handler(
    { group_id: groupA, date_from: "2026-07-11", date_to: "2026-07-12" },
    ctx,
  );
  equal(result.structuredContent.expense_count, 1, "intervalo explícito");
  equal(result.structuredContent.total_group_expenses, 20, "intervalo filtra");
}
for (const [input, code] of [
  [{ group_id: groupA, date_from: "2026-08-01", date_to: "2026-07-01" }, "INVALID_DATE_RANGE"],
  [{ group_id: groupA, date_from: "2025-01-01", date_to: "2026-07-01" }, "RESULT_SET_TOO_LARGE"],
  [{ group_id: groupA, date_from: "01/07/2026" }, "INVALID_INPUT"],
  [{ group_id: groupA, user_id: userA }, "INVALID_INPUT"],
  [{ group_id: groupA, membership_id: memberA }, "INVALID_INPUT"],
]) {
  use();
  errorCode(await core.memberSummary.handler(input, ctx), code, `summary ${code}`);
}
for (const target of [
  groupB,
  "59000000-0000-4000-8000-000000000009",
]) {
  use();
  errorCode(
    await core.memberSummary.handler({ group_id: target }, ctx),
    "RESOURCE_NOT_FOUND",
    "grupo alheio e inexistente iguais",
  );
}
{
  const tables = base();
  tables.expenses = tables.expenses.filter(
    (row) => row.shared_group_id !== groupA || !row.is_shared,
  );
  tables.expense_splits = [];
  use(tables);
  const result = await core.memberSummary.handler({ group_id: groupA }, ctx);
  equal(result.structuredContent.expense_count, 0, "grupo sem despesas");
  equal(result.structuredContent.total_group_expenses, 0, "total zero");
  check(result.structuredContent.warnings.includes("NO_SHARED_EXPENSES"), "warning vazio");
}
{
  const tables = base();
  tables.shared_groups[0].is_active = false;
  use(tables);
  const result = await core.memberSummary.handler({ group_id: groupA }, ctx);
  equal(result.structuredContent.group.is_active, false, "grupo inativo permitido");
  check(result.structuredContent.warnings.includes("GROUP_INACTIVE"), "warning inativo");
}
{
  const tables = base();
  tables.expense_splits = tables.expense_splits.filter(
    (row) => row.expense_id !== expense3,
  );
  use(tables);
  const result = await core.memberSummary.handler({ group_id: groupA }, ctx);
  equal(result.structuredContent.total_group_expenses, 37, "pago mantém despesa sem split");
  equal(result.structuredContent.total_allocated, 30, "alocado não inventado");
  equal(result.structuredContent.net_balance_sum, 7, "saldo não forçado a zero");
  equal(result.structuredContent.incomplete_expense_count, 1, "uma incompleta");
  equal(result.structuredContent.data_complete, false, "summary incompleto");
}
{
  const tables = base();
  tables.expenses.push(
    expense({
      id: "77000000-0000-4000-8000-000000000007",
      description: "Agosto",
      amount: 100,
      expense_date: "2026-08-01",
    }),
  );
  use(tables);
  const result = await core.memberSummary.handler({ group_id: groupA }, ctx);
  equal(result.structuredContent.expense_count, 3, "fora do mês excluído");
}

// Settlement determinístico, factual e sem efeitos.
{
  const db = use();
  const result = await core.settlement.handler({ group_id: groupA }, ctx);
  const data = result.structuredContent;
  equal(data.resource_type, "group_settlement", "resource settlement");
  equal(data.settlement_status, "transfers_suggested", "sugestões");
  equal(data.total_credit, 6.67, "crédito");
  equal(data.total_debit, 6.67, "débito");
  equal(data.total_to_transfer, 6.67, "total transferido");
  equal(data.residual_amount, 0, "residual zero");
  equal(data.transfer_count, 2, "duas transferências");
  equal(
    data.transfers.map((item) => [
      item.from_membership_id,
      item.to_membership_id,
      item.amount,
    ]),
    [
      [memberA, memberB, 5.34],
      [memberC, memberB, 1.33],
    ],
    "ordem determinística por maior saldo",
  );
  check(data.transfers.every((item) => item.amount > 0), "nenhuma zero/negativa");
  check(data.transfers.every((item) => item.from_membership_id !== item.to_membership_id), "nenhuma para si");
  check(result.content[0].text.includes("Sugestões matemáticas"), "content sugestão");
  check(result.content[0].text.includes("Nenhuma transferência foi realizada"), "content não executa");
  check(result.content[0].text.includes("nenhum pagamento foi confirmado"), "content não confirma");
  check(result.content[0].text.includes("nenhuma transação ou despesa foi criada"), "content não cria");
  equal(db.writes, [], "settlement sem escrita");
}
{
  const tables = base();
  tables.expenses = [expense({ amount: 10, paid_by: userA })];
  tables.expense_splits = [
    split({ user_id: userA, share_amount: 10 }),
  ];
  use(tables);
  const result = await core.settlement.handler({ group_id: groupA }, ctx);
  equal(result.structuredContent.settlement_status, "settled", "grupo equilibrado");
  equal(result.structuredContent.transfers, [], "sem transferências");
}
{
  const tables = base();
  tables.expenses = tables.expenses.filter(
    (row) => row.shared_group_id !== groupA || !row.is_shared,
  );
  tables.expense_splits = [];
  use(tables);
  const result = await core.settlement.handler({ group_id: groupA }, ctx);
  equal(result.structuredContent.settlement_status, "no_shared_expenses", "sem despesas");
  equal(result.structuredContent.transfers, [], "sem sugestão");
}
{
  const tables = base();
  tables.expense_splits = tables.expense_splits.filter(
    (row) => row.expense_id !== expense3,
  );
  use(tables);
  const result = await core.settlement.handler({ group_id: groupA }, ctx);
  equal(result.structuredContent.settlement_status, "unbalanced_source_data", "fonte desbalanceada");
  equal(result.structuredContent.transfers, [], "settlement bloqueado");
  equal(result.structuredContent.residual_amount, 7, "residual factual");
  check(result.structuredContent.warnings.includes("SETTLEMENT_NOT_BALANCED"), "warning settlement");
}
{
  const tables = base();
  tables.shared_group_members = tables.shared_group_members.filter(
    (row) => row.user_id !== userC,
  );
  use(tables);
  const result = await core.settlement.handler({ group_id: groupA }, ctx);
  equal(result.structuredContent.settlement_status, "incomplete_data", "histórico bloqueia");
  equal(result.structuredContent.transfers, [], "sem transferência com identidade ausente");
}

// Algoritmo puro: casos de 2, 3+, desempate e centavos.
for (const [balances, expected] of [
  [
    [
      { membership_id: memberA, display_name: "A", net_cents: -1000 },
      { membership_id: memberB, display_name: "B", net_cents: 1000 },
    ],
    [1000],
  ],
  [
    [
      { membership_id: memberA, display_name: "A", net_cents: -600 },
      { membership_id: memberB, display_name: "B", net_cents: -400 },
      { membership_id: memberC, display_name: "C", net_cents: 1000 },
    ],
    [600, 400],
  ],
  [
    [
      { membership_id: memberA, display_name: "A", net_cents: -1000 },
      { membership_id: memberB, display_name: "B", net_cents: 400 },
      { membership_id: memberC, display_name: "C", net_cents: 600 },
    ],
    [600, 400],
  ],
]) {
  const result = core.suggestSettlementTransfers(balances);
  equal(result.transfers.map((item) => item.amount_cents), expected, "caso settlement");
  equal(result.totalTransferCents, 1000, "total 1000 centavos");
  equal(result.residualCents, 0, "sem residual");
}
{
  const tie = core.suggestSettlementTransfers([
    { membership_id: memberC, display_name: "C", net_cents: -100 },
    { membership_id: memberA, display_name: "A", net_cents: -100 },
    { membership_id: memberB, display_name: "B", net_cents: 200 },
  ]);
  equal(tie.transfers[0].from_membership_id, memberA, "membership desempata");
}
{
  const multiple = core.suggestSettlementTransfers([
    { membership_id: "a", display_name: "A", net_cents: -700 },
    { membership_id: "b", display_name: "B", net_cents: -300 },
    { membership_id: "c", display_name: "C", net_cents: 600 },
    { membership_id: "d", display_name: "D", net_cents: 400 },
  ]);
  equal(multiple.totalTransferCents, 1000, "múltiplos devedores e credores");
  equal(multiple.residualCents, 0, "múltiplos sem residual");
  check(multiple.transfers.every((row) => row.amount_cents > 0), "múltiplos positivos");
}
equal(core.moneyToCents("10.00"), 1000, "10 reais em centavos");
equal(core.moneyToCents("0.01"), 1, "um centavo");
equal(core.moneyToCents("0.001"), null, "mais de duas casas rejeitado");
equal(core.centsToMoney(1), 0.01, "centavo reconstruído");
equal(core.centsToMoney(1000), 10, "sem ruído binário exposto");
{
  const many = [];
  for (let index = 0; index < 101; index += 1) {
    many.push({
      membership_id: `a${String(index).padStart(3, "0")}`,
      display_name: "D",
      net_cents: -1,
    });
    many.push({
      membership_id: `b${String(index).padStart(3, "0")}`,
      display_name: "C",
      net_cents: 1,
    });
  }
  check(
    core.suggestSettlementTransfers(many).transfers.length >
      core.GROUP_ANALYSIS_MAX_TRANSFERS,
    "helper detecta mais de 100 transferências para cap do handler",
  );
}

// Grupo inconsistente: identidade atual nunca é promovida ou inventada.
{
  const tables = base();
  tables.shared_group_members = tables.shared_group_members.filter(
    (row) => row.user_id !== userA,
  );
  use(tables);
  for (const tool of [core.memberSummary, core.settlement]) {
    errorCode(
      await tool.handler({ group_id: groupA }, ctx),
      "GROUP_DATA_INCOMPLETE",
      "membership atual ausente bloqueia analytics",
    );
  }
  errorCode(
    await core.expenseDetails.handler({ expense_id: expense1 }, ctx),
    "GROUP_DATA_INCOMPLETE",
    "details não inventa identidade atual",
  );
}
{
  const tables = base();
  tables.shared_group_members.find((row) => row.user_id === userA).role = "member";
  tables.shared_group_members.find((row) => row.user_id === userB).role = "owner";
  use(tables);
  const summary = await core.memberSummary.handler({ group_id: groupA }, ctx);
  equal(summary.structuredContent.group.current_user_role, "member", "sem promoção");
  equal(summary.structuredContent.data_complete, false, "role inconsistente incompleto");
  check(summary.structuredContent.warnings.includes("GROUP_ROLE_INCONSISTENCY"), "warning role");
  const settlement = await core.settlement.handler({ group_id: groupA }, ctx);
  equal(settlement.structuredContent.transfers, [], "role inconsistente bloqueia settlement");
}

// Caps e falhas seguras.
{
  const tables = base();
  tables.expenses = Array.from(
    { length: core.GROUP_ANALYSIS_MAX_EXPENSES + 1 },
    (_, index) =>
      expense({
        id: `90000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      }),
  );
  tables.expense_splits = [];
  use(tables);
  errorCode(
    await core.memberSummary.handler({ group_id: groupA }, ctx),
    "RESULT_SET_TOO_LARGE",
    "cap despesas",
  );
}
{
  const tables = base();
  tables.expense_splits = Array.from(
    { length: core.GROUP_ANALYSIS_MAX_SPLITS + 1 },
    (_, index) =>
      split({
        id: `91000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        expense_id: [expense1, expense2, expense3][index % 3],
      }),
  );
  use(tables);
  errorCode(
    await core.memberSummary.handler({ group_id: groupA }, ctx),
    "RESULT_SET_TOO_LARGE",
    "cap splits",
  );
}
{
  const tables = base();
  tables.shared_group_members = Array.from(
    { length: core.GROUP_ANALYSIS_MAX_MEMBERS + 1 },
    (_, index) =>
      membership({
        id: `92000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        user_id:
          index === 0
            ? userA
            : `93000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        role: index === 0 ? "owner" : "member",
      }),
  );
  use(tables);
  errorCode(
    await core.memberSummary.handler({ group_id: groupA }, ctx),
    "RESULT_SET_TOO_LARGE",
    "cap membros",
  );
}
{
  use(base(), { failTable: "expense_splits" });
  const result = await core.memberSummary.handler({ group_id: groupA }, ctx);
  errorCode(result, "READ_FAILED", "falha leitura segura");
  check(!serialized(result).includes("database"), "sem detalhe interno");
}

// Contratos, privacidade, ausência de mutações e artefatos oficiais.
for (const tool of [core.expenseDetails, core.memberSummary, core.settlement]) {
  equal(tool.annotations.readOnlyHint, true, `${tool.name} read-only`);
  equal(tool.annotations.destructiveHint, false, `${tool.name} não destrutiva`);
  equal(tool.annotations.idempotentHint, true, `${tool.name} idempotente`);
  equal(tool.annotations.openWorldHint, false, `${tool.name} mundo fechado`);
}
const sourceFiles = [
  "src/lib/mcp/shared/group-split-analysis.ts",
  "src/lib/mcp/tools/get-expense-split-details.ts",
  "src/lib/mcp/tools/get-group-member-summary.ts",
  "src/lib/mcp/tools/get-group-settlement.ts",
];
for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  check(source.includes("supabaseForUser") || file.includes("/tools/"), `${file} cliente autenticado`);
  check(!source.includes("service_role"), `${file} sem service role`);
  check(!source.includes('from "@/'), `${file} sem alias`);
  check(!source.includes(".insert("), `${file} sem insert`);
  check(!source.includes(".update("), `${file} sem update`);
  check(!source.includes(".delete("), `${file} sem delete`);
  check(!source.includes(".upsert("), `${file} sem upsert`);
}
const helperSource = await readFile(
  "src/lib/mcp/shared/group-split-analysis.ts",
  "utf8",
);
check(!helperSource.includes(".rpc("), "sem RPC SECURITY DEFINER");
check(!helperSource.includes("user_email"), "não seleciona snapshot de email");
check(helperSource.includes('expense.paid_by ?? expense.user_id'), "fallback de pagador comprovado");
check(helperSource.includes("moneyToCents"), "cálculo em centavos");

const manifest = JSON.parse(
  await readFile(".lovable/mcp/manifest.json", "utf8"),
);
const tools = manifest.mcp.tools;
equal(tools.length, 49, "manifest 49 tools");
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint === true).length,
  24,
  "24 read-only",
);
equal(
  tools.filter((tool) => tool.annotations?.readOnlyHint === false).length,
  25,
  "25 write",
);
for (const name of [
  "get_expense_split_details",
  "get_group_member_summary",
  "get_group_settlement",
]) {
  const tool = tools.find((candidate) => candidate.name === name);
  check(tool, `${name} registrada`);
  equal(tool.inputSchema.additionalProperties, false, `${name} input fechado`);
  equal(tool.outputSchema.additionalProperties, false, `${name} output fechado`);
  equal(tool.annotations.readOnlyHint, true, `${name} manifest read`);
  equal(tool.annotations.destructiveHint, false, `${name} manifest não destrutiva`);
  check(!("user_id" in tool.inputSchema.properties), `${name} sem user_id input`);
  check(!serialized(tool.outputSchema).includes("user_id"), `${name} sem user_id output`);
  check(!serialized(tool.outputSchema).includes("created_by"), `${name} sem created_by`);
  check(!serialized(tool.outputSchema).includes("email"), `${name} sem email`);
}

const bundleSource = await readFile(
  "supabase/functions/mcp/index.ts",
  "utf8",
);
check(bundleSource.includes("Deno.serve"), "bundle Deno.serve");
for (const name of [
  "get_expense_split_details",
  "get_group_member_summary",
  "get_group_settlement",
]) {
  check(bundleSource.includes(`name: "${name}"`), `bundle contém ${name}`);
}
check(!bundleSource.includes('from "@/'), "bundle sem alias");
check(!bundleSource.includes("npm:@/"), "bundle sem npm alias");
check(
  !/[A-Za-z]:[\\/](?:Users|home)[\\/]/u.test(bundleSource),
  "bundle sem caminho absoluto",
);
equal(
  execFileSync("git", ["diff", "--name-only", "--", "supabase/functions"], {
    encoding: "utf8",
  }).trim(),
  "supabase/functions/mcp/index.ts",
  "somente Edge Function MCP",
);
equal(
  execFileSync("git", ["status", "--porcelain", "--", "supabase/migrations"], {
    encoding: "utf8",
  }).trim(),
  "",
  "nenhuma migration",
);

console.log(`Phase MCP 1.2F-B: ${checks} checks passed.`);
