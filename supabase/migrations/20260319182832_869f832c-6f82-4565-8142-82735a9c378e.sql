ALTER TABLE public.incomes ADD COLUMN installment_group_id uuid DEFAULT NULL;
ALTER TABLE public.incomes ADD COLUMN installment_number integer DEFAULT 1;
ALTER TABLE public.incomes ADD COLUMN total_installments integer DEFAULT 1;