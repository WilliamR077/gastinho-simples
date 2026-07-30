import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mock } from "node:test";
import { build } from "esbuild";

mock.timers.enable({
  apis: ["Date"],
  now: new Date("2026-07-30T12:00:00-03:00"),
});

const plugin = {
  name: "phase-1.2f-e-supabase",
  setup(builder) {
    builder.onResolve({ filter: /supabase-client$/ }, () => ({
      path: "supabase-client",
      namespace: "test",
    }));
    builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({
      contents:
        "export function supabaseForUser(){return globalThis.__MCP_PROFILE_SUPABASE__}",
      loader: "js",
    }));
  },
};

const bundled = await build({
  stdin: {
    contents: `
      export { default as getTool } from "./src/lib/mcp/tools/get-profile.ts";
      export { default as updateTool } from "./src/lib/mcp/tools/update-profile.ts";
      export * from "./src/lib/mcp/shared/profile-read.ts";
      export * from "./src/lib/mcp/shared/profile-write.ts";
      export * from "./src/lib/mcp/runtime/strict-empty-input.ts";
    `,
    resolveDir: process.cwd(),
    sourcefile: "phase-1.2f-e-entry.ts",
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

const userId = "10000000-0000-4000-8000-000000000001";
const otherUserId = "20000000-0000-4000-8000-000000000002";
const createdAt = "2026-06-18T12:00:00.000Z";
const version1 = "2026-07-01T12:00:00.000Z";
const version2 = "2026-07-30T15:00:00.000Z";
const profile = (overrides = {}) => ({
  user_id: userId,
  display_name: "João Silva",
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
  matching() {
    return this.db.profiles
      .filter((row) => row.accessible !== false)
      .filter((row) =>
        this.filters.every((filter) => row[filter.column] === filter.value),
      );
  }
  execute() {
    if (this.table !== "profiles") {
      return { data: null, error: { message: "unexpected table" } };
    }
    if (this.operation === "select") {
      this.db.reads += 1;
      this.db.onRead?.(this.db);
      if (this.db.failRead) return { data: null, error: { message: "private SQL" } };
      return {
        data: structuredClone(this.project(this.matching().slice(0, this.maximum))),
        error: null,
      };
    }
    if (this.operation === "insert") {
      this.db.writes.push({ method: "insert", table: this.table, payload: this.payload });
      this.db.onInsert?.(this.db);
      if (
        this.db.failWrite ||
        this.db.profiles.some((row) => row.user_id === this.payload.user_id)
      ) {
        return { data: null, error: { message: "private unique constraint" } };
      }
      const inserted = {
        ...this.payload,
        created_at: createdAt,
        updated_at: version2,
        accessible: true,
      };
      this.db.profiles.push(inserted);
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
  constructor(profiles = [], options = {}) {
    this.profiles = structuredClone(profiles);
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
const use = (profiles = [], options = {}) => {
  const db = new DB(profiles, options);
  globalThis.__MCP_PROFILE_SUPABASE__ = db;
  return db;
};

// Pipeline HTTP publicado: o guard roda antes de o SDK descartar campos extras.
const mcpRequest = (name, args, id = 1) =>
  new Request("https://example.test/functions/v1/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });

{
  const db = use([profile()]);
  let sdkCalls = 0;
  const publishedPipeline = core.withStrictEmptyInputGuard(async (request) => {
    sdkCalls += 1;
    const payload = await request.json();
    // Reproduz o SDK: raw shape vazio transforma o input e remove extras.
    const result = await core.getTool.handler({}, ctx);
    return Response.json({
      jsonrpc: "2.0",
      id: payload.id,
      result,
    });
  });

  const validResponse = await publishedPipeline(mcpRequest("get_profile", {}));
  const validBody = await validResponse.json();
  equal(validResponse.status, 200, "pipeline aceita objeto vazio");
  equal(sdkCalls, 1, "chamada válida chega ao SDK");
  equal(db.reads, 1, "chamada válida preserva leitura do perfil");
  equal(
    validBody.result.structuredContent.display_name,
    db.profiles[0].display_name,
    "contrato válido preservado",
  );

  for (const [args, label] of [
    [{ campo_fake: "teste" }, "campo fake"],
    [{ user_id: userId }, "user_id"],
    [{ fields: ["display_name"] }, "fields"],
    [{ include_auth: true }, "include_auth"],
  ]) {
    const beforeReads = db.reads;
    const beforeWrites = db.writes.length;
    const response = await publishedPipeline(mcpRequest("get_profile", args));
    const body = await response.json();
    equal(response.status, 200, `${label}: erro JSON-RPC`);
    equal(body.error.code, -32602, `${label}: invalid params`);
    check(body.error.message.includes("INVALID_INPUT"), `${label}: erro tipado`);
    equal(db.reads, beforeReads, `${label}: nenhuma consulta`);
    equal(db.writes.length, beforeWrites, `${label}: nenhuma escrita`);
    check(!("result" in body), `${label}: nenhum perfil retornado`);
    check(!JSON.stringify(body).includes(userId), `${label}: nenhum UUID`);
    check(!JSON.stringify(body).includes("@"), `${label}: nenhum e-mail`);
  }
  equal(sdkCalls, 1, "inputs inválidos são bloqueados antes do SDK");
}

{
  let forwarded = 0;
  const pipeline = core.withStrictEmptyInputGuard(async () => {
    forwarded += 1;
    return Response.json({ ok: true });
  });
  const response = await pipeline(
    mcpRequest("update_profile", { campo_fake: "teste" }),
  );
  equal(response.status, 200, "update_profile permanece fora do guard");
  equal(forwarded, 1, "update_profile permanece entregue ao SDK");

  const identityResponse = await pipeline(
    mcpRequest("get_connection_identity", { campo_fake: "teste" }),
  );
  const identityBody = await identityResponse.json();
  equal(identityBody.error.code, -32602, "outra tool vazia rejeita extra");
  check(
    identityBody.error.message.includes("INVALID_INPUT"),
    "outra tool vazia usa erro tipado",
  );
  equal(forwarded, 1, "outra tool vazia inválida não chega ao SDK");
}

{
  let invoked = 0;
  const pipeline = core.withStrictEmptyInputGuard(async () => {
    invoked += 1;
    return Response.json({ ok: true });
  });
  const response = await pipeline(
    new Request(
      "https://example.test/functions/v1/mcp/.mcp/invoke-tool/get_profile",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campo_fake: "teste" }),
      },
    ),
  );
  const body = await response.json();
  equal(response.status, 400, "invoke-tool também rejeita extra");
  equal(body.error, "INVALID_INPUT", "invoke-tool retorna erro tipado");
  equal(invoked, 0, "invoke-tool inválido não chega ao SDK");
}

{
  const pipeline = core.withStrictEmptyInputGuard(async () =>
    Response.json({
      jsonrpc: "2.0",
      id: 1,
      result: {
        tools: [
          {
            name: "get_profile",
            inputSchema: { type: "object", properties: {} },
          },
          {
            name: "update_profile",
            inputSchema: {
              type: "object",
              properties: { changes: { type: "object" } },
              additionalProperties: false,
            },
          },
        ],
      },
    }),
  );
  const response = await pipeline(
    new Request("https://example.test/functions/v1/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }),
  );
  const body = await response.json();
  equal(
    body.result.tools[0].inputSchema.additionalProperties,
    false,
    "tools/list publicado anuncia input vazio fechado",
  );
  equal(
    body.result.tools[1].inputSchema.additionalProperties,
    false,
    "tools/list não altera schemas parametrizados",
  );
}

// Schemas fechados e validação real do nome.
for (const [input, valid, label] of [
  [{ changes: { display_name: "Maria" } }, true, "criação sem versão"],
  [{ changes: { display_name: " Maria " }, expected_updated_at: version1 }, true, "update"],
  [{ changes: { display_name: "Maria" }, expected_updated_at: null }, true, "versão nula"],
  [{}, false, "sem changes"],
  [{ changes: {} }, false, "changes vazio"],
  [{ changes: { display_name: null } }, false, "nome null"],
  [{ changes: { display_name: " " } }, false, "nome vazio"],
  [{ changes: { display_name: "A" } }, false, "abaixo do mínimo"],
  [{ changes: { display_name: "A".repeat(60) } }, true, "máximo"],
  [{ changes: { display_name: "A".repeat(61) } }, false, "acima do máximo"],
  [{ changes: { display_name: "Maria\u0000" } }, false, "controle"],
  [{ changes: { display_name: "Maria", email: "x@y.z" } }, false, "email"],
  [{ changes: { display_name: "Maria", password: "secret" } }, false, "password"],
  [{ changes: { display_name: "Maria", provider: "google" } }, false, "provider"],
  [{ changes: { display_name: "Maria", role: "admin" } }, false, "role"],
  [{ changes: { display_name: "Maria" }, user_id: userId }, false, "user id"],
  [{ changes: { display_name: "Maria" }, force: true }, false, "extra principal"],
  [{ changes: { display_name: "Maria" }, expected_updated_at: "invalid" }, false, "versão inválida"],
]) {
  equal(
    core.updateProfileInputProperties.changes
      ? core.profileChangesSchema
          .safeParse(input.changes)
          .success &&
          !Object.keys(input).some((key) => !["changes", "expected_updated_at"].includes(key)) &&
          (input.expected_updated_at === undefined ||
            input.expected_updated_at === null ||
            /^\d{4}-\d{2}-\d{2}T/.test(input.expected_updated_at))
      : false,
    valid,
    label,
  );
}
equal(core.displayNameSchema.parse("  João  da Silva  "), "João  da Silva", "trim e espaços internos");
equal(core.displayNameSchema.parse("Áurea 日本"), "Áurea 日本", "Unicode e acentos");
equal(core.displayNameSchema.parse("<b>Maria</b>"), "<b>Maria</b>", "markup preservado como texto");

// get_profile existente, incompleto, ausente, duplicado e privado.
{
  const db = use([profile()]);
  const result = await core.getTool.handler({}, ctx);
  equal(result.structuredContent.profile_exists, true, "perfil existe");
  equal(result.structuredContent.display_name, "João Silva", "nome");
  equal(result.structuredContent.profile_complete, true, "completo");
  equal(result.structuredContent.created_at, createdAt, "created");
  equal(result.structuredContent.updated_at, version1, "updated");
  equal(result.structuredContent.can_update, true, "pode atualizar");
  equal(result.structuredContent.data_complete, true, "dados completos");
  equal(db.writes, [], "get sem escrita");
  check(result.content[0].text.includes("João Silva"), "content nome");
  check(result.content[0].text.includes(version1), "content versão");
  check(result.content[0].text.includes("nenhuma alteração"), "content read-only");
  check(!JSON.stringify(result).includes(userId), "get sem UUID");
}
{
  use([]);
  const result = await core.getTool.handler({}, ctx);
  equal(result.structuredContent.profile_exists, false, "ausente");
  equal(result.structuredContent.display_name, null, "nome ausente");
  equal(result.structuredContent.profile_complete, false, "ausente incompleto");
  equal(result.structuredContent.created_at, null, "created ausente");
  equal(result.structuredContent.updated_at, null, "updated ausente");
  check(result.structuredContent.warnings.includes("PROFILE_NOT_CONFIGURED"), "warning ausente");
  check(result.content[0].text.includes("update_profile"), "orienta criação");
}
{
  use([profile({ display_name: null })]);
  const result = await core.getTool.handler({}, ctx);
  equal(result.structuredContent.profile_exists, true, "linha sem nome existe");
  equal(result.structuredContent.display_name, null, "nome null factual");
  equal(result.structuredContent.profile_complete, false, "nome null incompleto");
  check(result.structuredContent.warnings.includes("PROFILE_INCOMPLETE"), "warning incompleto");
}
{
  use([profile({ updated_at: null })]);
  const result = await core.getTool.handler({}, ctx);
  equal(result.structuredContent.data_complete, false, "versão ausente incompleta");
  check(result.structuredContent.warnings.includes("PROFILE_VERSION_MISSING"), "warning versão");
  check(result.structuredContent.warnings.includes("PROFILE_DATA_INCOMPLETE"), "warning dados");
}
{
  use([profile(), profile({ display_name: "Duplicado" })]);
  const result = await core.getTool.handler({}, ctx);
  errorCode(result, "PROFILE_DATA_INCOMPLETE", "duplicado");
  check(!JSON.stringify(result).includes(userId), "duplicado sem UUID");
}
{
  use([profile({ accessible: false })]);
  const result = await core.getTool.handler({}, ctx);
  equal(result.structuredContent.profile_exists, false, "RLS parece ausente");
}
for (const input of [{ user_id: userId }, { email: "x@y.z" }, { include_auth: true }]) {
  use([profile()]);
  const result = await core.getProfile(input, ctx);
  errorCode(result, "INVALID_INPUT", "get rejeita extra");
}

// Criação inicial segura.
{
  const db = use([]);
  const result = await core.updateTool.handler(
    { changes: { display_name: "  Maria Silva  " } },
    ctx,
  );
  equal(result.structuredContent.applied, true, "create applied");
  equal(result.structuredContent.created, true, "created");
  equal(result.structuredContent.no_op, false, "create não no-op");
  equal(result.structuredContent.before.profile_exists, false, "before ausente");
  equal(result.structuredContent.after.profile_exists, true, "after existe");
  equal(result.structuredContent.after.display_name, "Maria Silva", "create trim");
  equal(result.structuredContent.changed_fields, ["display_name"], "campo criado");
  check(result.structuredContent.warnings.includes("PROFILE_CREATED"), "warning created");
  equal(db.writes.length, 1, "um insert");
  equal(db.writes[0].table, "profiles", "somente profiles");
  equal(db.writes[0].method, "insert", "insert explícito");
  equal(db.writes[0].payload.user_id, userId, "id definido internamente");
  check(result.content[0].text.includes("Auth"), "content Auth intacto");
  check(!JSON.stringify(result).includes(userId), "create sem UUID público");
}
{
  use([]);
  const result = await core.updateTool.handler(
    { changes: { display_name: "Maria" }, expected_updated_at: version1 },
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "ausente com versão");
}
{
  const db = use([], {
    onRead(currentDb) {
      if (currentDb.reads === 2) currentDb.profiles.push(profile({ display_name: "Concorrente" }));
    },
  });
  const result = await core.updateTool.handler(
    { changes: { display_name: "Maria" } },
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "corrida antes do insert");
  equal(db.writes.length, 0, "corrida sem insert");
}
{
  const db = use([], {
    onInsert(currentDb) {
      currentDb.profiles.push(profile({ display_name: "Concorrente" }));
    },
  });
  const result = await core.updateTool.handler(
    { changes: { display_name: "Maria" }, expected_updated_at: null },
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "conflito único seguro");
  equal(db.profiles[0].display_name, "Concorrente", "não sobrescreve corrida");
}

// Update existente, concorrência e no-op.
{
  const db = use([profile()]);
  const result = await core.updateTool.handler(
    { changes: { display_name: "Maria" }, expected_updated_at: version1 },
    ctx,
  );
  equal(result.structuredContent.applied, true, "update applied");
  equal(result.structuredContent.created, false, "update não create");
  equal(result.structuredContent.no_op, false, "update não no-op");
  equal(result.structuredContent.before.display_name, "João Silva", "before");
  equal(result.structuredContent.after.display_name, "Maria", "after");
  equal(result.structuredContent.after.updated_at, version2, "nova versão");
  equal(result.structuredContent.changed_fields, ["display_name"], "changed");
  check(result.structuredContent.warnings.includes("PROFILE_UPDATED"), "warning update");
  equal(db.writes.length, 1, "um update");
  equal(db.writes[0].method, "update", "update explícito");
  const eqCalls = db.calls.filter((call) => call.method === "eq");
  check(eqCalls.some((call) => call.column === "user_id" && call.value === userId), "filtra usuário");
  check(eqCalls.some((call) => call.column === "updated_at" && call.value === version1), "filtra versão");
  equal(Object.keys(db.writes[0].payload), ["display_name"], "somente nome no patch");
}
{
  const db = use([profile()]);
  const result = await core.updateTool.handler(
    { changes: { display_name: "João Silva" } },
    ctx,
  );
  errorCode(result, "EXPECTED_VERSION_REQUIRED", "existente exige versão");
  equal(db.writes, [], "sem versão sem escrita");
}
{
  const db = use([profile()]);
  const result = await core.updateTool.handler(
    { changes: { display_name: "Maria" }, expected_updated_at: version2 },
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "versão antiga");
  equal(db.writes, [], "conflito inicial sem escrita");
  check(result.content[0].text.includes("get_profile"), "conflito orienta releitura");
}
{
  const db = use([profile({ display_name: "Maria" })]);
  const result = await core.updateTool.handler(
    { changes: { display_name: "  Maria  " }, expected_updated_at: version1 },
    ctx,
  );
  equal(result.structuredContent.applied, false, "no-op não aplicado");
  equal(result.structuredContent.created, false, "no-op não criado");
  equal(result.structuredContent.no_op, true, "no-op");
  equal(result.structuredContent.before, result.structuredContent.after, "before after iguais");
  equal(result.structuredContent.after.updated_at, version1, "versão preservada");
  equal(result.structuredContent.changed_fields, [], "sem campos");
  check(result.structuredContent.warnings.includes("NO_CHANGES_APPLIED"), "warning no-op");
  equal(db.writes, [], "no-op sem update");
  check(result.content[0].text.includes("Nenhuma escrita"), "content no-op");
}
{
  const db = use([profile({ updated_at: null })]);
  const result = await core.updateTool.handler(
    { changes: { display_name: "Maria" }, expected_updated_at: version1 },
    ctx,
  );
  errorCode(result, "PROFILE_VERSION_MISSING", "versão ausente bloqueia");
  equal(db.writes, [], "versão ausente sem escrita");
}
{
  const db = use([profile(), profile({ display_name: "Duplicado" })]);
  const result = await core.updateTool.handler(
    { changes: { display_name: "Maria" }, expected_updated_at: version1 },
    ctx,
  );
  errorCode(result, "PROFILE_DATA_INCOMPLETE", "duplicado bloqueia update");
  equal(db.writes, [], "duplicado sem escrita");
}
{
  const db = use([profile()], {
    onUpdate(currentDb) {
      currentDb.profiles[0].updated_at = version2;
    },
  });
  const result = await core.updateTool.handler(
    { changes: { display_name: "Maria" }, expected_updated_at: version1 },
    ctx,
  );
  errorCode(result, "CONCURRENT_MODIFICATION", "corrida final");
  equal(db.profiles[0].display_name, "João Silva", "corrida não altera nome");
}
{
  use([profile()], { failRead: true });
  const result = await core.getTool.handler({}, ctx);
  errorCode(result, "READ_FAILED", "erro leitura sanitizado");
  check(!JSON.stringify(result).includes("private SQL"), "sem SQL");
}
{
  use([profile()], { failWrite: true });
  const result = await core.updateTool.handler(
    { changes: { display_name: "Maria" }, expected_updated_at: version1 },
    ctx,
  );
  errorCode(result, "WRITE_FAILED", "erro escrita sanitizado");
  check(!JSON.stringify(result).includes("private policy"), "sem policy");
}
{
  use([profile()]);
  const unauthenticated = { isAuthenticated: () => false, getUserId: () => undefined };
  errorCode(await core.getTool.handler({}, unauthenticated), "UNAUTHENTICATED", "get auth");
  errorCode(
    await core.updateTool.handler({ changes: { display_name: "Maria" } }, unauthenticated),
    "UNAUTHENTICATED",
    "update auth",
  );
}

// Manifest, privacidade, isolamento e bundle.
const manifest = JSON.parse(await readFile(".lovable/mcp/manifest.json", "utf8"));
const tools = manifest.mcp.tools;
equal(tools.length, 53, "manifest 53 tools");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === true).length, 26, "26 read-only");
equal(tools.filter((tool) => tool.annotations?.readOnlyHint === false).length, 27, "27 write");
equal(new Set(tools.map((tool) => tool.name)).size, 53, "sem duplicidade");

const getDeclared = tools.find((tool) => tool.name === "get_profile");
const updateDeclared = tools.find((tool) => tool.name === "update_profile");
check(getDeclared, "get registrada");
check(updateDeclared, "update registrada");
equal(getDeclared.inputSchema.properties, {}, "get input sem propriedades");
check(
  getDeclared.inputSchema.additionalProperties === false,
  "get input não declara extras",
);
equal(getDeclared.outputSchema.additionalProperties, false, "get output fechado");
equal(updateDeclared.inputSchema.additionalProperties, false, "update input fechado");
equal(updateDeclared.outputSchema.additionalProperties, false, "update output fechado");
equal(updateDeclared.inputSchema.properties.changes.additionalProperties, false, "changes fechado");
equal(getDeclared.annotations, {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}, "annotations get");
equal(updateDeclared.annotations, {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
}, "annotations update");

const schemas = JSON.stringify([getDeclared.inputSchema, getDeclared.outputSchema, updateDeclared.inputSchema, updateDeclared.outputSchema]);
for (const forbidden of [
  "user_id",
  "profile_id",
  "email",
  "phone",
  "password",
  "provider",
  "avatar_url",
  "role",
  "subscription",
  "token",
]) {
  check(!schemas.includes(forbidden), `${forbidden} fora dos contratos`);
}

const readSource = await readFile("src/lib/mcp/shared/profile-read.ts", "utf8");
const writeSource = await readFile("src/lib/mcp/shared/profile-write.ts", "utf8");
const source = `${readSource}\n${writeSource}`;
check(source.includes("supabaseForUser"), "cliente por usuário");
check(!source.includes("service_role"), "sem service role");
check(!source.includes("auth.users"), "sem auth users");
check(!source.includes(".upsert("), "sem upsert");
check(!source.includes(".delete("), "sem delete");
check(!source.includes(".rpc("), "sem RPC");
check(!readSource.includes(".insert("), "read sem insert");
check(!readSource.includes(".update("), "read sem update");
check(writeSource.includes('.from("profiles")'), "somente profiles");
check(!writeSource.includes('.from("expenses")'), "sem despesas");
check(!writeSource.includes('.from("shared_groups")'), "sem grupos");

const bundleSource = await readFile("supabase/functions/mcp/index.ts", "utf8");
check(bundleSource.includes('name: "get_profile"'), "bundle get");
check(bundleSource.includes('name: "update_profile"'), "bundle update");
check(bundleSource.includes("withStrictEmptyInputGuard"), "bundle usa guard publicado");
check(bundleSource.includes("INVALID_INPUT:"), "bundle preserva erro tipado");
check(bundleSource.includes("Deno.serve"), "bundle serve");
check(!/[A-Z]:\\\\Users\\\\/u.test(bundleSource), "bundle sem caminho absoluto");
check(!bundleSource.includes("npm:@/"), "bundle sem alias npm");

check(checks >= 126, `cobertura mínima; obtidas ${checks}`);
console.log(`MCP Fase 1.2F-E: ${checks} verificações aprovadas.`);
