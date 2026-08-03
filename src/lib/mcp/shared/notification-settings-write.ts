import { z } from "zod";
import { mcpError, type McpToolError } from "./errors";
import {
  missingNotificationSettingsSnapshot,
  notificationSettingsSnapshot,
  notificationSettingsSnapshotSchema,
  NOTIFICATION_SETTING_FIELDS,
  PRODUCT_NOTIFICATION_DEFAULTS,
  publicNotificationSettingsSchema,
  parsePersistedNotificationSettings,
  readOwnNotificationSettingsRows,
  type NotificationSettingsContextLike,
  type NotificationSettingsRow,
  type NotificationSettingsSnapshot,
  type PublicNotificationSettings,
} from "./notification-settings-read";
import { supabaseForUser } from "./supabase-client";

export const notificationSettingsChangeProperties = {
  is_enabled: z.boolean().optional(),
  notify_3_days_before: z.boolean().optional(),
  notify_1_day_before: z.boolean().optional(),
  notify_on_day: z.boolean().optional(),
} as const;

export const notificationSettingsChangesSchema = z
  .object(notificationSettingsChangeProperties)
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: "Informe ao menos uma preferência.",
  });

export const updateNotificationSettingsInputProperties = {
  changes: notificationSettingsChangesSchema,
  expected_updated_at: z.string().datetime({ offset: true }).nullable().optional(),
};
const updateNotificationSettingsInputSchema = z
  .object(updateNotificationSettingsInputProperties)
  .strict();

export const NOTIFICATION_SETTINGS_WRITE_WARNINGS = [
  "NOTIFICATION_SETTINGS_CREATED",
  "NOTIFICATION_SETTINGS_UPDATED",
  "PRODUCT_DEFAULTS_APPLIED",
  "DEVICE_PERMISSION_NOT_VERIFIED",
  "NO_CHANGES_APPLIED",
] as const;

const notificationSettingsWriteWarningSchema = z.enum(
  NOTIFICATION_SETTINGS_WRITE_WARNINGS,
);

export const updateNotificationSettingsOutputSchema = z
  .object({
    resource_type: z.literal("notification_settings"),
    applied: z.boolean(),
    created: z.boolean(),
    no_op: z.boolean(),
    before: notificationSettingsSnapshotSchema,
    after: notificationSettingsSnapshotSchema,
    changed_fields: z.array(z.enum(NOTIFICATION_SETTING_FIELDS)),
    operation_completed_at: z.string().datetime(),
    warnings: z.array(notificationSettingsWriteWarningSchema),
    data_complete: z.literal(true),
  })
  .strict();

type NotificationSettingsField = (typeof NOTIFICATION_SETTING_FIELDS)[number];
type NotificationSettingsWriteWarning =
  (typeof NOTIFICATION_SETTINGS_WRITE_WARNINGS)[number];

function concurrent(message: string): McpToolError {
  return mcpError(
    "CONCURRENT_MODIFICATION",
    `${message} Releia as preferências com get_notification_settings antes de tentar novamente; nada foi alterado.`,
  );
}

function incomplete(): McpToolError {
  return mcpError(
    "NOTIFICATION_SETTINGS_DATA_INCOMPLETE",
    "As preferências persistidas estão duplicadas ou inválidas. Nenhuma linha foi escolhida e nenhuma alteração foi realizada.",
  );
}

function versionMissing(): McpToolError {
  return mcpError(
    "NOTIFICATION_SETTINGS_VERSION_MISSING",
    "As preferências existentes não possuem updated_at utilizável. Nada foi alterado.",
  );
}

function changedFields(
  before: PublicNotificationSettings,
  after: PublicNotificationSettings,
): NotificationSettingsField[] {
  return NOTIFICATION_SETTING_FIELDS.filter(
    (field) => before[field] !== after[field],
  );
}

function contentFor(result: {
  created: boolean;
  no_op: boolean;
  before: NotificationSettingsSnapshot;
  after: NotificationSettingsSnapshot;
  changed_fields: NotificationSettingsField[];
  warnings: NotificationSettingsWriteWarning[];
}): string {
  if (result.created) {
    return (
      `Configuração inicial criada; preferências finais=${JSON.stringify(result.after.settings)}; ` +
      `updated_at=${result.after.updated_at}; warnings=${result.warnings.join(",")}. ` +
      "Nenhuma notificação foi enviada e nenhum token ou permissão de dispositivo foi alterado."
    );
  }
  if (result.no_op) {
    return (
      `Nenhum valor mudou; preferências=${JSON.stringify(result.after.settings)}; ` +
      `updated_at permaneceu ${result.after.updated_at}; warnings=${result.warnings.join(",")}. ` +
      "Nenhuma escrita ou notificação foi realizada."
    );
  }
  return (
    `Preferências atualizadas; campos=${result.changed_fields.join(",")}; ` +
    `antes=${JSON.stringify(result.before.settings)}; depois=${JSON.stringify(result.after.settings)}; ` +
    `updated_at=${result.after.updated_at}; warnings=${result.warnings.join(",")}. ` +
    "Nenhuma notificação foi enviada e nenhum token ou permissão de dispositivo foi alterado."
  );
}

function toolResult(
  applied: boolean,
  created: boolean,
  noOp: boolean,
  before: NotificationSettingsSnapshot,
  after: NotificationSettingsSnapshot,
  fields: NotificationSettingsField[],
  warnings: NotificationSettingsWriteWarning[],
) {
  const result = {
    resource_type: "notification_settings" as const,
    applied,
    created,
    no_op: noOp,
    before,
    after,
    changed_fields: fields,
    operation_completed_at: new Date().toISOString(),
    warnings,
    data_complete: true as const,
  };
  const validated = updateNotificationSettingsOutputSchema.safeParse(result);
  if (!validated.success) return mcpError("INVALID_DATA");
  return {
    content: [{ type: "text" as const, text: contentFor(result) }],
    structuredContent: validated.data,
  };
}

async function currentRow(
  ctx: NotificationSettingsContextLike,
): Promise<NotificationSettingsRow | null | McpToolError> {
  const rows = await readOwnNotificationSettingsRows(ctx);
  if ("isError" in rows) return rows;
  if (rows.length > 1) return incomplete();
  return rows[0] ?? null;
}

export async function updateNotificationSettings(
  rawInput: unknown,
  ctx: NotificationSettingsContextLike,
) {
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
  const parsed = updateNotificationSettingsInputSchema.safeParse(rawInput);
  if (!parsed.success) return mcpError("INVALID_INPUT");
  const input = parsed.data;

  try {
    const currentRaw = await currentRow(ctx);
    if (currentRaw && "isError" in currentRaw) return currentRaw;
    const current = currentRaw as NotificationSettingsRow | null;
    const supabase = supabaseForUser(ctx as never);

    if (!current) {
      if (
        input.expected_updated_at !== undefined &&
        input.expected_updated_at !== null
      ) {
        return concurrent(
          "As preferências ainda não existem, mas foi fornecida uma versão anterior.",
        );
      }
      const confirmed = await currentRow(ctx);
      if (confirmed && "isError" in confirmed) return confirmed;
      if (confirmed) return concurrent("As preferências foram criadas simultaneamente.");

      const finalSettings = publicNotificationSettingsSchema.parse({
        ...PRODUCT_NOTIFICATION_DEFAULTS,
        ...input.changes,
      });
      const insertResult = await supabase
        .from("notification_settings")
        .insert({ user_id: userId, ...finalSettings })
        .select(
          "is_enabled,notify_3_days_before,notify_1_day_before,notify_on_day,created_at,updated_at",
        )
        .maybeSingle();
      if (insertResult.error || !insertResult.data) {
        const latest = await currentRow(ctx);
        if (latest && "isError" in latest) return latest;
        if (latest) return concurrent("As preferências foram criadas simultaneamente.");
        return mcpError(
          "WRITE_FAILED",
          "Não foi possível criar as preferências com segurança. Nada foi sobrescrito.",
        );
      }

      const row = insertResult.data as unknown as NotificationSettingsRow;
      const persisted = parsePersistedNotificationSettings(row);
      if (!persisted || !row.created_at || !row.updated_at) return incomplete();
      const omittedDefaults = NOTIFICATION_SETTING_FIELDS.some(
        (field) => !(field in input.changes),
      );
      return toolResult(
        true,
        true,
        false,
        missingNotificationSettingsSnapshot(),
        notificationSettingsSnapshot(row, persisted),
        changedFields(PRODUCT_NOTIFICATION_DEFAULTS, persisted),
        [
          "NOTIFICATION_SETTINGS_CREATED",
          ...(omittedDefaults
            ? (["PRODUCT_DEFAULTS_APPLIED"] as const)
            : []),
          "DEVICE_PERMISSION_NOT_VERIFIED",
        ],
      );
    }

    const persisted = parsePersistedNotificationSettings(current);
    if (!persisted) return incomplete();
    if (!current.updated_at) return versionMissing();
    if (!input.expected_updated_at) {
      return mcpError(
        "EXPECTED_VERSION_REQUIRED",
        "Preferências existentes exigem expected_updated_at obtido em get_notification_settings. Nada foi alterado.",
      );
    }
    if (current.updated_at !== input.expected_updated_at) {
      return concurrent("As preferências mudaram desde a leitura.");
    }

    const finalSettings = publicNotificationSettingsSchema.parse({
      ...persisted,
      ...input.changes,
    });
    const fields = changedFields(persisted, finalSettings);
    const before = notificationSettingsSnapshot(current, persisted);
    if (fields.length === 0) {
      return toolResult(
        false,
        false,
        true,
        before,
        before,
        [],
        ["NO_CHANGES_APPLIED", "DEVICE_PERMISSION_NOT_VERIFIED"],
      );
    }

    const payload = Object.fromEntries(
      fields.map((field) => [field, finalSettings[field]]),
    );
    const updateResult = await supabase
      .from("notification_settings")
      .update(payload)
      .eq("user_id", userId)
      .eq("updated_at", input.expected_updated_at)
      .select(
        "is_enabled,notify_3_days_before,notify_1_day_before,notify_on_day,created_at,updated_at",
      )
      .maybeSingle();
    if (updateResult.error) return mcpError("WRITE_FAILED");
    if (!updateResult.data) {
      const latestRaw = await currentRow(ctx);
      if (latestRaw && "isError" in latestRaw) return latestRaw;
      const latest = latestRaw as NotificationSettingsRow | null;
      if (!latest || latest.updated_at !== input.expected_updated_at) {
        return concurrent(
          "As preferências mudaram ou deixaram de estar acessíveis durante a atualização.",
        );
      }
      return mcpError(
        "WRITE_FAILED",
        "Não foi possível concluir a atualização segura. Nada foi alterado.",
      );
    }

    const afterRow = updateResult.data as unknown as NotificationSettingsRow;
    const afterSettings = parsePersistedNotificationSettings(afterRow);
    if (!afterSettings || !afterRow.created_at || !afterRow.updated_at) {
      return incomplete();
    }
    return toolResult(
      true,
      false,
      false,
      before,
      notificationSettingsSnapshot(afterRow, afterSettings),
      fields,
      ["NOTIFICATION_SETTINGS_UPDATED", "DEVICE_PERMISSION_NOT_VERIFIED"],
    );
  } catch {
    return mcpError("WRITE_FAILED");
  }
}
