import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../shared/supabase-client";
import { mcpError } from "../shared/errors";

export default defineTool({
  name: "list_categories",
  title: "Listar categorias",
  description:
    "Lista as categorias de despesa ou receita do usuário autenticado (útil para descobrir o UUID a passar em create_expense / create_income).",
  inputSchema: {
    kind: z.enum(["expense", "income"]).describe("Tipo de categoria: expense ou income."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ kind }, ctx) => {
    if (!ctx.isAuthenticated()) return mcpError("UNAUTHENTICATED");
    const supabase = supabaseForUser(ctx);
    const table = kind === "expense" ? "user_categories" : "user_income_categories";
    const { data, error } = await supabase
      .from(table)
      .select("id, name, icon")
      .eq("user_id", ctx.getUserId())
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    if (error) return mcpError("INTERNAL_ERROR", error.message);
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { categories: data ?? [] },
    };
  },
});
