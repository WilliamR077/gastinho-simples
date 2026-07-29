import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpError } from "../shared/errors";
import {
  deleteGoalConfirmationContent,
  deleteGoalContent,
  expectedUpdatedAtSchema,
  goalViewSchema,
  goalWriteView,
  goalWriteWarningSchema,
  type GoalWriteWarning,
} from "../shared/goal-write";
import type { GoalRow } from "../shared/goals";
import { supabaseForUser } from "../shared/supabase-client";

const COLUMNS =
  "id,user_id,type,category,limit_amount,shared_group_id,created_at,updated_at";
const inputProperties = {
  goal_id: z.string().uuid(),
  expected_updated_at: expectedUpdatedAtSchema,
  confirm_delete: z.boolean(),
};
const inputValidator = z
  .object({ ...inputProperties, confirm_delete: z.boolean().optional() })
  .strict();

export default defineTool({
  name: "delete_goal",
  title: "Excluir meta mensal",
  description:
    "Exclui permanentemente uma meta mensal pertencente à conta autenticada, com confirmação e concorrência otimista. Não exclui transações.",
  inputSchema: inputProperties,
  outputSchema: {
    resource_type: z.literal("goal"),
    id: z.string().uuid(),
    deleted: z.literal(true),
    deletion_mode: z.literal("permanent"),
    deleted_goal: goalViewSchema,
    operation_completed_at: z.string(),
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
    if (!parsed.success) return mcpError("INVALID_INPUT");
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
    const recognizable = goalWriteView(current, userId);
    if (!recognizable) return mcpError("INVALID_DATA");

    const alertsResult = await supabase
      .from("budget_goal_alerts")
      .select("id")
      .eq("goal_id", input.goal_id)
      .eq("user_id", userId);
    if (alertsResult.error) return mcpError("INTERNAL_ERROR");
    const alertCount = alertsResult.data?.length ?? 0;

    if (input.confirm_delete !== true) {
      return mcpError(
        "CONFIRMATION_REQUIRED",
        deleteGoalConfirmationContent(recognizable, alertCount),
      );
    }

    const deleteResult = await supabase
      .from("budget_goals")
      .delete()
      .eq("id", input.goal_id)
      .eq("user_id", userId)
      .eq("updated_at", input.expected_updated_at)
      .select(COLUMNS)
      .maybeSingle();
    if (deleteResult.error) return mcpError("WRITE_FAILED");
    if (!deleteResult.data) {
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
          ? "A meta mensal mudou durante a exclusão. Releia a meta com list_goals antes de tentar novamente."
          : undefined,
      );
    }
    const deletedGoal = goalWriteView(deleteResult.data as GoalRow, userId);
    if (!deletedGoal) return mcpError("INVALID_DATA");
    const warnings: GoalWriteWarning[] = [
      "MONTHLY_GOAL_ONLY",
      "PERMANENT_DELETION",
      "GOAL_DELETED",
    ];
    if (deletedGoal.is_shared) warnings.push("SHARED_GOAL_DELETED");
    if (alertCount > 0) warnings.push("GOAL_ALERTS_DELETED");
    const operationCompletedAt = new Date().toISOString();
    const result = {
      resource_type: "goal" as const,
      id: deletedGoal.id,
      deleted: true as const,
      deletion_mode: "permanent" as const,
      deleted_goal: deletedGoal,
      operation_completed_at: operationCompletedAt,
      warnings,
      data_complete: true as const,
    };
    return {
      content: [
        {
          type: "text" as const,
          text: deleteGoalContent({
            ...result,
            deletedAlertCount: alertCount,
          }),
        },
      ],
      structuredContent: result,
    };
  },
});
