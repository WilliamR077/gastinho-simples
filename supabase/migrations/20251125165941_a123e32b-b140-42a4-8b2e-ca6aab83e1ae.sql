-- Criar tabela para controlar alertas de metas e evitar spam
CREATE TABLE IF NOT EXISTS public.budget_goal_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_id UUID NOT NULL REFERENCES public.budget_goals(id) ON DELETE CASCADE,
  alert_level INTEGER NOT NULL, -- 80, 95, 100
  alert_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(goal_id, alert_level, alert_date)
);

-- Enable RLS
ALTER TABLE public.budget_goal_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own budget goal alerts"
ON public.budget_goal_alerts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budget goal alerts"
ON public.budget_goal_alerts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_budget_goal_alerts_goal_date ON public.budget_goal_alerts(goal_id, alert_date);
CREATE INDEX idx_budget_goal_alerts_user ON public.budget_goal_alerts(user_id);