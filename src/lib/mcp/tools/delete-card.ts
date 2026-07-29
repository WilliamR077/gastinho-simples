import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  activeCardDeletionBlockedContent,
  cardDeleteReferenceSummarySchema,
  cardDeleteWarningSchema,
  deleteCardConfirmationContent,
  deleteCardContent,
  emptyCardDeleteReferenceSummary,
  referencedCardDeletionBlockedContent,
  type CardDeleteReferenceSummary,
  type CardDeleteWarning,
} from "../shared/card-delete";
import {
  cardViewSchema,
  cardWriteView,
  expectedUpdatedAtSchema,
  type CardWriteRow,
} from "../shared/card-write";
import { preserveSqlDate } from "../shared/cashflow";
import { todayIso } from "../shared/dates";
import { mcpError } from "../shared/errors";
import { supabaseForUser } from "../shared/supabase-client";

const COLUMNS =
  "id,user_id,name,card_type,color,card_limit,opening_day,closing_day,due_day,days_before_due,is_active,created_at,updated_at";
const inputProperties = {
  card_id: z.string().uuid(),
  expected_updated_at: expectedUpdatedAtSchema,
  confirm_delete: z.boolean(),
};
const inputValidator = z
  .object({ ...inputProperties, confirm_delete: z.boolean().optional() })
  .strict();

interface ExpenseReferenceRow {
  id: string;
  expense_date: unknown;
  installment_group_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
}

interface RecurringReferenceRow {
  id: string;
  is_active: boolean;
}

function referenceSummary(
  expenses: ExpenseReferenceRow[],
  recurring: RecurringReferenceRow[],
  today: string,
): CardDeleteReferenceSummary | null {
  const dates = expenses.map((row) => preserveSqlDate(row.expense_date));
  if (dates.some((date) => date === null)) return null;
  const historical = dates.filter((date) => date! <= today).length;
  const future = dates.length - historical;
  const installments = expenses.filter(
    (row) =>
      row.installment_group_id !== null ||
      (row.installment_number ?? 0) > 1 ||
      (row.total_installments ?? 0) > 1,
  ).length;
  const active = recurring.filter((row) => row.is_active).length;
  const inactive = recurring.length - active;
  return {
    historical_expense_count: historical,
    future_materialized_expense_count: future,
    installment_expense_count: installments,
    active_recurring_template_count: active,
    inactive_recurring_template_count: inactive,
    total_expense_reference_count: expenses.length,
    total_recurring_reference_count: recurring.length,
    total_reference_count: expenses.length + recurring.length,
  };
}

export default defineTool({
  name: "delete_card",
  title: "Excluir cartão",
  description:
    "Exclui permanentemente somente um cartão pessoal inativo, sem despesas, parcelas ou templates recorrentes vinculados, com confirmação e concorrência otimista.",
  inputSchema: inputProperties,
  outputSchema: {
    resource_type: z.literal("card"),
    id: z.string().uuid(),
    deleted: z.literal(true),
    deletion_mode: z.literal("permanent"),
    deleted_card: cardViewSchema,
    reference_summary: cardDeleteReferenceSummarySchema,
    operation_completed_at: z.string(),
    warnings: z.array(cardDeleteWarningSchema),
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
        "O cartão foi alterado desde a leitura. Releia-o com list_cards antes de tentar novamente.",
      );
    }
    const recognizable = cardWriteView(current, userId);
    if (!recognizable) return mcpError("INVALID_DATA");
    if (input.confirm_delete !== true) {
      return mcpError(
        "CONFIRMATION_REQUIRED",
        deleteCardConfirmationContent(recognizable),
      );
    }
    if (recognizable.is_active) {
      return mcpError(
        "CARD_MUST_BE_INACTIVE",
        activeCardDeletionBlockedContent(recognizable),
      );
    }

    const expensesResult = await supabase
      .from("expenses")
      .select(
        "id,expense_date,installment_group_id,installment_number,total_installments",
      )
      .eq("user_id", userId)
      .eq("card_id", input.card_id);
    const recurringResult = await supabase
      .from("recurring_expenses")
      .select("id,is_active")
      .eq("user_id", userId)
      .eq("card_id", input.card_id);
    if (expensesResult.error || recurringResult.error) {
      return mcpError("INTERNAL_ERROR");
    }
    const summary = referenceSummary(
      (expensesResult.data ?? []) as ExpenseReferenceRow[],
      (recurringResult.data ?? []) as RecurringReferenceRow[],
      todayIso(),
    );
    if (!summary) return mcpError("INVALID_DATA");
    if (summary.total_reference_count > 0) {
      return mcpError(
        "CARD_HAS_REFERENCES",
        referencedCardDeletionBlockedContent(recognizable, summary),
      );
    }

    const deleteResult = await supabase
      .from("cards")
      .delete()
      .eq("id", input.card_id)
      .eq("user_id", userId)
      .eq("updated_at", input.expected_updated_at)
      .eq("is_active", false)
      .select(COLUMNS)
      .maybeSingle();
    if (deleteResult.error) {
      return mcpError(
        "WRITE_FAILED",
        "Não foi possível excluir o cartão. Ele pode ter recebido uma referência; releia-o com list_cards e mantenha-o desativado.",
      );
    }
    if (!deleteResult.data) {
      const existence = await supabase
        .from("cards")
        .select("id,updated_at,is_active")
        .eq("id", input.card_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existence.error) return mcpError("INTERNAL_ERROR");
      if (!existence.data) return mcpError("RESOURCE_NOT_FOUND");
      if (existence.data.is_active) {
        return mcpError(
          "CARD_MUST_BE_INACTIVE",
          "Nada foi removido. O cartão foi reativado durante a exclusão. Releia-o com list_cards.",
        );
      }
      return mcpError(
        "CONCURRENT_MODIFICATION",
        "Nada foi removido. O cartão mudou durante a exclusão. Releia-o com list_cards.",
      );
    }
    const deletedCard = cardWriteView(
      deleteResult.data as CardWriteRow,
      userId,
    );
    if (!deletedCard) return mcpError("INVALID_DATA");
    const warnings: CardDeleteWarning[] = [
      "PERMANENT_DELETION",
      "CARD_DELETED",
      "BANK_ISSUER_UNAFFECTED",
    ];
    const result = {
      resource_type: "card" as const,
      id: deletedCard.id,
      deleted: true as const,
      deletion_mode: "permanent" as const,
      deleted_card: deletedCard,
      reference_summary: emptyCardDeleteReferenceSummary(),
      operation_completed_at: new Date().toISOString(),
      warnings,
      data_complete: true as const,
    };
    return {
      content: [{ type: "text" as const, text: deleteCardContent(result) }],
      structuredContent: result,
    };
  },
});
