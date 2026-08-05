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
const UNCATEGORIZED_NAME = "Outros";

const normalizedName = (value?: string | null): string | null => {
  const name = value?.trim();
  return name ? name : null;
};

/** Resolve uma categoria uma única vez para interface e PDF. */
export function resolveReportCategory(
  input: ReportCategoryInput,
  categories: ReportCategoryDefinition[],
): ResolvedReportCategory {
  if (input.categoryId) {
    const category = categories.find((item) => item.id === input.categoryId);
    if (category) {
      return { key: category.id, name: category.name, icon: category.icon || FALLBACK_ICON };
    }

    return {
      key: "unresolved",
      name: "Categoria não resolvida",
      icon: FALLBACK_ICON,
    };
  }

  const categoryName = normalizedName(input.categoryName);
  if (categoryName) {
    return {
      key: `name:${categoryName}`,
      name: categoryName,
      icon: input.categoryIcon || FALLBACK_ICON,
    };
  }

  const legacyLabel = normalizedName(input.legacyLabel);
  if (legacyLabel) {
    return { key: `legacy:${legacyLabel}`, name: legacyLabel, icon: FALLBACK_ICON };
  }

  return { key: "uncategorized", name: UNCATEGORIZED_NAME, icon: FALLBACK_ICON };
}

export function resolveReportGoalCategory(
  categoryReference: string | null | undefined,
  categories: ReportCategoryDefinition[],
  legacyLabels: Record<string, string>,
): string {
  const reference = normalizedName(categoryReference);
  if (!reference) return "Não se aplica";

  const knownById = categories.some((category) => category.id === reference);
  if (knownById) {
    return resolveReportCategory({ categoryId: reference }, categories).name;
  }

  const legacyLabel = legacyLabels[reference];
  if (legacyLabel) {
    return resolveReportCategory({ categoryName: legacyLabel }, categories).name;
  }

  const looksLikeId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(reference);
  if (looksLikeId) {
    return resolveReportCategory({ categoryId: reference }, categories).name;
  }

  return resolveReportCategory({ categoryName: reference }, categories).name;
}
