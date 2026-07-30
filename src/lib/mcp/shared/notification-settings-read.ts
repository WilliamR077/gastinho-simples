import { z } from "zod";
import { mcpError, type McpToolError } from "./errors";
import { supabaseForUser } from "./supabase-client";

export const NOTIFICATION_SETTING_FIELDS = [
  "is_enabled",
  "notify_3_days_before",
  "notify_1_day_before",
  "notify_on_day",
] as const;

export const PRODUCT_NOTIFICATION_DEFAULTS = {
  is_enabled: true,
  notify_3_days_before: true,
  notify_1_day_before: true,
  notify_on_day: true,
} as const;

export const NOTIFICATION_SETTINGS_WARNINGS = [
  "NOTIFICATION_SETTINGS_NOT_CONFIGURED",
  "NOTIFICATION_SETTINGS_DATA_INCOMPLETE",
  "NOTIFICATION_SETTINGS_INVALID",
  "NOTIFICATION_SETTINGS_VERSION_MISSING",
  "PRODUCT_DEFAULTS_APPLIED",
  "DEVICE_PERMISSION_NOT_VERIFIED",
] as const;

export type NotificationSettingsWarning =
  (typeof NOTIFICATION_SETTINGS_WARNINGS)[number];

export type NotificationSettingsContextLike = {
  isAuthenticated(): boolean;
  getUserId(): string | undefined;
};

export interface NotificationSettingsRow {
  is_enabled: unknown;
  notify_3_days_before: unknown;
  notify_1_day_before: unknown;
  notify_on_day: unknown;
  created_at: string | null;
  updated_at: string | null;
}

export const publicNotificationSettingsSchema = z
  .object({
    is_enabled: z.boolean(),
    notify_3_days_before: z.boolean(),
    notify_1_day_before: z.boolean(),
    notify_on_day: z.boolean(),
  })
  .strict();

export const notificationSettingsWarningSchema = z.enum(
  NOTIFICATION_SETTINGS_WARNINGS,
);

export const notificationSettingsSnapshotSchema = z
  .object({
    settings_exist: z.boolean(),
    settings: publicNotificationSettingsSchema,
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
  })
  .strict();

export const getNotificationSettingsOutputSchema = z
  .object({
    resource_type: z.literal("notification_settings"),
    settings_exist: z.boolean(),
    settings: publicNotificationSettingsSchema.nullable(),
    effective_settings: publicNotificationSettingsSchema.nullable(),
    uses_product_defaults: z.boolean(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    can_update: z.literal(true),
    warnings: z.array(notificationSettingsWarningSchema),
    data_complete: z.boolean(),
    generated_at: z.string().datetime(),
  })
  .strict();

export type PublicNotificationSettings = z.infer<
  typeof publicNotificationSettingsSchema
>;
export type NotificationSettingsSnapshot = z.infer<
  typeof notificationSettingsSnapshotSchema
>;

export function parsePersistedNotificationSettings(
  row: NotificationSettingsRow,
): PublicNotificationSettings | null {
  const parsed = publicNotificationSettingsSchema.safeParse({
    is_enabled: row.is_enabled,
    notify_3_days_before: row.notify_3_days_before,
    notify_1_day_before: row.notify_1_day_before,
    notify_on_day: row.notify_on_day,
  });
  return parsed.success ? parsed.data : null;
}

export function missingNotificationSettingsSnapshot(): NotificationSettingsSnapshot {
  return {
    settings_exist: false,
    settings: { ...PRODUCT_NOTIFICATION_DEFAULTS },
    created_at: null,
    updated_at: null,
  };
}

export function notificationSettingsSnapshot(
  row: NotificationSettingsRow,
  settings: PublicNotificationSettings,
): NotificationSettingsSnapshot {
  return {
    settings_exist: true,
    settings,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function readOwnNotificationSettingsRows(
  ctx: NotificationSettingsContextLike,
): Promise<NotificationSettingsRow[] | McpToolError> {
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
  const supabase = supabaseForUser(ctx as never);
  const { data, error } = await supabase
    .from("notification_settings")
    .select(
      "is_enabled,notify_3_days_before,notify_1_day_before,notify_on_day,created_at,updated_at",
    )
    .eq("user_id", userId)
    .limit(2);
  if (error) return mcpError("READ_FAILED");
  return (data ?? []) as unknown as NotificationSettingsRow[];
}

export async function getNotificationSettings(
  rawInput: unknown,
  ctx: NotificationSettingsContextLike,
) {
  const parsed = z.object({}).strict().safeParse(rawInput);
  if (!parsed.success) return mcpError("INVALID_INPUT");

  try {
    const rows = await readOwnNotificationSettingsRows(ctx);
    if ("isError" in rows) return rows;

    const warnings: NotificationSettingsWarning[] = [
      "DEVICE_PERMISSION_NOT_VERIFIED",
    ];
    let settingsExist = rows.length > 0;
    let settings: PublicNotificationSettings | null = null;
    let effectiveSettings: PublicNotificationSettings | null = null;
    let usesProductDefaults = false;
    let createdAt: string | null = null;
    let updatedAt: string | null = null;
    let dataComplete = true;

    if (rows.length === 0) {
      settingsExist = false;
      effectiveSettings = { ...PRODUCT_NOTIFICATION_DEFAULTS };
      usesProductDefaults = true;
      warnings.unshift(
        "NOTIFICATION_SETTINGS_NOT_CONFIGURED",
        "PRODUCT_DEFAULTS_APPLIED",
      );
    } else if (rows.length > 1) {
      dataComplete = false;
      warnings.unshift("NOTIFICATION_SETTINGS_DATA_INCOMPLETE");
    } else {
      const row = rows[0];
      createdAt = row.created_at;
      updatedAt = row.updated_at;
      settings = parsePersistedNotificationSettings(row);
      effectiveSettings = settings;
      if (!settings) {
        dataComplete = false;
        warnings.unshift("NOTIFICATION_SETTINGS_INVALID");
      }
      if (!createdAt || !updatedAt) {
        dataComplete = false;
        warnings.unshift("NOTIFICATION_SETTINGS_DATA_INCOMPLETE");
      }
      if (!updatedAt) warnings.unshift("NOTIFICATION_SETTINGS_VERSION_MISSING");
    }

    const result = {
      resource_type: "notification_settings" as const,
      settings_exist: settingsExist,
      settings,
      effective_settings: effectiveSettings,
      uses_product_defaults: usesProductDefaults,
      created_at: createdAt,
      updated_at: updatedAt,
      can_update: true as const,
      warnings,
      data_complete: dataComplete,
      generated_at: new Date().toISOString(),
    };
    const validated = getNotificationSettingsOutputSchema.safeParse(result);
    if (!validated.success) return mcpError("INVALID_DATA");

    const source = usesProductDefaults
      ? "defaults do produto não persistidos"
      : settings
        ? "preferências persistidas"
        : "preferências indisponíveis por inconsistência";
    return {
      content: [
        {
          type: "text" as const,
          text:
            `Configuração persistida=${settingsExist}; fonte efetiva=${source}; ` +
            `preferências efetivas=${JSON.stringify(effectiveSettings)}; ` +
            `updated_at=${updatedAt ?? "ausente"}; warnings=${warnings.join(",") || "nenhum"}. ` +
            "Nenhuma alteração ou notificação foi realizada. Permissão do dispositivo e entrega não foram verificadas.",
        },
      ],
      structuredContent: validated.data,
    };
  } catch {
    return mcpError("READ_FAILED");
  }
}
