import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpError } from "../shared/errors";
import {
  GOAL_TYPES,
  GOAL_WARNINGS,
  compareGoals,
  goalCursorSortValue,
  goalItem,
  type GoalRow,
  type GoalType,
} from "../shared/goals";
import {
  CURSOR_VERSION,
  filtersFingerprint,
  getCursorSecret,
} from "../shared/phase-1.1b-core";
import {
  decodeResourceCursor,
  encodeResourceCursor,
} from "../shared/resource-cursor";
import type { McpScope } from "../shared/scope";
import { supabaseForUser } from "../shared/supabase-client";

const CURSOR_CONTEXT = "list_goals";
const CURSOR_SORT = "type|category_reference|id";
const goalTypeSchema = z.enum(GOAL_TYPES);
const warningSchema = z.enum(GOAL_WARNINGS);

const goalSchema = z.object({
  id: z.string().uuid(),
  type: goalTypeSchema,
  category_reference: z.string().nullable(),
  limit_amount: z.number(),
  shared_group_id: z.string().uuid().nullable(),
  is_shared: z.boolean(),
  is_owner: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  data_warnings: z.array(warningSchema),
}).strict();

function postgrestString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export default defineTool({
  name: "list_goals",
  title: "Listar metas mensais",
  description:
    "Lista metas ou limites mensais acessíveis à conta autenticada. Não representa contas de investimento, contribuições acumuladas ou metas de poupança com prazo.",
  inputSchema: {
    scope: z.enum(["personal", "shared", "all_accessible"]).optional(),
    group_id: z.string().uuid().optional(),
    type: goalTypeSchema.optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).max(1000).optional(),
  },
  outputSchema: {
    goals: z.array(goalSchema),
    count: z.number().int().nonnegative(),
    has_more: z.boolean(),
    next_cursor: z.string().nullable(),
    cursor_version: z.literal(3),
    applied_filters: z.object({
      scope: z.enum(["personal", "shared", "all_accessible"]),
      group_id: z.string().uuid().nullable(),
      type: goalTypeSchema.nullable(),
      limit: z.number().int().min(1).max(100),
    }).strict(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const userId = ctx.getUserId();
    if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
    const scope: McpScope = input.scope ?? "personal";
    const limit = input.limit ?? 20;
    const appliedFilters = {
      scope,
      group_id: input.group_id ?? null,
      type: input.type ?? null,
      limit,
    };
    const cursorSecret = getCursorSecret();
    if (!cursorSecret) return mcpError("INTERNAL_ERROR");
    const fingerprint = await filtersFingerprint(
      CURSOR_CONTEXT,
      appliedFilters,
    );
    const cursor = await decodeResourceCursor(
      input.cursor,
      {
        context: CURSOR_CONTEXT,
        sort_by: CURSOR_SORT,
        sort_order: "asc",
        filters_fingerprint: fingerprint,
      },
      cursorSecret,
    );
    if (input.cursor && !cursor) return mcpError("INVALID_CURSOR");

    let query = supabaseForUser(ctx)
      .from("budget_goals")
      .select(
        "id,user_id,type,category,limit_amount,shared_group_id,created_at,updated_at",
      );
    if (scope === "personal") query = query.eq("user_id", userId);
    if (scope === "shared") query = query.not("shared_group_id", "is", null);
    if (input.group_id) query = query.eq("shared_group_id", input.group_id);
    if (input.type) query = query.eq("type", input.type);
    if (cursor) {
      let decoded: [GoalType, string | null];
      try {
        decoded = JSON.parse(cursor.sort_value) as [GoalType, string | null];
      } catch {
        return mcpError("INVALID_CURSOR");
      }
      const [type, category] = decoded;
      if (!GOAL_TYPES.includes(type) || (category !== null && typeof category !== "string")) {
        return mcpError("INVALID_CURSOR");
      }
      const quotedType = postgrestString(type);
      query =
        category === null
          ? query.or(
              `type.gt.${quotedType},and(type.eq.${quotedType},category.not.is.null),` +
                `and(type.eq.${quotedType},category.is.null,id.gt.${cursor.id})`,
            )
          : query.or(
              `type.gt.${quotedType},and(type.eq.${quotedType},category.gt.${postgrestString(category)}),` +
                `and(type.eq.${quotedType},category.eq.${postgrestString(category)},id.gt.${cursor.id})`,
            );
    }
    const { data, error } = await query
      .order("type", { ascending: true })
      .order("category", { ascending: true, nullsFirst: true })
      .order("id", { ascending: true })
      .limit(limit + 1);
    if (error) return mcpError("INTERNAL_ERROR");
    const combined = ((data ?? []) as GoalRow[])
      .map((row) => goalItem(row, userId))
      .sort(compareGoals);
    const hasMore = combined.length > limit;
    const goals = combined.slice(0, limit);
    const last = goals.at(-1);
    const nextCursor =
      hasMore && last
        ? await encodeResourceCursor(
            {
              context: CURSOR_CONTEXT,
              sort_by: CURSOR_SORT,
              sort_order: "asc",
              sort_value: goalCursorSortValue(last),
              id: last.id,
              filters_fingerprint: fingerprint,
            },
            cursorSecret,
          )
        : null;
    const result = {
      goals,
      count: goals.length,
      has_more: hasMore,
      next_cursor: nextCursor,
      cursor_version: CURSOR_VERSION,
      applied_filters: appliedFilters,
    };
    return {
      content: [
        {
          type: "text",
          text:
            "Estas são metas ou limites mensais. Não representam contas de investimento, " +
            "contribuições acumuladas ou metas de poupança com prazo. " +
            `Filtros=${JSON.stringify(appliedFilters)}; count=${goals.length}; has_more=${hasMore}; ` +
            `cursor_version=${CURSOR_VERSION}; next_cursor=${nextCursor ?? "null"}. ` +
            `Metas (máximo 10)=${JSON.stringify(goals.slice(0, 10))}; ` +
            `metas omitidas do content=${Math.max(0, goals.length - 10)}.`,
        },
      ],
      structuredContent: result,
    };
  },
});
