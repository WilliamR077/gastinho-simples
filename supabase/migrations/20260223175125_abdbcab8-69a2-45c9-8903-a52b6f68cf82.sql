ALTER TABLE budget_goals 
  ALTER COLUMN category TYPE text 
  USING category::text;
NOTIFY pgrst, 'reload schema';