import { z } from "zod";
import {
  type CardWriteView,
  cardViewSchema,
  supportsCredit,
} from "./card-write";

export const CARD_DELETE_WARNINGS = [
  "PERMANENT_DELETION",
  "CARD_DELETED",
  "BANK_ISSUER_UNAFFECTED",
] as const;
export type CardDeleteWarning = (typeof CARD_DELETE_WARNINGS)[number];
export const cardDeleteWarningSchema = z.enum(CARD_DELETE_WARNINGS);

export const cardDeleteReferenceSummarySchema = z
  .object({
    historical_expense_count: z.number().int().nonnegative(),
    future_materialized_expense_count: z.number().int().nonnegative(),
    installment_expense_count: z.number().int().nonnegative(),
    active_recurring_template_count: z.number().int().nonnegative(),
    inactive_recurring_template_count: z.number().int().nonnegative(),
    total_expense_reference_count: z.number().int().nonnegative(),
    total_recurring_reference_count: z.number().int().nonnegative(),
    total_reference_count: z.number().int().nonnegative(),
  })
  .strict();
export type CardDeleteReferenceSummary = z.infer<
  typeof cardDeleteReferenceSummarySchema
>;

export const emptyCardDeleteReferenceSummary =
  (): CardDeleteReferenceSummary => ({
    historical_expense_count: 0,
    future_materialized_expense_count: 0,
    installment_expense_count: 0,
    active_recurring_template_count: 0,
    inactive_recurring_template_count: 0,
    total_expense_reference_count: 0,
    total_recurring_reference_count: 0,
    total_reference_count: 0,
  });

export { cardViewSchema };

function cardFacts(card: CardWriteView): string {
  const billing = supportsCredit(card.card_type)
    ? `limite=${card.card_limit ?? "null"}; opening_day=${card.opening_day ?? "null"}; ` +
      `closing_day=${card.closing_day ?? "null"}; due_day=${card.due_day ?? "null"}; ` +
      `days_before_due=${card.days_before_due ?? "null"}`
    : "limite=null; sem ciclo de cobrança";
  return (
    `id=${card.id}; nome=${JSON.stringify(card.name)}; tipo=${card.card_type}; ` +
    `status=${card.is_active ? "ativo" : "inativo"}; cor=${card.color}; ${billing}`
  );
}

export function deleteCardConfirmationContent(card: CardWriteView): string {
  return (
    `Nada foi removido. Falta confirm_delete=true. A exclusão permanente deste cartão exige confirmação explícita: ${cardFacts(card)}. ` +
    "Não existe restauração pelo MCP. Nenhuma despesa, parcela, recorrência ou referência seria removida ou alterada. " +
    "Releia o cartão com list_cards e repita a chamada com confirm_delete=true e o expected_updated_at atual."
  );
}

export function activeCardDeletionBlockedContent(card: CardWriteView): string {
  return (
    `Nada foi removido. O cartão está ativo: ${cardFacts(card)}. ` +
    "Desative-o primeiro com update_card, releia-o com list_cards e só então solicite a exclusão permanente. " +
    "O Gastinho não alterou o cartão no banco emissor e nenhum dado bancário foi acessado."
  );
}

export function referencedCardDeletionBlockedContent(
  card: CardWriteView,
  summary: CardDeleteReferenceSummary,
): string {
  return (
    `Nada foi removido. A exclusão do cartão ${JSON.stringify(card.name)} foi bloqueada para preservar o histórico. ` +
    `Referências: despesas históricas=${summary.historical_expense_count}; ` +
    `lançamentos futuros=${summary.future_materialized_expense_count}; ` +
    `parcelas=${summary.installment_expense_count}; templates ativos=${summary.active_recurring_template_count}; ` +
    `templates inativos=${summary.inactive_recurring_template_count}; ` +
    `despesas distintas=${summary.total_expense_reference_count}; ` +
    `templates distintos=${summary.total_recurring_reference_count}; total distinto=${summary.total_reference_count}. ` +
    "Nenhuma despesa, parcela, recorrência ou card_id foi removido ou alterado. Mantenha o cartão desativado; não há exclusão em cascata."
  );
}

export function deleteCardContent(result: {
  id: string;
  deleted_card: CardWriteView;
  reference_summary: CardDeleteReferenceSummary;
  operation_completed_at: string;
  warnings: CardDeleteWarning[];
}): string {
  return (
    `Cartão excluído permanentemente somente do Gastinho: ${cardFacts(result.deleted_card)}. ` +
    `operation_completed_at=${result.operation_completed_at}; referências confirmadas=${JSON.stringify(result.reference_summary)}; ` +
    `warnings=${JSON.stringify(result.warnings)}. ` +
    "Nenhuma despesa, parcela ou recorrência foi removida ou alterada. O cartão não foi cancelado no banco emissor, " +
    "nenhuma comunicação foi enviada ao emissor e nenhum dado bancário foi acessado. Não existe restauração pelo MCP."
  );
}
