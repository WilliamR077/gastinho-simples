import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpError } from "../shared/errors";
import {
  CURSOR_VERSION,
  filtersFingerprint,
  getCursorSecret,
} from "../shared/phase-1.1b-core";
import {
  decodeResourceCursor,
  encodeResourceCursor,
  resourceCursorFilterExpression,
} from "../shared/resource-cursor";
import { supabaseForUser } from "../shared/supabase-client";

const CURSOR_CONTEXT = "list_cards";
const cardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  card_type: z.enum(["credit", "debit", "both"]),
  color: z.string(),
  card_limit: z.number().nullable(),
  opening_day: z.number().int().nullable(),
  closing_day: z.number().int().nullable(),
  due_day: z.number().int().nullable(),
  days_before_due: z.number().int().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export default defineTool({
  name: "list_cards",
  title: "Listar cartões",
  description:
    "Lista factual dos cartões da conta autenticada. Por padrão retorna somente cartões ativos, ordenados por nome. Não calcula fatura, limite disponível ou resumo.",
  inputSchema: {
    include_inactive: z.boolean().optional(),
    card_type: z.enum(["credit", "debit", "both"]).optional(),
    sort_by: z.enum(["name", "created_at"]).optional(),
    sort_order: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).max(1000).optional(),
  },
  outputSchema: {
    cards: z.array(cardSchema),
    count: z.number().int().nonnegative(),
    has_more: z.boolean(),
    next_cursor: z.string().nullable(),
    cursor_version: z.number().int(),
    applied_filters: z.object({
      include_inactive: z.boolean(),
      card_type: z.enum(["credit", "debit", "both"]).nullable(),
      sort_by: z.enum(["name", "created_at"]),
      sort_order: z.enum(["asc", "desc"]),
    }),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated() || !ctx.getUserId()) return mcpError("UNAUTHENTICATED");
    const includeInactive = input.include_inactive ?? false;
    const sortBy = input.sort_by ?? "name";
    const sortOrder = input.sort_order ?? "asc";
    const limit = input.limit ?? 20;
    const cursorSecret = getCursorSecret();
    if (!cursorSecret) return mcpError("INTERNAL_ERROR");
    const fingerprint = await filtersFingerprint(CURSOR_CONTEXT, {
      include_inactive: includeInactive,
      card_type: input.card_type ?? null,
      sort_by: sortBy,
      sort_order: sortOrder,
    });
    const cursor = await decodeResourceCursor(
      input.cursor,
      {
        context: CURSOR_CONTEXT,
        sort_by: sortBy,
        sort_order: sortOrder,
        filters_fingerprint: fingerprint,
      },
      cursorSecret,
    );
    if (input.cursor && !cursor) return mcpError("INVALID_CURSOR");

    let query = supabaseForUser(ctx)
      .from("cards")
      .select(
        "id,name,card_type,color,card_limit,opening_day,closing_day,due_day,days_before_due,is_active,created_at,updated_at",
      )
      .eq("user_id", ctx.getUserId()!);
    if (!includeInactive) query = query.eq("is_active", true);
    if (input.card_type) query = query.eq("card_type", input.card_type);
    if (cursor) query = query.or(resourceCursorFilterExpression(sortBy, cursor));
    const { data, error } = await query
      .order(sortBy, { ascending: sortOrder === "asc" })
      .order("id", { ascending: sortOrder === "asc" })
      .limit(limit + 1);
    if (error) return mcpError("INTERNAL_ERROR");

    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const candidateCards = rows.slice(0, limit);
    if (candidateCards.some((card) => !["credit", "debit", "both"].includes(card.card_type))) {
      return mcpError("INVALID_CARD_TYPE");
    }
    const parsedCards = z.array(cardSchema).safeParse(candidateCards);
    if (!parsedCards.success) return mcpError("INVALID_DATA");
    const cards = parsedCards.data;
    const last = cards.at(-1);
    const nextCursor =
      hasMore && last
        ? await encodeResourceCursor(
            {
              context: CURSOR_CONTEXT,
              sort_by: sortBy,
              sort_order: sortOrder,
              sort_value: String(last[sortBy]),
              id: last.id,
              filters_fingerprint: fingerprint,
            },
            cursorSecret,
          )
        : null;
    const result = {
      cards,
      count: cards.length,
      has_more: hasMore,
      next_cursor: nextCursor,
      cursor_version: CURSOR_VERSION,
      applied_filters: {
        include_inactive: includeInactive,
        card_type: input.card_type ?? null,
        sort_by: sortBy,
        sort_order: sortOrder,
      },
    };
    const visible = cards.slice(0, 10);
    const omitted = cards.length - visible.length;
    return {
      content: [
        {
          type: "text",
          text:
            `Cartões encontrados: ${cards.length}. ` +
            `Filtros aplicados: include_inactive=${includeInactive}, card_type=${input.card_type ?? "todos"}, ` +
            `sort_by=${sortBy}, sort_order=${sortOrder}. ` +
            `Dados: ${JSON.stringify(visible)}.` +
            (omitted > 0 ? ` Há ${omitted} cartão(ões) adicional(is) nesta página.` : "") +
            ` has_more=${hasMore}; next_cursor=${nextCursor ?? "null"}.`,
        },
      ],
      structuredContent: result,
    };
  },
});
