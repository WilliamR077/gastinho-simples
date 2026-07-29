import { z } from "zod";
import { compactText } from "./content";
import { mcpError } from "./errors";
import { supabaseForUser } from "./supabase-client";

export const GROUP_ROLES = ["owner", "admin", "member"] as const;
export const SHARED_GROUP_WARNINGS = [
  "GROUP_INACTIVE",
  "OWNER_MEMBERSHIP_MISSING",
  "GROUP_ROLE_INCONSISTENCY",
  "DUPLICATE_MEMBERSHIP_DETECTED",
  "GROUP_CAPACITY_INCONSISTENT",
  "INVITE_CODE_NOT_AVAILABLE",
  "DATA_INCOMPLETE",
] as const;
export const SHARED_GROUP_COLLECTION_WARNINGS = [
  "NO_SHARED_GROUPS",
  "DATA_INCOMPLETE",
] as const;
export const SHARED_GROUP_MEMBER_WARNINGS = [
  "GROUP_INACTIVE",
  "OWNER_MEMBERSHIP_MISSING",
  "GROUP_ROLE_INCONSISTENCY",
  "DUPLICATE_MEMBERSHIP_DETECTED",
  "MEMBER_PROFILE_INCOMPLETE",
  "GROUP_CAPACITY_INCONSISTENT",
  "DATA_INCOMPLETE",
] as const;

const MAX_GROUPS = 100;
const MAX_MEMBERS_PER_GROUP = 100;
const MAX_MEMBERS_ACROSS_GROUPS = 10_000;

type GroupRole = (typeof GROUP_ROLES)[number];
type SharedGroupWarning = (typeof SHARED_GROUP_WARNINGS)[number];
type SharedGroupMemberWarning = (typeof SHARED_GROUP_MEMBER_WARNINGS)[number];

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_by: string;
  is_active: boolean | null;
  max_members: number | null;
  created_at: string | null;
  updated_at: string | null;
  invite_code?: string;
}

interface MembershipRow {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string | null;
}

interface ProfileRow {
  user_id: string;
  display_name: string | null;
}

export const groupRoleSchema = z.enum(GROUP_ROLES);
export const sharedGroupWarningSchema = z.enum(SHARED_GROUP_WARNINGS);
export const sharedGroupCollectionWarningSchema = z.enum(
  SHARED_GROUP_COLLECTION_WARNINGS,
);
export const sharedGroupMemberWarningSchema = z.enum(
  SHARED_GROUP_MEMBER_WARNINGS,
);

export const sharedGroupSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    color: z.string().nullable(),
    is_active: z.boolean(),
    current_user_role: groupRoleSchema.nullable(),
    current_membership_id: z.string().uuid().nullable(),
    is_owner: z.boolean(),
    can_manage: z.boolean(),
    member_count: z.number().int().nonnegative().nullable(),
    max_members: z.number().int().nullable(),
    capacity_remaining: z.number().int().nonnegative().nullable(),
    created_at: z.string().nullable(),
    updated_at: z.string().nullable(),
    invite_code: z.string().optional(),
    warnings: z.array(sharedGroupWarningSchema),
  })
  .strict();

export const publicGroupMemberSchema = z
  .object({
    membership_id: z.string().uuid(),
    display_name: z.string(),
    role: groupRoleSchema,
    is_current_user: z.boolean(),
    joined_at: z.string().nullable(),
  })
  .strict();

export const sharedGroupSummarySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    current_user_role: groupRoleSchema.nullable(),
    is_owner: z.boolean(),
    can_manage: z.boolean(),
    is_active: z.boolean(),
    member_count: z.number().int().nonnegative().nullable(),
    max_members: z.number().int().nullable(),
    capacity_remaining: z.number().int().nonnegative().nullable(),
    updated_at: z.string().nullable(),
  })
  .strict();

const listGroupsInputSchema = z
  .object({
    include_inactive: z.boolean().optional(),
    include_invite_code: z.boolean().optional(),
  })
  .strict();

const listMembersInputSchema = z
  .object({
    group_id: z.string().uuid(),
  })
  .strict();

function uniqueWarnings<T extends string>(warnings: T[]): T[] {
  return [...new Set(warnings)];
}

function validRole(value: unknown): value is GroupRole {
  return GROUP_ROLES.includes(value as GroupRole);
}

function compareMemberships(a: MembershipRow, b: MembershipRow): number {
  const joinedA = a.joined_at ?? "";
  const joinedB = b.joined_at ?? "";
  return joinedA.localeCompare(joinedB) || a.id.localeCompare(b.id);
}

function chooseCurrentMembership(
  rows: MembershipRow[],
): MembershipRow | null {
  if (rows.length === 0) return null;
  const privilege: Record<GroupRole, number> = {
    member: 0,
    admin: 1,
    owner: 2,
  };
  return [...rows].sort(
    (a, b) =>
      privilege[a.role] - privilege[b.role] ||
      compareMemberships(a, b),
  )[0];
}

function normalizeMaxMembers(
  raw: number | null,
  memberCount: number | null,
  warnings: SharedGroupWarning[] | SharedGroupMemberWarning[],
): { maxMembers: number | null; capacityRemaining: number | null } {
  if (raw === null) {
    return { maxMembers: null, capacityRemaining: null };
  }
  if (!Number.isInteger(raw)) {
    warnings.push("GROUP_CAPACITY_INCONSISTENT", "DATA_INCOMPLETE");
    return { maxMembers: null, capacityRemaining: null };
  }
  if (raw < 0) warnings.push("GROUP_CAPACITY_INCONSISTENT");
  return {
    maxMembers: raw,
    capacityRemaining:
      memberCount === null ? null : Math.max(raw - memberCount, 0),
  };
}

function inspectGroup(
  group: GroupRow,
  memberships: MembershipRow[],
  userId: string,
  includeInviteCode: boolean,
) {
  const warnings: SharedGroupWarning[] = [];
  const rowsByUser = new Map<string, MembershipRow[]>();
  for (const membership of memberships) {
    const existing = rowsByUser.get(membership.user_id) ?? [];
    existing.push(membership);
    rowsByUser.set(membership.user_id, existing);
  }
  const duplicateMembership = [...rowsByUser.values()].some(
    (rows) => rows.length > 1,
  );
  if (duplicateMembership) warnings.push("DUPLICATE_MEMBERSHIP_DETECTED");

  const currentRows = rowsByUser.get(userId) ?? [];
  const currentMembership = chooseCurrentMembership(currentRows);
  const currentRole =
    currentMembership && validRole(currentMembership.role)
      ? currentMembership.role
      : null;
  const creatorRows = rowsByUser.get(group.created_by) ?? [];
  const creatorOwnerRows = creatorRows.filter((row) => row.role === "owner");
  const ownerUserIds = new Set(
    memberships
      .filter((row) => row.role === "owner")
      .map((row) => row.user_id),
  );
  const creatorMembershipMissing =
    group.created_by === userId && currentRows.length === 0;
  if (creatorMembershipMissing) {
    warnings.push("OWNER_MEMBERSHIP_MISSING", "DATA_INCOMPLETE");
  }

  const ownershipConsistent =
    creatorOwnerRows.length === 1 &&
    ownerUserIds.size === 1 &&
    !duplicateMembership;
  if (
    !ownershipConsistent ||
    (group.created_by === userId && currentRole !== "owner") ||
    (currentRole === "owner" && group.created_by !== userId)
  ) {
    warnings.push("GROUP_ROLE_INCONSISTENCY", "DATA_INCOMPLETE");
  }

  if (group.is_active !== true) warnings.push("GROUP_INACTIVE");
  if (
    group.created_at === null ||
    group.updated_at === null ||
    group.is_active === null
  ) {
    warnings.push("DATA_INCOMPLETE");
  }

  const membershipVisible = currentRows.length > 0;
  const memberCount = membershipVisible ? rowsByUser.size : null;
  if (!membershipVisible && memberships.length > 0) {
    warnings.push("DATA_INCOMPLETE");
  }
  const capacity = normalizeMaxMembers(
    group.max_members,
    memberCount,
    warnings,
  );
  const duplicateCurrentMembership = currentRows.length > 1;
  const canManage =
    !duplicateCurrentMembership &&
    (currentRole === "owner" || currentRole === "admin");
  const isOwner =
    !duplicateCurrentMembership &&
    ownershipConsistent &&
    currentRole === "owner" &&
    group.created_by === userId;

  const publicGroup = {
    id: group.id,
    name: group.name,
    description: group.description,
    color: group.color,
    is_active: group.is_active === true,
    current_user_role: currentRole,
    current_membership_id: currentMembership?.id ?? null,
    is_owner: isOwner,
    can_manage: canManage,
    member_count: memberCount,
    max_members: capacity.maxMembers,
    capacity_remaining: capacity.capacityRemaining,
    created_at: group.created_at,
    updated_at: group.updated_at,
    warnings: uniqueWarnings(warnings),
  } as z.infer<typeof sharedGroupSchema>;

  if (includeInviteCode) {
    if (canManage && group.invite_code) {
      publicGroup.invite_code = group.invite_code;
    } else {
      publicGroup.warnings = uniqueWarnings([
        ...publicGroup.warnings,
        "INVITE_CODE_NOT_AVAILABLE",
      ]);
    }
  }
  return publicGroup;
}

function groupCapacityText(
  group: Pick<
    z.infer<typeof sharedGroupSchema>,
    "member_count" | "max_members" | "capacity_remaining"
  >,
): string {
  if (group.member_count === null) return "membros=indisponível";
  if (group.max_members === null) {
    return `membros=${group.member_count}; capacidade=sem limite configurado`;
  }
  return (
    `membros=${group.member_count}/${group.max_members}; ` +
    `vagas_calculadas=${group.capacity_remaining}`
  );
}

function groupsContent(
  result: {
    groups: z.infer<typeof sharedGroupSchema>[];
    returned_count: number;
    total_accessible_count: number;
    active_count: number;
    inactive_count: number;
    warnings: string[];
    data_complete: boolean;
    generated_at: string;
  },
  includeInactive: boolean,
  includeInviteCode: boolean,
): string {
  const lines = result.groups.map((group, index) => {
    const invite =
      includeInviteCode && group.invite_code
        ? `; invite_code=${group.invite_code}`
        : "";
    return (
      `${index + 1}. id=${group.id}; nome=${compactText(group.name, 100)}; ` +
      `ativo=${group.is_active}; papel=${group.current_user_role ?? "indisponível"}; ` +
      `membership_id=${group.current_membership_id ?? "indisponível"}; ` +
      `is_owner=${group.is_owner}; can_manage=${group.can_manage}; ` +
      `${groupCapacityText(group)}; updated_at=${group.updated_at ?? "indisponível"}` +
      `${invite}; warnings=${group.warnings.join(",") || "nenhum"}`
    );
  });
  return (
    "Consulta somente leitura; nenhum dado foi alterado. " +
    `Grupos retornados=${result.returned_count}; grupos acessíveis=${result.total_accessible_count}; ` +
    `ativos=${result.active_count}; inativos=${result.inactive_count}; ` +
    `include_inactive=${includeInactive}; include_invite_code=${includeInviteCode}; ` +
    `data_complete=${result.data_complete}; warnings=${result.warnings.join(",") || "nenhum"}; ` +
    `generated_at=${result.generated_at}.\n` +
    (lines.join("\n") || "Nenhum grupo compartilhado retornado.")
  );
}

function membersContent(result: {
  group: z.infer<typeof sharedGroupSummarySchema>;
  members: z.infer<typeof publicGroupMemberSchema>[];
  returned_count: number;
  warnings: string[];
  data_complete: boolean;
  generated_at: string;
}): string {
  const memberLines = result.members.map(
    (member, index) =>
      `${index + 1}. membership_id=${member.membership_id}; ` +
      `nome=${compactText(member.display_name, 100)}; papel=${member.role}; ` +
      `is_current_user=${member.is_current_user}; joined_at=${member.joined_at ?? "indisponível"}`,
  );
  return (
    "Consulta somente leitura; nenhum dado foi alterado. " +
    `Grupo=${compactText(result.group.name, 100)}; group_id=${result.group.id}; ` +
    `papel_atual=${result.group.current_user_role ?? "indisponível"}; ` +
    `is_owner=${result.group.is_owner}; can_manage=${result.group.can_manage}; ` +
    `ativo=${result.group.is_active}; membros=${result.group.member_count ?? "indisponível"}; ` +
    `max_members=${result.group.max_members ?? "sem limite configurado"}; ` +
    `updated_at=${result.group.updated_at ?? "indisponível"}; ` +
    `retornados=${result.returned_count}; data_complete=${result.data_complete}; ` +
    `warnings=${result.warnings.join(",") || "nenhum"}; generated_at=${result.generated_at}.\n` +
    (memberLines.join("\n") || "Nenhum membro pôde ser listado.")
  );
}

export async function listSharedGroups(
  rawInput: unknown,
  ctx: {
    isAuthenticated(): boolean;
    getUserId(): string | undefined;
    getToken(): string;
  },
) {
  const parsed = listGroupsInputSchema.safeParse(rawInput);
  if (!parsed.success) return mcpError("INVALID_INPUT");
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
  const includeInactive = parsed.data.include_inactive ?? false;
  const includeInviteCode = parsed.data.include_invite_code ?? false;

  try {
    const supabase = supabaseForUser(ctx as never);
    const groupColumns =
      "id,name,description,color,created_by,is_active,max_members,created_at,updated_at" +
      (includeInviteCode ? ",invite_code" : "");
    const { data: groupData, error: groupError } = await supabase
      .from("shared_groups")
      .select(groupColumns)
      .limit(MAX_GROUPS + 1);
    if (groupError) return mcpError("READ_FAILED");
    const groups = (groupData ?? []) as unknown as GroupRow[];
    if (groups.length > MAX_GROUPS) return mcpError("RESULT_SET_TOO_LARGE");

    const groupIds = groups.map((group) => group.id);
    let memberships: MembershipRow[] = [];
    if (groupIds.length > 0) {
      const { data, error } = await supabase
        .from("shared_group_members")
        .select("id,group_id,user_id,role,joined_at")
        .in("group_id", groupIds)
        .limit(MAX_MEMBERS_ACROSS_GROUPS + 1);
      if (error) return mcpError("READ_FAILED");
      memberships = (data ?? []) as MembershipRow[];
      if (memberships.length > MAX_MEMBERS_ACROSS_GROUPS) {
        return mcpError("RESULT_SET_TOO_LARGE");
      }
    }

    const membershipsByGroup = new Map<string, MembershipRow[]>();
    for (const membership of memberships) {
      const current = membershipsByGroup.get(membership.group_id) ?? [];
      current.push(membership);
      membershipsByGroup.set(membership.group_id, current);
    }
    const resolved = groups
      .map((group) =>
        inspectGroup(
          group,
          membershipsByGroup.get(group.id) ?? [],
          userId,
          includeInviteCode,
        ),
      )
      .sort(
        (a, b) =>
          Number(b.is_active) - Number(a.is_active) ||
          a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) ||
          a.id.localeCompare(b.id),
      );
    const returnedGroups = includeInactive
      ? resolved
      : resolved.filter((group) => group.is_active);
    const activeCount = resolved.filter((group) => group.is_active).length;
    const inactiveCount = resolved.length - activeCount;
    const collectionWarnings: Array<
      (typeof SHARED_GROUP_COLLECTION_WARNINGS)[number]
    > = [];
    if (resolved.length === 0) collectionWarnings.push("NO_SHARED_GROUPS");
    const dataComplete = resolved.every(
      (group) => !group.warnings.includes("DATA_INCOMPLETE"),
    );
    if (!dataComplete) collectionWarnings.push("DATA_INCOMPLETE");
    const result = {
      resource_type: "shared_group_collection" as const,
      groups: returnedGroups,
      returned_count: returnedGroups.length,
      total_accessible_count: resolved.length,
      active_count: activeCount,
      inactive_count: inactiveCount,
      warnings: uniqueWarnings(collectionWarnings),
      data_complete: dataComplete,
      generated_at: new Date().toISOString(),
    };
    return {
      content: [
        {
          type: "text" as const,
          text: groupsContent(
            result,
            includeInactive,
            includeInviteCode,
          ),
        },
      ],
      structuredContent: result,
    };
  } catch {
    return mcpError("READ_FAILED");
  }
}

export async function listSharedGroupMembers(
  rawInput: unknown,
  ctx: {
    isAuthenticated(): boolean;
    getUserId(): string | undefined;
    getToken(): string;
  },
) {
  const parsed = listMembersInputSchema.safeParse(rawInput);
  if (!parsed.success) return mcpError("INVALID_INPUT");
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");

  try {
    const supabase = supabaseForUser(ctx as never);
    const { data: groupData, error: groupError } = await supabase
      .from("shared_groups")
      .select(
        "id,name,description,color,created_by,is_active,max_members,created_at,updated_at",
      )
      .eq("id", parsed.data.group_id)
      .maybeSingle();
    if (groupError) return mcpError("READ_FAILED");
    if (!groupData) return mcpError("RESOURCE_NOT_FOUND");
    const group = groupData as unknown as GroupRow;

    const { data: membershipData, error: membershipError } = await supabase
      .from("shared_group_members")
      .select("id,group_id,user_id,role,joined_at")
      .eq("group_id", group.id)
      .limit(MAX_MEMBERS_PER_GROUP + 1);
    if (membershipError) return mcpError("READ_FAILED");
    const memberships = (membershipData ?? []) as MembershipRow[];
    if (memberships.length > MAX_MEMBERS_PER_GROUP) {
      return mcpError("RESULT_SET_TOO_LARGE");
    }

    const inspected = inspectGroup(
      group,
      memberships,
      userId,
      false,
    );
    const rowsByUser = new Map<string, MembershipRow[]>();
    for (const membership of memberships) {
      const current = rowsByUser.get(membership.user_id) ?? [];
      current.push(membership);
      rowsByUser.set(membership.user_id, current);
    }
    const deduplicated = [...rowsByUser.values()]
      .map((rows) => [...rows].sort(compareMemberships)[0])
      .sort(compareMemberships);
    const userIds = deduplicated.map((membership) => membership.user_id);
    let profiles: ProfileRow[] = [];
    if (userIds.length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,display_name")
        .in("user_id", userIds)
        .limit(MAX_MEMBERS_PER_GROUP);
      if (error) return mcpError("READ_FAILED");
      profiles = (data ?? []) as ProfileRow[];
    }
    const profileByUser = new Map(
      profiles.map((profile) => [profile.user_id, profile.display_name]),
    );
    const warnings: SharedGroupMemberWarning[] = inspected.warnings.filter(
      (warning): warning is SharedGroupMemberWarning =>
        SHARED_GROUP_MEMBER_WARNINGS.includes(
          warning as SharedGroupMemberWarning,
        ),
    );
    const members = deduplicated.map((membership) => {
      const displayName = profileByUser.get(membership.user_id)?.trim();
      if (!displayName) warnings.push("MEMBER_PROFILE_INCOMPLETE");
      return {
        membership_id: membership.id,
        display_name: displayName || "Membro",
        role: membership.role,
        is_current_user: membership.user_id === userId,
        joined_at: membership.joined_at,
      };
    });
    if (memberships.length !== deduplicated.length) {
      warnings.push("DUPLICATE_MEMBERSHIP_DETECTED", "DATA_INCOMPLETE");
    }
    if (
      members.some((member) => member.joined_at === null) ||
      inspected.updated_at === null
    ) {
      warnings.push("DATA_INCOMPLETE");
    }
    const finalWarnings = uniqueWarnings(warnings);
    const dataComplete = !finalWarnings.includes("DATA_INCOMPLETE");
    const result = {
      resource_type: "shared_group_member_collection" as const,
      group: {
        id: inspected.id,
        name: inspected.name,
        current_user_role: inspected.current_user_role,
        is_owner: inspected.is_owner,
        can_manage: inspected.can_manage,
        is_active: inspected.is_active,
        member_count: inspected.member_count,
        max_members: inspected.max_members,
        capacity_remaining: inspected.capacity_remaining,
        updated_at: inspected.updated_at,
      },
      members,
      returned_count: members.length,
      warnings: finalWarnings,
      data_complete: dataComplete,
      generated_at: new Date().toISOString(),
    };
    return {
      content: [
        {
          type: "text" as const,
          text: membersContent(result),
        },
      ],
      structuredContent: result,
    };
  } catch {
    return mcpError("READ_FAILED");
  }
}
