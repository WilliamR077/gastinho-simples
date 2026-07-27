export const INSTALLMENT_DATA_WARNINGS = [
  "MISSING_INSTALLMENT_NUMBER",
  "MISSING_TOTAL_INSTALLMENTS",
  "INSTALLMENT_NUMBER_EXCEEDS_TOTAL",
  "TOTAL_INSTALLMENTS_BELOW_TWO",
  "MISSING_INSTALLMENT_GROUP_ID",
  "MISSING_CATEGORY",
  "NON_CREDIT_PAYMENT_METHOD",
] as const;

export type InstallmentDataWarning = (typeof INSTALLMENT_DATA_WARNINGS)[number];

export const INSTALLMENT_SERIES_WARNINGS = [
  "INACTIVE_CARD",
  "SERIES_COMPLETENESS_NOT_VERIFIED",
  "INCONSISTENT_INSTALLMENT_METADATA_PRESENT",
] as const;

export interface InstallmentEvidence {
  installment_group_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
}

export function hasInstallmentEvidence(row: InstallmentEvidence): boolean {
  return (
    row.installment_group_id !== null ||
    (row.installment_number ?? 0) > 1 ||
    (row.total_installments ?? 0) > 1
  );
}

export function installmentWarnings(
  row: InstallmentEvidence & {
    category_id: string | null;
    category_name: string | null;
    payment_method: string;
  },
): InstallmentDataWarning[] {
  const warnings: InstallmentDataWarning[] = [];
  if (row.installment_number === null) warnings.push("MISSING_INSTALLMENT_NUMBER");
  if (row.total_installments === null) warnings.push("MISSING_TOTAL_INSTALLMENTS");
  if (
    row.installment_number !== null &&
    row.total_installments !== null &&
    row.installment_number > row.total_installments
  ) {
    warnings.push("INSTALLMENT_NUMBER_EXCEEDS_TOTAL");
  }
  if (row.total_installments !== null && row.total_installments < 2) {
    warnings.push("TOTAL_INSTALLMENTS_BELOW_TWO");
  }
  if (row.installment_group_id === null) warnings.push("MISSING_INSTALLMENT_GROUP_ID");
  if (row.category_id === null || row.category_name === null) warnings.push("MISSING_CATEGORY");
  if (row.payment_method !== "credit") warnings.push("NON_CREDIT_PAYMENT_METHOD");
  return warnings;
}
