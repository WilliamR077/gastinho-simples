import { defineTool } from "@lovable.dev/mcp-js";
import { mcpError } from "../shared/errors";

/**
 * Mascara e-mail preservando a primeira letra do local e o domínio inteiro.
 * "joao.silva@gmail.com" -> "jo***@gmail.com"
 */
function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain || !local) return null;
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}***@${domain}`;
}

function uuidSuffix(uuid: string | null | undefined): string | null {
  if (!uuid) return null;
  const clean = uuid.replace(/-/g, "");
  return clean.slice(-8);
}

export default defineTool({
  name: "get_connection_identity",
  title: "Identidade da conexão",
  description:
    "Mostra qual conta do Gastinho Simples está conectada ao assistente atual. Retorna apenas identificadores mascarados — nunca tokens, UUID completo ou claims.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return mcpError("UNAUTHENTICATED");

    // Fonte exclusiva de identidade: token OAuth validado pelo mcp-js.
    const userId = ctx.getUserId();
    const email = typeof ctx.getUserEmail === "function" ? ctx.getUserEmail() : null;
    const clientId = typeof ctx.getClientId === "function" ? ctx.getClientId() : null;

    // oauth_client_name só entra se estiver confiavelmente disponível.
    // O contrato atual do ToolContext expõe apenas client_id — não o nome
    // do cliente OAuth registrado — portanto NÃO devolvemos nome aqui.

    const identity = {
      user_id_suffix: uuidSuffix(userId),
      email_masked: maskEmail(email),
      oauth_client_id_present: Boolean(clientId),
      authenticated: true,
      timestamp: new Date().toISOString(),
    };

    const summaryEmail = identity.email_masked ?? "conta sem e-mail visível";
    return {
      content: [{ type: "text", text: `Você está conectado à conta ${summaryEmail}.` }],
      structuredContent: identity,
    };
  },
});
