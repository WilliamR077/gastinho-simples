import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
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

async function connectionReference(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .slice(0, 8)
    .toUpperCase();
  return `GS-${hex}`;
}

export default defineTool({
  name: "get_connection_identity",
  title: "Identidade da conexão",
  description:
    "Mostra qual conta do Gastinho Simples está conectada ao assistente atual. Retorna e-mail mascarado e uma referência opaca derivada por hash — nunca tokens, UUID ou claims.",
  inputSchema: {},
  outputSchema: {
    email_masked: z.string().nullable(),
    connection_reference: z.string().regex(/^GS-[A-F0-9]{8}$/),
    oauth_client_id_present: z.boolean(),
    authenticated: z.boolean(),
    timestamp: z.string().datetime(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return mcpError("UNAUTHENTICATED");

    // Fonte exclusiva de identidade: token OAuth validado pelo mcp-js.
    const userId = ctx.getUserId();
    if (!userId) return mcpError("UNAUTHENTICATED");
    const email = typeof ctx.getUserEmail === "function" ? ctx.getUserEmail() : null;
    const clientId = typeof ctx.getClientId === "function" ? ctx.getClientId() : null;

    // oauth_client_name só entra se estiver confiavelmente disponível.
    // O contrato atual do ToolContext expõe apenas client_id — não o nome
    // do cliente OAuth registrado — portanto NÃO devolvemos nome aqui.

    const identity = {
      email_masked: maskEmail(email),
      connection_reference: await connectionReference(userId),
      oauth_client_id_present: Boolean(clientId),
      authenticated: true,
      timestamp: new Date().toISOString(),
    };

    const summaryEmail = identity.email_masked ?? "conta sem e-mail visível";
    return {
      content: [
        {
          type: "text",
          text:
            `Conta conectada: ${summaryEmail}. ` +
            `Referência da conexão: ${identity.connection_reference}. ` +
            `Autenticada: sim. ` +
            `Cliente OAuth identificado: ${identity.oauth_client_id_present ? "sim" : "não"}. ` +
            `Timestamp: ${identity.timestamp}.`,
        },
      ],
      structuredContent: identity,
    };
  },
});
