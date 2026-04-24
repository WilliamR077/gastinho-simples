-- Limpar parcelas órfãs: registros com installment_group_id mas sem a 1ª parcela
-- (caso onde a 1ª foi excluída individualmente em algum momento, deixando as demais)

DELETE FROM public.incomes
WHERE installment_group_id IS NOT NULL
  AND installment_group_id IN (
    SELECT installment_group_id
    FROM public.incomes
    WHERE installment_group_id IS NOT NULL
    GROUP BY installment_group_id
    HAVING NOT bool_or(installment_number = 1)
  );

DELETE FROM public.expenses
WHERE installment_group_id IS NOT NULL
  AND installment_group_id IN (
    SELECT installment_group_id
    FROM public.expenses
    WHERE installment_group_id IS NOT NULL
    GROUP BY installment_group_id
    HAVING NOT bool_or(installment_number = 1)
  );