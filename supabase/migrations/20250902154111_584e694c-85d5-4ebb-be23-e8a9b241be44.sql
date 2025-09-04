-- Add expense_date column to expenses table
ALTER TABLE public.expenses 
ADD COLUMN expense_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Create index for better performance when filtering by date
CREATE INDEX idx_expenses_expense_date ON public.expenses(expense_date);

-- Create index for user_id and expense_date combination for efficient queries
CREATE INDEX idx_expenses_user_date ON public.expenses(user_id, expense_date);