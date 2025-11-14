-- A coluna card_type já é do tipo TEXT, então não precisa alterar o tipo
-- Apenas garantir que o valor 'both' seja aceito (já é aceito por ser TEXT)
-- Esta migração apenas documenta que o valor 'both' agora é permitido

DO $$ 
BEGIN
  -- Adicionar comentário na coluna indicando os valores válidos
  COMMENT ON COLUMN public.cards.card_type IS 'Valores aceitos: credit, debit, both';
END $$;