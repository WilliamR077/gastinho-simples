-- Create enum for expense categories
CREATE TYPE expense_category AS ENUM (
  'alimentacao',
  'transporte',
  'lazer',
  'saude',
  'educacao',
  'moradia',
  'vestuario',
  'servicos',
  'outros'
);

-- Add category column to expenses table
ALTER TABLE public.expenses 
ADD COLUMN category expense_category NOT NULL DEFAULT 'outros';

-- Add category column to recurring_expenses table
ALTER TABLE public.recurring_expenses 
ADD COLUMN category expense_category NOT NULL DEFAULT 'outros';