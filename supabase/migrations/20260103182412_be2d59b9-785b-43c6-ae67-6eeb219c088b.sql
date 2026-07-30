-- Criar enum para categoria de receita
CREATE TYPE public.income_category AS ENUM (
  'salario',
  'freelance',
  'investimentos',
  'vendas',
  'bonus',
  'presente',
  'reembolso',
  'aluguel',
  'outros'
);

-- Criar tabela de receitas/entradas
CREATE TABLE public.incomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category public.income_category NOT NULL DEFAULT 'outros',
  income_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  shared_group_id UUID REFERENCES public.shared_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de receitas recorrentes
CREATE TABLE public.recurring_incomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category public.income_category NOT NULL DEFAULT 'salario',
  day_of_month INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  shared_group_id UUID REFERENCES public.shared_groups(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_incomes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para incomes
CREATE POLICY "Users can view their own or group incomes"
ON public.incomes FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  ((shared_group_id IS NOT NULL) AND is_group_member(shared_group_id, auth.uid()))
);

CREATE POLICY "Users can insert incomes"
ON public.incomes FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) AND 
  ((shared_group_id IS NULL) OR is_group_member(shared_group_id, auth.uid()))
);

CREATE POLICY "Users can update their own incomes"
ON public.incomes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own incomes"
ON public.incomes FOR DELETE
USING (auth.uid() = user_id);

-- Políticas RLS para recurring_incomes
CREATE POLICY "Users can view their own or group recurring incomes"
ON public.recurring_incomes FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  ((shared_group_id IS NOT NULL) AND is_group_member(shared_group_id, auth.uid()))
);

CREATE POLICY "Users can insert recurring incomes"
ON public.recurring_incomes FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) AND 
  ((shared_group_id IS NULL) OR is_group_member(shared_group_id, auth.uid()))
);

CREATE POLICY "Users can update their own recurring incomes"
ON public.recurring_incomes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring incomes"
ON public.recurring_incomes FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_incomes_updated_at
BEFORE UPDATE ON public.incomes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_incomes_updated_at
BEFORE UPDATE ON public.recurring_incomes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();