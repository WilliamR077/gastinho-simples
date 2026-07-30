-- Adicionar coluna de cor na tabela cards
ALTER TABLE public.cards 
ADD COLUMN color TEXT NOT NULL DEFAULT '#FFA500';