import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpError } from "../shared/errors";
import {
  expectedUpdatedAtSchema,
  recurringContent,
  recurringIncomeChangesSchema,
  recurringIncomeView,
  recurringIncomeViewSchema,
  recurringWarningSchema,
  recurringWarnings,
  validateRecurringRange,
  type RecurringIncomeWriteRow,
  type RecurringWriteWarning,
} from "../shared/recurring-write";
import { supabaseForUser } from "../shared/supabase-client";

const COLUMNS =
  "id,user_id,description,amount,day_of_month,start_date,end_date,is_active,income_category_id,category_name,category_icon,shared_group_id,created_at,updated_at";
const CHANGE_FIELDS = [
  "description",
  "amount",
  "day_of_month",
  "start_date",
  "end_date",
  "income_category_id",
  "is_active",
] as const;
type ChangeField = (typeof CHANGE_FIELDS)[number];

const inputProperties = {
  recurring_income_id: z.string().uuid(),
  expected_updated_at: expectedUpdatedAtSchema,
  changes: recurringIncomeChangesSchema,
};
const inputValidator = z.object(inputProperties).strict();

export default defineTool({
  name: "update_recurring_income",
  title: "Editar template mensal de receita",
  description:
    "Edita parcialmente somente um template mensal de receita pertencente à conta autenticada, com concorrência otimista. Não altera receitas reais.",
  inputSchema: inputProperties,
  outputSchema: {
    resource_type: z.literal("recurring_income"),
    id: z.string().uuid(),
    applied: z.boolean(),
    changed_fields: z.array(z.enum(CHANGE_FIELDS)),
    before: recurringIncomeViewSchema,
    after: recurringIncomeViewSchema,
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
      .from("recurring_incomes")
      .select(COLUMNS)
      .eq("id", input.recurring_income_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (currentResult.error) return mcpError("INTERNAL_ERROR");
    if (!currentResult.data) return mcpError("RESOURCE_NOT_FOUND");
    const current = currentResult.data as RecurringIncomeWriteRow;
    if (current.updated_at !== input.expected_updated_at) {
      return mcpError("CONCURRENT_MODIFICATION");
    }
    const before = recurringIncomeView(current);
    if (!before || !recurringIncomeViewSchema.safeParse(before).success) {
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
      changes.income_category_id !== undefined &&
      changes.income_category_id !== current.income_category_id
    ) {
      if (changes.income_category_id === null) {
        patch.income_category_id = null;
        patch.category_name = null;
        patch.category_icon = null;
      } else {
        const category = await supabase
          .from("user_income_categories")
          .select("name,icon,is_active")
          .eq("id", changes.income_category_id)
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();
        if (category.error) return mcpError("INTERNAL_ERROR");
        if (!category.data) return mcpError("CATEGORY_NOT_FOUND");
        patch.income_category_id = changes.income_category_id;
        patch.category_name = category.data.name;
        patch.category_icon = category.data.icon;
      }
      changedFields.push("income_category_id");
      warnings.push("CATEGORY_SNAPSHOT_UPDATED");
    }

    if (changedFields.length === 0) {
      const result = {
        resource_type: "recurring_income" as const,
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
      .from("recurring_incomes")
      .update(patch)
      .eq("id", input.recurring_income_id)
      .eq("user_id", userId)
      .eq("updated_at", input.expected_updated_at)
      .select(COLUMNS)
      .maybeSingle();
    if (updateResult.error) return mcpError("WRITE_FAILED");
    if (!updateResult.data) {
      const existence = await supabase
        .from("recurring_incomes")
        .select("id,updated_at")
        .eq("id", input.recurring_income_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existence.error) return mcpError("INTERNAL_ERROR");
      return mcpError(
        existence.data ? "CONCURRENT_MODIFICATION" : "RESOURCE_NOT_FOUND",
      );
    }
    const after = recurringIncomeView(
      updateResult.data as RecurringIncomeWriteRow,
    );
    if (!after || !recurringIncomeViewSchema.safeParse(after).success) {
      return mcpError("INVALID_DATA");
    }
    warnings.unshift(...recurringWarnings(after.day_of_month, after.start_date));
    if (before.is_shared) warnings.push("SHARED_TEMPLATE_UPDATED");
    const result = {
      resource_type: "recurring_income" as const,
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
