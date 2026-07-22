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
  name: "create_expense",
  title: "Criar despesa",
  description:
    "Cria uma nova despesa para o usuário autenticado. Requer descrição, valor, data (YYYY-MM-DD) e método de pagamento. Opcionalmente aceita category_id (UUID de user_categories).",
  inputSchema: {
    description: z.string().trim().min(1).max(200),
    amount: z.number().positive(),
    expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    payment_method: z.enum(["pix", "credit", "debit", "cash", "transfer"]),
    category_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    let category_name: string | null = null;
    let category_icon: string | null = null;
    if (input.category_id) {
      const { data: cat } = await supabase
        .from("user_categories")
        .select("name, icon")
        .eq("id", input.category_id)
        .eq("user_id", ctx.getUserId())
        .maybeSingle();
      if (cat) {
        category_name = cat.name;
        category_icon = cat.icon;
      }
    }

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: ctx.getUserId(),
        description: input.description,
        amount: input.amount,
        expense_date: input.expense_date,
        payment_method: input.payment_method,
        category: "outros" as const,
        category_id: input.category_id ?? null,
        category_name,
        category_icon,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Despesa criada: ${data.id}` }],
      structuredContent: { expense: data },
    };
  },
});
