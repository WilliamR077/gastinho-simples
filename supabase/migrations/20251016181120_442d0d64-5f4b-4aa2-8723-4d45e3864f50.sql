-- Create enum for budget goal types
CREATE TYPE budget_goal_type AS ENUM ('monthly_total', 'category');

-- Create budget_goals table
CREATE TABLE public.budget_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type budget_goal_type NOT NULL,
  category expense_category,
  limit_amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_category_for_type CHECK (
    (type = 'monthly_total' AND category IS NULL) OR
    (type = 'category' AND category IS NOT NULL)
  )
);

-- Enable Row Level Security
ALTER TABLE public.budget_goals ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own budget goals" 
ON public.budget_goals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own budget goals" 
ON public.budget_goals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budget goals" 
ON public.budget_goals 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budget goals" 
ON public.budget_goals 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_budget_goals_updated_at
BEFORE UPDATE ON public.budget_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_budget_goals_user_id ON public.budget_goals(user_id);
CREATE INDEX idx_budget_goals_type ON public.budget_goals(type);
CREATE INDEX idx_budget_goals_category ON public.budget_goals(category) WHERE category IS NOT NULL;