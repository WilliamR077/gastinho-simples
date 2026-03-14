
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS card_color text DEFAULT NULL;
ALTER TABLE public.recurring_expenses ADD COLUMN IF NOT EXISTS card_color text DEFAULT NULL;

-- Backfill existing data from cards table
UPDATE public.expenses e SET card_color = c.color FROM public.cards c WHERE e.card_id = c.id AND e.card_color IS NULL;
UPDATE public.recurring_expenses re SET card_color = c.color FROM public.cards c WHERE re.card_id = c.id AND re.card_color IS NULL;
