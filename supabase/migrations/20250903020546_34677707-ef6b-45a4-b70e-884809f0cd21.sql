-- Create table for credit card billing configurations
CREATE TABLE public.credit_card_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  opening_day INTEGER NOT NULL CHECK (opening_day >= 1 AND opening_day <= 31),
  closing_day INTEGER NOT NULL CHECK (closing_day >= 1 AND closing_day <= 31),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.credit_card_configs ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own credit card config" 
ON public.credit_card_configs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own credit card config" 
ON public.credit_card_configs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credit card config" 
ON public.credit_card_configs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credit card config" 
ON public.credit_card_configs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_credit_card_configs_updated_at
BEFORE UPDATE ON public.credit_card_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();