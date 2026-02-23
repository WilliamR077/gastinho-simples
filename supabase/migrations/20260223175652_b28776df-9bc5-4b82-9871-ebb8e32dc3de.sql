
-- Tabela user_income_categories
CREATE TABLE public.user_income_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '📦',
  color text DEFAULT '#10b981',
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.user_income_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own income categories"
ON public.user_income_categories FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own income categories"
ON public.user_income_categories FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own income categories"
ON public.user_income_categories FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own income categories"
ON public.user_income_categories FOR DELETE
USING (auth.uid() = user_id);

-- Colunas income_category_id nas tabelas incomes e recurring_incomes
ALTER TABLE public.incomes ADD COLUMN income_category_id uuid REFERENCES public.user_income_categories(id);
ALTER TABLE public.recurring_incomes ADD COLUMN income_category_id uuid REFERENCES public.user_income_categories(id);

-- Colunas para cache de nome/icone (mesmo padrão das despesas)
ALTER TABLE public.incomes ADD COLUMN category_name text;
ALTER TABLE public.incomes ADD COLUMN category_icon text DEFAULT '📦';
ALTER TABLE public.recurring_incomes ADD COLUMN category_name text;
ALTER TABLE public.recurring_incomes ADD COLUMN category_icon text DEFAULT '📦';

-- RPC: inicializar categorias padrão de entrada
CREATE OR REPLACE FUNCTION public.initialize_user_income_categories(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  default_categories TEXT[][] := ARRAY[
    ARRAY['Salário', '💰'],
    ARRAY['Freelance', '💻'],
    ARRAY['Investimentos', '📈'],
    ARRAY['Vendas', '🛒'],
    ARRAY['Bônus', '🎁'],
    ARRAY['Presente', '🎀'],
    ARRAY['Reembolso', '🔄'],
    ARRAY['Aluguel', '🏠'],
    ARRAY['Outros', '📦']
  ];
  cat TEXT[];
  i INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_income_categories WHERE user_id = user_id_param) THEN
    RETURN;
  END IF;

  FOREACH cat SLICE 1 IN ARRAY default_categories LOOP
    INSERT INTO public.user_income_categories (user_id, name, icon, is_default, display_order)
    VALUES (user_id_param, cat[1], cat[2], true, i);
    i := i + 1;
  END LOOP;
END;
$function$;

-- RPC: migrar entradas existentes do enum para category_id
CREATE OR REPLACE FUNCTION public.migrate_income_categories(user_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  category_map JSONB := '{
    "salario": "Salário",
    "freelance": "Freelance",
    "investimentos": "Investimentos",
    "vendas": "Vendas",
    "bonus": "Bônus",
    "presente": "Presente",
    "reembolso": "Reembolso",
    "aluguel": "Aluguel",
    "outros": "Outros"
  }'::JSONB;
  cat_name TEXT;
  cat_id UUID;
  income_record RECORD;
BEGIN
  -- Migrar incomes
  FOR income_record IN
    SELECT id, category FROM public.incomes
    WHERE user_id = user_id_param AND income_category_id IS NULL AND category IS NOT NULL
  LOOP
    cat_name := category_map ->> income_record.category::TEXT;
    IF cat_name IS NOT NULL THEN
      SELECT id INTO cat_id FROM public.user_income_categories
      WHERE user_id = user_id_param AND name = cat_name;
      IF cat_id IS NOT NULL THEN
        UPDATE public.incomes SET income_category_id = cat_id WHERE id = income_record.id;
      END IF;
    END IF;
  END LOOP;

  -- Migrar recurring_incomes
  FOR income_record IN
    SELECT id, category FROM public.recurring_incomes
    WHERE user_id = user_id_param AND income_category_id IS NULL AND category IS NOT NULL
  LOOP
    cat_name := category_map ->> income_record.category::TEXT;
    IF cat_name IS NOT NULL THEN
      SELECT id INTO cat_id FROM public.user_income_categories
      WHERE user_id = user_id_param AND name = cat_name;
      IF cat_id IS NOT NULL THEN
        UPDATE public.recurring_incomes SET income_category_id = cat_id WHERE id = income_record.id;
      END IF;
    END IF;
  END LOOP;
END;
$function$;

NOTIFY pgrst, 'reload schema';
