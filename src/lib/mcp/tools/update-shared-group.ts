import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  SHARED_GROUP_EDITABLE_FIELDS,
  sharedGroupWriteViewSchema,
  sharedGroupWriteWarningSchema,
  updateSharedGroup,
  updateSharedGroupInputProperties,
} from "../shared/shared-group-write";

export default defineTool({
  name: "update_shared_group",
  title: "Editar grupo compartilhado",
  description:
    "Edita nome, descrição ou cor de um grupo ativo e estruturalmente consistente quando a associação autenticada é owner ou admin. Exige updated_at para concorrência otimista e não altera membros, papéis, convites, capacidade ou dados financeiros.",
  inputSchema: updateSharedGroupInputProperties,
  outputSchema: {
    resource_type: z.literal("shared_group"),
    id: z.string().uuid(),
    applied: z.boolean(),
    no_op: z.boolean(),
    before: sharedGroupWriteViewSchema,
    after: sharedGroupWriteViewSchema,
    changed_fields: z.array(z.enum(SHARED_GROUP_EDITABLE_FIELDS)),
    current_user_role: z.enum(["owner", "admin"]),
    can_manage: z.literal(true),
    operation_completed_at: z.string().datetime(),
    warnings: z.array(sharedGroupWriteWarningSchema),
    data_complete: z.literal(true),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: updateSharedGroup,
});
