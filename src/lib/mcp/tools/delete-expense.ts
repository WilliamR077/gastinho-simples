import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  confirmationRequiredContent,
  deleteContent,
  deleteWarningSchema,
  type DeleteWarning,
} from "../shared/transaction-delete";
import { mcpError } from "../shared/errors";
import { supabaseForUser } from "../shared/supabase-client";
import {
  expectedUpdatedAtSchema,
  expenseView,
  expenseViewSchema,
  isInstallment,
  type ExpenseUpdateRow,
} from "../shared/transaction-update";

const EXPENSE_COLUMNS =
  "id,user_id,description,amount,expense_date,category_id,category_name,category_icon,payment_method,card_id,card_name,card_color,shared_group_id,is_shared,installment_group_id,installment_number,total_installments,created_at,updated_at";

const inputProperties = {
  expense_id: z.string().uuid(),
  expected_updated_at: expectedUpdatedAtSchema,
  confirm_delete: z.boolean(),
  confirm_single_installment_delete: z.boolean().optional(),
};
const inputValidator = z
  .object({
    ...inputProperties,
    confirm_delete: z.boolean().optional(),
  })
  .strict();

export default defineTool({
  name: "delete_expense",
  title: "Excluir despesa definitivamente",
  description:
    "Exclui definitivamente uma única despesa pertencente à conta autenticada. Exige confirm_delete=true, expected_updated_at atual e confirmação adicional para parcelas.",
  inputSchema: inputProperties,
  outputSchema: {
    resource_type: z.literal("expense"),
    id: z.string().uuid(),
    deleted: z.literal(true),
    deletion_mode: z.literal("permanent"),
    deleted_record: expenseViewSchema,
    operation_completed_at: z.string(),
    warnings: z.array(deleteWarningSchema),
    data_complete: z.literal(true),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async (rawInput, ctx) => {
    if (!ctx.isAuthenticated() || !ctx.getUserId()) {
      return mcpError("UNAUTHENTICATED");
    }
    const parsed = inputValidator.safeParse(rawInput);
    if (!parsed.success) return mcpError("INVALID_INPUT");
    const input = parsed.data;
    const userId = ctx.getUserId()!;
    const supabase = supabaseForUser(ctx);

    const currentResult = await supabase
      .from("expenses")
      .select(EXPENSE_COLUMNS)
      .eq("id", input.expense_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (currentResult.error) return mcpError("INTERNAL_ERROR");
    if (!currentResult.data) return mcpError("RESOURCE_NOT_FOUND");
    const current = currentResult.data as ExpenseUpdateRow;
    if (current.updated_at !== input.expected_updated_at) {
      return mcpError("CONCURRENT_MODIFICATION");
    }
    const recognizable = expenseView(current);
    if (!recognizable || !expenseViewSchema.safeParse(recognizable).success) {
      return mcpError("INVALID_DATA");
    }
    if (input.confirm_delete !== true) {
      return mcpError(
        "CONFIRMATION_REQUIRED",
        confirmationRequiredContent("expense", recognizable, false),
      );
    }
    const installment = isInstallment(current);
    if (installment && input.confirm_single_installment_delete !== true) {
      return mcpError(
        "CONFIRMATION_REQUIRED",
        confirmationRequiredContent("expense", recognizable, true),
      );
    }

    const deleteResult = await supabase
      .from("expenses")
      .delete()
      .eq("id", input.expense_id)
      .eq("user_id", userId)
      .eq("updated_at", input.expected_updated_at)
      .select(EXPENSE_COLUMNS)
      .maybeSingle();
    if (deleteResult.error) return mcpError("WRITE_FAILED");
    if (!deleteResult.data) {
      const existence = await supabase
        .from("expenses")
        .select("id,updated_at")
        .eq("id", input.expense_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existence.error) return mcpError("INTERNAL_ERROR");
      return mcpError(
        existence.data ? "CONCURRENT_MODIFICATION" : "RESOURCE_NOT_FOUND",
      );
    }

    const deletedRecord = expenseView(deleteResult.data as ExpenseUpdateRow);
    if (!deletedRecord || !expenseViewSchema.safeParse(deletedRecord).success) {
      return mcpError("INVALID_DATA");
    }
    const warnings: DeleteWarning[] = ["PERMANENT_DELETION"];
    if (deletedRecord.is_shared) warnings.push("SHARED_RECORD_DELETED");
    if (installment) warnings.push("ONLY_ONE_INSTALLMENT_DELETED");
    const result = {
      resource_type: "expense" as const,
      id: deletedRecord.id,
      deleted: true as const,
      deletion_mode: "permanent" as const,
      deleted_record: deletedRecord,
      operation_completed_at: new Date().toISOString(),
      warnings,
      data_complete: true as const,
    };
    return {
      content: [{ type: "text" as const, text: deleteContent(result) }],
      structuredContent: result,
    };
  },
});
