
CREATE TABLE public.admin_notifications_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'broadcast',
  target_email TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  sent_by TEXT,
  recipients_count INTEGER DEFAULT 0
);

ALTER TABLE public.admin_notifications_log ENABLE ROW LEVEL SECURITY;
