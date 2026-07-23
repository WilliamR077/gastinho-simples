import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "list_expenses",
  title: "Listar despesas",
  description:
    "Lista as despesas do usuário autenticado. Aceita intervalo de datas opcional (ISO YYYY-MM-DD) e limite. Retorna descrição, valor, data, categoria e método de pagamento.",
  inputSchema: {
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Data inicial (YYYY-MM-DD), inclusive."),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Data final (YYYY-MM-DD), inclusive."),
    limit: z.number().int().min(1).max(200).optional().describe("Máximo de registros (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("expenses")
      .select(
        "id, description, amount, expense_date, payment_method, category_name, card_name, is_shared",
      )
      .eq("user_id", ctx.getUserId())
      .order("expense_date", { ascending: false })
      .limit(limit ?? 50);
    if (start_date) query = query.gte("expense_date", start_date);
    if (end_date) query = query.lte("expense_date", end_date);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { expenses: data ?? [], count: data?.length ?? 0 },
    };
  },
});
