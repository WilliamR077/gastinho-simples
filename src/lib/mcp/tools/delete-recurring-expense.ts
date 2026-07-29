import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpError } from "../shared/errors";
import {
  recurringDeleteConfirmationContent,
  recurringDeleteContent,
  recurringDeleteWarningSchema,
  type RecurringDeleteWarning,
} from "../shared/recurring-delete";
import {
  expectedUpdatedAtSchema,
  recurringExpenseView,
  recurringExpenseViewSchema,
  type RecurringExpenseWriteRow,
} from "../shared/recurring-write";
import { supabaseForUser } from "../shared/supabase-client";

const COLUMNS =
  "id,user_id,description,amount,day_of_month,start_date,end_date,is_active,category_id,category_name,category_icon,payment_method,card_id,card_name,card_color,shared_group_id,created_at,updated_at";
const inputProperties = {
  recurring_expense_id: z.string().uuid(),
  expected_updated_at: expectedUpdatedAtSchema,
  confirm_delete: z.boolean(),
};
const inputValidator = z
  .object({ ...inputProperties, confirm_delete: z.boolean().optional() })
  .strict();

export default defineTool({
  name: "delete_recurring_expense",
  title: "Excluir template mensal de despesa",
  description:
    "Exclui permanentemente somente um template mensal de despesa pertencente à conta autenticada. Não exclui despesas nem ocorrências reais.",
  inputSchema: inputProperties,
  outputSchema: {
    resource_type: z.literal("recurring_expense"),
    id: z.string().uuid(),
    deleted: z.literal(true),
    deletion_mode: z.literal("permanent"),
    deleted_template: recurringExpenseViewSchema,
    operation_completed_at: z.string(),
    warnings: z.array(recurringDeleteWarningSchema),
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
      .from("recurring_expenses")
      .select(COLUMNS)
      .eq("id", input.recurring_expense_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (currentResult.error) return mcpError("INTERNAL_ERROR");
    if (!currentResult.data) return mcpError("RESOURCE_NOT_FOUND");
    const current = currentResult.data as RecurringExpenseWriteRow;
    if (current.updated_at !== input.expected_updated_at) {
      return mcpError("CONCURRENT_MODIFICATION");
    }
    const recognizable = recurringExpenseView(current);
    if (
      !recognizable ||
      !recurringExpenseViewSchema.safeParse(recognizable).success
    ) {
      return mcpError("INVALID_DATA");
    }
    if (input.confirm_delete !== true) {
      return mcpError(
        "CONFIRMATION_REQUIRED",
        recurringDeleteConfirmationContent(
          "recurring_expense",
          recognizable,
        ),
      );
    }

    const deleteResult = await supabase
      .from("recurring_expenses")
      .delete()
      .eq("id", input.recurring_expense_id)
      .eq("user_id", userId)
      .eq("updated_at", input.expected_updated_at)
      .select(COLUMNS)
      .maybeSingle();
    if (deleteResult.error) return mcpError("WRITE_FAILED");
    if (!deleteResult.data) {
      const existence = await supabase
        .from("recurring_expenses")
        .select("id,updated_at")
        .eq("id", input.recurring_expense_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existence.error) return mcpError("INTERNAL_ERROR");
      return mcpError(
        existence.data ? "CONCURRENT_MODIFICATION" : "RESOURCE_NOT_FOUND",
      );
    }
    const deletedTemplate = recurringExpenseView(
      deleteResult.data as RecurringExpenseWriteRow,
    );
    if (
      !deletedTemplate ||
      !recurringExpenseViewSchema.safeParse(deletedTemplate).success
    ) {
      return mcpError("INVALID_DATA");
    }
    const warnings: RecurringDeleteWarning[] = [
      "PERMANENT_DELETION",
      "RECURRING_TEMPLATE_DELETED",
      "FORECAST_WILL_CHANGE",
    ];
    if (deletedTemplate.is_shared) warnings.push("SHARED_TEMPLATE_DELETED");
    const result = {
      resource_type: "recurring_expense" as const,
      id: deletedTemplate.id,
      deleted: true as const,
      deletion_mode: "permanent" as const,
      deleted_template: deletedTemplate,
      operation_completed_at: new Date().toISOString(),
      warnings,
      data_complete: true as const,
    };
    return {
      content: [
        { type: "text" as const, text: recurringDeleteContent(result) },
      ],
      structuredContent: result,
    };
  },
});
