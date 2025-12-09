-- Criar tabela de categorias do usuário
CREATE TABLE public.user_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📦',
  color TEXT DEFAULT '#6366f1',
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Habilitar RLS
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Users can view their own categories"
ON public.user_categories FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own categories"
ON public.user_categories FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories"
ON public.user_categories FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories"
ON public.user_categories FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_user_categories_updated_at
BEFORE UPDATE ON public.user_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar coluna category_id nas tabelas de despesas
ALTER TABLE public.expenses ADD COLUMN category_id UUID REFERENCES public.user_categories(id);
ALTER TABLE public.recurring_expenses ADD COLUMN category_id UUID REFERENCES public.user_categories(id);

-- Função para inicializar categorias padrão para um usuário
CREATE OR REPLACE FUNCTION public.initialize_user_categories(user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_categories TEXT[][] := ARRAY[
    ARRAY['alimentacao', 'Alimentação', '🍔'],
    ARRAY['transporte', 'Transporte', '🚗'],
    ARRAY['lazer', 'Lazer', '🎮'],
    ARRAY['saude', 'Saúde', '⚕️'],
    ARRAY['educacao', 'Educação', '📚'],
    ARRAY['moradia', 'Moradia', '🏠'],
    ARRAY['vestuario', 'Vestuário', '👕'],
    ARRAY['servicos', 'Serviços', '🔧'],
    ARRAY['outros', 'Outros', '📦']
  ];
  cat TEXT[];
  i INTEGER := 0;
BEGIN
  -- Verificar se usuário já tem categorias
  IF EXISTS (SELECT 1 FROM public.user_categories WHERE user_id = user_id_param) THEN
    RETURN;
  END IF;
  
  -- Inserir categorias padrão
  FOREACH cat SLICE 1 IN ARRAY default_categories LOOP
    INSERT INTO public.user_categories (user_id, name, icon, is_default, display_order)
    VALUES (user_id_param, cat[2], cat[3], true, i);
    i := i + 1;
  END LOOP;
END;
$$;

-- Função para migrar categorias enum para category_id
CREATE OR REPLACE FUNCTION public.migrate_expense_categories(user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  category_map JSONB := '{
    "alimentacao": "Alimentação",
    "transporte": "Transporte",
    "lazer": "Lazer",
    "saude": "Saúde",
    "educacao": "Educação",
    "moradia": "Moradia",
    "vestuario": "Vestuário",
    "servicos": "Serviços",
    "outros": "Outros"
  }'::JSONB;
  cat_name TEXT;
  cat_id UUID;
  expense_record RECORD;
BEGIN
  -- Migrar expenses
  FOR expense_record IN 
    SELECT id, category FROM public.expenses 
    WHERE user_id = user_id_param AND category_id IS NULL AND category IS NOT NULL
  LOOP
    cat_name := category_map ->> expense_record.category::TEXT;
    IF cat_name IS NOT NULL THEN
      SELECT id INTO cat_id FROM public.user_categories 
      WHERE user_id = user_id_param AND name = cat_name;
      
      IF cat_id IS NOT NULL THEN
        UPDATE public.expenses SET category_id = cat_id WHERE id = expense_record.id;
      END IF;
    END IF;
  END LOOP;
  
  -- Migrar recurring_expenses
  FOR expense_record IN 
    SELECT id, category FROM public.recurring_expenses 
    WHERE user_id = user_id_param AND category_id IS NULL AND category IS NOT NULL
  LOOP
    cat_name := category_map ->> expense_record.category::TEXT;
    IF cat_name IS NOT NULL THEN
      SELECT id INTO cat_id FROM public.user_categories 
      WHERE user_id = user_id_param AND name = cat_name;
      
      IF cat_id IS NOT NULL THEN
        UPDATE public.recurring_expenses SET category_id = cat_id WHERE id = expense_record.id;
      END IF;
    END IF;
  END LOOP;
END;
$$;