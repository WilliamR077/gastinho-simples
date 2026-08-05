export interface CategoryReferenceCounts {
  transactions: number;
  recurring: number;
  goals: number;
  total: number;
}

export interface CategoryReplacementResult {
  source_category_id: string;
  destination_category_id: string;
  source_archived: boolean;
  references_before: CategoryReferenceCounts;
  updated: CategoryReferenceCounts;
}

export function parseCategoryReferenceCounts(value: unknown): CategoryReferenceCounts {
  const candidate = value as Partial<CategoryReferenceCounts> | null;
  return {
    transactions: Number(candidate?.transactions ?? 0),
    recurring: Number(candidate?.recurring ?? 0),
    goals: Number(candidate?.goals ?? 0),
    total: Number(candidate?.total ?? 0),
  };
}

export function shouldApplyCategoryReferenceResponse(
  requestId: number,
  latestRequestId: number,
  requestedCategoryId: string,
  currentCategoryId: string | null,
): boolean {
  return requestId === latestRequestId && requestedCategoryId === currentCategoryId;
}
