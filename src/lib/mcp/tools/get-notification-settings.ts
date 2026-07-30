import { defineTool } from "@lovable.dev/mcp-js";
import {
  getNotificationSettings,
  getNotificationSettingsOutputSchema,
} from "../shared/notification-settings-read";

export default defineTool({
  name: "get_notification_settings",
  title: "Consultar preferências de notificação",
  description:
    "Lê somente as preferências pessoais persistidas e os defaults efetivos do produto. Não consulta tokens, permissões, dispositivos ou entrega e não envia notificações.",
  inputSchema: {},
  outputSchema: getNotificationSettingsOutputSchema.shape,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: getNotificationSettings,
});
