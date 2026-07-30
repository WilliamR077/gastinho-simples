
-- Atualizar constraint para incluir balance_target (categoria deve ser null)
ALTER TABLE public.budget_goals DROP CONSTRAINT IF EXISTS valid_category_for_type;
ALTER TABLE public.budget_goals ADD CONSTRAINT valid_category_for_type CHECK (
  (type IN ('monthly_total', 'income_monthly_total', 'balance_target') AND category IS NULL)
  OR
  (type IN ('category', 'income_category') AND category IS NOT NULL)
);
