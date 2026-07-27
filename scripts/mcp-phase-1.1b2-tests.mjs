import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({
  stdin: {
    contents: `
      export * from "./src/lib/mcp/shared/content.ts";
      export * from "./src/lib/mcp/shared/errors.ts";
      export * from "./src/lib/mcp/shared/phase-1.1b-core.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.1b2-test-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});

const core = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`,
);
const secret = "synthetic-1.1b2-secret-0123456789abcdef";
const now = new Date("2026-07-26T12:00:00.000Z");
const lowercaseUuid = "abcdefab-cdef-4abc-8def-abcdefabcdef";
const uppercaseUuid = lowercaseUuid.toUpperCase();
const differentUuid = "abcdefab-cdef-4abc-8def-abcdefabcdee";

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function contentDetails(groupsTruncated) {
  return {
    requestedPeriod: { start_date: "2026-07-01", end_date: "2026-07-31" },
    effectivePeriod: {
      start_date: "2026-07-01",
      end_date: "2026-07-26",
      days: 26,
    },
    total: 100,
    transactionCount: 2,
    groupBy: "category",
    scope: "personal",
    timeScope: "occurred",
    dataComplete: true,
    returnedGroupCount: groupsTruncated ? 1 : 2,
    totalGroupCount: 2,
    groupsTruncated,
    coverageWarning: null,
  };
}

test("explains truncated visible percentages without claiming incomplete data", () => {
  const text = core.breakdownContent(
    [{
      key: "mercado",
      label: "Mercado",
      total: 80,
      percentage: 80,
      transaction_count: 1,
      average: 80,
      largest_transaction: {
        id: lowercaseUuid,
        description: "Compra",
        amount: 80,
        date: "2026-07-10",
      },
    }],
    contentDetails(true),
  );
  assert.match(text, /lista de grupos foi limitada/iu);
  assert.match(text, /percentuais dos grupos exibidos podem somar menos de 100%/iu);
  assert.match(text, /totais gerais consideram todos os grupos/iu);
  assert.doesNotMatch(text, /data_complete=false/iu);
  assert.ok(text.length < 1_000);
});

test("omits the truncation warning when every group is returned", () => {
  const text = core.breakdownContent(
    [
      {
        key: "mercado",
        label: "Mercado",
        total: 80,
        percentage: 80,
        transaction_count: 1,
        average: 80,
        largest_transaction: {
          id: lowercaseUuid,
          description: "Compra",
          amount: 80,
          date: "2026-07-10",
        },
      },
      {
        key: "casa",
        label: "Casa",
        total: 20,
        percentage: 20,
        transaction_count: 1,
        average: 20,
        largest_transaction: {
          id: differentUuid,
          description: "Conta",
          amount: 20,
          date: "2026-07-11",
        },
      },
    ],
    contentDetails(false),
  );
  assert.doesNotMatch(text, /lista de grupos foi limitada/iu);
  assert.doesNotMatch(text, /menos de 100%/iu);
});

test("rejects a cursor exactly at and after expires_at", async () => {
  const fingerprint = await core.filtersFingerprint("search_transactions", {});
  const cursor = await core.encodeCursor(
    {
      context: "search_transactions",
      sort_by: "date",
      sort_order: "asc",
      sort_value: "2026-07-25",
      id: lowercaseUuid,
      transaction_type: "expense",
      filters_fingerprint: fingerprint,
    },
    secret,
    now,
  );
  const expected = {
    context: "search_transactions",
    sort_by: "date",
    sort_order: "asc",
    transaction_type: "expense",
    filters_fingerprint: fingerprint,
  };
  assert.ok(
    await core.decodeCursor(
      cursor,
      expected,
      secret,
      new Date(now.getTime() + core.CURSOR_TTL_SECONDS * 1_000 - 1_000),
    ),
  );
  assert.equal(
    await core.decodeCursor(
      cursor,
      expected,
      secret,
      new Date(now.getTime() + core.CURSOR_TTL_SECONDS * 1_000),
    ),
    null,
  );
  assert.equal(
    await core.decodeCursor(
      cursor,
      expected,
      secret,
      new Date(now.getTime() + core.CURSOR_TTL_SECONDS * 1_000 + 1_000),
    ),
    null,
  );
  const publicError = core.mcpError("INVALID_CURSOR");
  assert.equal(publicError.structuredContent.error.code, "INVALID_CURSOR");
  assert.doesNotMatch(publicError.content[0].text, /expir/iu);
});

test("normalizes every UUID filter field without changing non-UUID strings", async () => {
  for (const field of [
    "category_id",
    "income_category_id",
    "card_id",
    "group_id",
  ]) {
    const lower = await core.filtersFingerprint("search_transactions", {
      [field]: lowercaseUuid,
      query: "Mercado Central",
    });
    const upper = await core.filtersFingerprint("search_transactions", {
      [field]: uppercaseUuid,
      query: "Mercado Central",
    });
    const different = await core.filtersFingerprint("search_transactions", {
      [field]: differentUuid,
      query: "Mercado Central",
    });
    assert.equal(lower, upper, field);
    assert.notEqual(lower, different, field);
  }
  assert.equal(core.normalizeUuidFilter(uppercaseUuid), lowercaseUuid);
  assert.equal(core.normalizeUuidFilter("Não é UUID"), "Não é UUID");
});

test("accepts a cursor when only UUID filter casing changes", async () => {
  const lowerFingerprint = await core.filtersFingerprint("search_transactions", {
    category_id: lowercaseUuid,
  });
  const upperFingerprint = await core.filtersFingerprint("search_transactions", {
    category_id: uppercaseUuid,
  });
  const cursor = await core.encodeCursor(
    {
      context: "search_transactions",
      sort_by: "date",
      sort_order: "asc",
      sort_value: "2026-07-25",
      id: uppercaseUuid,
      transaction_type: "expense",
      filters_fingerprint: lowerFingerprint,
    },
    secret,
    now,
  );
  const decoded = await core.decodeCursor(
    cursor,
    {
      context: "search_transactions",
      sort_by: "date",
      sort_order: "asc",
      transaction_type: "expense",
      filters_fingerprint: upperFingerprint,
    },
    secret,
    now,
  );
  assert.equal(decoded?.id, lowercaseUuid);

  const changedFingerprint = await core.filtersFingerprint("search_transactions", {
    category_id: differentUuid,
  });
  assert.equal(
    await core.decodeCursor(
      cursor,
      {
        context: "search_transactions",
        sort_by: "date",
        sort_order: "asc",
        transaction_type: "expense",
        filters_fingerprint: changedFingerprint,
      },
      secret,
      now,
    ),
    null,
  );
});

test("preserves the established normalized query semantics", async () => {
  const spaced = await core.filtersFingerprint("search_transactions", {
    query: "  MERCADO   Central ",
  });
  const normalized = await core.filtersFingerprint("search_transactions", {
    query: "mercado central",
  });
  const different = await core.filtersFingerprint("search_transactions", {
    query: "mercado bairro",
  });
  assert.equal(spaced, normalized);
  assert.notEqual(spaced, different);
});

let passed = 0;
for (const current of tests) {
  await current.fn();
  passed += 1;
  console.log(`ok ${passed} - ${current.name}`);
}
console.log(`1..${passed}`);
