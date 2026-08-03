import { z } from "zod";
import { currentMonthRange, isValidIsoDate } from "./dates";
import { mcpError, type McpToolError } from "./errors";
import { inclusiveDays } from "./phase-1.1b-core";
import { supabaseForUser } from "./supabase-client";

export const GROUP_ANALYSIS_MAX_DAYS = 366;
export const GROUP_ANALYSIS_MAX_EXPENSES = 1_000;
export const GROUP_ANALYSIS_MAX_SPLITS = 5_000;
export const GROUP_ANALYSIS_MAX_MEMBERS = 100;
export const GROUP_ANALYSIS_MAX_TRANSFERS = 100;

const GROUP_ROLES = ["owner", "admin", "member"] as const;
const SPLIT_TYPES = ["equal", "percentage", "manual"] as const;
const SPLIT_TYPE_OUTPUTS = [...SPLIT_TYPES, "unknown"] as const;
const ALLOCATION_STATUSES = [
  "balanced",
  "under_allocated",
  "over_allocated",
  "no_split_rows",
  "inconsistent",
] as const;
const SETTLEMENT_STATUSES = [
  "settled",
  "transfers_suggested",
  "incomplete_data",
  "unbalanced_source_data",
  "no_shared_expenses",
] as const;
export const GROUP_SPLIT_WARNINGS = [
  "NO_SHARED_EXPENSES",
  "SPLIT_DETAILS_MISSING",
  "SPLIT_UNDER_ALLOCATED",
  "SPLIT_OVER_ALLOCATED",
  "SPLIT_PERCENTAGE_INVALID",
  "SPLIT_AMOUNT_INVALID",
  "PAYER_UNRESOLVED",
  "MEMBER_PROFILE_INCOMPLETE",
  "HISTORICAL_MEMBER_UNRESOLVED",
  "GROUP_INACTIVE",
  "OWNER_MEMBERSHIP_MISSING",
  "GROUP_ROLE_INCONSISTENCY",
  "DATA_INCOMPLETE",
  "SETTLEMENT_NOT_BALANCED",
  "RESIDUAL_AMOUNT_REMAINS",
] as const;

type GroupRole = (typeof GROUP_ROLES)[number];
type SplitType = (typeof SPLIT_TYPES)[number];
type Warning = (typeof GROUP_SPLIT_WARNINGS)[number];

interface ToolContextLike {
  isAuthenticated(): boolean;
  getUserId(): string | undefined;
  getToken(): string;
}

interface GroupRow {
  id: string;
  name: string;
  created_by: string;
  is_active: boolean | null;
  updated_at: string | null;
}

interface MembershipRow {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string | null;
}

interface ProfileRow {
  user_id: string;
  display_name: string | null;
}

interface ExpenseRow {
  id: string;
  user_id: string;
  description: string;
  amount: number | string;
  expense_date: string;
  shared_group_id: string | null;
  is_shared: boolean;
  paid_by: string | null;
  split_type: string | null;
  installment_number: number | null;
  total_installments: number | null;
  updated_at: string;
}

interface SplitRow {
  id: string;
  expense_id: string;
  user_id: string;
  share_amount: number | string;
  share_percentage: number | string | null;
  created_at: string | null;
}

interface ResolvedIdentity {
  internal_key: string;
  membership_id: string | null;
  display_name: string;
  role: GroupRole | null;
  is_current_user: boolean;
  historical: boolean;
  profile_complete: boolean;
}

interface LoadedGroup {
  group: GroupRow;
  memberships: MembershipRow[];
  identities: Map<string, ResolvedIdentity>;
  currentMembership: MembershipRow;
  warnings: Warning[];
  dataComplete: boolean;
}

interface AnalysisMember {
  internal_key: string;
  membership_id: string | null;
  display_name: string;
  role: GroupRole | null;
  is_current_user: boolean;
  paid_cents: number;
  allocated_cents: number;
  expense_count_paid: number;
  split_count: number;
  warnings: Warning[];
}

interface GroupAnalysis {
  loaded: LoadedGroup;
  period: { date_from: string; date_to: string; days: number; time_zone: string };
  members: AnalysisMember[];
  totalExpenseCents: number;
  totalAllocatedCents: number;
  totalUnallocatedCents: number;
  expenseCount: number;
  splitExpenseCount: number;
  incompleteExpenseCount: number;
  warnings: Warning[];
  dataComplete: boolean;
}

export const groupSplitWarningSchema = z.enum(GROUP_SPLIT_WARNINGS);
export const groupAnalysisPeriodSchema = z
  .object({
    date_from: z.string(),
    date_to: z.string(),
    days: z.number().int().positive(),
    time_zone: z.literal("America/Sao_Paulo"),
  })
  .strict();
export const groupAnalysisGroupSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    is_active: z.boolean(),
    current_user_role: z.enum(GROUP_ROLES),
    updated_at: z.string().nullable(),
  })
  .strict();
export const expenseSplitParticipantSchema = z
  .object({
    membership_id: z.string().uuid().nullable(),
    display_name: z.string(),
    is_current_user: z.boolean(),
    allocated_amount: z.number(),
    percentage: z.number().nullable(),
    allocation_source: z.literal("persisted_split"),
  })
  .strict();
export const expenseSplitDetailsExpenseSchema = z
  .object({
    id: z.string().uuid(),
    description: z.string(),
    amount: z.number(),
    expense_date: z.string(),
    split_type: z.enum(SPLIT_TYPE_OUTPUTS),
    group_id: z.string().uuid(),
    group_name: z.string(),
    paid_by_membership_id: z.string().uuid().nullable(),
    paid_by_display_name: z.string(),
    installment_number: z.number().int().nullable(),
    total_installments: z.number().int().nullable(),
    updated_at: z.string(),
  })
  .strict();
export const groupMemberSummaryItemSchema = z
  .object({
    membership_id: z.string().uuid().nullable(),
    display_name: z.string(),
    role: z.enum(GROUP_ROLES).nullable(),
    is_current_user: z.boolean(),
    paid_amount: z.number(),
    allocated_amount: z.number(),
    net_balance: z.number(),
    expense_count_paid: z.number().int().nonnegative(),
    split_count: z.number().int().nonnegative(),
    warnings: z.array(groupSplitWarningSchema),
  })
  .strict();
export const settlementTransferSchema = z
  .object({
    from_membership_id: z.string().uuid(),
    from_display_name: z.string(),
    to_membership_id: z.string().uuid(),
    to_display_name: z.string(),
    amount: z.number().positive(),
  })
  .strict();
export const allocationStatusSchema = z.enum(ALLOCATION_STATUSES);
export const settlementStatusSchema = z.enum(SETTLEMENT_STATUSES);

const expenseDetailsInputSchema = z.object({ expense_id: z.string().uuid() }).strict();
const groupAnalysisInputSchema = z
  .object({
    group_id: z.string().uuid(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
  })
  .strict();

function uniqueWarnings(warnings: Warning[]): Warning[] {
  return [...new Set(warnings)];
}

function isRole(value: string): value is GroupRole {
  return GROUP_ROLES.includes(value as GroupRole);
}

function isSplitType(value: string | null): value is SplitType {
  return value !== null && SPLIT_TYPES.includes(value as SplitType);
}

function decimalToScaledInteger(
  value: number | string,
  scale: number,
): number | null {
  const raw = String(value).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) return null;
  const fraction = match[3] ?? "";
  if (fraction.length > scale) return null;
  const factor = 10 ** scale;
  const whole = Number(match[2]);
  const fractional = Number(fraction.padEnd(scale, "0") || "0");
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(fractional)) return null;
  const absolute = whole * factor + fractional;
  if (!Number.isSafeInteger(absolute)) return null;
  return match[1] === "-" ? -absolute : absolute;
}

export function moneyToCents(value: number | string): number | null {
  return decimalToScaledInteger(value, 2);
}

export function centsToMoney(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function percentageToUnits(value: number | string): number | null {
  return decimalToScaledInteger(value, 4);
}

function resolvePeriod(
  dateFrom?: string,
  dateTo?: string,
):
  | { ok: true; period: GroupAnalysis["period"] }
  | { ok: false; error: McpToolError } {
  if (
    (dateFrom !== undefined && !isValidIsoDate(dateFrom)) ||
    (dateTo !== undefined && !isValidIsoDate(dateTo))
  ) {
    return { ok: false, error: mcpError("INVALID_INPUT") };
  }
  const defaults = currentMonthRange();
  const from = dateFrom ?? defaults.from;
  const to = dateTo ?? defaults.to;
  if (from > to) return { ok: false, error: mcpError("INVALID_DATE_RANGE") };
  const days = inclusiveDays(from, to);
  if (days > GROUP_ANALYSIS_MAX_DAYS) {
    return { ok: false, error: mcpError("RESULT_SET_TOO_LARGE") };
  }
  return {
    ok: true,
    period: {
      date_from: from,
      date_to: to,
      days,
      time_zone: "America/Sao_Paulo",
    },
  };
}

function membershipOrder(left: MembershipRow, right: MembershipRow): number {
  return (
    (left.joined_at ?? "").localeCompare(right.joined_at ?? "") ||
    left.id.localeCompare(right.id)
  );
}

async function loadGroup(
  groupId: string,
  userId: string,
  ctx: ToolContextLike,
): Promise<LoadedGroup | McpToolError> {
  const supabase = supabaseForUser(ctx as never);
  const { data: rawGroup, error: groupError } = await supabase
    .from("shared_groups")
    .select("id,name,created_by,is_active,updated_at")
    .eq("id", groupId)
    .maybeSingle();
  if (groupError) return mcpError("READ_FAILED");
  if (!rawGroup) return mcpError("RESOURCE_NOT_FOUND");
  const group = rawGroup as unknown as GroupRow;

  const { data: rawMemberships, error: memberError } = await supabase
    .from("shared_group_members")
    .select("id,group_id,user_id,role,joined_at")
    .eq("group_id", groupId)
    .limit(GROUP_ANALYSIS_MAX_MEMBERS + 1);
  if (memberError) return mcpError("READ_FAILED");
  const memberships = (rawMemberships ?? []) as MembershipRow[];
  if (memberships.length > GROUP_ANALYSIS_MAX_MEMBERS) {
    return mcpError("RESULT_SET_TOO_LARGE");
  }

  const warnings: Warning[] = [];
  const byUser = new Map<string, MembershipRow[]>();
  for (const membership of memberships) {
    const rows = byUser.get(membership.user_id) ?? [];
    rows.push(membership);
    byUser.set(membership.user_id, rows);
  }
  const duplicateMembership = [...byUser.values()].some((rows) => rows.length !== 1);
  const currentRows = byUser.get(userId) ?? [];
  if (currentRows.length !== 1 || !isRole(currentRows[0]?.role ?? "")) {
    warnings.push("OWNER_MEMBERSHIP_MISSING", "GROUP_ROLE_INCONSISTENCY", "DATA_INCOMPLETE");
    return mcpError(
      "GROUP_DATA_INCOMPLETE",
      "Os dados de associação do grupo não permitem confirmar a identidade atual com segurança.",
    );
  }
  const currentMembership = currentRows[0];
  const ownerRows = memberships.filter((membership) => membership.role === "owner");
  const ownershipConsistent =
    ownerRows.length === 1 && ownerRows[0].user_id === group.created_by;
  if (!ownershipConsistent || duplicateMembership) {
    warnings.push("GROUP_ROLE_INCONSISTENCY", "DATA_INCOMPLETE");
  }
  if (!byUser.has(group.created_by)) {
    warnings.push("OWNER_MEMBERSHIP_MISSING", "DATA_INCOMPLETE");
  }
  if (group.is_active !== true) warnings.push("GROUP_INACTIVE");
  if (group.updated_at === null || group.is_active === null) warnings.push("DATA_INCOMPLETE");

  const userIds = [...byUser.keys()];
  let profiles: ProfileRow[] = [];
  if (userIds.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,display_name")
      .in("user_id", userIds)
      .limit(GROUP_ANALYSIS_MAX_MEMBERS);
    if (error) return mcpError("READ_FAILED");
    profiles = (data ?? []) as ProfileRow[];
  }
  const names = new Map(profiles.map((profile) => [profile.user_id, profile.display_name]));
  const identities = new Map<string, ResolvedIdentity>();
  for (const [memberUserId, rows] of byUser) {
    const membership = [...rows].sort(membershipOrder)[0];
    const displayName = names.get(memberUserId)?.trim();
    if (!displayName) warnings.push("MEMBER_PROFILE_INCOMPLETE", "DATA_INCOMPLETE");
    identities.set(memberUserId, {
      internal_key: memberUserId,
      membership_id: membership.id,
      display_name: displayName || "Membro",
      role: isRole(membership.role) ? membership.role : null,
      is_current_user: memberUserId === userId,
      historical: false,
      profile_complete: Boolean(displayName),
    });
  }

  return {
    group,
    memberships,
    identities,
    currentMembership,
    warnings: uniqueWarnings(warnings),
    dataComplete: !warnings.includes("DATA_INCOMPLETE"),
  };
}

function historicalIdentity(
  internalKey: string,
  currentUserId: string,
): ResolvedIdentity {
  return {
    internal_key: internalKey,
    membership_id: null,
    display_name: "Membro anterior",
    role: null,
    is_current_user: internalKey === currentUserId,
    historical: true,
    profile_complete: false,
  };
}

function memberFor(
  map: Map<string, AnalysisMember>,
  identity: ResolvedIdentity,
): AnalysisMember {
  const existing = map.get(identity.internal_key);
  if (existing) return existing;
  const warnings: Warning[] = [];
  if (identity.historical) warnings.push("HISTORICAL_MEMBER_UNRESOLVED", "DATA_INCOMPLETE");
  if (!identity.profile_complete && !identity.historical) {
    warnings.push("MEMBER_PROFILE_INCOMPLETE", "DATA_INCOMPLETE");
  }
  const created: AnalysisMember = {
    internal_key: identity.internal_key,
    membership_id: identity.membership_id,
    display_name: identity.display_name,
    role: identity.role,
    is_current_user: identity.is_current_user,
    paid_cents: 0,
    allocated_cents: 0,
    expense_count_paid: 0,
    split_count: 0,
    warnings,
  };
  map.set(identity.internal_key, created);
  return created;
}

function allocationFacts(expense: ExpenseRow, splits: SplitRow[]) {
  const warnings: Warning[] = [];
  const expenseCents = moneyToCents(expense.amount);
  const parsedSplits = splits.map((split) => ({
    split,
    cents: moneyToCents(split.share_amount),
  }));
  if (
    expenseCents === null ||
    expenseCents < 0 ||
    parsedSplits.some((item) => item.cents === null || (item.cents ?? 0) < 0)
  ) {
    warnings.push("SPLIT_AMOUNT_INVALID", "DATA_INCOMPLETE");
  }
  const allocatedCents = parsedSplits.reduce(
    (total, item) => total + Math.max(item.cents ?? 0, 0),
    0,
  );
  const amountCents = Math.max(expenseCents ?? 0, 0);
  let status: (typeof ALLOCATION_STATUSES)[number];
  if (splits.length === 0) {
    status = "no_split_rows";
    warnings.push("SPLIT_DETAILS_MISSING", "DATA_INCOMPLETE");
  } else if (!isSplitType(expense.split_type)) {
    status = "inconsistent";
    warnings.push("DATA_INCOMPLETE");
  } else if (allocatedCents < amountCents) {
    status = "under_allocated";
    warnings.push("SPLIT_UNDER_ALLOCATED", "DATA_INCOMPLETE");
  } else if (allocatedCents > amountCents) {
    status = "over_allocated";
    warnings.push("SPLIT_OVER_ALLOCATED", "DATA_INCOMPLETE");
  } else {
    status = "balanced";
  }

  if (expense.split_type === "percentage") {
    const percentages = splits.map((split) =>
      split.share_percentage === null
        ? null
        : percentageToUnits(split.share_percentage),
    );
    const invalid =
      percentages.some((percentage) => percentage === null || percentage < 0 || percentage > 1_000_000) ||
      percentages.reduce((total, percentage) => total + (percentage ?? 0), 0) !==
        1_000_000;
    if (invalid) {
      warnings.push("SPLIT_PERCENTAGE_INVALID", "DATA_INCOMPLETE");
      status = "inconsistent";
    }
  }
  return {
    expenseCents: amountCents,
    allocatedCents,
    unallocatedCents: Math.max(amountCents - allocatedCents, 0),
    differenceCents: allocatedCents - amountCents,
    status,
    parsedSplits,
    warnings: uniqueWarnings(warnings),
  };
}

async function loadGroupAnalysis(
  input: z.infer<typeof groupAnalysisInputSchema>,
  ctx: ToolContextLike,
  userId: string,
): Promise<GroupAnalysis | McpToolError> {
  const periodResult = resolvePeriod(input.date_from, input.date_to);
  if (!periodResult.ok) {
    return (periodResult as Extract<typeof periodResult, { ok: false }>).error;
  }
  const loaded = await loadGroup(input.group_id, userId, ctx);
  if ("isError" in loaded) return loaded;
  const supabase = supabaseForUser(ctx as never);
  const { data: rawExpenses, error: expenseError } = await supabase
    .from("expenses")
    .select(
      "id,user_id,description,amount,expense_date,shared_group_id,is_shared,paid_by,split_type,installment_number,total_installments,updated_at",
    )
    .eq("shared_group_id", input.group_id)
    .gte("expense_date", periodResult.period.date_from)
    .lte("expense_date", periodResult.period.date_to)
    .limit(GROUP_ANALYSIS_MAX_EXPENSES + 1);
  if (expenseError) return mcpError("READ_FAILED");
  const allExpenses = (rawExpenses ?? []) as ExpenseRow[];
  if (allExpenses.length > GROUP_ANALYSIS_MAX_EXPENSES) {
    return mcpError("RESULT_SET_TOO_LARGE");
  }
  const expenses = allExpenses.filter(
    (expense) => expense.shared_group_id === input.group_id && expense.is_shared,
  );
  const expenseIds = expenses.map((expense) => expense.id);
  let splits: SplitRow[] = [];
  if (expenseIds.length > 0) {
    const { data, error } = await supabase
      .from("expense_splits")
      .select("id,expense_id,user_id,share_amount,share_percentage,created_at")
      .in("expense_id", expenseIds)
      .limit(GROUP_ANALYSIS_MAX_SPLITS + 1);
    if (error) return mcpError("READ_FAILED");
    splits = (data ?? []) as SplitRow[];
    if (splits.length > GROUP_ANALYSIS_MAX_SPLITS) {
      return mcpError("RESULT_SET_TOO_LARGE");
    }
  }
  const splitByExpense = new Map<string, SplitRow[]>();
  for (const split of splits) {
    const rows = splitByExpense.get(split.expense_id) ?? [];
    rows.push(split);
    splitByExpense.set(split.expense_id, rows);
  }

  const members = new Map<string, AnalysisMember>();
  for (const identity of loaded.identities.values()) memberFor(members, identity);
  const warnings: Warning[] = [...loaded.warnings];
  let totalExpenseCents = 0;
  let totalAllocatedCents = 0;
  let totalUnallocatedCents = 0;
  let splitExpenseCount = 0;
  let incompleteExpenseCount = 0;

  for (const expense of expenses) {
    const expenseSplits = splitByExpense.get(expense.id) ?? [];
    const facts = allocationFacts(expense, expenseSplits);
    warnings.push(...facts.warnings);
    totalExpenseCents += facts.expenseCents;
    totalAllocatedCents += facts.allocatedCents;
    totalUnallocatedCents += facts.unallocatedCents;
    if (expenseSplits.length > 0) splitExpenseCount += 1;
    if (facts.status !== "balanced") incompleteExpenseCount += 1;

    const payerKey = expense.paid_by ?? expense.user_id;
    const payerIdentity =
      loaded.identities.get(payerKey) ?? historicalIdentity(payerKey, userId);
    const payer = memberFor(members, payerIdentity);
    payer.paid_cents += facts.expenseCents;
    payer.expense_count_paid += 1;
    if (payerIdentity.historical) {
      warnings.push("PAYER_UNRESOLVED", "HISTORICAL_MEMBER_UNRESOLVED", "DATA_INCOMPLETE");
      incompleteExpenseCount += facts.status === "balanced" ? 1 : 0;
    }

    for (const parsed of facts.parsedSplits) {
      const identity =
        loaded.identities.get(parsed.split.user_id) ??
        historicalIdentity(parsed.split.user_id, userId);
      const member = memberFor(members, identity);
      member.allocated_cents += Math.max(parsed.cents ?? 0, 0);
      member.split_count += 1;
      if (identity.historical) {
        warnings.push("HISTORICAL_MEMBER_UNRESOLVED", "DATA_INCOMPLETE");
      }
    }
  }
  if (expenses.length === 0) warnings.push("NO_SHARED_EXPENSES");
  const orderedMembers = [...members.values()].sort(
    (left, right) =>
      (left.membership_id ?? `~${left.internal_key}`).localeCompare(
        right.membership_id ?? `~${right.internal_key}`,
      ),
  );
  const allWarnings = uniqueWarnings([
    ...warnings,
    ...orderedMembers.flatMap((member) => member.warnings),
  ]);
  return {
    loaded,
    period: periodResult.period,
    members: orderedMembers,
    totalExpenseCents,
    totalAllocatedCents,
    totalUnallocatedCents,
    expenseCount: expenses.length,
    splitExpenseCount,
    incompleteExpenseCount,
    warnings: allWarnings,
    dataComplete: !allWarnings.includes("DATA_INCOMPLETE"),
  };
}

function publicGroup(loaded: LoadedGroup) {
  return {
    id: loaded.group.id,
    name: loaded.group.name,
    is_active: loaded.group.is_active === true,
    current_user_role: loaded.currentMembership.role as GroupRole,
    updated_at: loaded.group.updated_at,
  };
}

function publicMember(member: AnalysisMember) {
  return {
    membership_id: member.membership_id,
    display_name: member.display_name,
    role: member.role,
    is_current_user: member.is_current_user,
    paid_amount: centsToMoney(member.paid_cents),
    allocated_amount: centsToMoney(member.allocated_cents),
    net_balance: centsToMoney(member.paid_cents - member.allocated_cents),
    expense_count_paid: member.expense_count_paid,
    split_count: member.split_count,
    warnings: uniqueWarnings(member.warnings),
  };
}

function summaryContent(result: ReturnType<typeof buildSummaryResult>): string {
  const members = result.members
    .map(
      (member, index) =>
        `${index + 1}. membership_id=${member.membership_id ?? "indisponível"}; ` +
        `nome=${member.display_name}; papel=${member.role ?? "histórico"}; ` +
        `is_current_user=${member.is_current_user}; pagou=${member.paid_amount}; ` +
        `atribuído=${member.allocated_amount}; saldo_líquido=${member.net_balance}; ` +
        `despesas_pagas=${member.expense_count_paid}; rateios=${member.split_count}`,
    )
    .join("\n");
  return (
    `Consulta somente leitura do grupo ${result.group.name} (${result.group.id}), período ` +
    `${result.period.date_from} a ${result.period.date_to}, America/Sao_Paulo. ` +
    `Despesas compartilhadas=${result.expense_count}; total=${result.total_group_expenses}; ` +
    `total_rateado=${result.total_allocated}; não_rateado=${result.total_unallocated}; ` +
    `soma_saldos=${result.net_balance_sum}; despesas_incompletas=${result.incomplete_expense_count}; ` +
    `data_complete=${result.data_complete}; warnings=${result.warnings.join(",") || "nenhum"}.\n` +
    `${members || "Nenhum membro com identidade pública disponível."}\n` +
    "Nenhuma transação, despesa, associação ou rateio foi criado ou alterado."
  );
}

function buildSummaryResult(analysis: GroupAnalysis) {
  const members = analysis.members.map(publicMember);
  const memberPaidCents = analysis.members.reduce((total, member) => total + member.paid_cents, 0);
  const memberAllocatedCents = analysis.members.reduce(
    (total, member) => total + member.allocated_cents,
    0,
  );
  return {
    resource_type: "group_member_summary" as const,
    group: publicGroup(analysis.loaded),
    period: analysis.period,
    total_group_expenses: centsToMoney(analysis.totalExpenseCents),
    total_allocated: centsToMoney(analysis.totalAllocatedCents),
    total_unallocated: centsToMoney(analysis.totalUnallocatedCents),
    member_paid_total: centsToMoney(memberPaidCents),
    member_allocated_total: centsToMoney(memberAllocatedCents),
    net_balance_sum: centsToMoney(memberPaidCents - memberAllocatedCents),
    expense_count: analysis.expenseCount,
    split_expense_count: analysis.splitExpenseCount,
    incomplete_expense_count: analysis.incompleteExpenseCount,
    members,
    warnings: analysis.warnings,
    data_complete: analysis.dataComplete,
    generated_at: new Date().toISOString(),
  };
}

export async function getGroupMemberSummary(
  rawInput: unknown,
  ctx: ToolContextLike,
) {
  const parsed = groupAnalysisInputSchema.safeParse(rawInput);
  if (!parsed.success) return mcpError("INVALID_INPUT");
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
  try {
    const analysis = await loadGroupAnalysis(parsed.data, ctx, userId);
    if ("isError" in analysis) return analysis;
    const result = buildSummaryResult(analysis);
    return {
      content: [{ type: "text" as const, text: summaryContent(result) }],
      structuredContent: result,
    };
  } catch {
    return mcpError("READ_FAILED");
  }
}

export interface SettlementBalanceInput {
  membership_id: string;
  display_name: string;
  net_cents: number;
}

export function suggestSettlementTransfers(balances: SettlementBalanceInput[]) {
  const debtors = balances
    .filter((balance) => balance.net_cents < 0)
    .map((balance) => ({ ...balance, remaining: -balance.net_cents }))
    .sort(
      (left, right) =>
        right.remaining - left.remaining ||
        left.membership_id.localeCompare(right.membership_id),
    );
  const creditors = balances
    .filter((balance) => balance.net_cents > 0)
    .map((balance) => ({ ...balance, remaining: balance.net_cents }))
    .sort(
      (left, right) =>
        right.remaining - left.remaining ||
        left.membership_id.localeCompare(right.membership_id),
    );
  const transfers: Array<{
    from_membership_id: string;
    from_display_name: string;
    to_membership_id: string;
    to_display_name: string;
    amount_cents: number;
  }> = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.remaining, creditor.remaining);
    if (amount > 0 && debtor.membership_id !== creditor.membership_id) {
      transfers.push({
        from_membership_id: debtor.membership_id,
        from_display_name: debtor.display_name,
        to_membership_id: creditor.membership_id,
        to_display_name: creditor.display_name,
        amount_cents: amount,
      });
    }
    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining === 0) debtorIndex += 1;
    if (creditor.remaining === 0) creditorIndex += 1;
  }
  const totalCreditCents = balances.reduce(
    (total, balance) => total + Math.max(balance.net_cents, 0),
    0,
  );
  const totalDebitCents = balances.reduce(
    (total, balance) => total + Math.max(-balance.net_cents, 0),
    0,
  );
  const totalTransferCents = transfers.reduce(
    (total, transfer) => total + transfer.amount_cents,
    0,
  );
  return {
    transfers,
    totalCreditCents,
    totalDebitCents,
    totalTransferCents,
    residualCents: Math.abs(totalCreditCents - totalDebitCents),
  };
}

function settlementContent(result: {
  group: ReturnType<typeof publicGroup>;
  period: GroupAnalysis["period"];
  member_balances: ReturnType<typeof publicMember>[];
  transfers: Array<z.infer<typeof settlementTransferSchema>>;
  transfer_count: number;
  total_to_transfer: number;
  residual_amount: number;
  settlement_status: (typeof SETTLEMENT_STATUSES)[number];
  warnings: Warning[];
  data_complete: boolean;
}): string {
  const balances = result.member_balances
    .map(
      (member) =>
        `${member.display_name} (${member.membership_id ?? "identidade histórica"}): ` +
        `pagou=${member.paid_amount}; atribuído=${member.allocated_amount}; saldo=${member.net_balance}`,
    )
    .join("\n");
  const transfers = result.transfers
    .map(
      (transfer, index) =>
        `${index + 1}. ${transfer.from_display_name} transfere ${transfer.amount} para ${transfer.to_display_name}`,
    )
    .join("\n");
  return (
    `Sugestões matemáticas de acerto para ${result.group.name}, período ${result.period.date_from} ` +
    `a ${result.period.date_to}. Status=${result.settlement_status}; total_sugerido=${result.total_to_transfer}; ` +
    `residual=${result.residual_amount}; data_complete=${result.data_complete}; ` +
    `warnings=${result.warnings.join(",") || "nenhum"}.\nSaldos:\n${balances || "Nenhum saldo."}\n` +
    `Sugestões:\n${transfers || "Nenhuma transferência sugerida."}\n` +
    "São apenas sugestões matemáticas, não cobranças obrigatórias. Nenhuma transferência foi realizada, " +
    "nenhum pagamento foi confirmado e nenhuma transação ou despesa foi criada ou alterada."
  );
}

export async function getGroupSettlement(
  rawInput: unknown,
  ctx: ToolContextLike,
) {
  const parsed = groupAnalysisInputSchema.safeParse(rawInput);
  if (!parsed.success) return mcpError("INVALID_INPUT");
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
  try {
    const analysis = await loadGroupAnalysis(parsed.data, ctx, userId);
    if ("isError" in analysis) return analysis;
    const memberBalances = analysis.members.map(publicMember);
    const resolvable = analysis.members.every((member) => member.membership_id !== null);
    const sourceBalanced =
      analysis.totalExpenseCents === analysis.totalAllocatedCents &&
      analysis.dataComplete;
    let settlement = {
      transfers: [] as ReturnType<typeof suggestSettlementTransfers>["transfers"],
      totalCreditCents: analysis.members.reduce(
        (total, member) => total + Math.max(member.paid_cents - member.allocated_cents, 0),
        0,
      ),
      totalDebitCents: analysis.members.reduce(
        (total, member) => total + Math.max(member.allocated_cents - member.paid_cents, 0),
        0,
      ),
      totalTransferCents: 0,
      residualCents: Math.abs(analysis.totalExpenseCents - analysis.totalAllocatedCents),
    };
    let status: (typeof SETTLEMENT_STATUSES)[number];
    const warnings = [...analysis.warnings];
    if (analysis.expenseCount === 0) {
      status = "no_shared_expenses";
    } else if (!resolvable) {
      status = "incomplete_data";
      warnings.push("SETTLEMENT_NOT_BALANCED", "DATA_INCOMPLETE");
    } else if (!sourceBalanced) {
      status = "unbalanced_source_data";
      warnings.push("SETTLEMENT_NOT_BALANCED", "DATA_INCOMPLETE");
    } else {
      settlement = suggestSettlementTransfers(
        analysis.members.map((member) => ({
          membership_id: member.membership_id as string,
          display_name: member.display_name,
          net_cents: member.paid_cents - member.allocated_cents,
        })),
      );
      if (settlement.transfers.length > GROUP_ANALYSIS_MAX_TRANSFERS) {
        return mcpError("RESULT_SET_TOO_LARGE");
      }
      status = settlement.transfers.length === 0 ? "settled" : "transfers_suggested";
    }
    if (settlement.residualCents > 0) warnings.push("RESIDUAL_AMOUNT_REMAINS");
    const transfers = settlement.transfers.map((transfer) => ({
      from_membership_id: transfer.from_membership_id,
      from_display_name: transfer.from_display_name,
      to_membership_id: transfer.to_membership_id,
      to_display_name: transfer.to_display_name,
      amount: centsToMoney(transfer.amount_cents),
    }));
    const result = {
      resource_type: "group_settlement" as const,
      group: publicGroup(analysis.loaded),
      period: analysis.period,
      member_balances: memberBalances,
      transfers,
      transfer_count: transfers.length,
      total_to_transfer: centsToMoney(settlement.totalTransferCents),
      total_credit: centsToMoney(settlement.totalCreditCents),
      total_debit: centsToMoney(settlement.totalDebitCents),
      residual_amount: centsToMoney(settlement.residualCents),
      settlement_status: status,
      warnings: uniqueWarnings(warnings),
      data_complete: analysis.dataComplete && resolvable && sourceBalanced,
      generated_at: new Date().toISOString(),
    };
    return {
      content: [{ type: "text" as const, text: settlementContent(result) }],
      structuredContent: result,
    };
  } catch {
    return mcpError("READ_FAILED");
  }
}

export async function getExpenseSplitDetails(
  rawInput: unknown,
  ctx: ToolContextLike,
) {
  const parsed = expenseDetailsInputSchema.safeParse(rawInput);
  if (!parsed.success) return mcpError("INVALID_INPUT");
  const userId = ctx.getUserId();
  if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
  try {
    const supabase = supabaseForUser(ctx as never);
    const { data: rawExpense, error: expenseError } = await supabase
      .from("expenses")
      .select(
        "id,user_id,description,amount,expense_date,shared_group_id,is_shared,paid_by,split_type,installment_number,total_installments,updated_at",
      )
      .eq("id", parsed.data.expense_id)
      .maybeSingle();
    if (expenseError) return mcpError("READ_FAILED");
    if (!rawExpense) return mcpError("RESOURCE_NOT_FOUND");
    const expense = rawExpense as unknown as ExpenseRow;
    if (!expense.shared_group_id || !expense.is_shared) {
      return mcpError(
        "EXPENSE_NOT_SHARED",
        "A despesa acessível não possui um rateio compartilhado.",
      );
    }
    const loaded = await loadGroup(expense.shared_group_id, userId, ctx);
    if ("isError" in loaded) return loaded;
    const { data: rawSplits, error: splitError } = await supabase
      .from("expense_splits")
      .select("id,expense_id,user_id,share_amount,share_percentage,created_at")
      .eq("expense_id", expense.id)
      .limit(GROUP_ANALYSIS_MAX_MEMBERS + 1);
    if (splitError) return mcpError("READ_FAILED");
    const splits = (rawSplits ?? []) as SplitRow[];
    if (splits.length > GROUP_ANALYSIS_MAX_MEMBERS) {
      return mcpError("RESULT_SET_TOO_LARGE");
    }
    const facts = allocationFacts(expense, splits);
    const warnings: Warning[] = [...loaded.warnings, ...facts.warnings];
    const payerKey = expense.paid_by ?? expense.user_id;
    const payer =
      loaded.identities.get(payerKey) ?? historicalIdentity(payerKey, userId);
    if (payer.historical) {
      warnings.push("PAYER_UNRESOLVED", "HISTORICAL_MEMBER_UNRESOLVED", "DATA_INCOMPLETE");
    }
    const participants = facts.parsedSplits
      .map(({ split, cents }) => {
        const identity =
          loaded.identities.get(split.user_id) ??
          historicalIdentity(split.user_id, userId);
        if (identity.historical) {
          warnings.push("HISTORICAL_MEMBER_UNRESOLVED", "DATA_INCOMPLETE");
        }
        if (!identity.profile_complete && !identity.historical) {
          warnings.push("MEMBER_PROFILE_INCOMPLETE", "DATA_INCOMPLETE");
        }
        return {
          membership_id: identity.membership_id,
          display_name: identity.display_name,
          is_current_user: identity.is_current_user,
          allocated_amount: centsToMoney(Math.max(cents ?? 0, 0)),
          percentage:
            expense.split_type === "percentage" && split.share_percentage !== null
              ? Number(split.share_percentage)
              : null,
          allocation_source: "persisted_split" as const,
          _sort: split.id,
        };
      })
      .sort(
        (left, right) =>
          (left.membership_id ?? `~${left._sort}`).localeCompare(
            right.membership_id ?? `~${right._sort}`,
          ),
      )
      .map(({ _sort, ...participant }) => participant);
    const finalWarnings = uniqueWarnings(warnings);
    const result = {
      resource_type: "expense_split_details" as const,
      expense: {
        id: expense.id,
        description: expense.description,
        amount: centsToMoney(facts.expenseCents),
        expense_date: expense.expense_date,
        split_type: isSplitType(expense.split_type) ? expense.split_type : "unknown",
        group_id: loaded.group.id,
        group_name: loaded.group.name,
        paid_by_membership_id: payer.membership_id,
        paid_by_display_name: payer.display_name,
        installment_number: expense.installment_number,
        total_installments: expense.total_installments,
        updated_at: expense.updated_at,
      },
      participants,
      participant_count: participants.length,
      allocated_amount_total: centsToMoney(facts.allocatedCents),
      unallocated_amount: centsToMoney(facts.unallocatedCents),
      allocation_difference: centsToMoney(facts.differenceCents),
      allocation_status: facts.status,
      warnings: finalWarnings,
      data_complete: !finalWarnings.includes("DATA_INCOMPLETE"),
      generated_at: new Date().toISOString(),
    };
    const participantText = participants
      .map(
        (participant, index) =>
          `${index + 1}. membership_id=${participant.membership_id ?? "indisponível"}; ` +
          `nome=${participant.display_name}; is_current_user=${participant.is_current_user}; ` +
          `valor_atribuído=${participant.allocated_amount}; percentual=${participant.percentage ?? "não aplicável"}`,
      )
      .join("\n");
    return {
      content: [
        {
          type: "text" as const,
          text:
            `Consulta somente leitura do rateio da despesa ${result.expense.description} (${result.expense.id}), ` +
            `grupo ${result.expense.group_name} (${result.expense.group_id}). Valor=${result.expense.amount}; ` +
            `data=${result.expense.expense_date}; tipo=${result.expense.split_type}; ` +
            `pagador=${result.expense.paid_by_display_name}; ` +
            `paid_by_membership_id=${result.expense.paid_by_membership_id ?? "indisponível"}; ` +
            `participantes=${result.participant_count}; total_atribuído=${result.allocated_amount_total}; ` +
            `não_atribuído=${result.unallocated_amount}; diferença=${result.allocation_difference}; ` +
            `status=${result.allocation_status}; data_complete=${result.data_complete}; ` +
            `warnings=${result.warnings.join(",") || "nenhum"}.\n` +
            `${participantText || "Nenhuma linha de rateio persistida."}\nNenhum dado foi alterado.`,
        },
      ],
      structuredContent: result,
    };
  } catch {
    return mcpError("READ_FAILED");
  }
}
