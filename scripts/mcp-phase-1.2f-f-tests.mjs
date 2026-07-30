import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mock } from "node:test";
import { build } from "esbuild";

mock.timers.enable({
  apis: ["Date"],
  now: new Date("2026-07-30T12:00:00-03:00"),
});

const supabasePlugin = {
  name: "phase-1.2f-f-supabase",
  setup(builder) {
    builder.onResolve({ filter: /supabase-client$/ }, () => ({
      path: "supabase-client",
      namespace: "test",
    }));
    builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({
      contents:
        "export function supabaseForUser(){return globalThis.__MCP_NOTIFICATION_SETTINGS_SUPABASE__}",
      loader: "js",
    }));
  },
};

const bundled = await build({
  stdin: {
    contents: `
      export { default as getTool } from "./src/lib/mcp/tools/get-notification-settings.ts";
      export { default as updateTool } from "./src/lib/mcp/tools/update-notification-settings.ts";
      export * from "./src/lib/mcp/shared/notification-settings-read.ts";
      export * from "./src/lib/mcp/shared/notification-settings-write.ts";
      export * from "./src/lib/mcp/runtime/strict-empty-input.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2f-f-entry.ts",
    loader: "ts",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [supabasePlugin],
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

const userId = "10000000-0000-4000-8000-000000000001";
const otherUserId = "20000000-0000-4000-8000-000000000002";
const createdAt = "2026-06-18T12:00:00.000Z";
const version1 = "2026-07-01T12:00:00.000Z";
const version2 = "2026-07-30T15:00:00.000Z";
const defaults = {
  is_enabled: true,
  notify_3_days_before: true,
  notify_1_day_before: true,
  notify_on_day: true,
};
const setting = (overrides = {}) => ({
  id: "30000000-0000-4000-8000-000000000003",
  user_id: userId,
  ...defaults,
  notify_expense_goals: true,
  notify_income_goals: true,
  notify_balance_goals: true,
  created_at: createdAt,
  updated_at: version1,
  accessible: true,
  ...overrides,
});

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.columns = null;
    this.maximum = Infinity;
    this.operation = "select";
    this.payload = null;
  }
  select(columns) {
    this.columns = columns.split(",").map((column) => column.trim());
    this.db.calls.push({ table: this.table, method: "select", columns });
    return this;
  }
  eq(column, value) {
    this.filters.push({ column, value });
    this.db.calls.push({ table: this.table, method: "eq", column, value });
    return this;
  }
  limit(value) {
    this.maximum = value;
    this.db.calls.push({ table: this.table, method: "limit", value });
    return this;
  }
  insert(payload) {
    this.operation = "insert";
    this.payload = structuredClone(payload);
    this.db.calls.push({ table: this.table, method: "insert", payload: this.payload });
    return this;
  }
  update(payload) {
    this.operation = "update";
    this.payload = structuredClone(payload);
    this.db.calls.push({ table: this.table, method: "update", payload: this.payload });
    return this;
  }
  matching() {
    return this.db.rows
      .filter((row) => row.accessible !== false)
      .filter((row) =>
        this.filters.every((filter) => row[filter.column] === filter.value),
      );
  }
  project(rows) {
    if (!this.columns) return rows;
    return rows.map((row) =>
      Object.fromEntries(
        this.columns
          .filter((column) => column in row)
          .map((column) => [column, row[column]]),
      ),
    );
  }
  execute() {
    if (this.table !== "notification_settings") {
      return { data: null, error: { message: "unexpected table" } };
    }
    if (this.operation === "select") {
      this.db.reads += 1;
      this.db.onRead?.(this.db);
      if (this.db.failRead) return { data: null, error: { message: "private SQL" } };
      return {
        data: structuredClone(
          this.project(this.matching().slice(0, this.maximum)),
        ),
        error: null,
      };
    }
    if (this.operation === "insert") {
      this.db.writes.push({ method: "insert", table: this.table, payload: this.payload });
      this.db.onInsert?.(this.db);
      if (
        this.db.failWrite ||
        this.db.rows.some((row) => row.user_id === this.payload.user_id)
      ) {
        return { data: null, error: { message: "private unique constraint" } };
      }
      const inserted = setting({
        ...this.payload,
        id: "40000000-0000-4000-8000-000000000004",
        created_at: createdAt,
        updated_at: version2,
      });
      this.db.rows.push(inserted);
      return { data: this.project([inserted])[0], error: null };
    }
    this.db.writes.push({ method: "update", table: this.table, payload: this.payload });
    this.db.onUpdate?.(this.db);
    if (this.db.failWrite) return { data: null, error: { message: "private policy" } };
    const rows = this.matching();
    if (rows.length !== 1) return { data: null, error: null };
    Object.assign(rows[0], this.payload, { updated_at: version2 });
    return { data: this.project(rows)[0], error: null };
  }
  async maybeSingle() {
    const result = this.execute();
    return {
      data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data,
      error: result.error,
    };
  }
  then(resolve, reject) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }
}

class DB {
  constructor(rows = [], options = {}) {
    this.rows = structuredClone(rows);
    this.calls = [];
    this.writes = [];
    this.reads = 0;
    Object.assign(this, options);
  }
  from(table) {
    this.calls.push({ table, method: "from" });
    return new Query(this, table);
  }
  rpc() {
    throw new Error("RPC não deve ser usada");
  }
}

const ctx = {
  isAuthenticated: () => true,
  getUserId: () => userId,
  getToken: () => "synthetic",
};
const use = (rows = [], options = {}) => {
  const db = new DB(rows, options);
  globalThis.__MCP_NOTIFICATION_SETTINGS_SUPABASE__ = db;
  return db;
};

// Contratos fonte.
equal(core.getTool.name, "get_notification_settings", "get registrada");
equal(core.updateTool.name, "update_notification_settings", "update registrada");
equal(core.getTool.annotations, {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}, "annotations get");
equal(core.updateTool.annotations, {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
}, "annotations update");
equal(core.getTool.inputSchema, {}, "get sem parâmetros artificiais");

for (const field of core.NOTIFICATION_SETTING_FIELDS) {
  equal(core.PRODUCT_NOTIFICATION_DEFAULTS[field], true, `${field} default real`);
  check(field in core.notificationSettingsChangeProperties, `${field} editável`);
}
for (const forbidden of [
  "user_id",
  "token",
  "fcm_token",
  "device_id",
  "email",
  "phone",
  "permission_status",
  "delivery_status",
  "notify_expense_goals",
  "notify_income_goals",
  "notify_balance_goals",
  "send_test_notification",
  "force",
]) {
  check(!(forbidden in core.notificationSettingsChangeProperties), `${forbidden} proibido`);
}

for (const [input, valid, label] of [
  [{ is_enabled: false }, true, "toggle global"],
  [{ notify_3_days_before: false }, true, "três dias"],
  [{ notify_1_day_before: false }, true, "um dia"],
  [{ notify_on_day: false }, true, "no dia"],
  [{ is_enabled: false, notify_on_day: false }, true, "patch combinado"],
  [{}, false, "changes vazio"],
  [{ is_enabled: null }, false, "null"],
  [{ is_enabled: "false" }, false, "tipo inválido"],
  [{ notify_expense_goals: false }, false, "legado fora do contrato"],
  [{ token: "secret" }, false, "token"],
]) {
  equal(
    core.notificationSettingsChangesSchema.safeParse(input).success,
    valid,
    label,
  );
}

// Guard do pipeline publicado.
const mcpRequest = (args) =>
  new Request("https://example.test/functions/v1/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "get_notification_settings", arguments: args },
    }),
  });
{
  const db = use([setting()]);
  let forwarded = 0;
  const pipeline = core.withStrictEmptyInputGuard(async (request) => {
    forwarded += 1;
    const payload = await request.json();
    const result = await core.getTool.handler({}, ctx);
    return Response.json({ jsonrpc: "2.0", id: payload.id, result });
  });
  const valid = await (await pipeline(mcpRequest({}))).json();
  equal(forwarded, 1, "objeto vazio chega ao SDK");
  equal(db.reads, 1, "objeto vazio consulta");
  equal(valid.result.structuredContent.settings_exist, true, "contrato válido");
  for (const [args, label] of [
    [{ campo_fake: "teste" }, "extra"],
    [{ user_id: userId }, "user_id"],
    [{ include_tokens: true }, "tokens"],
    [{ include_devices: true }, "devices"],
  ]) {
    const reads = db.reads;
    const writes = db.writes.length;
    const body = await (await pipeline(mcpRequest(args))).json();
    equal(body.error.code, -32602, `${label}: JSON-RPC invalid params`);
    check(body.error.message.includes("INVALID_INPUT"), `${label}: erro tipado`);
    equal(db.reads, reads, `${label}: nenhuma consulta`);
    equal(db.writes.length, writes, `${label}: nenhuma escrita`);
    check(!("result" in body), `${label}: nenhum dado retornado`);
    check(!JSON.stringify(body).includes(userId), `${label}: sem UUID`);
  }
  equal(forwarded, 1, "inválidos bloqueados antes do SDK");
}

// Leitura existente, ausente e inconsistente.
{
  const db = use([setting({ notify_1_day_before: false })]);
  const result = await core.getTool.handler({}, ctx);
  equal(result.structuredContent.settings_exist, true, "linha existente");
  equal(result.structuredContent.settings.notify_1_day_before, false, "persistido factual");
  equal(result.structuredContent.effective_settings, result.structuredContent.settings, "efetivo persistido");
  equal(result.structuredContent.uses_product_defaults, false, "sem defaults");
  equal(result.structuredContent.created_at, createdAt, "created_at");
  equal(result.structuredContent.updated_at, version1, "updated_at");
  equal(result.structuredContent.can_update, true, "editável");
  equal(result.structuredContent.data_complete, true, "dados completos");
  check(result.structuredContent.warnings.includes("DEVICE_PERMISSION_NOT_VERIFIED"), "permissão não presumida");
  equal(db.writes, [], "get sem escrita");
  check(result.content[0].text.includes("Nenhuma alteração ou notificação"), "content autossuficiente");
}
{
  const db = use([]);
  const result = await core.getTool.handler({}, ctx);
  equal(result.structuredContent.settings_exist, false, "linha ausente");
  equal(result.structuredContent.settings, null, "nada persistido");
  equal(result.structuredContent.effective_settings, defaults, "defaults efetivos");
  equal(result.structuredContent.uses_product_defaults, true, "origem defaults");
  equal(result.structuredContent.created_at, null, "sem created_at");
  equal(result.structuredContent.updated_at, null, "sem updated_at");
  check(result.structuredContent.warnings.includes("NOTIFICATION_SETTINGS_NOT_CONFIGURED"), "warning ausente");
  check(result.structuredContent.warnings.includes("PRODUCT_DEFAULTS_APPLIED"), "warning defaults");
  equal(db.writes, [], "ausência não cria");
}
{
  use([setting(), setting({ id: "50000000-0000-4000-8000-000000000005" })]);
  const result = await core.getTool.handler({}, ctx);
  equal(result.structuredContent.data_complete, false, "duplicidade incompleta");
  equal(result.structuredContent.settings, null, "não escolhe linha");
  check(result.structuredContent.warnings.includes("NOTIFICATION_SETTINGS_DATA_INCOMPLETE"), "warning duplicidade");
}
{
  use([setting({ is_enabled: "invalid" })]);
  const result = await core.getTool.handler({}, ctx);
  equal(result.structuredContent.data_complete, false, "valor inválido incompleto");
  equal(result.structuredContent.effective_settings, null, "não inventa efetivo");
  check(result.structuredContent.warnings.includes("NOTIFICATION_SETTINGS_INVALID"), "warning inválido");
}
{
  use([setting({ updated_at: null })]);
  const result = await core.getTool.handler({}, ctx);
  equal(result.structuredContent.data_complete, false, "versão ausente incompleta");
  check(result.structuredContent.warnings.includes("NOTIFICATION_SETTINGS_VERSION_MISSING"), "warning versão");
}

// Criação parcial, defaults e corridas.
{
  const db = use([]);
  const result = await core.updateTool.handler(
    { changes: { is_enabled: false } },
    ctx,
  );
  equal(result.structuredContent.applied, true, "create aplicada");
  equal(result.structuredContent.created, true, "created true");
  equal(result.structuredContent.no_op, false, "create não no-op");
  equal(result.structuredContent.before.settings_exist, false, "before ausente");
  equal(result.structuredContent.after.settings_exist, true, "after existente");
  equal(result.structuredContent.after.settings, { ...defaults, is_enabled: false }, "defaults completam patch");
  equal(result.structuredContent.changed_fields, ["is_enabled"], "campo alterado");
  check(result.structuredContent.warnings.includes("PRODUCT_DEFAULTS_APPLIED"), "defaults documentados");
  equal(db.writes.length, 1, "um insert");
  equal(db.writes[0].method, "insert", "INSERT explícito");
  equal(db.writes[0].table, "notification_settings", "tabela correta");
  equal(db.writes[0].payload.user_id, userId, "identificador interno");
  check(!("notify_expense_goals" in db.writes[0].payload), "legado usa default do banco");
}
{
  const db = use([]);
  const result = await core.updateTool.handler(
    { changes: { is_enabled: true }, expected_updated_at: null },
    ctx,
  );
  equal(result.structuredContent.created, true, "pedido igual a default persiste");
  equal(result.structuredContent.changed_fields, [], "nenhum valor efetivo mudou");
  equal(db.writes.length, 1, "persistência explícita cria");
}
{
  const db = use([]);
  const result = await core.updateTool.handler(
    { changes: { is_enabled: false }, expected_updated_at: version1 },
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "versão em linha ausente");
  equal(db.writes, [], "versão fictícia não cria");
}
{
  const db = use([], {
    onRead(currentDb) {
      if (currentDb.reads === 2) currentDb.rows.push(setting());
    },
  });
  const result = await core.updateTool.handler(
    { changes: { is_enabled: false } },
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "corrida antes do insert");
  equal(db.writes, [], "corrida não sobrescreve");
}
{
  const db = use([], {
    onInsert(currentDb) {
      currentDb.rows.push(setting());
    },
  });
  const result = await core.updateTool.handler(
    { changes: { is_enabled: false } },
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "conflito único seguro");
  equal(db.rows[0].is_enabled, true, "linha concorrente preservada");
}

// Update, concorrência e no-op.
{
  const db = use([setting()]);
  const result = await core.updateTool.handler(
    { changes: { notify_on_day: false } },
    ctx,
  );
  errorCode(result, "EXPECTED_VERSION_REQUIRED", "versão obrigatória");
  equal(db.writes, [], "sem versão sem escrita");
}
{
  const db = use([setting()]);
  const result = await core.updateTool.handler(
    { changes: { notify_on_day: false }, expected_updated_at: "2026-06-01T00:00:00.000Z" },
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "timestamp antigo");
  equal(db.writes, [], "conflito sem escrita");
}
{
  const db = use([setting()]);
  const result = await core.updateTool.handler(
    {
      changes: { is_enabled: false, notify_on_day: false },
      expected_updated_at: version1,
    },
    ctx,
  );
  equal(result.structuredContent.applied, true, "update aplicada");
  equal(result.structuredContent.created, false, "update não cria");
  equal(result.structuredContent.changed_fields, ["is_enabled", "notify_on_day"], "patch combinado");
  equal(db.writes.length, 1, "um update");
  equal(db.writes[0].payload, { is_enabled: false, notify_on_day: false }, "somente mudanças");
  check(db.calls.some((call) => call.method === "eq" && call.column === "user_id" && call.value === userId), "filtro usuário");
  check(db.calls.some((call) => call.method === "eq" && call.column === "updated_at" && call.value === version1), "filtro versão");
  equal(db.rows[0].notify_3_days_before, true, "omitido preservado");
  equal(db.rows[0].notify_expense_goals, true, "legado preservado");
}
{
  const db = use([setting({ is_enabled: false })]);
  const result = await core.updateTool.handler(
    { changes: { is_enabled: false }, expected_updated_at: version1 },
    ctx,
  );
  equal(result.structuredContent.applied, false, "no-op não aplicado");
  equal(result.structuredContent.created, false, "no-op não cria");
  equal(result.structuredContent.no_op, true, "no-op true");
  equal(result.structuredContent.before, result.structuredContent.after, "before after iguais");
  equal(result.structuredContent.after.updated_at, version1, "timestamp preservado");
  check(result.structuredContent.warnings.includes("NO_CHANGES_APPLIED"), "warning no-op");
  equal(db.writes, [], "no-op sem update");
}
{
  const db = use([setting(), setting({ id: "60000000-0000-4000-8000-000000000006" })]);
  const result = await core.updateTool.handler(
    { changes: { is_enabled: false }, expected_updated_at: version1 },
    ctx,
  );
  errorCode(result, "NOTIFICATION_SETTINGS_DATA_INCOMPLETE", "duplicidade bloqueia");
  equal(db.writes, [], "duplicidade sem update");
}
{
  const db = use([setting({ updated_at: null })]);
  const result = await core.updateTool.handler(
    { changes: { is_enabled: false }, expected_updated_at: version1 },
    ctx,
  );
  errorCode(result, "NOTIFICATION_SETTINGS_VERSION_MISSING", "sem versão bloqueia");
  equal(db.writes, [], "sem versão sem update");
}
{
  const db = use([setting({ notify_on_day: "invalid" })]);
  const result = await core.updateTool.handler(
    { changes: { is_enabled: false }, expected_updated_at: version1 },
    ctx,
  );
  errorCode(result, "NOTIFICATION_SETTINGS_DATA_INCOMPLETE", "persistido inválido bloqueia");
  equal(db.writes, [], "inválido sem update");
}
{
  const db = use([setting()], {
    onUpdate(currentDb) {
      currentDb.rows[0].updated_at = version2;
    },
  });
  const result = await core.updateTool.handler(
    { changes: { is_enabled: false }, expected_updated_at: version1 },
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "corrida final");
  equal(db.rows[0].is_enabled, true, "corrida preserva valor");
}
{
  use([setting()], { failRead: true });
  const result = await core.getTool.handler({}, ctx);
  errorCode(result, "READ_FAILED", "erro de leitura sanitizado");
  check(!JSON.stringify(result).includes("private SQL"), "sem SQL");
}
{
  use([setting()], { failWrite: true });
  const result = await core.updateTool.handler(
    { changes: { is_enabled: false }, expected_updated_at: version1 },
    ctx,
  );
  errorCode(result, "WRITE_FAILED", "erro de escrita sanitizado");
  check(!JSON.stringify(result).includes("private policy"), "sem policy");
}

// Manifest, isolamento e artefato.
const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const tools = manifest.mcp.tools;
equal(tools.length, 53, "manifest 53 tools");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === true).length, 26, "26 read-only");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === false).length, 27, "27 write");
equal(new Set(tools.map((tool) => tool.name)).size, 53, "sem duplicidade");
const getDeclared = tools.find((tool) => tool.name === "get_notification_settings");
const updateDeclared = tools.find((tool) => tool.name === "update_notification_settings");
check(getDeclared, "get no manifest");
check(updateDeclared, "update no manifest");
equal(getDeclared.inputSchema.properties, {}, "get schema vazio");
equal(getDeclared.inputSchema.additionalProperties, false, "get fechado no manifest");
equal(getDeclared.outputSchema.additionalProperties, false, "get output fechado");
equal(updateDeclared.inputSchema.additionalProperties, false, "update input fechado");
equal(updateDeclared.inputSchema.properties.changes.additionalProperties, false, "changes fechado");
equal(updateDeclared.outputSchema.additionalProperties, false, "update output fechado");
for (const field of core.NOTIFICATION_SETTING_FIELDS) {
  check(field in updateDeclared.inputSchema.properties.changes.properties, `${field} no manifest`);
}
const serializedContracts = JSON.stringify([getDeclared, updateDeclared]);
for (const forbidden of [
  "user_id",
  "fcm_token",
  "device_id",
  "email",
  "phone",
  "permission_status",
  "delivery_status",
  "notify_expense_goals",
  "notify_income_goals",
  "notify_balance_goals",
]) {
  check(!serializedContracts.includes(forbidden), `${forbidden} fora do contrato público`);
}

const readSource = await readFile("src/lib/mcp/shared/notification-settings-read.ts", "utf8");
const writeSource = await readFile("src/lib/mcp/shared/notification-settings-write.ts", "utf8");
const source = `${readSource}\n${writeSource}`;
check(source.includes("supabaseForUser"), "cliente do usuário");
check(source.includes('from("notification_settings")'), "tabela permitida");
check(!source.includes('from("user_fcm_tokens")'), "sem FCM");
check(!source.includes("auth.users"), "sem auth users");
check(!source.includes("service_role"), "sem service role");
check(!source.includes(".upsert("), "sem upsert");
check(!source.includes(".delete("), "sem delete");
check(!source.includes(".rpc("), "sem RPC");
check(!source.includes("functions.invoke"), "sem envio");
check(!readSource.includes(".insert("), "get sem insert");
check(!readSource.includes(".update("), "get sem update");

const bundleSource = await readFile("supabase/functions/mcp/index.ts", "utf8");
check(bundleSource.includes('name: "get_notification_settings"'), "bundle get");
check(bundleSource.includes('name: "update_notification_settings"'), "bundle update");
check(bundleSource.includes("get_notification_settings"), "bundle guard registra get");
check(bundleSource.includes("withStrictEmptyInputGuard"), "bundle usa guard");
check(bundleSource.includes("Deno.serve"), "bundle serve");
check(!bundleSource.includes("npm:@/"), "sem alias");
check(!/[A-Z]:\\\\Users\\\\/u.test(bundleSource), "sem caminho absoluto");

check(checks >= 128, `cobertura mínima; obtidas ${checks}`);
console.log(`MCP Fase 1.2F-F: ${checks} verificações aprovadas.`);
