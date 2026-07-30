import { z } from "zod";
import { mcpError, type McpToolError } from "./errors";
import {
  missingProfileView,
  profileView,
  profileViewSchema,
  readOwnProfileRows,
  type ProfileContextLike,
  type ProfileRow,
  type ProfileView,
} from "./profile-read";
import { supabaseForUser } from "./supabase-client";

export const PROFILE_WRITE_WARNINGS = [
  "PROFILE_CREATED",
  "PROFILE_UPDATED",
  "DISPLAY_NAME_UPDATED",
  "NO_CHANGES_APPLIED",
] as const;
export type ProfileWriteWarning = (typeof PROFILE_WRITE_WARNINGS)[number];

function hasControl(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

export const displayNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(2)
      .max(60)
      .refine((value) => !hasControl(value), "Nome contém caractere de controle."),
  );

export const profileChangesSchema = z
  .object({ display_name: displayNameSchema })
  .strict();

export const updateProfileInputProperties = {
  changes: profileChangesSchema,
  expected_updated_at: z.string().datetime({ offset: true }).nullable().optional(),
};
const updateProfileInputSchema = z.object(updateProfileInputProperties).strict();

export const profileWriteWarningSchema = z.enum(PROFILE_WRITE_WARNINGS);
export const updateProfileOutputSchema = z
  .object({
    resource_type: z.literal("user_profile"),
    applied: z.boolean(),
    created: z.boolean(),
    no_op: z.boolean(),
    before: profileViewSchema,
    after: profileViewSchema,
    changed_fields: z.array(z.literal("display_name")),
    operation_completed_at: z.string().datetime(),
    warnings: z.array(profileWriteWarningSchema),
    data_complete: z.literal(true),
  })
  .strict();

function concurrent(message: string): McpToolError {
  return mcpError(
    "CONCURRENT_MODIFICATION",
    `${message} Releia o perfil com get_profile antes de tentar novamente; nada foi alterado.`,
  );
}

function versionMissing(): McpToolError {
  return mcpError(
    "PROFILE_VERSION_MISSING",
    "O perfil existente não possui uma versão updated_at utilizável. Nada foi alterado; a inconsistência requer correção administrativa futura.",
  );
}

function resultContent(result: {
  applied: boolean;
  created: boolean;
  no_op: boolean;
  before: ProfileView;
  after: ProfileView;
  warnings: ProfileWriteWarning[];
}): string {
  if (result.created) {
    return (
      `Perfil público criado; nome de exibição=${JSON.stringify(result.after.display_name)}; ` +
      `updated_at=${result.after.updated_at}; warnings=${result.warnings.join(",")}. ` +
      "Somente public.profiles foi alterada; Auth, e-mail e credenciais permaneceram intactos."
    );
  }
  if (result.no_op) {
    return (
      `Nenhum valor mudou; nome de exibição=${JSON.stringify(result.after.display_name)}; ` +
      `updated_at permaneceu ${result.after.updated_at}; warnings=${result.warnings.join(",")}. ` +
      "Nenhuma escrita foi executada e Auth permaneceu intacto."
    );
  }
  return (
    `Perfil público atualizado; nome anterior=${JSON.stringify(result.before.display_name)}; ` +
    `novo nome=${JSON.stringify(result.after.display_name)}; updated_at=${result.after.updated_at}; ` +
    `warnings=${result.warnings.join(",")}. Somente display_name em public.profiles foi alterado; ` +
    "Auth, e-mail e credenciais permaneceram intactos."
  );
}

function toolResult(
  applied: boolean,
  created: boolean,
  noOp: boolean,
  before: ProfileView,
  after: ProfileView,
  changedFields: Array<"display_name">,
  warnings: ProfileWriteWarning[],
) {
  const result = {
    resource_type: "user_profile" as const,
    applied,
    created,
    no_op: noOp,
    before,
    after,
    changed_fields: changedFields,
    operation_completed_at: new Date().toISOString(),
    warnings,
    data_complete: true as const,
  };
  const validated = updateProfileOutputSchema.safeParse(result);
  if (!validated.success) return mcpError("INVALID_DATA");
  return {
    content: [{ type: "text" as const, text: resultContent(result) }],
    structuredContent: validated.data,
  };
}

async function latestOwnProfile(
  ctx: ProfileContextLike,
): Promise<ProfileRow | null | McpToolError> {
  const rows = await readOwnProfileRows(ctx);
  if ("isError" in rows) return rows;
  return rows[0] ?? null;
}

export async function updateProfile(rawInput: unknown, ctx: ProfileContextLike) {
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
  const parsed = updateProfileInputSchema.safeParse(rawInput);
  if (!parsed.success) return mcpError("INVALID_INPUT");
  const input = parsed.data;

  try {
    const current = await latestOwnProfile(ctx);
    if (current && "isError" in current) return current;
    const supabase = supabaseForUser(ctx as never);

    if (!current) {
      if (input.expected_updated_at !== undefined && input.expected_updated_at !== null) {
        return concurrent(
          "O perfil ainda não existe, mas foi fornecida uma versão de um estado anterior.",
        );
      }
      const confirmed = await latestOwnProfile(ctx);
      if (confirmed && "isError" in confirmed) return confirmed;
      if (confirmed) return concurrent("O perfil foi configurado simultaneamente.");
      const insertResult = await supabase
        .from("profiles")
        .insert({ user_id: userId, display_name: input.changes.display_name })
        .select("display_name,created_at,updated_at")
        .maybeSingle();
      if (insertResult.error || !insertResult.data) {
        const latest = await latestOwnProfile(ctx);
        if (latest && "isError" in latest) return latest;
        if (latest) return concurrent("O perfil foi criado simultaneamente.");
        return mcpError(
          "WRITE_FAILED",
          "Não foi possível criar o perfil público com segurança. Nada foi sobrescrito.",
        );
      }
      const after = profileView(insertResult.data as unknown as ProfileRow);
      if (!after.created_at || !after.updated_at) {
        return mcpError("PROFILE_DATA_INCOMPLETE");
      }
      return toolResult(
        true,
        true,
        false,
        missingProfileView(),
        after,
        ["display_name"],
        ["PROFILE_CREATED", "DISPLAY_NAME_UPDATED"],
      );
    }

    if (!current.updated_at) return versionMissing();
    if (!input.expected_updated_at) {
      return mcpError(
        "EXPECTED_VERSION_REQUIRED",
        "Perfis existentes exigem expected_updated_at obtido em get_profile. Nada foi alterado.",
      );
    }
    if (current.updated_at !== input.expected_updated_at) {
      return concurrent("O perfil mudou desde a leitura.");
    }
    const before = profileView(current);
    if (before.display_name === input.changes.display_name) {
      return toolResult(
        false,
        false,
        true,
        before,
        before,
        [],
        ["NO_CHANGES_APPLIED"],
      );
    }

    const updateResult = await supabase
      .from("profiles")
      .update({ display_name: input.changes.display_name })
      .eq("user_id", userId)
      .eq("updated_at", input.expected_updated_at)
      .select("display_name,created_at,updated_at")
      .maybeSingle();
    if (updateResult.error) return mcpError("WRITE_FAILED");
    if (!updateResult.data) {
      const latest = await latestOwnProfile(ctx);
      if (latest && "isError" in latest) return latest;
      if (!latest || latest.updated_at !== input.expected_updated_at) {
        return concurrent("O perfil mudou ou deixou de estar acessível durante a atualização.");
      }
      return mcpError(
        "WRITE_FAILED",
        "Não foi possível concluir a atualização segura. Nada foi alterado.",
      );
    }
    const after = profileView(updateResult.data as unknown as ProfileRow);
    if (!after.created_at || !after.updated_at) {
      return mcpError("PROFILE_DATA_INCOMPLETE");
    }
    return toolResult(
      true,
      false,
      false,
      before,
      after,
      ["display_name"],
      ["PROFILE_UPDATED", "DISPLAY_NAME_UPDATED"],
    );
  } catch {
    return mcpError("WRITE_FAILED");
  }
}
