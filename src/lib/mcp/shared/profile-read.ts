import { z } from "zod";
import { mcpError, type McpToolError } from "./errors";
import { supabaseForUser } from "./supabase-client";

export const PROFILE_WARNINGS = [
  "PROFILE_NOT_CONFIGURED",
  "PROFILE_INCOMPLETE",
  "PROFILE_DATA_INCOMPLETE",
  "PROFILE_VERSION_MISSING",
] as const;
export type ProfileWarning = (typeof PROFILE_WARNINGS)[number];

export interface ProfileRow {
  display_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export type ProfileContextLike = {
  isAuthenticated(): boolean;
  getUserId(): string | undefined;
};

export const profileWarningSchema = z.enum(PROFILE_WARNINGS);
export const profileViewSchema = z
  .object({
    profile_exists: z.boolean(),
    display_name: z.string().nullable(),
    profile_complete: z.boolean(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
  })
  .strict();

export const getProfileOutputSchema = z
  .object({
    resource_type: z.literal("user_profile"),
    profile_exists: z.boolean(),
    display_name: z.string().nullable(),
    profile_complete: z.boolean(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    can_update: z.literal(true),
    warnings: z.array(profileWarningSchema),
    data_complete: z.boolean(),
    generated_at: z.string().datetime(),
  })
  .strict();

export type ProfileView = z.infer<typeof profileViewSchema>;

export function normalizedStoredName(value: string | null): string | null {
  if (value === null) return null;
  return value.trim() || null;
}

export function profileComplete(value: string | null): boolean {
  const normalized = normalizedStoredName(value);
  return normalized !== null && normalized.length >= 2 && normalized.length <= 60;
}

export function missingProfileView(): ProfileView {
  return {
    profile_exists: false,
    display_name: null,
    profile_complete: false,
    created_at: null,
    updated_at: null,
  };
}

export function profileView(row: ProfileRow): ProfileView {
  const displayName = normalizedStoredName(row.display_name);
  return {
    profile_exists: true,
    display_name: displayName,
    profile_complete: profileComplete(displayName),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function readOwnProfileRows(
  ctx: ProfileContextLike,
): Promise<ProfileRow[] | McpToolError> {
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
  const supabase = supabaseForUser(ctx as never);
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name,created_at,updated_at")
    .eq("user_id", userId)
    .limit(2);
  if (error) return mcpError("READ_FAILED");
  const rows = (data ?? []) as unknown as ProfileRow[];
  if (rows.length > 1) {
    return mcpError(
      "PROFILE_DATA_INCOMPLETE",
      "Foram encontradas configurações de perfil incompatíveis. Nenhum identificador interno foi exposto e nenhuma alteração foi realizada.",
    );
  }
  return rows;
}

function getWarnings(row: ProfileRow | null): ProfileWarning[] {
  if (!row) return ["PROFILE_NOT_CONFIGURED"];
  const warnings: ProfileWarning[] = [];
  if (!profileComplete(row.display_name)) warnings.push("PROFILE_INCOMPLETE");
  if (!row.created_at || !row.updated_at) warnings.push("PROFILE_DATA_INCOMPLETE");
  if (!row.updated_at) warnings.push("PROFILE_VERSION_MISSING");
  return warnings;
}

export async function getProfile(rawInput: unknown, ctx: ProfileContextLike) {
  const parsed = z.object({}).strict().safeParse(rawInput);
  if (!parsed.success) return mcpError("INVALID_INPUT");
  try {
    const rows = await readOwnProfileRows(ctx);
    if ("isError" in rows) return rows;
    const row = rows[0] ?? null;
    const view = row ? profileView(row) : missingProfileView();
    const warnings = getWarnings(row);
    const result = {
      resource_type: "user_profile" as const,
      ...view,
      can_update: true as const,
      warnings,
      data_complete:
        row === null || (row.created_at !== null && row.updated_at !== null),
      generated_at: new Date().toISOString(),
    };
    const validated = getProfileOutputSchema.safeParse(result);
    if (!validated.success) return mcpError("INVALID_DATA");
    const configured = view.profile_exists
      ? `configurado; nome de exibição=${JSON.stringify(view.display_name)}`
      : "ainda não configurado; update_profile pode criar a configuração inicial";
    return {
      content: [
        {
          type: "text" as const,
          text:
            `Perfil pessoal ${configured}. Completude=${view.profile_complete}; ` +
            `updated_at=${view.updated_at ?? "ausente"}; warnings=${warnings.join(",") || "nenhum"}. ` +
            "Consulta somente leitura: nenhuma alteração foi realizada.",
        },
      ],
      structuredContent: validated.data,
    };
  } catch {
    return mcpError("READ_FAILED");
  }
}
