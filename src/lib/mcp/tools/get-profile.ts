import { defineTool } from "@lovable.dev/mcp-js";
import { getProfile, getProfileOutputSchema } from "../shared/profile-read";

export default defineTool({
  name: "get_profile",
  title: "Consultar perfil pessoal",
  description:
    "Lê somente o perfil público reduzido da conta autenticada. Retorna display_name e versões do perfil, sem UUID, e-mail, Auth, assinatura ou dados financeiros.",
  inputSchema: {},
  outputSchema: getProfileOutputSchema.shape,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: getProfile,
});
