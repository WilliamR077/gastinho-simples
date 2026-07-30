import { defineTool } from "@lovable.dev/mcp-js";
import {
  updateNotificationSettings,
  updateNotificationSettingsInputProperties,
  updateNotificationSettingsOutputSchema,
} from "../shared/notification-settings-write";

export default defineTool({
  name: "update_notification_settings",
  title: "Atualizar preferências de notificação",
  description:
    "Cria ou atualiza somente os quatro toggles de notificação configuráveis na interface. Usa concorrência por updated_at e não envia notificações nem altera tokens ou permissões.",
  inputSchema: updateNotificationSettingsInputProperties,
  outputSchema: updateNotificationSettingsOutputSchema.shape,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: updateNotificationSettings,
});
