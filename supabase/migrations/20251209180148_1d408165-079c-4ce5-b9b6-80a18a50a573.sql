-- Adicionar colunas para controle temporal das despesas fixas
ALTER TABLE recurring_expenses
ADD COLUMN start_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN end_date DATE;

-- Popular dados existentes com a data de criação
UPDATE recurring_expenses 
SET start_date = DATE(created_at)
WHERE start_date IS NULL;