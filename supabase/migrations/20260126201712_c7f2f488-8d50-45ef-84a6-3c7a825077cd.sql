-- Add denormalized display columns to expenses table
ALTER TABLE expenses 
  ADD COLUMN IF NOT EXISTS category_name TEXT,
  ADD COLUMN IF NOT EXISTS category_icon TEXT DEFAULT '📦',
  ADD COLUMN IF NOT EXISTS card_name TEXT;

-- Add denormalized display columns to recurring_expenses table
ALTER TABLE recurring_expenses 
  ADD COLUMN IF NOT EXISTS category_name TEXT,
  ADD COLUMN IF NOT EXISTS category_icon TEXT DEFAULT '📦',
  ADD COLUMN IF NOT EXISTS card_name TEXT;