
-- Novos campos em expenses para suporte a rateio
ALTER TABLE expenses ADD COLUMN is_shared boolean NOT NULL DEFAULT false;
ALTER TABLE expenses ADD COLUMN paid_by uuid DEFAULT NULL;
ALTER TABLE expenses ADD COLUMN split_type text DEFAULT NULL;

-- Tabela de participantes do rateio
CREATE TABLE public.expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  share_amount numeric NOT NULL,
  share_percentage numeric DEFAULT NULL,
  user_email text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(expense_id, user_id)
);

-- RLS
ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;

-- SELECT: membros do grupo da despesa podem ver os splits
CREATE POLICY "Users can view splits of their group expenses"
ON public.expense_splits FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_splits.expense_id
    AND (
      e.user_id = auth.uid()
      OR (e.shared_group_id IS NOT NULL AND public.is_group_member(e.shared_group_id, auth.uid()))
    )
  )
);

-- INSERT: criador da despesa pode inserir splits
CREATE POLICY "Users can insert splits for their expenses"
ON public.expense_splits FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_splits.expense_id
    AND (
      e.user_id = auth.uid()
      OR (e.shared_group_id IS NOT NULL AND public.is_group_member(e.shared_group_id, auth.uid()))
    )
  )
);

-- UPDATE: criador da despesa pode atualizar splits
CREATE POLICY "Users can update splits of their expenses"
ON public.expense_splits FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_splits.expense_id
    AND e.user_id = auth.uid()
  )
);

-- DELETE: criador da despesa pode deletar splits
CREATE POLICY "Users can delete splits of their expenses"
ON public.expense_splits FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_splits.expense_id
    AND e.user_id = auth.uid()
  )
);

-- Índice para performance em queries de splits por expense
CREATE INDEX idx_expense_splits_expense_id ON public.expense_splits(expense_id);
CREATE INDEX idx_expense_splits_user_id ON public.expense_splits(user_id);
