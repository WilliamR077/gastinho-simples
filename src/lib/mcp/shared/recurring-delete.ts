import { z } from "zod";

export const RECURRING_DELETE_WARNINGS = [
  "PERMANENT_DELETION",
  "RECURRING_TEMPLATE_DELETED",
  "SHARED_TEMPLATE_DELETED",
  "FORECAST_WILL_CHANGE",
] as const;
export type RecurringDeleteWarning =
  (typeof RECURRING_DELETE_WARNINGS)[number];
export const recurringDeleteWarningSchema = z.enum(
  RECURRING_DELETE_WARNINGS,
);

interface RecognizableTemplate {
  description: string;
  amount: number;
  day_of_month: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  category_name: string | null;
  is_shared: boolean;
  payment_method?: string;
  card_name?: string | null;
}

function templateFacts(
  resourceType: "recurring_expense" | "recurring_income",
  template: RecognizableTemplate,
): string {
  return (
    `description=${JSON.stringify(template.description)}; amount=${template.amount}; ` +
    `day_of_month=${template.day_of_month}; start_date=${template.start_date ?? "null"}; ` +
    `end_date=${template.end_date ?? "null"}; is_active=${template.is_active}; ` +
    `category=${JSON.stringify(template.category_name)}; ` +
    (resourceType === "recurring_expense"
      ? `payment_method=${template.payment_method}; card=${JSON.stringify(template.card_name ?? null)}; `
      : "") +
    `scope=${template.is_shared ? "shared" : "personal"}`
  );
}

export function recurringDeleteConfirmationContent(
  resourceType: "recurring_expense" | "recurring_income",
  template: RecognizableTemplate,
): string {
  const label =
    resourceType === "recurring_expense"
      ? "template mensal de despesa"
      : "template mensal de receita";
  return (
    `Nada foi removido. Falta confirm_delete=true. A exclusão deste ${label} é permanente: ` +
    `${templateFacts(resourceType, template)}. ` +
    "Somente o template será removido; nenhuma despesa, receita, parcela ou ocorrência real será excluída ou alterada. " +
    "Releia o template e repita a chamada com a confirmação explícita e o expected_updated_at atual."
  );
}

export function recurringDeleteContent(result: {
  resource_type: "recurring_expense" | "recurring_income";
  id: string;
  deletion_mode: "permanent";
  deleted_template: RecognizableTemplate;
  operation_completed_at: string;
  warnings: RecurringDeleteWarning[];
}): string {
  const label =
    result.resource_type === "recurring_expense"
      ? "template mensal de despesa"
      : "template mensal de receita";
  const shared = result.deleted_template.is_shared
    ? " O template compartilhado deixará de aparecer nas projeções do grupo; o grupo e os templates de outros membros foram preservados."
    : "";
  return (
    `Foi excluído permanentemente o ${label} ${result.id}: ` +
    `${templateFacts(result.resource_type, result.deleted_template)}.` +
    shared +
    " O template mensal foi removido. Nenhuma despesa ou receita real foi excluída ou alterada. " +
    "Ele não participará dos forecasts futuros calculados a partir dos templates atualmente cadastrados. " +
    "Nenhum compromisso, cobrança, recebimento ou notificação externa ao aplicativo foi cancelado. " +
    `warnings=${JSON.stringify(result.warnings)}; ` +
    `operation_completed_at=${result.operation_completed_at}.`
  );
}
