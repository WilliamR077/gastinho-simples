import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../shared/supabase-client";
import { mcpError } from "../shared/errors";
import { ISO_DATE_RE, resolveDateRange } from "../shared/dates";

export default defineTool({
  name: "get_summary",
  title: "Resumo financeiro",
  description:
    "Retorna o total de receitas, total de despesas e saldo do usuário para um intervalo (YYYY-MM-DD). Padrão: mês corrente.",
  inputSchema: {
    start_date: z.string().regex(ISO_DATE_RE).optional(),
    end_date: z.string().regex(ISO_DATE_RE).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ start_date, end_date }, ctx) => {
    if (!ctx.isAuthenticated()) return mcpError("UNAUTHENTICATED");
    const range = resolveDateRange(start_date, end_date);
    if (range.ok === false) return mcpError(range.code);
    const { from, to } = range;

    const supabase = supabaseForUser(ctx);
    const uid = ctx.getUserId();

    const [{ data: exp, error: eErr }, { data: inc, error: iErr }] = await Promise.all([
      supabase.from("expenses").select("amount").eq("user_id", uid).gte("expense_date", from).lte("expense_date", to),
      supabase.from("incomes").select("amount").eq("user_id", uid).gte("income_date", from).lte("income_date", to),
    ]);
    if (eErr || iErr) return mcpError("INTERNAL_ERROR", (eErr ?? iErr)!.message);

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
