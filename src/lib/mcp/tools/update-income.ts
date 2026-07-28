import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  timestampToSaoPauloCivilDate,
  zonedMidnightUtc,
} from "../shared/cashflow";
import { mcpError } from "../shared/errors";
import { supabaseForUser } from "../shared/supabase-client";
import {
  expectedUpdatedAtSchema,
  incomeChangesSchema,
  incomeView,
  incomeViewSchema,
  updateContent,
  updateWarningSchema,
  type IncomeUpdateRow,
  type UpdateWarning,
} from "../shared/transaction-update";

const INCOME_COLUMNS =
  "id,user_id,description,amount,income_date,income_category_id,category_name,category_icon,shared_group_id,installment_group_id,installment_number,total_installments,created_at,updated_at";

const inputProperties = {
  income_id: z.string().uuid(),
  expected_updated_at: expectedUpdatedAtSchema,
  changes: incomeChangesSchema,
};
const inputValidator = z.object(inputProperties).strict();

export default defineTool({
  name: "update_income",
  title: "Editar receita com segurança",
  description:
    "Edita somente uma receita pertencente à conta autenticada, com concorrência otimista por expected_updated_at. A alteração é parcial e nunca atualiza uma série inteira.",
  inputSchema: inputProperties,
  outputSchema: {
    resource_type: z.literal("income"),
    id: z.string().uuid(),
    applied: z.boolean(),
    changed_fields: z.array(
      z.enum(["description", "amount", "income_date", "income_category_id"]),
    ),
    before: incomeViewSchema,
    after: incomeViewSchema,
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
      .from("incomes")
      .select(INCOME_COLUMNS)
      .eq("id", input.income_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (currentResult.error) return mcpError("INTERNAL_ERROR");
    if (!currentResult.data) return mcpError("RESOURCE_NOT_FOUND");

    const current = currentResult.data as IncomeUpdateRow;
    if (current.updated_at !== input.expected_updated_at) {
      return mcpError("CONCURRENT_MODIFICATION");
    }
    const before = incomeView(current);
    if (!incomeViewSchema.safeParse(before).success) {
      return mcpError("INVALID_DATA");
    }
    const patch: Record<string, unknown> = {};
    const changedFields: Array<
      "description" | "amount" | "income_date" | "income_category_id"
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
    if (changes.income_date !== undefined) {
      const currentCivilDate = timestampToSaoPauloCivilDate(current.income_date);
      if (!currentCivilDate) return mcpError("INVALID_DATA");
      if (changes.income_date !== currentCivilDate) {
        patch.income_date = zonedMidnightUtc(changes.income_date);
        changedFields.push("income_date");
      }
    }
    if (
      changes.income_category_id !== undefined &&
      changes.income_category_id !== current.income_category_id
    ) {
      if (changes.income_category_id === null) {
        patch.income_category_id = null;
        patch.category_name = null;
        patch.category_icon = null;
      } else {
        const categoryResult = await supabase
          .from("user_income_categories")
          .select("name,icon,is_active")
          .eq("id", changes.income_category_id)
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();
        if (categoryResult.error) return mcpError("INTERNAL_ERROR");
        if (!categoryResult.data) return mcpError("CATEGORY_NOT_FOUND");
        patch.income_category_id = changes.income_category_id;
        patch.category_name = categoryResult.data.name;
        patch.category_icon = categoryResult.data.icon;
      }
      changedFields.push("income_category_id");
      warnings.push("CATEGORY_SNAPSHOT_UPDATED");
    }

    if (changedFields.length === 0) {
      const result = {
        resource_type: "income" as const,
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
      .from("incomes")
      .update(patch)
      .eq("id", input.income_id)
      .eq("user_id", userId)
      .eq("updated_at", input.expected_updated_at)
      .select(INCOME_COLUMNS)
      .maybeSingle();
    if (updateResult.error) return mcpError("WRITE_FAILED");
    if (!updateResult.data) {
      const existence = await supabase
        .from("incomes")
        .select("id,updated_at")
        .eq("id", input.income_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existence.error) return mcpError("INTERNAL_ERROR");
      return mcpError(
        existence.data ? "CONCURRENT_MODIFICATION" : "RESOURCE_NOT_FOUND",
      );
    }

    const after = incomeView(updateResult.data as IncomeUpdateRow);
    if (!incomeViewSchema.safeParse(after).success) {
      return mcpError("INVALID_DATA");
    }
    if (before.is_shared) warnings.push("SHARED_RECORD_UPDATED");
    const result = {
      resource_type: "income" as const,
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
