import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  INSTALLMENT_DATA_WARNINGS,
  INSTALLMENT_SERIES_WARNINGS,
  installmentWarnings,
} from "../shared/card-factual";
import { ISO_DATE_RE, todayIso, validateOpenDateRange } from "../shared/dates";
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

const CURSOR_CONTEXT = "get_card_installments";
const warningSchema = z.enum(INSTALLMENT_DATA_WARNINGS);
const seriesWarningSchema = z.enum(INSTALLMENT_SERIES_WARNINGS);

const cardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  card_type: z.enum(["credit", "debit", "both"]),
  is_active: z.boolean(),
});

const installmentSchema = z.object({
  transaction_id: z.string().uuid(),
  installment_group_id: z.string().uuid().nullable(),
  description: z.string(),
  amount: z.number(),
  date: z.string(),
  updated_at: z.string(),
  installment_number: z.number().int().nullable(),
  total_installments: z.number().int().nullable(),
  is_installment: z.boolean(),
  category_id: z.string().uuid().nullable(),
  category_name: z.string().nullable(),
  category_icon: z.string().nullable(),
  payment_method: z.enum(["pix", "credit", "debit", "cash"]),
  shared_group_id: z.string().uuid().nullable(),
  is_shared: z.boolean(),
  card_id: z.string().uuid(),
  card_name: z.string().nullable(),
  data_warnings: z.array(warningSchema),
});

export default defineTool({
  name: "get_card_installments",
  title: "Consultar parcelas do cartão",
  description:
    "Lista lançamentos factuais com evidência de parcelamento para um cartão da conta autenticada. O padrão retorna parcelas futuras. Não representa fatura e não garante a completude histórica da série.",
  inputSchema: {
    card_id: z.string().uuid(),
    time_scope: z.enum(["occurred", "future", "all"]).optional(),
    start_date: z.string().regex(ISO_DATE_RE).optional(),
    end_date: z.string().regex(ISO_DATE_RE).optional(),
    sort_order: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().min(1).max(1000).optional(),
  },
  outputSchema: {
    card: cardSchema,
    installments: z.array(installmentSchema),
    count: z.number().int().nonnegative(),
    has_more: z.boolean(),
    next_cursor: z.string().nullable(),
    cursor_version: z.number().int(),
    time_scope: z.enum(["occurred", "future", "all"]),
    applied_filters: z.object({
      card_id: z.string().uuid(),
      time_scope: z.enum(["occurred", "future", "all"]),
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
      sort_order: z.enum(["asc", "desc"]),
    }),
    series_warnings: z.array(seriesWarningSchema),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated() || !ctx.getUserId()) return mcpError("UNAUTHENTICATED");
    const range = validateOpenDateRange(input.start_date, input.end_date);
    if (range.ok === false) return mcpError(range.code);

    const timeScope = input.time_scope ?? "future";
    const sortOrder = input.sort_order ?? "asc";
    const limit = input.limit ?? 20;
    const cursorSecret = getCursorSecret();
    if (!cursorSecret) return mcpError("INTERNAL_ERROR");
    const fingerprint = await filtersFingerprint(CURSOR_CONTEXT, {
      card_id: input.card_id,
      time_scope: timeScope,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      sort_order: sortOrder,
    });
    const cursor = await decodeResourceCursor(
      input.cursor,
      {
        context: CURSOR_CONTEXT,
        sort_by: "expense_date",
        sort_order: sortOrder,
        filters_fingerprint: fingerprint,
      },
      cursorSecret,
    );
    if (input.cursor && !cursor) return mcpError("INVALID_CURSOR");

    const supabase = supabaseForUser(ctx);
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id,name,card_type,is_active")
      .eq("id", input.card_id)
      .eq("user_id", ctx.getUserId()!)
      .maybeSingle();
    if (cardError) return mcpError("INTERNAL_ERROR");
    if (!card) return mcpError("RESOURCE_NOT_FOUND");
    if (!["credit", "debit", "both"].includes(card.card_type)) {
      return mcpError("INVALID_CARD_TYPE");
    }
    const parsedCard = cardSchema.safeParse(card);
    if (!parsedCard.success) return mcpError("INVALID_DATA");

    let query = supabase
      .from("expenses")
      .select(
        "id,description,amount,expense_date,updated_at,payment_method,card_id,card_name,category_id,category_name,category_icon,installment_group_id,installment_number,total_installments,shared_group_id",
      )
      .eq("user_id", ctx.getUserId()!)
      .eq("card_id", input.card_id)
      .or("installment_group_id.not.is.null,installment_number.gt.1,total_installments.gt.1");
    const today = todayIso();
    if (timeScope === "occurred") query = query.lte("expense_date", today);
    if (timeScope === "future") query = query.gt("expense_date", today);
    if (input.start_date) query = query.gte("expense_date", input.start_date);
    if (input.end_date) query = query.lte("expense_date", input.end_date);
    if (cursor) query = query.or(resourceCursorFilterExpression("expense_date", cursor));
    const { data, error } = await query
      .order("expense_date", { ascending: sortOrder === "asc" })
      .order("id", { ascending: sortOrder === "asc" })
      .limit(limit + 1);
    if (error) return mcpError("INTERNAL_ERROR");

    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const candidateInstallments = rows.slice(0, limit).map((row) => ({
      transaction_id: row.id,
      installment_group_id: row.installment_group_id,
      description: row.description,
      amount: row.amount,
      date: row.expense_date,
      updated_at: row.updated_at,
      installment_number: row.installment_number,
      total_installments: row.total_installments,
      is_installment: true,
      category_id: row.category_id,
      category_name: row.category_name,
      category_icon: row.category_icon,
      payment_method: row.payment_method,
      shared_group_id: row.shared_group_id,
      is_shared: row.shared_group_id !== null,
      card_id: row.card_id,
      card_name: row.card_name,
      data_warnings: installmentWarnings(row),
    }));
    const parsedInstallments = z.array(installmentSchema).safeParse(candidateInstallments);
    if (!parsedInstallments.success) return mcpError("INVALID_DATA");
    const installments = parsedInstallments.data;
    const last = installments.at(-1);
    const nextCursor =
      hasMore && last
        ? await encodeResourceCursor(
            {
              context: CURSOR_CONTEXT,
              sort_by: "expense_date",
              sort_order: sortOrder,
              sort_value: last.date,
              id: last.transaction_id,
              filters_fingerprint: fingerprint,
            },
            cursorSecret,
          )
        : null;
    const seriesWarnings: Array<(typeof INSTALLMENT_SERIES_WARNINGS)[number]> = [];
    if (!parsedCard.data.is_active) seriesWarnings.push("INACTIVE_CARD");
    if (installments.length > 0) seriesWarnings.push("SERIES_COMPLETENESS_NOT_VERIFIED");
    if (installments.some((item) => item.data_warnings.length > 0)) {
      seriesWarnings.push("INCONSISTENT_INSTALLMENT_METADATA_PRESENT");
    }
    const result = {
      card: parsedCard.data,
      installments,
      count: installments.length,
      has_more: hasMore,
      next_cursor: nextCursor,
      cursor_version: CURSOR_VERSION,
      time_scope: timeScope,
      applied_filters: {
        card_id: input.card_id,
        time_scope: timeScope,
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        sort_order: sortOrder,
      },
      series_warnings: seriesWarnings,
    };
    const visible = installments.slice(0, 10);
    const omitted = installments.length - visible.length;
    return {
      content: [
        {
          type: "text",
          text:
            `Cartão: ${parsedCard.data.name} (${parsedCard.data.card_type}, ${parsedCard.data.is_active ? "ativo" : "inativo"}). ` +
            `Parcelas factuais encontradas: ${installments.length}; time_scope=${timeScope}. ` +
            `Filtros de data: start_date=${input.start_date ?? "sem limite"}, end_date=${input.end_date ?? "sem limite"}. ` +
            `Dados: ${JSON.stringify(visible)}.` +
            (omitted > 0 ? ` Há ${omitted} parcela(s) adicional(is) nesta página.` : "") +
            ` Avisos da série: ${JSON.stringify(seriesWarnings)}. ` +
            `has_more=${hasMore}; next_cursor=${nextCursor ?? "null"}.`,
        },
      ],
      structuredContent: result,
    };
  },
});
