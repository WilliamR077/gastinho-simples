import { z } from "zod";
import { compactText } from "./content";
import { mcpError, type McpToolError } from "./errors";
import { expectedUpdatedAtSchema } from "./transaction-update";
import { supabaseForUser } from "./supabase-client";

export const SHARED_GROUP_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
] as const;
export const SHARED_GROUP_EDITABLE_FIELDS = [
  "name",
  "description",
  "color",
] as const;
export const SHARED_GROUP_WRITE_WARNINGS = [
  "GROUP_UPDATED",
  "GROUP_NAME_UPDATED",
  "GROUP_DESCRIPTION_UPDATED",
  "GROUP_COLOR_UPDATED",
  "NO_CHANGES_APPLIED",
] as const;

type GroupRole = "owner" | "admin" | "member";
type EditableField = (typeof SHARED_GROUP_EDITABLE_FIELDS)[number];
export type SharedGroupWriteWarning =
  (typeof SHARED_GROUP_WRITE_WARNINGS)[number];

interface ToolContextLike {
  isAuthenticated(): boolean;
  getUserId(): string | undefined;
  getToken(): string;
}

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_by: string;
  invite_code: string;
  max_members: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface MembershipRow {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string | null;
}

interface AuthorizedGroup {
  row: GroupRow;
  role: "owner" | "admin";
}

const HTML_DELIMITERS = /[<>]/u;
const MAX_MEMBERSHIP_ROWS = 100;

function normalizeName(value: string): string {
  return value.trim();
}

function normalizeDescription(value: string): string {
  return value.replace(/\r\n?/gu, "\n").trim();
}

function hasAnyControl(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function hasDangerousTextareaControl(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (
      code <= 8 ||
      code === 11 ||
      code === 12 ||
      (code >= 14 && code <= 31) ||
      code === 127
    );
  });
}

export const sharedGroupNameSchema = z
  .string()
  .transform(normalizeName)
  .pipe(
    z
      .string()
      .min(1)
      .max(50)
      .refine((value) => !hasAnyControl(value), "Nome contém controle.")
      .refine((value) => !HTML_DELIMITERS.test(value), "Nome contém marcação."),
  );

export const sharedGroupDescriptionSchema = z.union([
  z.null(),
  z
    .string()
    .transform(normalizeDescription)
    .pipe(
      z
        .string()
        .min(1)
        .max(200)
        .refine(
          (value) => !hasDangerousTextareaControl(value),
          "Descrição contém controle.",
        )
        .refine(
          (value) => !HTML_DELIMITERS.test(value),
          "Descrição contém marcação.",
        ),
    ),
]);

export const sharedGroupColorSchema = z
  .string()
  .transform((value) => value.toLowerCase())
  .pipe(z.enum(SHARED_GROUP_COLORS));

export const sharedGroupChangesSchema = z
  .object({
    name: sharedGroupNameSchema.optional(),
    description: sharedGroupDescriptionSchema.optional(),
    color: sharedGroupColorSchema.optional(),
  })
  .strict()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: "Informe pelo menos uma alteração.",
  });

export const updateSharedGroupInputProperties = {
  group_id: z.string().uuid(),
  expected_updated_at: expectedUpdatedAtSchema,
  changes: sharedGroupChangesSchema,
};
const updateSharedGroupInputSchema = z
  .object(updateSharedGroupInputProperties)
  .strict();

export const sharedGroupWriteViewSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    color: z.string().nullable(),
    is_active: z.boolean(),
    max_members: z.number().int().nullable(),
    created_at: z.string().nullable(),
    updated_at: z.string(),
  })
  .strict();
export type SharedGroupWriteView = z.infer<typeof sharedGroupWriteViewSchema>;

export const sharedGroupWriteWarningSchema = z.enum(
  SHARED_GROUP_WRITE_WARNINGS,
);

function writeView(row: GroupRow): SharedGroupWriteView | null {
  const candidate = {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    is_active: row.is_active === true,
    max_members: row.max_members,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  const parsed = sharedGroupWriteViewSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function groupIncomplete(): McpToolError {
  return mcpError(
    "GROUP_DATA_INCOMPLETE",
    "Os dados de associação não permitem confirmar a autorização. Nada foi alterado; o grupo precisa de correção administrativa futura.",
  );
}

function groupInactive(): McpToolError {
  return mcpError(
    "GROUP_INACTIVE",
    "O grupo está inativo e seus metadados não podem ser editados nesta fase. Nada foi alterado; esta operação não reativa grupos.",
  );
}

function permissionDenied(): McpToolError {
  return mcpError(
    "FORBIDDEN",
    "A associação atual não possui permissão para editar este grupo. Nada foi alterado.",
  );
}

async function authorizeGroup(
  groupId: string,
  userId: string,
  ctx: ToolContextLike,
): Promise<AuthorizedGroup | McpToolError> {
  const supabase = supabaseForUser(ctx as never);
  const groupResult = await supabase
    .from("shared_groups")
    .select(
      "id,name,description,color,created_by,invite_code,max_members,is_active,created_at,updated_at",
    )
    .eq("id", groupId)
    .maybeSingle();
  if (groupResult.error) return mcpError("READ_FAILED");
  if (!groupResult.data) return mcpError("RESOURCE_NOT_FOUND");
  const row = groupResult.data as unknown as GroupRow;

  const memberResult = await supabase
    .from("shared_group_members")
    .select("id,group_id,user_id,role,joined_at")
    .eq("group_id", groupId)
    .limit(MAX_MEMBERSHIP_ROWS + 1);
  if (memberResult.error) return mcpError("READ_FAILED");
  const memberships = (memberResult.data ?? []) as MembershipRow[];
  if (memberships.length > MAX_MEMBERSHIP_ROWS) return groupIncomplete();

  const byUser = new Map<string, MembershipRow[]>();
  for (const membership of memberships) {
    const rows = byUser.get(membership.user_id) ?? [];
    rows.push(membership);
    byUser.set(membership.user_id, rows);
  }
  const currentRows = byUser.get(userId) ?? [];
  const duplicateMembership = [...byUser.values()].some(
    (rows) => rows.length !== 1,
  );
  const ownerRows = memberships.filter(
    (membership) => membership.role === "owner",
  );
  const rolesValid = memberships.every((membership) =>
    ["owner", "admin", "member"].includes(membership.role),
  );
  const structurallyConsistent =
    !duplicateMembership &&
    rolesValid &&
    currentRows.length === 1 &&
    ownerRows.length === 1 &&
    ownerRows[0].user_id === row.created_by &&
    byUser.has(row.created_by) &&
    row.updated_at !== null &&
    row.is_active !== null;
  if (!structurallyConsistent) return groupIncomplete();
  if (row.is_active !== true) return groupInactive();

  const role = currentRows[0].role as GroupRole;
  if (role !== "owner" && role !== "admin") return permissionDenied();
  return { row, role };
}

function updateContent(result: {
  id: string;
  applied: boolean;
  no_op: boolean;
  before: SharedGroupWriteView;
  after: SharedGroupWriteView;
  changed_fields: EditableField[];
  current_user_role: "owner" | "admin";
  warnings: SharedGroupWriteWarning[];
}): string {
  const changes = result.changed_fields.map(
    (field) =>
      `${field}: ${JSON.stringify(result.before[field])} -> ` +
      `${JSON.stringify(result.after[field])}`,
  );
  const outcome = result.applied
    ? `atualizado; campos=${changes.join("; ")}`
    : "não alterado; nenhum valor mudou e nenhuma escrita foi executada";
  return (
    `Grupo ${compactText(result.after.name, 50)} (${result.id}) ${outcome}. ` +
    `Papel atual=${result.current_user_role}; can_manage=true; no_op=${result.no_op}; ` +
    `updated_at=${result.before.updated_at} -> ${result.after.updated_at}; ` +
    `warnings=${result.warnings.join(",") || "nenhum"}. ` +
    "Membros, papéis, convite, capacidade, status, dados financeiros, recorrências, metas e rateios não foram alterados."
  );
}

function changedWarnings(
  fields: EditableField[],
): SharedGroupWriteWarning[] {
  const warnings: SharedGroupWriteWarning[] = ["GROUP_UPDATED"];
  if (fields.includes("name")) warnings.push("GROUP_NAME_UPDATED");
  if (fields.includes("description")) {
    warnings.push("GROUP_DESCRIPTION_UPDATED");
  }
  if (fields.includes("color")) warnings.push("GROUP_COLOR_UPDATED");
  return warnings;
}

export async function updateSharedGroup(
  rawInput: unknown,
  ctx: ToolContextLike,
) {
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
  const parsed = updateSharedGroupInputSchema.safeParse(rawInput);
  if (!parsed.success) return mcpError("INVALID_INPUT");
  const input = parsed.data;

  try {
    const authorized = await authorizeGroup(
      input.group_id,
      userId,
      ctx,
    );
    if ("isError" in authorized) return authorized;
    const current = authorized.row;
    if (current.updated_at !== input.expected_updated_at) {
      return mcpError(
        "CONCURRENT_MODIFICATION",
        "O grupo mudou desde a leitura. Releia-o com list_shared_groups antes de tentar novamente; nada foi alterado.",
      );
    }
    const before = writeView(current);
    if (!before) return groupIncomplete();

    const finalValues = {
      name: input.changes.name ?? current.name,
      description:
        input.changes.description !== undefined
          ? input.changes.description
          : current.description,
      color: input.changes.color ?? current.color,
    };
    const patch: Partial<Record<EditableField, string | null>> = {};
    const changedFields: EditableField[] = [];
    for (const field of SHARED_GROUP_EDITABLE_FIELDS) {
      if (finalValues[field] !== current[field]) {
        patch[field] = finalValues[field];
        changedFields.push(field);
      }
    }

    if (changedFields.length === 0) {
      const result = {
        resource_type: "shared_group" as const,
        id: before.id,
        applied: false,
        no_op: true,
        before,
        after: before,
        changed_fields: changedFields,
        current_user_role: authorized.role,
        can_manage: true as const,
        operation_completed_at: new Date().toISOString(),
        warnings: ["NO_CHANGES_APPLIED"] as SharedGroupWriteWarning[],
        data_complete: true as const,
      };
      return {
        content: [{ type: "text" as const, text: updateContent(result) }],
        structuredContent: result,
      };
    }

    const supabase = supabaseForUser(ctx as never);
    const updateResult = await supabase
      .from("shared_groups")
      .update(patch)
      .eq("id", input.group_id)
      .eq("updated_at", input.expected_updated_at)
      .eq("is_active", true)
      .select(
        "id,name,description,color,created_by,invite_code,max_members,is_active,created_at,updated_at",
      )
      .maybeSingle();
    if (updateResult.error) return mcpError("WRITE_FAILED");
    if (!updateResult.data) {
      const latest = await authorizeGroup(input.group_id, userId, ctx);
      if ("isError" in latest) return latest;
      if (latest.row.updated_at !== input.expected_updated_at) {
        return mcpError(
          "CONCURRENT_MODIFICATION",
          "O grupo mudou durante a atualização. Releia-o com list_shared_groups antes de tentar novamente; nada foi alterado.",
        );
      }
      return mcpError(
        "WRITE_FAILED",
        "Não foi possível concluir a atualização segura. Nada foi alterado.",
      );
    }
    const updated = updateResult.data as unknown as GroupRow;
    const after = writeView(updated);
    if (!after) return groupIncomplete();
    const protectedFieldsPreserved =
      updated.created_by === current.created_by &&
      updated.invite_code === current.invite_code &&
      updated.max_members === current.max_members &&
      updated.is_active === current.is_active &&
      updated.created_at === current.created_at;
    if (!protectedFieldsPreserved) {
      return mcpError(
        "WRITE_FAILED",
        "A resposta da atualização não confirmou a preservação dos campos protegidos.",
      );
    }
    const result = {
      resource_type: "shared_group" as const,
      id: after.id,
      applied: true,
      no_op: false,
      before,
      after,
      changed_fields: changedFields,
      current_user_role: authorized.role,
      can_manage: true as const,
      operation_completed_at: new Date().toISOString(),
      warnings: changedWarnings(changedFields),
      data_complete: true as const,
    };
    return {
      content: [{ type: "text" as const, text: updateContent(result) }],
      structuredContent: result,
    };
  } catch {
    return mcpError("WRITE_FAILED");
  }
}
