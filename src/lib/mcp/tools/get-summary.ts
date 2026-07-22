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
  name: "get_summary",
  title: "Resumo financeiro",
  description:
    "Retorna o total de receitas, total de despesas e saldo do usuário para um intervalo (YYYY-MM-DD). Padrão: mês corrente.",
  inputSchema: {
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const from = start_date ?? firstDay;
    const to = end_date ?? lastDay;

    const supabase = supabaseForUser(ctx);
    const uid = ctx.getUserId();

    const [{ data: exp, error: eErr }, { data: inc, error: iErr }] = await Promise.all([
      supabase
        .from("expenses")
        .select("amount")
        .eq("user_id", uid)
        .gte("expense_date", from)
        .lte("expense_date", to),
      supabase
        .from("incomes")
        .select("amount")
        .eq("user_id", uid)
        .gte("income_date", from)
        .lte("income_date", to),
    ]);
    if (eErr || iErr) {
      return {
        content: [{ type: "text", text: (eErr ?? iErr)!.message }],
        isError: true,
      };
    }
    const totalExpenses = (exp ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const totalIncomes = (inc ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const balance = totalIncomes - totalExpenses;
    const summary = { period: { from, to }, total_incomes: totalIncomes, total_expenses: totalExpenses, balance };
    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
