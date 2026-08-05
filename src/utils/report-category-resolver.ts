export interface ReportCategoryDefinition {
  id: string;
  name: string;
  icon: string;
}

export interface ReportCategoryInput {
  categoryId?: string | null;
  categoryName?: string | null;
  categoryIcon?: string | null;
  legacyLabel?: string | null;
}

export interface ResolvedReportCategory {
  key: string;
  name: string;
  icon: string;
}

const FALLBACK_ICON = "📦";
const normalizedName = (value?: string | null) => value?.trim() || null;
const normalizedKeyName = (value: string) =>
  value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Canonical historical precedence shared by UI and exports:
 * resolvable ID (active or archived), snapshot, legacy label, uncategorized.
 * A broken ID is only unresolved when it has no usable snapshot.
 */
export function resolveReportCategory(
  input: ReportCategoryInput,
  categories: ReportCategoryDefinition[],
): ResolvedReportCategory {
  if (input.categoryId) {
    const category = categories.find(item => item.id === input.categoryId);
    if (category) return { key: category.id, name: category.name, icon: category.icon || FALLBACK_ICON };
  }

  const snapshot = normalizedName(input.categoryName);
  if (snapshot && input.categoryId) {
    return { key: `snapshot:${input.categoryId}:${normalizedKeyName(snapshot)}`, name: snapshot, icon: input.categoryIcon || FALLBACK_ICON };
  }
  if (snapshot) {
    return { key: `snapshot-name:${normalizedKeyName(snapshot)}`, name: snapshot, icon: input.categoryIcon || FALLBACK_ICON };
  }

  if (input.categoryId) {
    return { key: `unresolved:${input.categoryId}`, name: "Categoria não resolvida", icon: FALLBACK_ICON };
  }

  const legacy = normalizedName(input.legacyLabel);
  if (legacy) return { key: `legacy:${legacy}`, name: legacy, icon: FALLBACK_ICON };
  return { key: "uncategorized", name: "Outros", icon: FALLBACK_ICON };
}

export function resolveReportGoalCategory(
  categoryReference: string | null | undefined,
  categories: ReportCategoryDefinition[],
  legacyLabels: Record<string, string>,
): string {
  const reference = normalizedName(categoryReference);
  if (!reference) return "Não se aplica";
  if (categories.some(category => category.id === reference)) {
    return resolveReportCategory({ categoryId: reference }, categories).name;
  }
  const legacyLabel = legacyLabels[reference];
  if (legacyLabel) return resolveReportCategory({ categoryName: legacyLabel }, categories).name;
  const looksLikeId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(reference);
  if (looksLikeId) return resolveReportCategory({ categoryId: reference }, categories).name;
  return resolveReportCategory({ categoryName: reference }, categories).name;
}
