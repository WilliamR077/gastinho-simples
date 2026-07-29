import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpError } from "../shared/errors";
import {
  expectedUpdatedAtSchema,
  goalCategoryKind,
  goalChangesSchema,
  goalViewSchema,
  goalWriteView,
  goalWriteWarningSchema,
  resolveExpenseGoalCategoryReference,
  updateGoalContent,
  validGoalConfiguration,
  type GoalWriteWarning,
} from "../shared/goal-write";
import type { GoalRow, GoalType } from "../shared/goals";
import { supabaseForUser } from "../shared/supabase-client";

const COLUMNS =
  "id,user_id,type,category,limit_amount,shared_group_id,created_at,updated_at";
const CHANGE_FIELDS = ["type", "category", "limit_amount"] as const;
type ChangeField = (typeof CHANGE_FIELDS)[number];
const inputProperties = {
  goal_id: z.string().uuid(),
  expected_updated_at: expectedUpdatedAtSchema,
  changes: goalChangesSchema,
};
const inputValidator = z.object(inputProperties).strict();

export default defineTool({
  name: "update_goal",
  title: "Editar meta mensal",
  description:
    "Edita parcialmente uma meta mensal pertencente à conta autenticada, com concorrência otimista. Não altera transações.",
  inputSchema: inputProperties,
  outputSchema: {
    resource_type: z.literal("goal"),
    id: z.string().uuid(),
    applied: z.boolean(),
    changed_fields: z.array(z.enum(CHANGE_FIELDS)),
    before: goalViewSchema,
    after: goalViewSchema,
    updated_at_before: z.string(),
    updated_at_after: z.string(),
    warnings: z.array(goalWriteWarningSchema),
    data_complete: z.literal(true),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async (rawInput, ctx) => {
    const userId = ctx.getUserId();
    if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
    const parsed = inputValidator.safeParse(rawInput);
    if (!parsed.success) {
      return mcpError(
        parsed.error.issues.some((issue) => issue.path[0] === "changes")
          ? "INVALID_PATCH"
          : "INVALID_INPUT",
      );
    }
    const input = parsed.data;
    const supabase = supabaseForUser(ctx);
    const currentResult = await supabase
      .from("budget_goals")
      .select(COLUMNS)
      .eq("id", input.goal_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (currentResult.error) return mcpError("INTERNAL_ERROR");
    if (!currentResult.data) return mcpError("RESOURCE_NOT_FOUND");
    const current = currentResult.data as GoalRow;
    if (current.updated_at !== input.expected_updated_at) {
      return mcpError(
        "CONCURRENT_MODIFICATION",
        "A meta mensal foi alterada desde a leitura. Releia a meta com list_goals antes de tentar novamente.",
      );
    }
    const before = goalWriteView(current, userId);
    if (!before) return mcpError("INVALID_DATA");

    const changes = input.changes;
    const finalType = (changes.type ?? current.type) as GoalType;
    const typeChanged = finalType !== current.type;
    let finalCategory = current.category;
    const finalKind = goalCategoryKind(finalType);
    if (finalKind === null) {
      if (changes.category !== undefined && changes.category !== null) {
        return mcpError("INVALID_GOAL_CONFIGURATION");
      }
      finalCategory = null;
    } else if (typeChanged) {
      if (changes.category === undefined || changes.category === null) {
        return mcpError("INVALID_GOAL_CONFIGURATION");
      }
      finalCategory = changes.category;
    } else if (changes.category !== undefined) {
      finalCategory = changes.category;
    }
    if (!validGoalConfiguration(finalType, finalCategory)) {
      return mcpError("INVALID_GOAL_CONFIGURATION");
    }

    const categoryNeedsValidation =
      finalCategory !== current.category || (typeChanged && finalKind !== null);
    if (categoryNeedsValidation) {
      if (finalKind === "expense") {
        const resolution = await resolveExpenseGoalCategoryReference(
          supabase,
          userId,
          finalCategory!,
        );
        if (resolution.status === "error") return mcpError("INTERNAL_ERROR");
        if (resolution.status === "not_found") {
          return mcpError("CATEGORY_NOT_FOUND");
        }
        finalCategory = resolution.reference;
      }
      if (finalKind === "income") {
        const parsedCategory = z.string().uuid().safeParse(finalCategory);
        if (!parsedCategory.success) return mcpError("CATEGORY_NOT_FOUND");
        const categoryResult = await supabase
          .from("user_income_categories")
          .select("id")
          .eq("id", parsedCategory.data)
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();
        if (categoryResult.error) return mcpError("INTERNAL_ERROR");
        if (!categoryResult.data) return mcpError("CATEGORY_NOT_FOUND");
        finalCategory = categoryResult.data.id;
      }
    }

    const categoryChanged = finalCategory !== current.category;
    const patch: Record<string, unknown> = {};
    const changedFields: ChangeField[] = [];
    if (typeChanged) {
      patch.type = finalType;
      changedFields.push("type");
    }
    if (categoryChanged) {
      patch.category = finalCategory;
      changedFields.push("category");
    }
    if (
      changes.limit_amount !== undefined &&
      changes.limit_amount !== Number(current.limit_amount)
    ) {
      patch.limit_amount = changes.limit_amount;
      changedFields.push("limit_amount");
    }
    const baseWarnings: GoalWriteWarning[] = ["MONTHLY_GOAL_ONLY"];
    if (current.shared_group_id) baseWarnings.push("SHARED_GOAL_UPDATED");
    if (typeChanged) baseWarnings.push("GOAL_TYPE_CHANGED");
    if (categoryChanged) baseWarnings.push("CATEGORY_REFERENCE_UPDATED");

    if (changedFields.length === 0) {
      const result = {
        resource_type: "goal" as const,
        id: current.id,
        applied: false,
        changed_fields: changedFields,
        before,
        after: before,
        updated_at_before: current.updated_at,
        updated_at_after: current.updated_at,
        warnings: [...baseWarnings, "NO_EFFECTIVE_CHANGES"] as GoalWriteWarning[],
        data_complete: true as const,
      };
      return {
        content: [{ type: "text" as const, text: updateGoalContent(result) }],
        structuredContent: result,
      };
    }

    const updateResult = await supabase
      .from("budget_goals")
      .update(patch)
      .eq("id", input.goal_id)
      .eq("user_id", userId)
      .eq("updated_at", input.expected_updated_at)
      .select(COLUMNS)
      .maybeSingle();
    if (updateResult.error) return mcpError("WRITE_FAILED");
    if (!updateResult.data) {
      const existence = await supabase
        .from("budget_goals")
        .select("id,updated_at")
        .eq("id", input.goal_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existence.error) return mcpError("INTERNAL_ERROR");
      return mcpError(
        existence.data ? "CONCURRENT_MODIFICATION" : "RESOURCE_NOT_FOUND",
        existence.data
          ? "A meta mensal mudou durante a atualização. Releia a meta com list_goals antes de tentar novamente."
          : undefined,
      );
    }
    const after = goalWriteView(updateResult.data as GoalRow, userId);
    if (!after) return mcpError("INVALID_DATA");
    const result = {
      resource_type: "goal" as const,
      id: after.id,
      applied: true,
      changed_fields: changedFields,
      before,
      after,
      updated_at_before: current.updated_at,
      updated_at_after: after.updated_at,
      warnings: baseWarnings,
      data_complete: true as const,
    };
    return {
      content: [{ type: "text" as const, text: updateGoalContent(result) }],
      structuredContent: result,
    };
  },
});
