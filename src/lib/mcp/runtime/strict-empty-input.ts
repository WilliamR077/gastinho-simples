const STRICT_EMPTY_INPUT_TOOLS = new Set([
  "get_connection_identity",
  "get_notification_settings",
  "get_profile",
]);

type RuntimeHandler = (request: Request) => Response | Promise<Response>;

type JsonRpcRequest = {
  id?: unknown;
  method?: unknown;
  params?: {
    name?: unknown;
    arguments?: unknown;
  };
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasInvalidEmptyInput(value: unknown): boolean {
  return !isPlainObject(value) || Object.keys(value).length !== 0;
}

function guardedToolName(value: unknown): string | null {
  return typeof value === "string" && STRICT_EMPTY_INPUT_TOOLS.has(value)
    ? value
    : null;
}

function invalidMcpCall(value: unknown): { id: unknown; toolName: string } | null {
  if (!isPlainObject(value)) return null;
  const request = value as JsonRpcRequest;
  if (request.method !== "tools/call" || !isPlainObject(request.params)) {
    return null;
  }
  const toolName = guardedToolName(request.params.name);
  if (!toolName || request.params.arguments === undefined) return null;
  if (!hasInvalidEmptyInput(request.params.arguments)) return null;
  return { id: request.id ?? null, toolName };
}

function jsonHeaders(request: Request): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  const origin = request.headers.get("origin");
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }
  return headers;
}

function invalidMcpResponse(
  request: Request,
  invalid: { id: unknown; toolName: string },
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: invalid.id,
      error: {
        code: -32602,
        message:
          `INVALID_INPUT: ${invalid.toolName} aceita somente um objeto vazio.`,
      },
    }),
    { status: 200, headers: jsonHeaders(request) },
  );
}

function invalidRestResponse(request: Request, toolName: string): Response {
  return new Response(
    JSON.stringify({
      error: "INVALID_INPUT",
      message: `${toolName} aceita somente um objeto vazio.`,
    }),
    { status: 400, headers: jsonHeaders(request) },
  );
}

function closeEmptyInputSchemas(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const tools =
    Array.isArray(value.tools)
      ? value.tools
      : isPlainObject(value.result) && Array.isArray(value.result.tools)
        ? value.result.tools
        : null;
  if (!tools) return false;

  let changed = false;
  for (const tool of tools) {
    if (!isPlainObject(tool) || !guardedToolName(tool.name)) continue;
    const schema = tool.inputSchema;
    if (!isPlainObject(schema)) continue;
    schema.type = "object";
    schema.properties = {};
    schema.additionalProperties = false;
    changed = true;
  }
  return changed;
}

async function closeListToolsResponse(response: Response): Promise<Response> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return response;
  }
  if (!closeEmptyInputSchemas(body)) return response;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify(body), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Guards raw HTTP arguments before mcp-js/Zod can strip unknown keys from
 * parameterless tools. It also closes their schemas in runtime list responses.
 */
export function withStrictEmptyInputGuard(
  handler: RuntimeHandler,
): RuntimeHandler {
  return async (request) => {
    if (request.method !== "POST") return handler(request);

    let body: unknown;
    try {
      body = await request.clone().json();
    } catch {
      return handler(request);
    }

    const pathname = new URL(request.url).pathname.replace(/\/+$/, "");
    const invokeMatch = /\/\.mcp\/invoke-tool\/([^/]+)$/u.exec(pathname);
    if (invokeMatch) {
      let toolName: string;
      try {
        toolName = decodeURIComponent(invokeMatch[1]);
      } catch {
        return handler(request);
      }
      if (guardedToolName(toolName) && hasInvalidEmptyInput(body)) {
        return invalidRestResponse(request, toolName);
      }
    }

    const messages = Array.isArray(body) ? body : [body];
    for (const message of messages) {
      const invalid = invalidMcpCall(message);
      if (invalid) return invalidMcpResponse(request, invalid);
    }

    const response = await handler(request);
    const isListRequest = messages.some(
      (message) => isPlainObject(message) && message.method === "tools/list",
    );
    return isListRequest || pathname.endsWith("/.mcp/list-tools")
      ? closeListToolsResponse(response)
      : response;
  };
}
