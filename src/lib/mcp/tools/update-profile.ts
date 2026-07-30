import { defineTool } from "@lovable.dev/mcp-js";
import {
  updateProfile,
  updateProfileInputProperties,
  updateProfileOutputSchema,
} from "../shared/profile-write";

export default defineTool({
  name: "update_profile",
  title: "Atualizar perfil pessoal",
  description:
    "Cria com segurança o perfil público ausente ou atualiza somente display_name no perfil próprio. Perfis existentes exigem expected_updated_at; no-op não escreve. Não altera Auth, e-mail ou outros módulos.",
  inputSchema: updateProfileInputProperties,
  outputSchema: updateProfileOutputSchema.shape,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: updateProfile,
});
