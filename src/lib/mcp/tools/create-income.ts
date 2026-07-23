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
  name: "create_income",
  title: "Criar receita",
  description:
    "Cria uma nova receita (entrada) para o usuário autenticado. Requer descrição, valor e data (YYYY-MM-DD). Opcionalmente aceita income_category_id (UUID de user_income_categories).",
  inputSchema: {
    description: z.string().trim().min(1).max(200),
    amount: z.number().positive(),
    income_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    income_category_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    let category_name: string | null = null;
    let category_icon: string | null = null;
    if (input.income_category_id) {
      const { data: cat } = await supabase
        .from("user_income_categories")
        .select("name, icon")
        .eq("id", input.income_category_id)
        .eq("user_id", ctx.getUserId())
        .maybeSingle();
      if (cat) {
        category_name = cat.name;
        category_icon = cat.icon;
      }
    }

    const { data, error } = await supabase
      .from("incomes")
      .insert({
        user_id: ctx.getUserId(),
        description: input.description,
        amount: input.amount,
        income_date: input.income_date,
        category: "outros" as const,
        income_category_id: input.income_category_id ?? null,
        category_name,
        category_icon,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Receita criada: ${data.id}` }],
      structuredContent: { income: data },
    };
  },
});
