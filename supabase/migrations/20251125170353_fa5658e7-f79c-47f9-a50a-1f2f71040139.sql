-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule the budget goals check to run daily at 20:00 (8 PM)
SELECT cron.schedule(
  'check-budget-goals-daily',
  '0 20 * * *', -- At 20:00 every day
  $$
  SELECT
    net.http_post(
        url:='https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/check-budget-goals',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb2xkYXF2YmRsbG93ZXB6d2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjQ2MTYsImV4cCI6MjA3MjQwMDYxNn0.-TthPn1c2qiSQjSd7igTien0_czmLbgKWwCpBvSPV84"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);