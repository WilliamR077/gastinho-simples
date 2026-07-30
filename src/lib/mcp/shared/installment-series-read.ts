import { z } from "zod";
import { hasInstallmentEvidence } from "./card-factual";
import { DEFAULT_TIME_ZONE, isValidIsoDate } from "./dates";
import { mcpError, type McpToolError } from "./errors";
import { centsToMoney } from "./group-split-analysis";
import { supabaseForUser } from "./supabase-client";

// The largest series the current product can create is an income series with
// 48 installments (expense forms expose at most 12).
export const INSTALLMENT_SERIES_MAX_ROWS = 48;

export const INSTALLMENT_SERIES_INTEGRITY_STATUSES = [
  "complete",
  "incomplete",
  "inconsistent",
  "legacy_reference_missing",
] as const;

export const INSTALLMENT_SERIES_READ_WARNINGS = [
  "INSTALLMENT_SERIES_INCOMPLETE",
  "INSTALLMENT_TOTAL_INCONSISTENT",
  "INSTALLMENT_TOTAL_INVALID",
  "INSTALLMENT_NUMBER_MISSING",
  "INSTALLMENT_NUMBER_INVALID",
  "INSTALLMENT_NUMBER_DUPLICATE",
  "INSTALLMENT_NUMBER_OUT_OF_RANGE",
  "INSTALLMENT_SERIES_REFERENCE_INCONSISTENT",
  "INSTALLMENT_DATE_INVALID",
  "INSTALLMENT_VERSION_MISSING",
  "INSTALLMENT_CARD_INCONSISTENT",
  "INSTALLMENT_GROUP_SCOPE_INCONSISTENT",
  "INSTALLMENT_DESCRIPTION_VARIES",
  "INSTALLMENT_CATEGORY_VARIES",
  "INSTALLMENT_PAYMENT_METHOD_VARIES",
  "INSTALLMENT_AMOUNT_INVALID",
  "INSTALLMENT_MATERIALIZED_COUNT_MISMATCH",
] as const;

export type InstallmentSeriesWarning =
  (typeof INSTALLMENT_SERIES_READ_WARNINGS)[number];
export type InstallmentTransactionType = "expense" | "income";

export const installmentSeriesInputSchema = z
  .object({
    transaction_type: z.enum(["expense", "income"]),
    installment_group_id: z.string().uuid().optional(),
    transaction_id: z.string().uuid().optional(),
  })
  .strict()
  .refine(
    (input) =>
      Number(input.installment_group_id !== undefined) +
        Number(input.transaction_id !== undefined) ===
      1,
    { message: "Informe exatamente uma referência da série." },
  );

const nullableUuid = z.string().uuid().nullable();
const nullableInteger = z.number().int().nullable();
const nullableText = z.string().nullable();
export const installmentSeriesWarningSchema = z.enum(
  INSTALLMENT_SERIES_READ_WARNINGS,
);

const installmentCommonSchema = {
  id: z.string().uuid(),
  installment_group_id: nullableUuid,
  installment_number: nullableInteger,
  total_installments: nullableInteger,
  amount: z.number().nullable(),
  transaction_date: nullableText,
  description: z.string(),
  shared_group_id: nullableUuid,
  created_at: nullableText,
  updated_at: nullableText,
};

export const expenseSeriesInstallmentSchema = z
  .object({
    ...installmentCommonSchema,
    category_id: nullableUuid,
    card_id: nullableUuid,
    payment_method: z.enum(["pix", "credit", "debit", "cash"]).nullable(),
  })
  .strict();

export const incomeSeriesInstallmentSchema = z
  .object({
    ...installmentCommonSchema,
    income_category_id: nullableUuid,
  })
  .strict();

const seriesCommonSchema = {
  installment_group_id: z.string().uuid(),
  materialized_installment_count: z.number().int().nonnegative(),
  declared_total_installments: nullableInteger,
  observed_total_installments: z.array(z.number().int()),
  first_installment_number: nullableInteger,
  last_installment_number: nullableInteger,
  first_installment_date: nullableText,
  last_installment_date: nullableText,
  total_series_amount: z.number(),
  average_installment_amount: z.number().nullable(),
  currency: z.literal("BRL"),
  missing_installment_numbers: z.array(z.number().int().positive()),
  duplicate_installment_numbers: z.array(z.number().int()),
  out_of_range_installment_numbers: z.array(z.number().int()),
  integrity_status: z.enum(INSTALLMENT_SERIES_INTEGRITY_STATUSES),
  is_complete: z.boolean(),
  shared_group_id: nullableUuid,
  warnings: z.array(installmentSeriesWarningSchema),
};

export const expenseInstallmentSeriesSummarySchema = z
  .object({
    ...seriesCommonSchema,
    transaction_type: z.literal("expense"),
    card_id: nullableUuid,
  })
  .strict();

export const incomeInstallmentSeriesSummarySchema = z
  .object({
    ...seriesCommonSchema,
    transaction_type: z.literal("income"),
  })
  .strict();

export const installmentSeriesOutputSchema = z
  .object({
    resource_type: z.literal("installment_series"),
    transaction_type: z.enum(["expense", "income"]),
    installment_group_id: z.string().uuid(),
    series: z.union([
      expenseInstallmentSeriesSummarySchema,
      incomeInstallmentSeriesSummarySchema,
    ]),
    installments: z.array(
      z.union([expenseSeriesInstallmentSchema, incomeSeriesInstallmentSchema]),
    ),
    warnings: z.array(installmentSeriesWarningSchema),
    data_complete: z.boolean(),
    generated_at: z.string(),
  })
  .strict();

export interface RawInstallmentSeriesRow {
  id: string;
  description: string;
  amount: number | string;
  installment_group_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
  shared_group_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  expense_date?: string | null;
  income_date?: string | null;
  category_id?: string | null;
  income_category_id?: string | null;
  card_id?: string | null;
  payment_method?: "pix" | "credit" | "debit" | "cash" | null;
}

function uniqueSorted<T extends string | number>(values: T[]): T[] {
  return [...new Set(values)].sort((left, right) =>
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right)),
  );
}

function distinctKey(values: Array<string | null | undefined>): string[] {
  return uniqueSorted(values.map((value) => value ?? "__NULL__"));
}

function amountToCents(value: number | string): number | null {
  const text = String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/u.exec(text);
  if (!match) return null;
  const whole = Number(match[2]);
  if (!Number.isSafeInteger(whole)) return null;
  const fraction = match[3] ?? "";
  const centDigits = fraction.slice(0, 2).padEnd(2, "0");
  let absolute = whole * 100 + Number(centDigits);
  if (fraction.length > 2 && Number(fraction[2]) >= 5) absolute += 1;
  if (!Number.isSafeInteger(absolute)) return null;
  return match[1] === "-" ? -absolute : absolute;
}

function validInstallmentNumber(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value > 0;
}

function rowDate(
  type: InstallmentTransactionType,
  row: RawInstallmentSeriesRow,
): string | null {
  const raw = type === "expense" ? row.expense_date : row.income_date;
  if (!raw) return null;
  if (isValidIsoDate(raw)) return raw;
  if (type === "expense") return raw;
  const instant = new Date(raw);
  if (Number.isNaN(instant.getTime())) return raw;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (name: "year" | "month" | "day") =>
    parts.find((candidate) => candidate.type === name)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}-${month}-${day}` : raw;
}

function rowOrder(
  type: InstallmentTransactionType,
  left: RawInstallmentSeriesRow,
  right: RawInstallmentSeriesRow,
): number {
  const leftNumber = validInstallmentNumber(left.installment_number)
    ? left.installment_number
    : Number.MAX_SAFE_INTEGER;
  const rightNumber = validInstallmentNumber(right.installment_number)
    ? right.installment_number
    : Number.MAX_SAFE_INTEGER;
  return (
    leftNumber - rightNumber ||
    (rowDate(type, left) ?? "").localeCompare(rowDate(type, right) ?? "") ||
    left.id.localeCompare(right.id)
  );
}

function warningPush(
  warnings: InstallmentSeriesWarning[],
  warning: InstallmentSeriesWarning,
) {
  if (!warnings.includes(warning)) warnings.push(warning);
}

function mappedInstallment(
  type: InstallmentTransactionType,
  row: RawInstallmentSeriesRow,
  amountCents: number | null,
) {
  const common = {
    id: row.id,
    installment_group_id: row.installment_group_id,
    installment_number: row.installment_number,
    total_installments: row.total_installments,
    amount: amountCents === null ? null : centsToMoney(amountCents),
    transaction_date: rowDate(type, row),
    description: row.description,
    shared_group_id: row.shared_group_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  return type === "expense"
    ? {
        ...common,
        category_id: row.category_id ?? null,
        card_id: row.card_id ?? null,
        payment_method: row.payment_method ?? null,
      }
    : {
        ...common,
        income_category_id: row.income_category_id ?? null,
      };
}

export function analyzeInstallmentSeries(
  type: InstallmentTransactionType,
  installmentGroupId: string,
  sourceRows: RawInstallmentSeriesRow[],
) {
  const rows = [...sourceRows].sort((left, right) =>
    rowOrder(type, left, right),
  );
  const warnings: InstallmentSeriesWarning[] = [];
  if (rows.length === 0) {
    warningPush(warnings, "INSTALLMENT_SERIES_INCOMPLETE");
    warningPush(warnings, "INSTALLMENT_MATERIALIZED_COUNT_MISMATCH");
  }
  const observedTotals = uniqueSorted(
    rows
      .map((row) => row.total_installments)
      .filter((value): value is number => value !== null && Number.isInteger(value)),
  );
  const validTotals = observedTotals.filter((value) => value >= 2);
  const allTotalsValid =
    rows.length > 0 &&
    rows.every(
      (row) =>
        row.total_installments !== null &&
        Number.isInteger(row.total_installments) &&
        row.total_installments >= 2,
    );
  const declaredTotal =
    allTotalsValid && observedTotals.length === 1 && validTotals.length === 1
      ? observedTotals[0]
      : null;
  if (observedTotals.length > 1) {
    warningPush(warnings, "INSTALLMENT_TOTAL_INCONSISTENT");
  }
  if (
    rows.some(
      (row) =>
        row.total_installments === null ||
        !Number.isInteger(row.total_installments) ||
        row.total_installments < 2,
    )
  ) {
    warningPush(warnings, "INSTALLMENT_TOTAL_INVALID");
  }

  const validNumbers = rows
    .map((row) => row.installment_number)
    .filter(validInstallmentNumber);
  if (rows.some((row) => row.installment_number === null)) {
    warningPush(warnings, "INSTALLMENT_NUMBER_MISSING");
  }
  if (
    rows.some(
      (row) =>
        row.installment_number !== null &&
        (!Number.isInteger(row.installment_number) || row.installment_number <= 0),
    )
  ) {
    warningPush(warnings, "INSTALLMENT_NUMBER_INVALID");
  }
  const counts = new Map<number, number>();
  for (const number of validNumbers) {
    counts.set(number, (counts.get(number) ?? 0) + 1);
  }
  const duplicates = uniqueSorted(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([number]) => number),
  );
  if (duplicates.length > 0) warningPush(warnings, "INSTALLMENT_NUMBER_DUPLICATE");
  const outOfRange = uniqueSorted(
    rows
      .filter(
        (row) =>
          validInstallmentNumber(row.installment_number) &&
          row.total_installments !== null &&
          Number.isInteger(row.total_installments) &&
          row.total_installments >= 2 &&
          row.installment_number > row.total_installments,
      )
      .map((row) => row.installment_number as number),
  );
  if (outOfRange.length > 0) {
    warningPush(warnings, "INSTALLMENT_NUMBER_OUT_OF_RANGE");
  }
  const missing =
    declaredTotal === null
      ? []
      : Array.from({ length: declaredTotal }, (_, index) => index + 1).filter(
          (number) => !counts.has(number),
        );
  if (missing.length > 0) warningPush(warnings, "INSTALLMENT_SERIES_INCOMPLETE");
  if (declaredTotal !== null && rows.length !== declaredTotal) {
    warningPush(warnings, "INSTALLMENT_MATERIALIZED_COUNT_MISMATCH");
    warningPush(warnings, "INSTALLMENT_SERIES_INCOMPLETE");
  }
  if (
    rows.some(
      (row) =>
        row.installment_group_id === null ||
        row.installment_group_id !== installmentGroupId,
    )
  ) {
    warningPush(warnings, "INSTALLMENT_SERIES_REFERENCE_INCONSISTENT");
  }
  const validDates = rows
    .map((row) => rowDate(type, row))
    .filter((date): date is string => isValidIsoDate(date));
  if (rows.some((row) => !isValidIsoDate(rowDate(type, row)))) {
    warningPush(warnings, "INSTALLMENT_DATE_INVALID");
  }
  if (rows.some((row) => !row.updated_at)) {
    warningPush(warnings, "INSTALLMENT_VERSION_MISSING");
  }

  const sharedGroups = distinctKey(rows.map((row) => row.shared_group_id));
  const sharedGroupId =
    sharedGroups.length === 1 && sharedGroups[0] !== "__NULL__"
      ? sharedGroups[0]
      : null;
  if (sharedGroups.length > 1) {
    warningPush(warnings, "INSTALLMENT_GROUP_SCOPE_INCONSISTENT");
  }
  const cardIds =
    type === "expense" ? distinctKey(rows.map((row) => row.card_id)) : [];
  const cardId =
    cardIds.length === 1 && cardIds[0] !== "__NULL__" ? cardIds[0] : null;
  if (type === "expense" && cardIds.length > 1) {
    warningPush(warnings, "INSTALLMENT_CARD_INCONSISTENT");
  }
  const semanticDescriptions = rows.map((row) =>
    row.description.replace(/\s*\(\d+\/\d+\)\s*$/u, "").trim(),
  );
  if (distinctKey(semanticDescriptions).length > 1) {
    warningPush(warnings, "INSTALLMENT_DESCRIPTION_VARIES");
  }
  const categoryValues =
    type === "expense"
      ? rows.map((row) => row.category_id)
      : rows.map((row) => row.income_category_id);
  if (distinctKey(categoryValues).length > 1) {
    warningPush(warnings, "INSTALLMENT_CATEGORY_VARIES");
  }
  if (
    type === "expense" &&
    distinctKey(rows.map((row) => row.payment_method)).length > 1
  ) {
    warningPush(warnings, "INSTALLMENT_PAYMENT_METHOD_VARIES");
  }

  const cents = rows.map((row) => amountToCents(row.amount));
  if (cents.some((value) => value === null)) {
    warningPush(warnings, "INSTALLMENT_AMOUNT_INVALID");
  }
  const factualCents = cents.filter((value): value is number => value !== null);
  const totalCents = factualCents.reduce((total, value) => total + value, 0);
  const averageCents =
    factualCents.length === rows.length &&
    rows.length > 0 &&
    totalCents % rows.length === 0
      ? totalCents / rows.length
      : null;

  const structuralWarnings: InstallmentSeriesWarning[] = [
    "INSTALLMENT_TOTAL_INCONSISTENT",
    "INSTALLMENT_TOTAL_INVALID",
    "INSTALLMENT_NUMBER_MISSING",
    "INSTALLMENT_NUMBER_INVALID",
    "INSTALLMENT_NUMBER_DUPLICATE",
    "INSTALLMENT_NUMBER_OUT_OF_RANGE",
    "INSTALLMENT_SERIES_REFERENCE_INCONSISTENT",
    "INSTALLMENT_DATE_INVALID",
    "INSTALLMENT_VERSION_MISSING",
    "INSTALLMENT_CARD_INCONSISTENT",
    "INSTALLMENT_GROUP_SCOPE_INCONSISTENT",
    "INSTALLMENT_AMOUNT_INVALID",
  ];
  const inconsistent = warnings.some((warning) =>
    structuralWarnings.includes(warning),
  );
  const incomplete =
    rows.length === 0 ||
    missing.length > 0 ||
    warnings.includes("INSTALLMENT_MATERIALIZED_COUNT_MISMATCH");
  const integrityStatus = inconsistent
    ? "inconsistent"
    : incomplete
      ? "incomplete"
      : "complete";
  const isComplete = integrityStatus === "complete";
  const numbersForBounds = uniqueSorted(validNumbers);
  const datesForBounds = uniqueSorted(validDates);
  const commonSummary = {
    installment_group_id: installmentGroupId,
    transaction_type: type,
    materialized_installment_count: rows.length,
    declared_total_installments: declaredTotal,
    observed_total_installments: observedTotals,
    first_installment_number: numbersForBounds[0] ?? null,
    last_installment_number: numbersForBounds.at(-1) ?? null,
    first_installment_date: datesForBounds[0] ?? null,
    last_installment_date: datesForBounds.at(-1) ?? null,
    total_series_amount: centsToMoney(totalCents),
    average_installment_amount:
      averageCents === null ? null : centsToMoney(averageCents),
    currency: "BRL" as const,
    missing_installment_numbers: missing,
    duplicate_installment_numbers: duplicates,
    out_of_range_installment_numbers: outOfRange,
    integrity_status: integrityStatus,
    is_complete: isComplete,
    shared_group_id: sharedGroupId,
    warnings,
  };
  const series =
    type === "expense" ? { ...commonSummary, card_id: cardId } : commonSummary;
  return {
    resource_type: "installment_series" as const,
    transaction_type: type,
    installment_group_id: installmentGroupId,
    series,
    installments: rows.map((row, index) =>
      mappedInstallment(type, row, cents[index]),
    ),
    warnings,
    data_complete: isComplete,
    generated_at: new Date().toISOString(),
  };
}

const EXPENSE_COLUMNS =
  "id,description,amount,expense_date,category_id,payment_method,card_id,installment_group_id,installment_number,total_installments,shared_group_id,created_at,updated_at";
const INCOME_COLUMNS =
  "id,description,amount,income_date,income_category_id,installment_group_id,installment_number,total_installments,shared_group_id,created_at,updated_at";

type ToolContextLike = {
  isAuthenticated(): boolean;
  getUserId(): string | undefined;
};

function referenceMissingError(): McpToolError {
  return mcpError(
    "INSTALLMENT_SERIES_REFERENCE_MISSING",
    "A transação acessível declara parcelamento, mas não possui installment_group_id. A série não foi inferida e nenhuma alteração foi realizada.",
  );
}

export async function getInstallmentSeries(
  rawInput: unknown,
  ctx: ToolContextLike,
) {
  const parsed = installmentSeriesInputSchema.safeParse(rawInput);
  if (!parsed.success) return mcpError("INVALID_INPUT");
  if (!ctx.isAuthenticated() || !ctx.getUserId()) {
    return mcpError("UNAUTHENTICATED");
  }
  const { transaction_type: type } = parsed.data;
  const table = type === "expense" ? "expenses" : "incomes";
  const columns = type === "expense" ? EXPENSE_COLUMNS : INCOME_COLUMNS;
  const supabase = supabaseForUser(ctx as never);
  try {
    let installmentGroupId = parsed.data.installment_group_id;
    if (parsed.data.transaction_id) {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq("id", parsed.data.transaction_id)
        .maybeSingle();
      if (error) return mcpError("READ_FAILED");
      if (!data) return mcpError("RESOURCE_NOT_FOUND");
      const reference = data as unknown as RawInstallmentSeriesRow;
      if (!hasInstallmentEvidence(reference)) {
        return mcpError(
          "TRANSACTION_NOT_INSTALLMENT",
          "A transação existe e é acessível, mas não pertence a uma série parcelada. Nenhuma alteração foi realizada.",
        );
      }
      if (!reference.installment_group_id) return referenceMissingError();
      installmentGroupId = reference.installment_group_id;
    }
    if (!installmentGroupId) return mcpError("INVALID_INPUT");
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("installment_group_id", installmentGroupId)
      .order("installment_number", { ascending: true, nullsFirst: false })
      .order(type === "expense" ? "expense_date" : "income_date", {
        ascending: true,
      })
      .order("id", { ascending: true })
      .limit(INSTALLMENT_SERIES_MAX_ROWS + 1);
    if (error) return mcpError("READ_FAILED");
    const rows = (data ?? []) as unknown as RawInstallmentSeriesRow[];
    if (rows.length === 0) return mcpError("RESOURCE_NOT_FOUND");
    if (rows.length > INSTALLMENT_SERIES_MAX_ROWS) {
      return mcpError(
        "RESULT_SET_TOO_LARGE",
        `A série acessível excede o limite comprovado de ${INSTALLMENT_SERIES_MAX_ROWS} linhas e não foi analisada parcialmente. Revise a integridade da série. Nenhuma alteração foi realizada.`,
      );
    }
    const result = analyzeInstallmentSeries(type, installmentGroupId, rows);
    const validated = installmentSeriesOutputSchema.safeParse(result);
    if (!validated.success) return mcpError("INVALID_DATA");
    const installments = validated.data.installments
      .map(
        (item) =>
          `id=${item.id}; parcela=${item.installment_number ?? "ausente"}/${item.total_installments ?? "ausente"}; ` +
          `data=${item.transaction_date ?? "inválida"}; valor=${item.amount ?? "inválido"}; updated_at=${item.updated_at ?? "ausente"}`,
      )
      .join("\n");
    const summary = validated.data.series;
    return {
      content: [
        {
          type: "text" as const,
          text:
            `Série parcelada de ${type === "expense" ? "despesa" : "receita"}; ` +
            `installment_group_id=${installmentGroupId}; materializadas=${summary.materialized_installment_count}; ` +
            `total_declarado=${summary.declared_total_installments ?? "inconsistente/ausente"}; ` +
            `período=${summary.first_installment_date ?? "indisponível"} a ${summary.last_installment_date ?? "indisponível"}; ` +
            `total_factual=${summary.total_series_amount} BRL; integridade=${summary.integrity_status}; ` +
            `lacunas=${JSON.stringify(summary.missing_installment_numbers)}; duplicidades=${JSON.stringify(summary.duplicate_installment_numbers)}; ` +
            `warnings=${JSON.stringify(summary.warnings)}.\n${installments}\n` +
            "Consulta somente leitura. Nenhuma transação foi criada, editada ou excluída.",
        },
      ],
      structuredContent: validated.data,
    };
  } catch {
    return mcpError("READ_FAILED");
  }
}
