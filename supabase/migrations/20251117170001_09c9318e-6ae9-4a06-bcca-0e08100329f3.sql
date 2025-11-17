-- Remover a constraint antiga que só permite 'credit' e 'debit'
ALTER TABLE public.cards 
  DROP CONSTRAINT IF EXISTS cards_card_type_check;

-- Adicionar nova constraint que também permite 'both'
ALTER TABLE public.cards 
  ADD CONSTRAINT cards_card_type_check 
  CHECK (card_type = ANY (ARRAY['credit'::text, 'debit'::text, 'both'::text]));