import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  listSharedGroups,
  sharedGroupCollectionWarningSchema,
  sharedGroupSchema,
} from "../shared/shared-group-read";

export default defineTool({
  name: "list_shared_groups",
  title: "Listar grupos compartilhados",
  description:
    "Lista grupos compartilhados acessíveis à conta autenticada, incluindo IDs, papel atual, associação, capacidade e updated_at. Não deriva grupos de transações e não altera dados.",
  inputSchema: {
    include_inactive: z.boolean().optional(),
    include_invite_code: z.boolean().optional(),
  },
  outputSchema: {
    resource_type: z.literal("shared_group_collection"),
    groups: z.array(sharedGroupSchema),
    returned_count: z.number().int().nonnegative(),
    total_accessible_count: z.number().int().nonnegative(),
    active_count: z.number().int().nonnegative(),
    inactive_count: z.number().int().nonnegative(),
    warnings: z.array(sharedGroupCollectionWarningSchema),
    data_complete: z.boolean(),
    generated_at: z.string().datetime(),
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: listSharedGroups,
});
