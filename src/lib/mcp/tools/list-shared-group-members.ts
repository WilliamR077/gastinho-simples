import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  listSharedGroupMembers,
  publicGroupMemberSchema,
  sharedGroupMemberWarningSchema,
  sharedGroupSummarySchema,
} from "../shared/shared-group-read";

export default defineTool({
  name: "list_shared_group_members",
  title: "Listar membros do grupo compartilhado",
  description:
    "Lista identidades públicas reduzidas dos membros de um grupo acessível. Nunca retorna UUID de usuário, e-mail, proprietário interno ou código de convite e não altera dados.",
  inputSchema: {
    group_id: z.string().uuid(),
  },
  outputSchema: {
    resource_type: z.literal("shared_group_member_collection"),
    group: sharedGroupSummarySchema,
    members: z.array(publicGroupMemberSchema),
    returned_count: z.number().int().nonnegative(),
    warnings: z.array(sharedGroupMemberWarningSchema),
    data_complete: z.boolean(),
    generated_at: z.string().datetime(),
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: listSharedGroupMembers,
});
