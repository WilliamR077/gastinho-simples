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
  }>,
  scope: string,
  timeScope: string,
  transactionType: string,
  hasMore: boolean,
  nextCursor: string | null,
): string {
  const preview = items
    .slice(0, 10)
    .map(
      (item) =>
        `${item.transaction_type} ${item.date}: ${compactText(item.description, 80)} — ${item.amount}`,
    )
    .join("; ");
  return (
    `Foram retornadas ${items.length} transações (scope=${scope}, time_scope=${timeScope}, tipo=${transactionType}). ` +
    `Primeiros ${Math.min(items.length, 10)}: ${preview || "nenhum item"}. ` +
    `Há mais itens: ${hasMore ? "sim" : "não"}. ` +
    `${nextCursor ? `next_cursor=${nextCursor}` : "Não há próximo cursor."}`
  );
}

export function breakdownContent(
  groups: Array<{ label: string; total: number; percentage: number }>,
  details: {
    start: string;
    end: string;
    total: number;
    transactionCount: number;
    groupBy: string;
    scope: string;
    timeScope: string;
    returnedGroupCount: number;
    totalGroupCount: number;
    groupsTruncated: boolean;
    coverageWarning: string | null;
  },
): string {
  const preview = groups
    .slice(0, 10)
    .map(
      (group) =>
        `${compactText(group.label, 60)}: ${group.total} (${group.percentage.toFixed(2)}%)`,
    )
    .join("; ");
  const truncationNotice = details.groupsTruncated
    ? `A lista de grupos foi limitada a ${details.returnedGroupCount} de ${details.totalGroupCount}. ` +
      "Os totais gerais consideram todos os grupos, mas os percentuais dos grupos exibidos podem " +
      "somar menos de 100% porque parte dos grupos não aparece nesta resposta. "
    : "";
  return (
    `Gastos solicitados de ${details.start} a ${details.end}: total=${details.total}, ` +
    `lançamentos=${details.transactionCount}, agrupamento=${details.groupBy}, ` +
    `scope=${details.scope}, time_scope=${details.timeScope}. ` +
    `Principais grupos: ${preview || "nenhum grupo"}. ` +
    `Grupos retornados=${details.returnedGroupCount} de ${details.totalGroupCount}; ` +
    `groups_truncated=${details.groupsTruncated}. ` +
    truncationNotice +
    `${details.coverageWarning ?? "Cobertura integral do período solicitado."}`
  );
}

export function comparisonBreakdownContent(
  groups: Array<{
    label: string;
    period_a_total: number;
    period_b_total: number;
  }> | null,
): string {
  if (groups === null) return "";
  const preview = groups
    .slice(0, 10)
    .map(
      (group) =>
        `${compactText(group.label, 60)}: ${group.period_a_total} → ${group.period_b_total}`,
    )
    .join("; ");
  return `Principais grupos: ${preview || "nenhum"}; outros grupos=${Math.max(0, groups.length - 10)}.`;
}
