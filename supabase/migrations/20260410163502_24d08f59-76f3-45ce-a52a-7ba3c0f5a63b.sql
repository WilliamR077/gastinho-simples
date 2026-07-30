ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS notify_expense_goals boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_income_goals boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_balance_goals boolean NOT NULL DEFAULT true;