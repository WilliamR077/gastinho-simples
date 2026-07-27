import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv from "ajv";
import { build } from "esbuild";

const bundled = await build({
  stdin: {
    contents: `export * from "./src/lib/mcp/shared/content.ts";`,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.1b3-test-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});
const contentHelpers = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`,
);

const ids = Array.from(
  { length: 12 },
  (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const groups = ids.map((id, index) => ({
  key: `key-${index + 1}`,
  label: `Grupo ${index + 1}`,
  total: 120 - index,
  percentage: 12 - index / 10,
  transaction_count: index + 1,
  average: 10,
  largest_transaction: {
    id,
    description: `Maior transação ${index + 1}`,
    amount: 120 - index,
    date: "2026-07-20",
  },
}));
const metricsA = {
  income: 1_000,
  expenses: 600,
  balance: 400,
  savings_rate: 40,
  expense_count: 6,
  income_count: 2,
};
const metricsB = {
  income: 1_200,
  expenses: 700,
  balance: 500,
  savings_rate: 41.67,
  expense_count: 7,
  income_count: 2,
};
const absoluteChanges = {
  income: 200,
  expenses: 100,
  balance: 100,
  savings_rate: 1.67,
  expense_count: 1,
  income_count: 0,
};
const percentageChanges = {
  income: 20,
  expenses: 16.67,
  balance: 25,
  savings_rate: 4.18,
  expense_count: 16.67,
  income_count: 0,
};
const breakdownChanges = groups.map((group, index) => ({
  key: group.key,
  label: group.label,
  period_a_total: 100 - index,
  period_b_total: 120 - index,
  absolute_change: 20,
  percentage_change: 20,
}));

const breakdownResult = {
  period: { start_date: "2026-07-01", end_date: "2026-07-31" },
  requested_period: { start_date: "2026-07-01", end_date: "2026-07-31" },
  effective_period: {
    start_date: "2026-07-01",
    end_date: "2026-07-26",
    days: 26,
  },
  coverage_warning: "Período efetivo limitado por time_scope=occurred.",
  total: 833.44,
  transaction_count: 16,
  groups,
  group_by: "category",
  scope: "personal",
  time_scope: "occurred",
  complete: true,
  data_complete: true,
  total_group_count: 12,
  returned_group_count: 12,
  groups_truncated: false,
};

const transactionItems = ids.map((id, index) => ({
  id,
  transaction_type: index % 2 === 0 ? "expense" : "income",
  description: `Transação ${index + 1}`,
  amount: index + 1,
  date: "2026-07-20",
  created_at: "2026-07-20T12:00:00.000Z",
  category_id: null,
  category_name: null,
  category_icon: null,
  payment_method: index % 2 === 0 ? "pix" : null,
  card_id: null,
  card_name: null,
  installment_number: null,
  total_installments: null,
  shared_group_id: null,
  is_shared: false,
  is_owner: true,
}));
const appliedFilters = {
  query: "mercado",
  transaction_type: "all",
  start_date: "2026-07-01",
  end_date: "2026-07-31",
  category_id: null,
  payment_method: null,
  card_id: null,
  group_id: null,
  min_amount: null,
  max_amount: null,
  sort_by: "date",
  sort_order: "desc",
};
const searchResult = {
  items: transactionItems,
  count: transactionItems.length,
  limit: 20,
  has_more: true,
  cursor_version: 2,
  next_cursor: "synthetic-signed-next-cursor",
  applied_filters: appliedFilters,
  scope: "personal",
  time_scope: "occurred",
};

const periodA = {
  start_date: "2026-06-01",
  end_date: "2026-06-30",
  days: 30,
  requested_days: 30,
  effective_days: 30,
  requested_period: { start_date: "2026-06-01", end_date: "2026-06-30" },
  effective_period: {
    start_date: "2026-06-01",
    end_date: "2026-06-30",
    days: 30,
  },
  coverage_warning: null,
  metrics: metricsA,
};
const periodB = {
  start_date: "2026-07-01",
  end_date: "2026-07-31",
  days: 26,
  requested_days: 31,
  effective_days: 26,
  requested_period: { start_date: "2026-07-01", end_date: "2026-07-31" },
  effective_period: {
    start_date: "2026-07-01",
    end_date: "2026-07-26",
    days: 26,
  },
  coverage_warning: "Período B limitado até hoje.",
  metrics: metricsB,
};
const compareResult = {
  period_a: periodA,
  period_b: periodB,
  absolute_changes: absoluteChanges,
  percentage_changes: percentageChanges,
  breakdown_changes: breakdownChanges,
  scope: "personal",
  time_scope: "occurred",
  coverage_warning: ["Período B limitado até hoje."],
  data_sufficiency_warnings: ["As coberturas efetivas têm durações diferentes."],
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const forbiddenPublicData = /(?:user_id|access_token|refresh_token|MCP_CURSOR_SECRET|service_role)/u;

test("breakdown content is self-contained and limited to ten complete groups", () => {
  const text = contentHelpers.breakdownContent(groups, {
    requestedPeriod: breakdownResult.requested_period,
    effectivePeriod: breakdownResult.effective_period,
    total: breakdownResult.total,
    transactionCount: breakdownResult.transaction_count,
    groupBy: breakdownResult.group_by,
    scope: breakdownResult.scope,
    timeScope: breakdownResult.time_scope,
    dataComplete: breakdownResult.data_complete,
    returnedGroupCount: breakdownResult.returned_group_count,
    totalGroupCount: breakdownResult.total_group_count,
    groupsTruncated: breakdownResult.groups_truncated,
    coverageWarning: breakdownResult.coverage_warning,
  });
  for (const field of [
    "key=",
    "label=",
    "total=",
    "percentage=",
    "transaction_count=",
    "average=",
    "largest_transaction=",
    "requested_period=",
    "effective_period=",
    "coverage_warning=",
    "data_complete=",
    "total_group_count=",
    "returned_group_count=",
    "groups_truncated=",
  ]) {
    assert.match(text, new RegExp(field, "u"));
  }
  assert.match(text, /label=Grupo 10/u);
  assert.doesNotMatch(text, /label=Grupo 11/u);
  assert.match(text, /Grupos omitidos do content=2/u);
  assert.doesNotMatch(text, forbiddenPublicData);
  assert.ok(text.length < 6_000);
});

test("search content carries all pagination data and at most ten summaries", () => {
  const text = contentHelpers.transactionContent(
    transactionItems,
    searchResult.scope,
    searchResult.time_scope,
    searchResult.applied_filters.transaction_type,
    searchResult.has_more,
    searchResult.next_cursor,
    searchResult.limit,
    searchResult.cursor_version,
    searchResult.applied_filters,
  );
  for (const expected of [
    "Quantidade retornada=12",
    "has_more=true",
    "cursor_version=2",
    "next_cursor=synthetic-signed-next-cursor",
    "scope=personal",
    "time_scope=occurred",
    "applied_filters=",
    "Transação 10",
  ]) {
    assert.match(text, new RegExp(expected, "u"));
  }
  assert.doesNotMatch(text, /Transação 11/u);
  assert.doesNotMatch(text, forbiddenPublicData);
  assert.ok(text.length < 6_000);
});

test("comparison content carries periods, metrics, changes and warnings", () => {
  const text = contentHelpers.comparisonContent({
    periodA,
    periodB,
    absoluteChanges,
    percentageChanges,
    breakdownChanges,
    scope: compareResult.scope,
    timeScope: compareResult.time_scope,
    coverageWarnings: compareResult.coverage_warning,
    dataSufficiencyWarnings: compareResult.data_sufficiency_warnings,
  });
  for (const expected of [
    "Período A: requested_period=",
    "Período B: requested_period=",
    "effective_period=",
    "effective_days=",
    "coverage_warning=",
    "income=",
    "expenses=",
    "balance=",
    "savings_rate=",
    "expense_count=",
    "income_count=",
    "absolute_changes=",
    "percentage_changes=",
    "data_sufficiency_warnings=",
    "label=Grupo 10",
  ]) {
    assert.match(text, new RegExp(expected, "u"));
  }
  assert.doesNotMatch(text, /label=Grupo 11/u);
  assert.match(text, /Grupos de breakdown omitidos do content=2/u);
  assert.doesNotMatch(text, forbiddenPublicData);
  assert.ok(text.length < 8_000);
});

test("synthetic structured content validates against every explicit output schema", async () => {
  const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
  assert.equal(manifest.mcp.tools.length, 10);
  const tools = Object.fromEntries(manifest.mcp.tools.map((tool) => [tool.name, tool]));
  const cases = [
    ["search_transactions", searchResult],
    ["get_spending_breakdown", breakdownResult],
    ["compare_periods", compareResult],
  ];
  const ajv = new Ajv({ strict: false, validateFormats: false });
  for (const [name, value] of cases) {
    assert.equal(tools[name].annotations.readOnlyHint, true);
    assert.ok(tools[name].outputSchema);
    const validate = ajv.compile(tools[name].outputSchema);
    assert.equal(validate(value), true, `${name}: ${JSON.stringify(validate.errors)}`);
  }
});

let passed = 0;
for (const current of tests) {
  await current.fn();
  passed += 1;
  console.log(`ok ${passed} - ${current.name}`);
}
console.log(`1..${passed}`);
