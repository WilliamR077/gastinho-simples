-- Add installment columns to expenses table
ALTER TABLE public.expenses 
ADD COLUMN total_installments INTEGER DEFAULT 1,
ADD COLUMN installment_number INTEGER DEFAULT 1,
ADD COLUMN installment_group_id UUID DEFAULT NULL;

-- Add index for better performance on installment queries
CREATE INDEX idx_expenses_installment_group ON public.expenses(installment_group_id);

-- Add constraint to ensure installment_number is valid
ALTER TABLE public.expenses 
ADD CONSTRAINT check_installment_number 
CHECK (installment_number > 0 AND installment_number <= total_installments);