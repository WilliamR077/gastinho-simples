export function compactText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function transactionContent(
  items: Array<{
    transaction_type: "expense" | "income";
    date: string;
    description: string;
    amount: number;
    updated_at: string;
  }>,
  scope: string,
  timeScope: string,
  transactionType: string,
  hasMore: boolean,
  nextCursor: string | null,
  limit: number = items.length,
  cursorVersion: number = 3,
  appliedFilters: Record<string, unknown> = {},
): string {
  const preview = items
    .slice(0, 10)
    .map(
      (item) =>
        `${item.transaction_type} ${item.date}: ${compactText(item.description, 80)} — ${item.amount}; updated_at=${item.updated_at}`,
    )
    .join("; ");
  return (
    `Quantidade retornada=${items.length}; limit=${limit}; has_more=${hasMore}; ` +
    `cursor_version=${cursorVersion}; next_cursor=${nextCursor ?? "null"}; ` +
    `scope=${scope}; time_scope=${timeScope}; query_transaction_type=${transactionType}; ` +
    `applied_filters=${JSON.stringify(appliedFilters)}. ` +
    `Itens resumidos (máximo 10): ${preview || "nenhum item"}.`
  );
}

interface BreakdownContentGroup {
  key: string;
  label: string;
  total: number;
  percentage: number;
  transaction_count: number;
  average: number;
  largest_transaction: {
    id: string;
    description: string;
    amount: number;
    date: string;
  };
}

export function breakdownContent(
  groups: BreakdownContentGroup[],
  details: {
    requestedPeriod: { start_date: string; end_date: string };
    effectivePeriod: {
      start_date: string;
      end_date: string;
      days: number;
    } | null;
    total: number;
    transactionCount: number;
    groupBy: string;
    scope: string;
    timeScope: string;
    dataComplete: boolean;
    returnedGroupCount: number;
    totalGroupCount: number;
    groupsTruncated: boolean;
    coverageWarning: string | null;
  },
): string {
  const preview = groups
    .slice(0, 10)
    .map(
      (group, index) =>
        `${index + 1}. key=${compactText(group.key, 80)}; ` +
        `label=${compactText(group.label, 60)}; total=${group.total}; ` +
        `percentage=${group.percentage.toFixed(2)}; ` +
        `transaction_count=${group.transaction_count}; average=${group.average}; ` +
        `largest_transaction={id=${group.largest_transaction.id}; ` +
        `description=${compactText(group.largest_transaction.description, 80)}; ` +
        `amount=${group.largest_transaction.amount}; date=${group.largest_transaction.date}}`,
    )
    .join("\n");
  const contentOmittedCount = Math.max(0, groups.length - 10);
  const truncationNotice = details.groupsTruncated
    ? `A lista de grupos foi limitada a ${details.returnedGroupCount} de ${details.totalGroupCount}. ` +
      "Os totais gerais consideram todos os grupos, mas os percentuais dos grupos exibidos podem " +
      "somar menos de 100% porque parte dos grupos não aparece nesta resposta. "
    : "";
  return (
    `requested_period={start_date=${details.requestedPeriod.start_date}; ` +
    `end_date=${details.requestedPeriod.end_date}}; ` +
    `effective_period=${details.effectivePeriod
      ? `{start_date=${details.effectivePeriod.start_date}; end_date=${details.effectivePeriod.end_date}; days=${details.effectivePeriod.days}}`
      : "null"}; ` +
    `coverage_warning=${details.coverageWarning ?? "null"}; total=${details.total}; ` +
    `transaction_count=${details.transactionCount}; data_complete=${details.dataComplete}; ` +
    `total_group_count=${details.totalGroupCount}; ` +
    `returned_group_count=${details.returnedGroupCount}; ` +
    `groups_truncated=${details.groupsTruncated}; group_by=${details.groupBy}; ` +
    `scope=${details.scope}; time_scope=${details.timeScope}. ` +
    truncationNotice +
    `Grupos completos no content (máximo 10):\n${preview || "nenhum grupo"}\n` +
    `Grupos omitidos do content=${contentOmittedCount}.`
  );
}

export function comparisonBreakdownContent(
  groups: Array<{
    key: string;
    label: string;
    period_a_total: number;
    period_b_total: number;
    absolute_change: number;
    percentage_change: number | null;
  }> | null,
): string {
  if (groups === null) return "breakdown_changes=null.";
  const preview = groups
    .slice(0, 10)
    .map(
      (group, index) =>
        `${index + 1}. key=${compactText(group.key, 80)}; ` +
        `label=${compactText(group.label, 60)}; period_a_total=${group.period_a_total}; ` +
        `period_b_total=${group.period_b_total}; absolute_change=${group.absolute_change}; ` +
        `percentage_change=${group.percentage_change ?? "null"}`,
    )
    .join("\n");
  return (
    `Principais breakdown_changes (máximo 10):\n${preview || "nenhum"}\n` +
    `Grupos de breakdown omitidos do content=${Math.max(0, groups.length - 10)}.`
  );
}

interface ComparisonContentPeriod {
  requested_period: { start_date: string; end_date: string };
  effective_period: {
    start_date: string;
    end_date: string;
    days: number;
  } | null;
  requested_days: number;
  effective_days: number;
  coverage_warning: string | null;
  metrics: {
    income: number;
    expenses: number;
    balance: number;
    savings_rate: number | null;
    expense_count: number;
    income_count: number;
  };
}

export function comparisonContent(details: {
  periodA: ComparisonContentPeriod;
  periodB: ComparisonContentPeriod;
  absoluteChanges: Record<string, number | null>;
  percentageChanges: Record<string, number | null>;
  breakdownChanges: Parameters<typeof comparisonBreakdownContent>[0];
  scope: string;
  timeScope: string;
  coverageWarnings: string[];
  dataSufficiencyWarnings: string[];
}): string {
  const periodText = (label: string, period: ComparisonContentPeriod) =>
    `${label}: requested_period={start_date=${period.requested_period.start_date}; ` +
    `end_date=${period.requested_period.end_date}}; ` +
    `effective_period=${period.effective_period
      ? `{start_date=${period.effective_period.start_date}; end_date=${period.effective_period.end_date}; days=${period.effective_period.days}}`
      : "null"}; requested_days=${period.requested_days}; ` +
    `effective_days=${period.effective_days}; ` +
    `coverage_warning=${period.coverage_warning ?? "null"}; ` +
    `income=${period.metrics.income}; expenses=${period.metrics.expenses}; ` +
    `balance=${period.metrics.balance}; savings_rate=${period.metrics.savings_rate ?? "null"}; ` +
    `expense_count=${period.metrics.expense_count}; income_count=${period.metrics.income_count}.`;

  return (
    `Comparação factual; scope=${details.scope}; time_scope=${details.timeScope}.\n` +
    `${periodText("Período A", details.periodA)}\n` +
    `${periodText("Período B", details.periodB)}\n` +
    `absolute_changes=${JSON.stringify(details.absoluteChanges)}.\n` +
    `percentage_changes=${JSON.stringify(details.percentageChanges)}.\n` +
    `coverage_warning=${JSON.stringify(details.coverageWarnings)}.\n` +
    `data_sufficiency_warnings=${JSON.stringify(details.dataSufficiencyWarnings)}.\n` +
    comparisonBreakdownContent(details.breakdownChanges)
  );
}
