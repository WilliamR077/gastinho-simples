import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../shared/supabase-client";
import { mcpError } from "../shared/errors";
import { ISO_DATE_RE, resolveDateRange } from "../shared/dates";

export default defineTool({
  name: "list_incomes",
  title: "Listar receitas",
  description:
    "Lista as receitas (entradas) do usuário autenticado. Aceita intervalo de datas opcional (ISO YYYY-MM-DD) e limite.",
  inputSchema: {
    start_date: z.string().regex(ISO_DATE_RE).optional(),
    end_date: z.string().regex(ISO_DATE_RE).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return mcpError("UNAUTHENTICATED");
    if (start_date || end_date) {
      const range = resolveDateRange(start_date, end_date);
      if (range.ok === false) return mcpError(range.code);
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("incomes")
      .select("id, description, amount, income_date, category_name")
      .eq("user_id", ctx.getUserId())
      .order("income_date", { ascending: false })
      .limit(limit ?? 50);
    if (start_date) query = query.gte("income_date", start_date);
    if (end_date) query = query.lte("income_date", end_date);
    const { data, error } = await query;
    if (error) return mcpError("INTERNAL_ERROR", error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { incomes: data ?? [], count: data?.length ?? 0 },
    };
  },
});
