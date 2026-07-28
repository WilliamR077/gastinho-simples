import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpError } from "../shared/errors";
import { supabaseForUser } from "../shared/supabase-client";
import {
  cardSupports,
  expectedUpdatedAtSchema,
  expenseChangesSchema,
  expenseView,
  expenseViewSchema,
  isInstallment,
  updateContent,
  updateWarningSchema,
  usesCard,
  type ExpenseUpdateRow,
  type UpdateWarning,
} from "../shared/transaction-update";

const EXPENSE_COLUMNS =
  "id,user_id,description,amount,expense_date,category_id,category_name,category_icon,payment_method,card_id,card_name,card_color,shared_group_id,is_shared,installment_group_id,installment_number,total_installments,created_at,updated_at";

const inputProperties = {
  expense_id: z.string().uuid(),
  expected_updated_at: expectedUpdatedAtSchema,
  changes: expenseChangesSchema,
  confirm_single_installment_update: z.boolean().optional(),
};
const inputValidator = z.object(inputProperties).strict();

export default defineTool({
  name: "update_expense",
  title: "Editar despesa com segurança",
  description:
    "Edita somente uma despesa pertencente à conta autenticada, com concorrência otimista por expected_updated_at. Parcelas exigem confirmação explícita e apenas a linha selecionada é alterada.",
  inputSchema: inputProperties,
  outputSchema: {
    resource_type: z.literal("expense"),
    id: z.string().uuid(),
    applied: z.boolean(),
    changed_fields: z.array(
      z.enum([
        "description",
        "amount",
        "expense_date",
        "category_id",
        "payment_method",
        "card_id",
      ]),
    ),
    before: expenseViewSchema,
    after: expenseViewSchema,
    updated_at_before: z.string(),
    updated_at_after: z.string(),
    warnings: z.array(updateWarningSchema),
    data_complete: z.boolean(),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
  },
  handler: async (rawInput, ctx) => {
    if (!ctx.isAuthenticated() || !ctx.getUserId()) {
      return mcpError("UNAUTHENTICATED");
    }
    const parsed = inputValidator.safeParse(rawInput);
    if (!parsed.success) {
      const changesInvalid = parsed.error.issues.some(
        (issue) => issue.path[0] === "changes",
      );
      return mcpError(changesInvalid ? "INVALID_PATCH" : "INVALID_INPUT");
    }
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
    if (
      isInstallment(current) &&
      input.confirm_single_installment_update !== true
    ) {
      return mcpError(
        "CONFIRMATION_REQUIRED",
        `Esta despesa é uma parcela individual ` +
          `(parcela=${current.installment_number ?? "desconhecida"}; ` +
          `total=${current.total_installments ?? "desconhecido"}). ` +
          "Somente esta linha seria alterada. Repita com confirm_single_installment_update=true.",
      );
    }

    const before = expenseView(current);
    if (!before || !expenseViewSchema.safeParse(before).success) {
      return mcpError("INVALID_DATA");
    }
    const patch: Record<string, unknown> = {};
    const changedFields: Array<
      | "description"
      | "amount"
      | "expense_date"
      | "category_id"
      | "payment_method"
      | "card_id"
    > = [];
    const warnings: UpdateWarning[] = [];
    const changes = input.changes;

    if (
      changes.description !== undefined &&
      changes.description !== current.description
    ) {
      patch.description = changes.description;
      changedFields.push("description");
    }
    if (
      changes.amount !== undefined &&
      changes.amount !== Number(current.amount)
    ) {
      patch.amount = changes.amount;
      changedFields.push("amount");
    }
    if (
      changes.expense_date !== undefined &&
      changes.expense_date !== before.expense_date
    ) {
      patch.expense_date = changes.expense_date;
      changedFields.push("expense_date");
    }

    if (
      changes.category_id !== undefined &&
      changes.category_id !== current.category_id
    ) {
      if (changes.category_id === null) {
        patch.category_id = null;
        patch.category_name = null;
        patch.category_icon = null;
      } else {
        const categoryResult = await supabase
          .from("user_categories")
          .select("name,icon,is_active")
          .eq("id", changes.category_id)
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();
        if (categoryResult.error) return mcpError("INTERNAL_ERROR");
        if (!categoryResult.data) return mcpError("CATEGORY_NOT_FOUND");
        patch.category_id = changes.category_id;
        patch.category_name = categoryResult.data.name;
        patch.category_icon = categoryResult.data.icon;
      }
      changedFields.push("category_id");
      warnings.push("CATEGORY_SNAPSHOT_UPDATED");
    }

    const finalPaymentMethod =
      changes.payment_method ?? current.payment_method;
    if (
      changes.payment_method !== undefined &&
      changes.payment_method !== current.payment_method
    ) {
      patch.payment_method = changes.payment_method;
      changedFields.push("payment_method");
    }

    let finalCardId =
      changes.card_id !== undefined ? changes.card_id : current.card_id;
    if (!usesCard(finalPaymentMethod)) {
      if (changes.card_id !== undefined && changes.card_id !== null) {
        return mcpError("BUSINESS_RULE_VIOLATION");
      }
      finalCardId = null;
    }
    const cardChanged = finalCardId !== current.card_id;
    if (finalCardId !== null && (cardChanged || finalPaymentMethod !== current.payment_method)) {
      const cardResult = await supabase
        .from("cards")
        .select("name,color,card_type,is_active")
        .eq("id", finalCardId)
        .eq("user_id", userId)
        .maybeSingle();
      if (cardResult.error) return mcpError("INTERNAL_ERROR");
      if (!cardResult.data || (cardChanged && cardResult.data.is_active !== true)) {
        return mcpError("CARD_NOT_FOUND");
      }
      if (!cardSupports(cardResult.data.card_type, finalPaymentMethod)) {
        return mcpError("BUSINESS_RULE_VIOLATION");
      }
      if (cardChanged) {
        patch.card_id = finalCardId;
        patch.card_name = cardResult.data.name;
        patch.card_color = cardResult.data.color;
      }
    } else if (cardChanged) {
      patch.card_id = null;
      patch.card_name = null;
      patch.card_color = null;
    }
    if (cardChanged) {
      changedFields.push("card_id");
      warnings.push("CARD_REFERENCE_UPDATED");
    }

    if (changedFields.length === 0) {
      const result = {
        resource_type: "expense" as const,
        id: current.id,
        applied: false,
        changed_fields: changedFields,
        before,
        after: before,
        updated_at_before: current.updated_at,
        updated_at_after: current.updated_at,
        warnings: ["NO_EFFECTIVE_CHANGES" as const],
        data_complete: true,
      };
      return {
        content: [{ type: "text" as const, text: updateContent(result) }],
        structuredContent: result,
      };
    }

    const updateResult = await supabase
      .from("expenses")
      .update(patch)
      .eq("id", input.expense_id)
      .eq("user_id", userId)
      .eq("updated_at", input.expected_updated_at)
      .select(EXPENSE_COLUMNS)
      .maybeSingle();
    if (updateResult.error) return mcpError("WRITE_FAILED");
    if (!updateResult.data) {
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

    const after = expenseView(updateResult.data as ExpenseUpdateRow);
    if (!after || !expenseViewSchema.safeParse(after).success) {
      return mcpError("INVALID_DATA");
    }
    if (before.is_shared) warnings.push("SHARED_RECORD_UPDATED");
    if (isInstallment(current)) warnings.push("ONLY_ONE_INSTALLMENT_UPDATED");
    const result = {
      resource_type: "expense" as const,
      id: current.id,
      applied: true,
      changed_fields: changedFields,
      before,
      after,
      updated_at_before: current.updated_at,
      updated_at_after: after.updated_at,
      warnings,
      data_complete: true,
    };
    return {
      content: [{ type: "text" as const, text: updateContent(result) }],
      structuredContent: result,
    };
  },
});
