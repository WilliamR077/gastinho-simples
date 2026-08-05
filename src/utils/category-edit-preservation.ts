interface CategorySnapshot {
  id: string;
  name: string;
  icon: string;
}

export function expenseSelectionForEdit(
  categoryId: string | null | undefined,
  legacyCategory: string | null | undefined,
  categories: CategorySnapshot[],
): string | null {
  if (categoryId) return categoryId;
  if (!legacyCategory) return null;
  const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
  const normalizedLegacy = normalize(legacyCategory);
  return categories.find(category => normalize(category.name) === normalizedLegacy)?.id ?? legacyCategory;
}

interface CategoryEditInput {
  currentSelection?: string | null;
  nextSelection?: string | null;
  selectedCategory?: CategorySnapshot | null;
  explicitName?: string | null;
  explicitIcon?: string | null;
  idColumn: "category_id" | "income_category_id";
}

/** Returns no category keys at all unless the user deliberately changed selection. */
export function categoryEditPatch(input: CategoryEditInput): Record<string, string | null> {
  const current = input.currentSelection || null;
  const next = input.nextSelection || null;
  if (current === next) return {};
  return {
    [input.idColumn]: input.selectedCategory?.id ?? null,
    category_name: input.selectedCategory?.name ?? input.explicitName ?? null,
    category_icon: input.selectedCategory?.icon ?? input.explicitIcon ?? null,
  };
}
