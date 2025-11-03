-- Criar tabela de cartões
CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  card_type TEXT NOT NULL CHECK (card_type IN ('credit', 'debit')),
  opening_day INTEGER,
  closing_day INTEGER,
  card_limit NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cards
CREATE POLICY "Users can view their own cards"
ON public.cards
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own cards"
ON public.cards
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cards"
ON public.cards
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cards"
ON public.cards
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_cards_updated_at
BEFORE UPDATE ON public.cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar coluna card_id em expenses
ALTER TABLE public.expenses
ADD COLUMN card_id UUID REFERENCES public.cards(id);

-- Adicionar coluna card_id em recurring_expenses
ALTER TABLE public.recurring_expenses
ADD COLUMN card_id UUID REFERENCES public.cards(id);

-- Criar índices para melhor performance
CREATE INDEX idx_expenses_card_id ON public.expenses(card_id);
CREATE INDEX idx_recurring_expenses_card_id ON public.recurring_expenses(card_id);
CREATE INDEX idx_cards_user_id ON public.cards(user_id);

-- Função para migrar configuração de cartão de crédito existente para um cartão padrão
CREATE OR REPLACE FUNCTION public.migrate_credit_card_config()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_record RECORD;
BEGIN
  -- Para cada usuário com configuração de cartão de crédito
  FOR config_record IN 
    SELECT DISTINCT user_id, opening_day, closing_day
    FROM public.credit_card_configs
  LOOP
    -- Criar cartão padrão se não existir
    INSERT INTO public.cards (user_id, name, card_type, opening_day, closing_day, is_active)
    VALUES (
      config_record.user_id,
      'Cartão de Crédito Principal',
      'credit',
      config_record.opening_day,
      config_record.closing_day,
      true
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;