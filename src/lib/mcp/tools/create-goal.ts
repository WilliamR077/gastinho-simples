import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpError } from "../shared/errors";
import {
  EXPENSE_GOAL_CATEGORIES,
  EXPENSE_GOAL_CATEGORY_NAMES,
  createGoalContent,
  goalAmountSchema,
  goalCategoryKind,
  goalCategorySchema,
  goalTypeSchema,
  goalViewSchema,
  goalWriteView,
  validGoalConfiguration,
  goalWriteWarningSchema,
  type GoalWriteWarning,
} from "../shared/goal-write";
import type { GoalRow } from "../shared/goals";
import { supabaseForUser } from "../shared/supabase-client";

const COLUMNS =
  "id,user_id,type,category,limit_amount,shared_group_id,created_at,updated_at";
const inputProperties = {
  type: goalTypeSchema,
  limit_amount: goalAmountSchema,
  category: goalCategorySchema.optional(),
  shared_group_id: z.string().uuid().optional(),
};
const inputValidator = z.object(inputProperties).strict();

export default defineTool({
  name: "create_goal",
  title: "Criar meta mensal",
  description:
    "Cria uma meta ou limite mensal para a conta autenticada. Não cria nem altera transações, investimentos ou poupança acumulada.",
  inputSchema: inputProperties,
  outputSchema: {
    resource_type: z.literal("goal"),
    id: z.string().uuid(),
    created: z.literal(true),
    goal: goalViewSchema,
    warnings: z.array(goalWriteWarningSchema),
    data_complete: z.literal(true),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async (rawInput, ctx) => {
    const userId = ctx.getUserId();
    if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
    const parsed = inputValidator.safeParse(rawInput);
    if (!parsed.success) return mcpError("INVALID_INPUT");
    const input = parsed.data;
    const category = input.category ?? null;
    if (!validGoalConfiguration(input.type, category)) {
      return mcpError("INVALID_GOAL_CONFIGURATION");
    }
    const supabase = supabaseForUser(ctx);

    if (input.shared_group_id) {
      const group = await supabase
        .from("shared_groups")
        .select("id")
        .eq("id", input.shared_group_id)
        .maybeSingle();
      if (group.error) return mcpError("INTERNAL_ERROR");
      if (!group.data) return mcpError("RESOURCE_NOT_FOUND");
    }

    const categoryKind = goalCategoryKind(input.type);
    if (categoryKind === "expense") {
      if (
        !EXPENSE_GOAL_CATEGORIES.includes(
          category as (typeof EXPENSE_GOAL_CATEGORIES)[number],
        )
      ) {
        return mcpError("CATEGORY_NOT_FOUND");
      }
      const expenseCategory =
        EXPENSE_GOAL_CATEGORY_NAMES[
          category as (typeof EXPENSE_GOAL_CATEGORIES)[number]
        ];
      const categoryResult = await supabase
        .from("user_categories")
        .select("id")
        .eq("user_id", userId)
        .eq("name", expenseCategory)
        .eq("is_active", true)
        .maybeSingle();
      if (categoryResult.error) return mcpError("INTERNAL_ERROR");
      if (!categoryResult.data) return mcpError("CATEGORY_NOT_FOUND");
    }
    if (categoryKind === "income") {
      const incomeCategoryId = z.string().uuid().safeParse(category);
      if (!incomeCategoryId.success) return mcpError("CATEGORY_NOT_FOUND");
      const categoryResult = await supabase
        .from("user_income_categories")
        .select("id")
        .eq("id", incomeCategoryId.data)
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      if (categoryResult.error) return mcpError("INTERNAL_ERROR");
      if (!categoryResult.data) return mcpError("CATEGORY_NOT_FOUND");
    }

    const insertResult = await supabase
      .from("budget_goals")
      .insert({
        user_id: userId,
        type: input.type,
        category,
        limit_amount: input.limit_amount,
        shared_group_id: input.shared_group_id ?? null,
      })
      .select(COLUMNS)
      .single();
    if (insertResult.error || !insertResult.data) return mcpError("WRITE_FAILED");
    const goal = goalWriteView(insertResult.data as GoalRow, userId);
    if (!goal) return mcpError("INVALID_DATA");
    const warnings: GoalWriteWarning[] = ["MONTHLY_GOAL_ONLY"];
    if (category !== null) warnings.push("CATEGORY_REFERENCE_STORED_AS_TEXT");
    if (goal.is_shared) warnings.push("SHARED_GOAL_CREATED");
    const result = {
      resource_type: "goal" as const,
      id: goal.id,
      created: true as const,
      goal,
      warnings,
      data_complete: true as const,
    };
    return {
      content: [{ type: "text" as const, text: createGoalContent(result) }],
      structuredContent: result,
    };
  },
});
