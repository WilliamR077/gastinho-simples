import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({
  stdin: {
    contents: `
      export * from "./src/lib/mcp/shared/phase-1.1b-core.ts";
      export * from "./src/lib/mcp/shared/transaction-query.ts";
      export * from "./src/lib/mcp/shared/content.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.1b4-test-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
});

const mcp = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`,
);
const secret = "synthetic-1.1b4-secret-0123456789abcdef";
const userId = "synthetic-user";
const context = "search_transactions";

const ids = Array.from(
  { length: 10 },
  (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);

function expense(id, description, date, amount) {
  return {
    id,
    user_id: userId,
    description,
    amount,
    expense_date: date,
    created_at: `${date}T12:00:00.000Z`,
    category_id: null,
    category_name: "Teste",
    category_icon: null,
    payment_method: "pix",
    card_id: null,
    card_name: null,
    installment_number: null,
    total_installments: null,
    shared_group_id: null,
  };
}

function income(id, description, date, amount) {
  return {
    id,
    user_id: userId,
    description,
    amount,
    income_date: date,
    created_at: `${date}T12:00:00.000Z`,
    income_category_id: null,
    category_name: "Teste",
    category_icon: null,
    installment_number: null,
    total_installments: null,
    shared_group_id: null,
  };
}

const expenses = [
  expense(ids[9], "Cross", "2026-07-25", 350),
  expense(ids[8], "Quebra-cabeça Londres", "2026-07-23", 50),
  expense(ids[7], "Hambúrguer - 99", "2026-07-23", 50),
  expense(ids[5], "Aluguel", "2026-07-21", 900),
  expense(ids[4], "UUID compartilhado expense", "2026-07-20", 50),
  expense(ids[2], "Café", "2026-07-19", 50),
];
const incomes = [
  income(ids[6], "Salário", "2026-07-22", 2_000),
  income(ids[4], "UUID compartilhado income", "2026-07-20", 50),
  income(ids[3], "Presente", "2026-07-19", 50),
  income(ids[1], "Bônus", "2026-07-18", 900),
];

function compareValue(left, operator, right) {
  const normalizedRight = typeof left === "number" ? Number(right) : right;
  if (operator === "eq") return left === normalizedRight;
  if (operator === "gt") return left > normalizedRight;
  return left < normalizedRight;
}

function evaluateClause(row, clause) {
  const match = /^([a-z_]+)\.(eq|gt|lt)\.(.+)$/u.exec(clause);
  assert.ok(match, `unsupported mock clause: ${clause}`);
  return compareValue(row[match[1]], match[2], match[3]);
}

function evaluateOr(row, expression) {
  const keyset = /^([^,]+),and\(([^,]+),([^)]+)\)$/u.exec(expression);
  if (keyset) {
    return evaluateClause(row, keyset[1]) ||
      (evaluateClause(row, keyset[2]) && evaluateClause(row, keyset[3]));
  }
  return expression.split(",").some((clause) => evaluateClause(row, clause));
}

class MockQuery {
  constructor(rows) {
    this.rows = rows;
    this.filters = [];
    this.orders = [];
    this.rowLimit = Infinity;
  }

  select() { return this; }
  eq(column, value) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  not(column, operator, value) {
    assert.equal(operator, "is");
    assert.equal(value, null);
    this.filters.push((row) => row[column] !== null);
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
  gt(column, value) {
    this.filters.push((row) => row[column] > value);
    return this;
  }
  lt(column, value) {
    this.filters.push((row) => row[column] < value);
    return this;
  }
  or(expression) {
    assert.doesNotMatch(expression, /ilike/u, "text search is outside this cursor test");
    this.filters.push((row) => evaluateOr(row, expression));
    return this;
  }
  order(column, { ascending }) {
    this.orders.push({ column, ascending });
    return this;
  }
  limit(value) {
    this.rowLimit = value;
    return this;
  }
  then(resolve, reject) {
    const result = this.rows
      .filter((row) => this.filters.every((filter) => filter(row)))
      .sort((left, right) => {
        for (const { column, ascending } of this.orders) {
          if (left[column] === right[column]) continue;
          const comparison = left[column] < right[column] ? -1 : 1;
          return ascending ? comparison : -comparison;
        }
        return 0;
      })
      .slice(0, this.rowLimit);
    return Promise.resolve({ data: result, error: null }).then(resolve, reject);
  }
}

const supabase = {
  from(table) {
    assert.ok(table === "expenses" || table === "incomes");
    return new MockQuery(table === "expenses" ? expenses : incomes);
  },
};

function filters(sortBy, sortOrder) {
  return {
    scope: "personal",
    time_scope: "occurred",
    sort_by: sortBy,
    sort_order: sortOrder,
  };
}

async function fingerprint(queryType, sortBy, sortOrder, extra = {}) {
  return mcp.filtersFingerprint(context, {
    query_transaction_type: queryType,
    scope: "personal",
    time_scope: "occurred",
    sort_by: sortBy,
    sort_order: sortOrder,
    ...extra,
  });
}

async function unifiedPage({
  queryType = "all",
  sortBy = "date",
  sortOrder = "desc",
  limit = 3,
  cursor: encodedCursor,
  fingerprintExtra = {},
} = {}) {
  const filtersFingerprint = await fingerprint(
    queryType,
    sortBy,
    sortOrder,
    fingerprintExtra,
  );
  const cursor = encodedCursor
    ? await mcp.decodeCursor(
        encodedCursor,
        {
          context,
          sort_by: sortBy,
          sort_order: sortOrder,
          query_transaction_type: queryType,
          filters_fingerprint: filtersFingerprint,
        },
        secret,
      )
    : null;
  if (encodedCursor && !cursor) return { invalid: true };

  const common = filters(sortBy, sortOrder);
  const [expensePage, incomePage] = await Promise.all([
    queryType === "income"
      ? { items: [], next_cursor: null, error: false }
      : mcp.queryExpensesPage(
          supabase,
          userId,
          common,
          limit + 1,
          cursor,
          context,
          filtersFingerprint,
          secret,
          queryType,
        ),
    queryType === "expense"
      ? { items: [], next_cursor: null, error: false }
      : mcp.queryIncomesPage(
          supabase,
          userId,
          common,
          limit + 1,
          cursor,
          context,
          filtersFingerprint,
          secret,
          queryType,
        ),
  ]);
  assert.equal(expensePage.error || incomePage.error, false);

  const combined = [
    ...expensePage.items.map((item) => ({ ...item, transaction_type: "expense" })),
    ...incomePage.items.map((item) => ({ ...item, transaction_type: "income" })),
  ].sort((left, right) =>
    mcp.compareUnifiedTransactions(left, right, sortBy, sortOrder),
  );
  const hasMore =
    combined.length > limit ||
    expensePage.next_cursor !== null ||
    incomePage.next_cursor !== null;
  const items = combined.slice(0, limit);
  const nextCursor = hasMore && items.length > 0
    ? await mcp.cursorForRow(
        items.at(-1),
        context,
        sortBy,
        sortOrder,
        filtersFingerprint,
        secret,
        queryType,
        items.at(-1).transaction_type,
      )
    : null;
  return { invalid: false, items, hasMore, nextCursor, filtersFingerprint };
}

function expectedItems(queryType, sortBy, sortOrder) {
  const selected = [
    ...(queryType === "income"
      ? []
      : expenses.map((row) => ({
          ...mcp.expenseItem(row, userId),
          transaction_type: "expense",
        }))),
    ...(queryType === "expense"
      ? []
      : incomes.map((row) => ({
          ...mcp.incomeItem(row, userId),
          transaction_type: "income",
        }))),
  ];
  return selected.sort((left, right) =>
    mcp.compareUnifiedTransactions(left, right, sortBy, sortOrder),
  );
}

async function collectPages(options) {
  const items = [];
  const pages = [];
  let cursor;
  for (let guard = 0; guard < 30; guard += 1) {
    const page = await unifiedPage({ ...options, cursor });
    assert.equal(page.invalid, false);
    pages.push(page);
    items.push(...page.items);
    if (!page.nextCursor) return { items, pages };
    cursor = page.nextCursor;
  }
  assert.fail("pagination did not terminate");
}

async function decode(cursor, queryType, sortBy, sortOrder, filtersFingerprint) {
  return mcp.decodeCursor(
    cursor,
    {
      context,
      sort_by: sortBy,
      sort_order: sortOrder,
      query_transaction_type: queryType,
      filters_fingerprint: filtersFingerprint,
    },
    secret,
  );
}

async function signRaw(payload) {
  const bytes = new TextEncoder().encode(mcp.canonicalJson(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes));
  return `${Buffer.from(bytes).toString("base64url")}.${Buffer.from(signature).toString("base64url")}`;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("continues the real all/desc/limit=3 case after an expense", async () => {
  const first = await unifiedPage();
  assert.deepEqual(
    first.items.map((item) => item.description),
    ["Cross", "Quebra-cabeça Londres", "Hambúrguer - 99"],
  );
  const decoded = await decode(
    first.nextCursor,
    "all",
    "date",
    "desc",
    first.filtersFingerprint,
  );
  assert.equal(decoded.query_transaction_type, "all");
  assert.equal(decoded.last_item_type, "expense");
  const second = await unifiedPage({ cursor: first.nextCursor });
  assert.equal(second.invalid, false);
  assert.deepEqual(
    second.items.filter((item) => first.items.some((prior) =>
      prior.id === item.id && prior.transaction_type === item.transaction_type)),
    [],
  );
});

test("continues an all query after an income", async () => {
  const first = await unifiedPage({ limit: 4 });
  assert.equal(first.items.at(-1).transaction_type, "income");
  const decoded = await decode(
    first.nextCursor,
    "all",
    "date",
    "desc",
    first.filtersFingerprint,
  );
  assert.equal(decoded.query_transaction_type, "all");
  assert.equal(decoded.last_item_type, "income");
  assert.equal((await unifiedPage({ limit: 4, cursor: first.nextCursor })).invalid, false);
});

test("paginates expense-only and income-only queries", async () => {
  for (const queryType of ["expense", "income"]) {
    const result = await collectPages({ queryType, limit: 1 });
    assert.deepEqual(
      result.items.map((item) => `${item.transaction_type}:${item.id}`),
      expectedItems(queryType, "date", "desc")
        .map((item) => `${item.transaction_type}:${item.id}`),
    );
    assert.ok(result.pages.length >= 3);
  }
});

test("loses and repeats nothing for limit 1/3, date/amount and asc/desc", async () => {
  for (const limit of [1, 3]) {
    for (const sortBy of ["date", "amount"]) {
      for (const sortOrder of ["asc", "desc"]) {
        const result = await collectPages({ limit, sortBy, sortOrder });
        const actual = result.items.map((item) => `${item.transaction_type}:${item.id}`);
        const expected = expectedItems("all", sortBy, sortOrder)
          .map((item) => `${item.transaction_type}:${item.id}`);
        assert.deepEqual(actual, expected, `${limit}/${sortBy}/${sortOrder}`);
        assert.equal(new Set(actual).size, actual.length);
        if (limit === 3) assert.ok(result.pages.length >= 3);
      }
    }
  }
});

test("keeps type then UUID as the total-order tie breakers", () => {
  for (const sortBy of ["date", "amount"]) {
    for (const sortOrder of ["asc", "desc"]) {
      const tied = expectedItems("all", sortBy, sortOrder).filter(
        (item) => item.id === ids[4],
      );
      assert.deepEqual(
        tied.map((item) => item.transaction_type),
        ["expense", "income"],
      );
    }
  }
});

test("rejects changed filters and incompatible query_transaction_type", async () => {
  const first = await unifiedPage();
  assert.equal(
    (await unifiedPage({ cursor: first.nextCursor, fingerprintExtra: { group_id: ids[0] } }))
      .invalid,
    true,
  );
  assert.equal(
    await decode(
      first.nextCursor,
      "expense",
      "date",
      "desc",
      await fingerprint("expense", "date", "desc"),
    ),
    null,
  );
});

test("rejects altered signature, payload and last_item_type", async () => {
  const first = await unifiedPage();
  const [payload, signature] = first.nextCursor.split(".");
  const alteredSignature =
    `${payload}.${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
  assert.equal(
    await decode(alteredSignature, "all", "date", "desc", first.filtersFingerprint),
    null,
  );

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  parsed.last_item_type = "income";
  const alteredPayload =
    `${Buffer.from(JSON.stringify(parsed)).toString("base64url")}.${signature}`;
  assert.equal(
    await decode(alteredPayload, "all", "date", "desc", first.filtersFingerprint),
    null,
  );
});

test("rejects old signed v2 and unsigned v1 cursors", async () => {
  const filtersFingerprint = await fingerprint("all", "date", "desc");
  const now = Math.floor(Date.now() / 1_000);
  const v2 = await signRaw({
    version: 2,
    context,
    sort_by: "date",
    sort_order: "desc",
    sort_value: "2026-07-23",
    id: ids[7],
    transaction_type: "expense",
    filters_fingerprint: filtersFingerprint,
    issued_at: now,
    expires_at: now + 3_600,
  });
  assert.equal(await decode(v2, "all", "date", "desc", filtersFingerprint), null);
  const v1 = Buffer.from(JSON.stringify({ version: 1, context })).toString("base64url");
  assert.equal(await decode(v1, "all", "date", "desc", filtersFingerprint), null);
});

test("search content identifies the query filter and cursor contract", () => {
  const text = mcp.transactionContent(
    [{ transaction_type: "expense", date: "2026-07-25", description: "Cross", amount: 350 }],
    "personal",
    "occurred",
    "all",
    true,
    "signed-next-cursor",
    3,
    3,
    { transaction_type: "all", sort_by: "date", sort_order: "desc" },
  );
  assert.match(text, /query_transaction_type=all/u);
  assert.match(text, /cursor_version=3/u);
  assert.match(text, /next_cursor=signed-next-cursor/u);
  assert.match(text, /has_more=true/u);
});

let passed = 0;
for (const current of tests) {
  await current.fn();
  passed += 1;
  console.log(`ok ${passed} - ${current.name}`);
}
console.log(`1..${passed}`);
