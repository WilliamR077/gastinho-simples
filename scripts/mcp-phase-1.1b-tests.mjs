import assert from "node:assert/strict";
import { build } from "esbuild";

const result = await build({
  stdin: {
    contents: `
      export * from "./src/lib/mcp/shared/phase-1.1b-core.ts";
      export * from "./src/lib/mcp/shared/analytics.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.1b-test-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});

const source = result.outputFiles[0].text;
const core = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const cursorSecret = "synthetic-test-secret-with-at-least-32-characters";

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test("validates ISO dates and inverted/oversized ranges", () => {
  assert.deepEqual(core.validateBoundedDateRange("2026-01-01", "2026-12-31"), {
    ok: true,
    days: 365,
  });
  assert.equal(
    core.validateBoundedDateRange("2026-02-31", "2026-03-01").code,
    "INVALID_DATE",
  );
  assert.equal(
    core.validateBoundedDateRange("2026-03-02", "2026-03-01").code,
    "INVALID_DATE_RANGE",
  );
  assert.equal(
    core.validateBoundedDateRange("2025-01-01", "2026-01-02").code,
    "DATE_RANGE_TOO_LARGE",
  );
});

test("applies personal/shared/all_accessible semantics", () => {
  const ownPersonal = { id: "1", user_id: "u1", shared_group_id: null };
  const ownShared = { id: "2", user_id: "u1", shared_group_id: "g1" };
  const otherShared = { id: "3", user_id: "u2", shared_group_id: "g1" };
  assert.equal(core.matchesScope(ownPersonal, "u1", "personal"), true);
  assert.equal(core.matchesScope(ownShared, "u1", "personal"), true);
  assert.equal(core.matchesScope(otherShared, "u1", "personal"), false);
  assert.equal(core.matchesScope(ownPersonal, "u1", "shared"), false);
  assert.equal(core.matchesScope(ownShared, "u1", "shared"), true);
  assert.equal(core.matchesScope(otherShared, "u1", "shared"), true);
  assert.equal(core.matchesScope(otherShared, "u1", "all_accessible"), true);
});

test("separates occurred, future and all financial dates", () => {
  assert.equal(
    core.todayIso(new Date("2026-07-26T01:00:00.000Z")),
    "2026-07-25",
  );
  assert.equal(core.matchesTimeScope("2026-07-25", "occurred", "2026-07-25"), true);
  assert.equal(core.matchesTimeScope("2026-07-26", "occurred", "2026-07-25"), false);
  assert.equal(core.matchesTimeScope("2026-07-26", "future", "2026-07-25"), true);
  assert.equal(core.matchesTimeScope("2027-02-01", "all", "2026-07-25"), true);
});

test("validates amount ranges", () => {
  assert.equal(core.validateAmountRange(10, 20), true);
  assert.equal(core.validateAmountRange(20, 10), false);
});

test("calculates savings and zero-safe percentages", () => {
  assert.equal(core.savingsRate(1000, 250), 75);
  assert.equal(core.savingsRate(0, 250), null);
  assert.equal(core.percentageChange(0, 10), null);
  assert.equal(core.percentageChange(100, 125), 25);
});

test("creates signed cursors and rejects incompatible cursors", async () => {
  const row = {
    id: "00000000-0000-4000-8000-000000000002",
    date: "2026-07-25",
    created_at: "2026-07-25T12:00:00.000Z",
    amount: 10,
  };
  const fingerprint = await core.filtersFingerprint("test", { scope: "personal" });
  const cursor = await core.cursorForRow(
    row,
    "test",
    "date",
    "desc",
    fingerprint,
    cursorSecret,
    "expense",
    "expense",
  );
  assert.equal(
    (
      await core.decodeCursor(
        cursor,
        {
          context: "test",
          sort_by: "date",
          sort_order: "desc",
          query_transaction_type: "expense",
          filters_fingerprint: fingerprint,
        },
        cursorSecret,
      )
    ).id,
    row.id,
  );
  assert.equal(
    await core.decodeCursor(
      cursor,
      {
        context: "test",
        sort_by: "amount",
        sort_order: "desc",
        query_transaction_type: "expense",
        filters_fingerprint: fingerprint,
      },
      cursorSecret,
    ),
    null,
  );
  assert.equal(
    await core.decodeCursor(
      "invalid",
      {
        context: "test",
        sort_by: "date",
        sort_order: "desc",
        query_transaction_type: "expense",
        filters_fingerprint: fingerprint,
      },
      cursorSecret,
    ),
    null,
  );
});

test("orders equal-date rows by id for stable pagination", () => {
  const rows = [
    {
      id: "00000000-0000-4000-8000-000000000002",
      date: "2026-07-25",
      created_at: "2026-07-25T12:00:00.000Z",
      amount: 10,
    },
    {
      id: "00000000-0000-4000-8000-000000000001",
      date: "2026-07-25",
      created_at: "2026-07-25T12:00:00.000Z",
      amount: 20,
    },
  ];
  rows.sort((a, b) => core.compareTransactions(a, b, "date", "asc"));
  assert.equal(rows[0].id.endsWith("0001"), true);
  rows.sort((a, b) => core.compareTransactions(a, b, "date", "desc"));
  assert.equal(rows[0].id.endsWith("0002"), true);
});

test("deduplicates all_accessible rows by transaction id", () => {
  const rows = core.deduplicateById([
    { id: "1", source: "personal" },
    { id: "2", source: "shared" },
    { id: "2", source: "shared" },
  ]);
  assert.deepEqual(rows.map((row) => row.id), ["1", "2"]);
});

test("uses an immediately preceding period of equal duration", () => {
  assert.deepEqual(core.previousPeriod("2026-07-01", "2026-07-31"), {
    start: "2026-05-31",
    end: "2026-06-30",
  });
});

let passed = 0;
for (const current of tests) {
  await current.fn();
  passed += 1;
  console.log(`ok ${passed} - ${current.name}`);
}
console.log(`1..${passed}`);
