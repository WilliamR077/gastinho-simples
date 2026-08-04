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

    // Em grupos, a categoria de outro membro pode não estar disponível por ID,
    // mas o nome desnormalizado específico continua sendo uma fonte confiável.
    if (input.categoryName && input.categoryName.trim().toLocaleLowerCase("pt-BR") !== "outros") {
      return {
        key: `name:${input.categoryName}`,
        name: input.categoryName,
        icon: input.categoryIcon || FALLBACK_ICON,
      };
    }

    return {
      key: `unresolved:${input.categoryId}`,
      name: "Categoria não resolvida",
      icon: FALLBACK_ICON,
    };
  }

  if (input.categoryName) {
    return {
      key: `name:${input.categoryName}`,
      name: input.categoryName,
      icon: input.categoryIcon || FALLBACK_ICON,
    };
  }

  if (input.legacyLabel) {
    return { key: `legacy:${input.legacyLabel}`, name: input.legacyLabel, icon: FALLBACK_ICON };
  }

  return { key: "unresolved", name: "Categoria não resolvida", icon: FALLBACK_ICON };
}
