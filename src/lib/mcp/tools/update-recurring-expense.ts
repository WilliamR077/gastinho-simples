import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpError } from "../shared/errors";
import {
  cardSupports,
  expectedUpdatedAtSchema,
  recurringContent,
  recurringExpenseChangesSchema,
  recurringExpenseView,
  recurringExpenseViewSchema,
  recurringWarningSchema,
  recurringWarnings,
  usesCard,
  validateRecurringRange,
  type RecurringExpenseWriteRow,
  type RecurringWriteWarning,
} from "../shared/recurring-write";
import { supabaseForUser } from "../shared/supabase-client";

const COLUMNS =
  "id,user_id,description,amount,day_of_month,start_date,end_date,is_active,category_id,category_name,category_icon,payment_method,card_id,card_name,card_color,shared_group_id,created_at,updated_at";
const CHANGE_FIELDS = [
  "description",
  "amount",
  "day_of_month",
  "start_date",
  "end_date",
  "category_id",
  "payment_method",
  "card_id",
  "is_active",
] as const;
type ChangeField = (typeof CHANGE_FIELDS)[number];

const inputProperties = {
  recurring_expense_id: z.string().uuid(),
  expected_updated_at: expectedUpdatedAtSchema,
  changes: recurringExpenseChangesSchema,
};
const inputValidator = z.object(inputProperties).strict();

export default defineTool({
  name: "update_recurring_expense",
  title: "Editar template mensal de despesa",
  description:
    "Edita parcialmente somente um template mensal de despesa pertencente à conta autenticada, com concorrência otimista. Não altera despesas reais.",
  inputSchema: inputProperties,
  outputSchema: {
    resource_type: z.literal("recurring_expense"),
    id: z.string().uuid(),
    applied: z.boolean(),
    changed_fields: z.array(z.enum(CHANGE_FIELDS)),
    before: recurringExpenseViewSchema,
    after: recurringExpenseViewSchema,
    updated_at_before: z.string(),
    updated_at_after: z.string(),
    warnings: z.array(recurringWarningSchema),
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
    const before = recurringExpenseView(current);
    if (!before || !recurringExpenseViewSchema.safeParse(before).success) {
      return mcpError("INVALID_DATA");
    }

    const changes = input.changes;
    const finalStartDate = changes.start_date ?? before.start_date;
    const finalEndDate =
      changes.end_date !== undefined ? changes.end_date : before.end_date;
    if (!validateRecurringRange(finalStartDate, finalEndDate)) {
      return mcpError("INVALID_DATE_RANGE");
    }
    const patch: Record<string, unknown> = {};
    const changedFields: ChangeField[] = [];
    const warnings: RecurringWriteWarning[] = [];
    const assign = <K extends ChangeField>(
      field: K,
      value: unknown,
      currentValue: unknown,
    ) => {
      if (value !== undefined && value !== currentValue) {
        patch[field] = value;
        changedFields.push(field);
      }
    };
    assign("description", changes.description, current.description);
    assign("amount", changes.amount, Number(current.amount));
    assign("day_of_month", changes.day_of_month, current.day_of_month);
    assign("start_date", changes.start_date, before.start_date);
    assign("end_date", changes.end_date, before.end_date);
    assign("is_active", changes.is_active, current.is_active);

    if (
      changes.category_id !== undefined &&
      changes.category_id !== current.category_id
    ) {
      if (changes.category_id === null) {
        patch.category_id = null;
        patch.category_name = null;
        patch.category_icon = null;
      } else {
        const category = await supabase
          .from("user_categories")
          .select("name,icon,is_active")
          .eq("id", changes.category_id)
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();
        if (category.error) return mcpError("INTERNAL_ERROR");
        if (!category.data) return mcpError("CATEGORY_NOT_FOUND");
        patch.category_id = changes.category_id;
        patch.category_name = category.data.name;
        patch.category_icon = category.data.icon;
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
    if (
      finalCardId !== null &&
      (cardChanged || finalPaymentMethod !== current.payment_method)
    ) {
      const card = await supabase
        .from("cards")
        .select("name,color,card_type,is_active")
        .eq("id", finalCardId)
        .eq("user_id", userId)
        .maybeSingle();
      if (card.error) return mcpError("INTERNAL_ERROR");
      if (!card.data || (cardChanged && card.data.is_active !== true)) {
        return mcpError("CARD_NOT_FOUND");
      }
      if (!cardSupports(card.data.card_type, finalPaymentMethod)) {
        return mcpError("BUSINESS_RULE_VIOLATION");
      }
      if (cardChanged) {
        patch.card_id = finalCardId;
        patch.card_name = card.data.name;
        patch.card_color = card.data.color;
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
        resource_type: "recurring_expense" as const,
        id: current.id,
        applied: false,
        changed_fields: changedFields,
        before,
        after: before,
        updated_at_before: current.updated_at,
        updated_at_after: current.updated_at,
        warnings: [
          "RECURRING_TEMPLATE_ONLY",
          "NO_EFFECTIVE_CHANGES",
        ] as RecurringWriteWarning[],
        data_complete: true as const,
      };
      return {
        content: [{ type: "text" as const, text: recurringContent(result) }],
        structuredContent: result,
      };
    }

    const updateResult = await supabase
      .from("recurring_expenses")
      .update(patch)
      .eq("id", input.recurring_expense_id)
      .eq("user_id", userId)
      .eq("updated_at", input.expected_updated_at)
      .select(COLUMNS)
      .maybeSingle();
    if (updateResult.error) return mcpError("WRITE_FAILED");
    if (!updateResult.data) {
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
    const after = recurringExpenseView(
      updateResult.data as RecurringExpenseWriteRow,
    );
    if (!after || !recurringExpenseViewSchema.safeParse(after).success) {
      return mcpError("INVALID_DATA");
    }
    warnings.unshift(...recurringWarnings(after.day_of_month, after.start_date));
    if (before.is_shared) warnings.push("SHARED_TEMPLATE_UPDATED");
    const result = {
      resource_type: "recurring_expense" as const,
      id: current.id,
      applied: true,
      changed_fields: changedFields,
      before,
      after,
      updated_at_before: current.updated_at,
      updated_at_after: after.updated_at,
      warnings: [...new Set(warnings)],
      data_complete: true as const,
    };
    return {
      content: [{ type: "text" as const, text: recurringContent(result) }],
      structuredContent: result,
    };
  },
});
