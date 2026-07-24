import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../shared/supabase-client";
import { mcpError } from "../shared/errors";
import { ISO_DATE_RE, resolveDateRange } from "../shared/dates";

export default defineTool({
  name: "list_expenses",
  title: "Listar despesas",
  description:
    "Lista as despesas do usuário autenticado. Aceita intervalo de datas opcional (ISO YYYY-MM-DD) e limite. Retorna descrição, valor, data, categoria e método de pagamento.",
  inputSchema: {
    start_date: z.string().regex(ISO_DATE_RE).optional().describe("Data inicial (YYYY-MM-DD), inclusive."),
    end_date: z.string().regex(ISO_DATE_RE).optional().describe("Data final (YYYY-MM-DD), inclusive."),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de registros (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return mcpError("UNAUTHENTICATED");

    // Datas: se ambas ausentes, seguimos sem filtro (comportamento pré-1.1A).
    // Se apenas uma vier inválida, resolveDateRange marca o erro corretamente.
    if (start_date || end_date) {
      const range = resolveDateRange(start_date, end_date);
      if (!range.ok) return mcpError(range.code);
    }

    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("expenses")
      .select(
        // is_shared é derivado no cliente a partir de shared_group_id
        "id, description, amount, expense_date, payment_method, category_name, card_name, shared_group_id",
      )
      .eq("user_id", ctx.getUserId())
      .order("expense_date", { ascending: false })
      .limit(limit ?? 50);
    if (start_date) query = query.gte("expense_date", start_date);
    if (end_date) query = query.lte("expense_date", end_date);
    const { data, error } = await query;
    if (error) return mcpError("INTERNAL_ERROR", error.message);

    const rows = (data ?? []).map((r) => ({
      id: r.id,
      description: r.description,
      amount: r.amount,
      expense_date: r.expense_date,
      payment_method: r.payment_method,
      category_name: r.category_name,
      card_name: r.card_name,
      is_shared: r.shared_group_id !== null,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(rows) }],
      structuredContent: { expenses: rows, count: rows.length },
    };
  },
});
