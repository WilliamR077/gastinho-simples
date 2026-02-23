
-- Adicionar 'balance_target' ao enum budget_goal_type
ALTER TYPE public.budget_goal_type ADD VALUE IF NOT EXISTS 'balance_target';
