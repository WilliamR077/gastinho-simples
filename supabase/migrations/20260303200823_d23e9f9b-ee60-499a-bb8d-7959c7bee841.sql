
ALTER TABLE public.cards ADD COLUMN due_day integer;
ALTER TABLE public.cards ADD COLUMN days_before_due integer DEFAULT 10;
