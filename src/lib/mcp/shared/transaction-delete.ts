import { z } from "zod";

export const DELETE_WARNINGS = [
  "ONLY_ONE_INSTALLMENT_DELETED",
  "SHARED_RECORD_DELETED",
  "PERMANENT_DELETION",
] as const;
export type DeleteWarning = (typeof DELETE_WARNINGS)[number];
export const deleteWarningSchema = z.enum(DELETE_WARNINGS);

interface RecognizableRecord {
  description: string;
  amount: number;
  is_shared: boolean;
  installment_group_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
  expense_date?: string;
  income_date?: string;
}

export function confirmationRequiredContent(
  resourceType: "expense" | "income",
  record: RecognizableRecord,
  installmentConfirmationMissing: boolean,
): string {
  const label = resourceType === "expense" ? "despesa" : "receita";
  const date = record.expense_date ?? record.income_date ?? "desconhecida";
  const installment = record.installment_group_id !== null ||
    (record.installment_number ?? 0) > 1 ||
    (record.total_installments ?? 0) > 1;
  const missing = installmentConfirmationMissing
    ? "Falta confirm_single_installment_delete=true. "
    : "Falta confirm_delete=true. ";
  return (
    `Nada foi excluído. ${missing}A exclusão desta ${label} é definitiva: ` +
    `description=${JSON.stringify(record.description)}; amount=${record.amount}; date=${date}; ` +
    `is_shared=${record.is_shared}; installment=${installment}; ` +
    `installment_number=${record.installment_number ?? "null"}; ` +
    `total_installments=${record.total_installments ?? "null"}. ` +
    (installment
      ? "Somente a parcela selecionada seria removida; nenhuma outra parcela seria excluída. "
      : "") +
    "Releia os dados e repita a operação com a confirmação explícita necessária."
  );
}

export function deleteContent(result: {
  resource_type: "expense" | "income";
  id: string;
  deleted_record: RecognizableRecord;
  operation_completed_at: string;
  warnings: DeleteWarning[];
}): string {
  const label = result.resource_type === "expense" ? "despesa" : "receita";
  const record = result.deleted_record;
  const date = record.expense_date ?? record.income_date ?? "desconhecida";
  const installment = record.installment_group_id !== null ||
    (record.installment_number ?? 0) > 1 ||
    (record.total_installments ?? 0) > 1;
  const installmentText = installment
    ? ` Foi excluída somente a parcela ${record.installment_number ?? "desconhecida"}/${record.total_installments ?? "desconhecido"}; nenhuma outra parcela foi removida e a série poderá ficar incompleta.`
    : "";
  const sharedText = record.is_shared
    ? " A transação compartilhada criada por você foi removida e deixará de aparecer no grupo."
    : "";
  return (
    `Foi excluída definitivamente a ${label} ${result.id}: ` +
    `description=${JSON.stringify(record.description)}; amount=${record.amount}; date=${date}.` +
    installmentText +
    sharedText +
    " Cartão, categoria, grupo, meta e templates recorrentes não foram excluídos." +
    ` warnings=${JSON.stringify(result.warnings)}; ` +
    `operation_completed_at=${result.operation_completed_at}.`
  );
}
