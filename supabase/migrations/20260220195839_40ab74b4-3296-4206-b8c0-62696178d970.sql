ALTER TABLE budget_goals DROP CONSTRAINT IF EXISTS valid_category_for_type;
ALTER TABLE budget_goals ADD CONSTRAINT valid_category_for_type CHECK (
  (type = 'monthly_total' AND category IS NULL) OR
  (type = 'category' AND category IS NOT NULL) OR
  (type = 'income_monthly_total' AND category IS NULL) OR
  (type = 'income_category' AND category IS NOT NULL)
);
NOTIFY pgrst, 'reload schema';