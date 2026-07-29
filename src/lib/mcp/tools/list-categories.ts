import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { categoryViewSchema } from "../shared/category-write";
import { mcpError } from "../shared/errors";
import { supabaseForUser } from "../shared/supabase-client";

export default defineTool({
  name: "list_categories",
  title: "Listar categorias",
  description:
    "Lista as categorias pessoais de despesa ou receita da conta autenticada, incluindo updated_at necessário para edições seguras.",
  inputSchema: {
    kind: z
      .enum(["expense", "income"])
      .describe("Tipo de categoria: expense ou income."),
    include_inactive: z
      .boolean()
      .optional()
      .default(false)
      .describe("Inclui categorias inativas quando true."),
  },
  outputSchema: {
    category_kind: z.enum(["expense", "income"]),
    include_inactive: z.boolean(),
    categories: z.array(categoryViewSchema),
    data_complete: z.literal(true),
  },
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ kind, include_inactive }, ctx) => {
    if (!ctx.isAuthenticated()) return mcpError("UNAUTHENTICATED");
    const userId = ctx.getUserId();
    if (!userId) return mcpError("UNAUTHENTICATED");
    const supabase = supabaseForUser(ctx);
    const table =
      kind === "expense" ? "user_categories" : "user_income_categories";
    const includeInactive = include_inactive ?? false;
    let query = supabase
      .from(table)
      .select(
        "id,name,icon,color,is_default,is_active,display_order,created_at,updated_at",
      )
      .eq("user_id", userId)
      .order("display_order", { ascending: true });
    if (!includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) return mcpError("INTERNAL_ERROR");
    const categories = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      icon: row.icon,
      color: row.color,
      is_default: row.is_default,
      is_active: row.is_active,
      display_order: row.display_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
    const result = {
      category_kind: kind,
      include_inactive: includeInactive,
      categories,
      data_complete: true as const,
    };
    return {
      content: [
        {
          type: "text",
          text:
            `Categorias pessoais de ${
              kind === "expense" ? "despesa" : "receita"
            } (inativas incluídas=${includeInactive}): ` +
            `${JSON.stringify(categories)}.`,
        },
      ],
      structuredContent: result,
    };
  },
});
