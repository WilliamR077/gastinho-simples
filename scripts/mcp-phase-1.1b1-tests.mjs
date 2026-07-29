import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";

const bundled = await build({
  stdin: {
    contents: `
      export * from "./src/lib/mcp/shared/dates.ts";
      export * from "./src/lib/mcp/shared/phase-1.1b-core.ts";
      export * from "./src/lib/mcp/shared/analytics.ts";
      export * from "./src/lib/mcp/shared/content.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.1b1-test-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});

const core = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);
const secret = "synthetic-only-test-secret-0123456789abcdef";
const now = new Date("2026-07-26T12:00:00.000Z");
const row = {
  id: "00000000-0000-4000-8000-000000000001",
  date: "2026-07-25",
  created_at: "2026-07-25T12:00:00.000Z",
  amount: 100,
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const baseFilters = {
  query_transaction_type: "expense",
  start_date: "2026-07-01",
  end_date: "2026-07-31",
  query: "Mercado",
  category_id: null,
  income_category_id: null,
  payment_method: null,
  card_id: null,
  group_id: null,
  min_amount: null,
  max_amount: null,
  scope: "personal",
  time_scope: "occurred",
  sort_by: "date",
  sort_order: "asc",
};

async function signedCursor(filters = baseFilters, overrides = {}) {
  const fingerprint = await core.filtersFingerprint("search_transactions", filters);
  const cursor = await core.encodeCursor(
    {
      context: "search_transactions",
      sort_by: "date",
      sort_order: "asc",
      sort_value: row.date,
      id: row.id,
      query_transaction_type: "expense",
      last_item_type: "expense",
      filters_fingerprint: fingerprint,
    },
    secret,
    now,
  );
  return { cursor, fingerprint, ...overrides };
}

async function decode(cursor, fingerprint, overrides = {}, at = now) {
  return core.decodeCursor(
    cursor,
    {
      context: "search_transactions",
      sort_by: "date",
      sort_order: "asc",
      query_transaction_type: "expense",
      filters_fingerprint: fingerprint,
      ...overrides,
    },
    secret,
    at,
  );
}

test("accepts a valid signed v3 cursor", async () => {
  const fingerprint = await core.filtersFingerprint("search_transactions", baseFilters);
  const cursor = await core.encodeCursor(
    {
      context: "search_transactions",
      sort_by: "date",
      sort_order: "asc",
      sort_value: row.date,
      id: row.id,
      query_transaction_type: "expense",
      last_item_type: "expense",
      filters_fingerprint: fingerprint,
    },
    secret,
    now,
  );
  assert.equal((await decode(cursor, fingerprint)).version, 3);
});

test("fails closed when the cursor secret is absent or too short", () => {
  const previous = process.env.MCP_CURSOR_SECRET;
  delete process.env.MCP_CURSOR_SECRET;
  assert.equal(core.getCursorSecret(), null);
  process.env.MCP_CURSOR_SECRET = "short";
  assert.equal(core.getCursorSecret(), null);
  process.env.MCP_CURSOR_SECRET = secret;
  assert.equal(core.getCursorSecret(), secret);
  if (previous === undefined) delete process.env.MCP_CURSOR_SECRET;
  else process.env.MCP_CURSOR_SECRET = previous;
});

test("rejects changed signature and payload", async () => {
  const { cursor, fingerprint } = await signedCursor();
  const [payload, signature] = cursor.split(".");
  const changedSignature = `${payload}.${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;
  assert.equal(await decode(changedSignature, fingerprint), null);
  const payloadObject = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  payloadObject.id = "00000000-0000-4000-8000-000000000099";
  const changedPayload = `${Buffer.from(JSON.stringify(payloadObject)).toString("base64url")}.${signature}`;
  assert.equal(await decode(changedPayload, fingerprint), null);
});

test("rejects changes to every relevant filter dimension", async () => {
  const { cursor, fingerprint } = await signedCursor();
  for (const change of [
    { scope: "shared" },
    { time_scope: "future" },
    { query_transaction_type: "income" },
    { start_date: "2026-07-02" },
    { end_date: "2026-07-30" },
    { query: "Outro texto" },
    { category_id: "00000000-0000-4000-8000-000000000010" },
    { payment_method: "pix" },
    { card_id: "00000000-0000-4000-8000-000000000011" },
    { group_id: "00000000-0000-4000-8000-000000000012" },
    { min_amount: 1 },
    { max_amount: 200 },
  ]) {
    const changedFingerprint = await core.filtersFingerprint("search_transactions", {
      ...baseFilters,
      ...change,
    });
    assert.notEqual(changedFingerprint, fingerprint);
    assert.equal(await decode(cursor, changedFingerprint), null);
  }
});

test("rejects changed sort, other tool, expired cursor and v1 cursor", async () => {
  const fingerprint = await core.filtersFingerprint("search_transactions", baseFilters);
  const cursor = await core.encodeCursor(
    {
      context: "search_transactions",
      sort_by: "date",
      sort_order: "asc",
      sort_value: row.date,
      id: row.id,
      query_transaction_type: "expense",
      last_item_type: "expense",
      filters_fingerprint: fingerprint,
    },
    secret,
    now,
  );
  assert.equal(
    await decode(cursor, fingerprint, { sort_order: "desc" }),
    null,
  );
  assert.equal(
    await decode(cursor, fingerprint, { context: "list_expenses" }),
    null,
  );
  assert.equal(
    await decode(cursor, fingerprint, {}, new Date("2026-07-27T12:00:01.000Z")),
    null,
  );
  const v1 = Buffer.from(
    JSON.stringify({ version: 1, context: "search_transactions" }),
  ).toString("base64url");
  assert.equal(await decode(v1, fingerprint), null);
});

test("orders complete unified ties without losing equal UUIDs", () => {
  for (const sortOrder of ["asc", "desc"]) {
    for (const sortBy of ["date", "created_at", "amount"]) {
      const rows = [
        { ...row, transaction_type: "income" },
        { ...row, transaction_type: "expense" },
      ].sort((left, right) =>
        core.compareUnifiedTransactions(left, right, sortBy, sortOrder),
      );
      assert.deepEqual(
        rows.map((item) => item.transaction_type),
        ["expense", "income"],
      );
      const secondPage = rows.filter(
        (item) =>
          core.compareUnifiedTransactions(item, rows[0], sortBy, sortOrder) > 0,
      );
      assert.deepEqual(
        secondPage.map((item) => item.transaction_type),
        ["income"],
      );
      assert.equal(
        core.unifiedCursorEqualValueMode("expense", "income"),
        "include_all_equal",
      );
      assert.equal(
        core.unifiedCursorEqualValueMode("income", "expense"),
        "exclude_all_equal",
      );
    }
  }
});

test("uses Sao Paulo across UTC month and year boundaries", () => {
  const instant = new Date("2026-08-01T01:00:00.000Z");
  assert.equal(core.todayIso(instant), "2026-07-31");
  assert.deepEqual(core.currentMonthRange(instant), {
    from: "2026-07-01",
    to: "2026-07-31",
  });
  const yearTurn = new Date("2027-01-01T01:00:00.000Z");
  assert.equal(core.todayIso(yearTurn), "2026-12-31");
  assert.deepEqual(core.currentMonthRange(yearTurn), {
    from: "2026-12-01",
    to: "2026-12-31",
  });
});

test("validates open and closed date ranges", () => {
  assert.deepEqual(core.validateOpenDateRange("2027-01-01", undefined), { ok: true });
  assert.deepEqual(core.validateOpenDateRange(undefined, "2020-01-01"), { ok: true });
  assert.equal(core.validateOpenDateRange("2026-02-02", "2026-02-01").code, "INVALID_DATE_RANGE");
  assert.equal(core.validateBoundedDateRange("2025-07-27", "2026-07-27").days, 366);
  assert.equal(
    core.validateBoundedDateRange("2025-07-26", "2026-07-27").code,
    "DATE_RANGE_TOO_LARGE",
  );
});

test("reports requested and effective temporal coverage", () => {
  const partial = core.effectiveDateRange(
    "2026-07-01",
    "2026-07-31",
    "occurred",
    "2026-07-10",
  );
  assert.deepEqual(partial.effective_period, {
    start_date: "2026-07-01",
    end_date: "2026-07-10",
    days: 10,
  });
  assert.ok(partial.coverage_warning);
  assert.deepEqual(core.previousPeriod("2026-07-01", "2026-07-10"), {
    start: "2026-06-21",
    end: "2026-06-30",
  });
  assert.equal(
    core.effectiveDateRange("2026-08-01", "2026-08-31", "occurred", "2026-07-10")
      .effective_period,
    null,
  );
  assert.equal(
    core.effectiveDateRange("2026-06-01", "2026-06-30", "future", "2026-07-10")
      .effective_period,
    null,
  );
});

test("rejects expense-only filters for all and income", () => {
  assert.equal(core.hasInvalidExpenseOnlyFilters("all", "card-id", undefined), true);
  assert.equal(core.hasInvalidExpenseOnlyFilters("all", undefined, "pix"), true);
  assert.equal(core.hasInvalidExpenseOnlyFilters("income", "card-id", undefined), true);
  assert.equal(core.hasInvalidExpenseOnlyFilters("income", undefined, "pix"), true);
  assert.equal(core.hasInvalidExpenseOnlyFilters("expense", "card-id", "pix"), false);
});

function expense(id, category) {
  return {
    ...row,
    id,
    description: category,
    category_id: id,
    category_name: category,
    category_icon: null,
    expense_date: row.date,
    payment_method: "pix",
    card_id: null,
    card_name: null,
    installment_number: null,
    total_installments: null,
    shared_group_id: null,
    is_shared: false,
    is_owner: true,
  };
}

test("separates data completeness from group truncation", () => {
  const expenses = [
    expense("00000000-0000-4000-8000-000000000001", "A"),
    expense("00000000-0000-4000-8000-000000000002", "B"),
    expense("00000000-0000-4000-8000-000000000003", "C"),
  ];
  const below = core.spendingBreakdown(expenses.slice(0, 1), "category", 2);
  const exact = core.spendingBreakdown(expenses.slice(0, 2), "category", 2);
  const above = core.spendingBreakdown(expenses, "category", 2);
  assert.equal(below.groups_truncated, false);
  assert.equal(exact.groups_truncated, false);
  assert.equal(above.groups_truncated, true);
  assert.equal(above.total_group_count, 3);
  assert.equal(above.returned_group_count, 2);
  assert.equal(above.total, 300);
});

test("keeps textual content compact and exposes pagination", () => {
  const items = Array.from({ length: 100 }, (_, index) => ({
    transaction_type: index % 2 ? "income" : "expense",
    date: "2026-07-25",
    description: "x".repeat(2_000),
    amount: index,
  }));
  const text = core.transactionContent(
    items,
    "personal",
    "occurred",
    "all",
    true,
    "signed-cursor",
  );
  assert.ok(text.length < 3_000);
  assert.match(text, /next_cursor=signed-cursor/u);
  assert.doesNotMatch(text, /x{100}/u);
});

test("manifest exposes the corrected output schemas", async () => {
  const manifest = JSON.parse(
    await readFile(".lovable/mcp/manifest.json", "utf8"),
  );
  assert.equal(manifest.mcp.tools.length, 42);
  const byName = Object.fromEntries(manifest.mcp.tools.map((tool) => [tool.name, tool]));
  for (const name of [
    "search_transactions",
    "get_spending_breakdown",
    "compare_periods",
  ]) {
    assert.equal(byName[name].annotations.readOnlyHint, true);
    assert.equal(byName[name].outputSchema.additionalProperties, false);
  }
  assert.ok(byName.search_transactions.outputSchema.properties.cursor_version);
  assert.ok(byName.search_transactions.outputSchema.properties.has_more);
  assert.ok(byName.get_spending_breakdown.outputSchema.properties.requested_period);
  assert.ok(byName.get_spending_breakdown.outputSchema.properties.effective_period);
  assert.ok(byName.get_spending_breakdown.outputSchema.properties.groups_truncated);
  assert.ok(byName.compare_periods.outputSchema.properties.coverage_warning);
});

let passed = 0;
for (const current of tests) {
  await current.fn();
  passed += 1;
  console.log(`ok ${passed} - ${current.name}`);
}
console.log(`1..${passed}`);
