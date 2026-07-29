import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  billingAdjustmentWarning,
  cardChangesSchema,
  cardViewSchema,
  cardWriteView,
  cardWriteWarningSchema,
  deriveBillingDays,
  expectedUpdatedAtSchema,
  referenceSummarySchema,
  supportsCredit,
  updateCardContent,
  type CardReferenceSummary,
  type CardWriteRow,
  type CardWriteWarning,
} from "../shared/card-write";
import { todayIso } from "../shared/dates";
import { mcpError } from "../shared/errors";
import { supabaseForUser } from "../shared/supabase-client";

const COLUMNS =
  "id,user_id,name,card_type,color,card_limit,opening_day,closing_day,due_day,days_before_due,is_active,created_at,updated_at";
const CHANGE_FIELDS = [
  "name",
  "card_type",
  "color",
  "card_limit",
  "opening_day",
  "closing_day",
  "due_day",
  "days_before_due",
  "is_active",
] as const;
type ChangeField = (typeof CHANGE_FIELDS)[number];
const inputProperties = {
  card_id: z.string().uuid(),
  expected_updated_at: expectedUpdatedAtSchema,
  changes: cardChangesSchema,
};
const inputValidator = z.object(inputProperties).strict();

const emptyReferenceSummary = (): CardReferenceSummary => ({
  historical_expense_count: null,
  future_materialized_expense_count: null,
  active_recurring_template_count: null,
});

export default defineTool({
  name: "update_card",
  title: "Editar cartão",
  description:
    "Edita parcialmente um cadastro pessoal de cartão com concorrência otimista. Não altera despesas, parcelas, templates ou o cartão no banco emissor.",
  inputSchema: inputProperties,
  outputSchema: {
    resource_type: z.literal("card"),
    id: z.string().uuid(),
    applied: z.boolean(),
    changed_fields: z.array(z.enum(CHANGE_FIELDS)),
    before: cardViewSchema,
    after: cardViewSchema,
    updated_at_before: z.string(),
    updated_at_after: z.string(),
    reference_summary: referenceSummarySchema,
    warnings: z.array(cardWriteWarningSchema),
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
      .from("cards")
      .select(COLUMNS)
      .eq("id", input.card_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (currentResult.error) return mcpError("INTERNAL_ERROR");
    if (!currentResult.data) return mcpError("RESOURCE_NOT_FOUND");
    const current = currentResult.data as CardWriteRow;
    if (current.updated_at !== input.expected_updated_at) {
      return mcpError(
        "CONCURRENT_MODIFICATION",
        "O cartão foi alterado desde a leitura. Releia o cadastro com list_cards antes de tentar novamente.",
      );
    }
    const before = cardWriteView(current, userId);
    if (!before) return mcpError("INVALID_DATA");
    const changes = input.changes;
    const finalType = changes.card_type ?? before.card_type;
    const finalCredit = supportsCredit(finalType);
    const crossingToCredit =
      !supportsCredit(before.card_type) && finalCredit;
    const billingWasExplicit =
      changes.due_day !== undefined ||
      changes.days_before_due !== undefined;
    let finalDueDay =
      changes.due_day !== undefined ? changes.due_day : before.due_day;
    let finalDaysBefore =
      changes.days_before_due !== undefined
        ? changes.days_before_due
        : before.days_before_due;
    let finalOpeningDay = before.opening_day;
    let finalClosingDay = before.closing_day;

    if (finalCredit && changes.days_before_due === null) {
      return mcpError("INVALID_CARD_CONFIGURATION");
    }
    if (!finalCredit) {
      if (
        (changes.due_day !== undefined && changes.due_day !== null) ||
        (changes.days_before_due !== undefined &&
          changes.days_before_due !== null)
      ) {
        return mcpError("INVALID_CARD_CONFIGURATION");
      }
      finalDueDay = null;
      finalDaysBefore = null;
      finalOpeningDay = null;
      finalClosingDay = null;
    } else if (finalDueDay !== null) {
      finalDaysBefore ??= 10;
      const billing = deriveBillingDays(finalDueDay, finalDaysBefore);
      finalOpeningDay = billing.opening_day;
      finalClosingDay = billing.closing_day;
    } else {
      const legacyValid =
        !crossingToCredit &&
        !billingWasExplicit &&
        Number.isInteger(before.opening_day) &&
        Number.isInteger(before.closing_day) &&
        before.opening_day !== null &&
        before.closing_day !== null &&
        before.opening_day >= 1 &&
        before.opening_day <= 31 &&
        before.closing_day >= 1 &&
        before.closing_day <= 31;
      if (!legacyValid) return mcpError("INVALID_CARD_CONFIGURATION");
    }

    const finalValues = {
      name: changes.name ?? before.name,
      card_type: finalType,
      color: changes.color ?? before.color,
      card_limit:
        changes.card_limit !== undefined
          ? changes.card_limit
          : before.card_limit,
      opening_day: finalOpeningDay,
      closing_day: finalClosingDay,
      due_day: finalDueDay,
      days_before_due: finalDaysBefore,
      is_active: changes.is_active ?? before.is_active,
    };
    const patch: Record<string, unknown> = {};
    const changedFields: ChangeField[] = [];
    for (const field of CHANGE_FIELDS) {
      if (finalValues[field] !== before[field]) {
        patch[field] = finalValues[field];
        changedFields.push(field);
      }
    }

    const deactivating = before.is_active && !finalValues.is_active;
    let referenceSummary = emptyReferenceSummary();
    let futureInstallmentCount = 0;
    if (deactivating) {
      const today = todayIso();
      const historicalResult = await supabase
        .from("expenses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("card_id", input.card_id)
        .lte("expense_date", today);
      const futureResult = await supabase
        .from("expenses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("card_id", input.card_id)
        .gt("expense_date", today);
      const futureInstallmentResult = await supabase
        .from("expenses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("card_id", input.card_id)
        .gt("expense_date", today)
        .not("installment_group_id", "is", null);
      const recurringResult = await supabase
        .from("recurring_expenses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("card_id", input.card_id)
        .eq("is_active", true);
      if (
        historicalResult.error ||
        futureResult.error ||
        futureInstallmentResult.error ||
        recurringResult.error
      ) {
        return mcpError("INTERNAL_ERROR");
      }
      referenceSummary = {
        historical_expense_count: historicalResult.count ?? 0,
        future_materialized_expense_count: futureResult.count ?? 0,
        active_recurring_template_count: recurringResult.count ?? 0,
      };
      futureInstallmentCount = futureInstallmentResult.count ?? 0;
    }

    if (changedFields.length === 0) {
      const result = {
        resource_type: "card" as const,
        id: before.id,
        applied: false,
        changed_fields: changedFields,
        before,
        after: before,
        updated_at_before: before.updated_at,
        updated_at_after: before.updated_at,
        reference_summary: referenceSummary,
        warnings: ["NO_EFFECTIVE_CHANGES"] as CardWriteWarning[],
        data_complete: true as const,
      };
      return {
        content: [{ type: "text" as const, text: updateCardContent(result) }],
        structuredContent: result,
      };
    }

    const updateResult = await supabase
      .from("cards")
      .update(patch)
      .eq("id", input.card_id)
      .eq("user_id", userId)
      .eq("updated_at", input.expected_updated_at)
      .select(COLUMNS)
      .maybeSingle();
    if (updateResult.error) return mcpError("WRITE_FAILED");
    if (!updateResult.data) {
      const existence = await supabase
        .from("cards")
        .select("id,updated_at")
        .eq("id", input.card_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existence.error) return mcpError("INTERNAL_ERROR");
      return mcpError(
        existence.data ? "CONCURRENT_MODIFICATION" : "RESOURCE_NOT_FOUND",
        existence.data
          ? "O cartão mudou durante a atualização. Releia o cadastro com list_cards antes de tentar novamente."
          : undefined,
      );
    }
    const after = cardWriteView(updateResult.data as CardWriteRow, userId);
    if (!after) return mcpError("INVALID_DATA");
    const warnings: CardWriteWarning[] = ["CARD_UPDATED"];
    if (before.card_type !== after.card_type) warnings.push("CARD_TYPE_CHANGED");
    if (before.is_active && !after.is_active) warnings.push("CARD_DEACTIVATED");
    if (!before.is_active && after.is_active) warnings.push("CARD_REACTIVATED");
    if (after.card_limit === null) warnings.push("CARD_WITHOUT_LIMIT");
    if (billingAdjustmentWarning(after.due_day)) {
      warnings.push("BILLING_DAY_MAY_BE_ADJUSTED");
    }
    if ((referenceSummary.historical_expense_count ?? 0) > 0) {
      warnings.push("HISTORICAL_CARD_REFERENCES_PRESERVED");
    }
    if (futureInstallmentCount > 0) {
      warnings.push("FUTURE_INSTALLMENTS_PRESERVED");
    }
    if ((referenceSummary.active_recurring_template_count ?? 0) > 0) {
      warnings.push("ACTIVE_RECURRING_TEMPLATES_REFERENCE_CARD");
    }
    const result = {
      resource_type: "card" as const,
      id: after.id,
      applied: true,
      changed_fields: changedFields,
      before,
      after,
      updated_at_before: before.updated_at,
      updated_at_after: after.updated_at,
      reference_summary: referenceSummary,
      warnings,
      data_complete: true as const,
    };
    return {
      content: [{ type: "text" as const, text: updateCardContent(result) }],
      structuredContent: result,
    };
  },
});
