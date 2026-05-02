-- Etapa C: remover plaintext do INTERNAL_API_SECRET dos cron jobs.
-- Os jobs 3, 4 e 5 passam a montar o header x-internal-secret em runtime
-- via public.get_internal_api_secret_for_cron(), que lê do vault.
-- Authorization: Bearer <anon> é mantido literal porque a anon key é pública
-- (já exposta no frontend e em src/integrations/supabase/client.ts).

-- Job 3: check-recurring-reminders-daily (12:00 UTC)
SELECT cron.alter_job(
  job_id := 3,
  command := $cmd$
    SELECT net.http_post(
      url := 'https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/check-recurring-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb2xkYXF2YmRsbG93ZXB6d2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjQ2MTYsImV4cCI6MjA3MjQwMDYxNn0.-TthPn1c2qiSQjSd7igTien0_czmLbgKWwCpBvSPV84',
        'x-internal-secret', public.get_internal_api_secret_for_cron()
      ),
      body := jsonb_build_object('triggered_at', now())
    );
  $cmd$
);

-- Job 4: check-budget-goals-daily (20:00 UTC)
SELECT cron.alter_job(
  job_id := 4,
  command := $cmd$
    SELECT net.http_post(
      url := 'https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/check-budget-goals',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb2xkYXF2YmRsbG93ZXB6d2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjQ2MTYsImV4cCI6MjA3MjQwMDYxNn0.-TthPn1c2qiSQjSd7igTien0_czmLbgKWwCpBvSPV84',
        'x-internal-secret', public.get_internal_api_secret_for_cron()
      ),
      body := jsonb_build_object('triggered_at', now())
    );
  $cmd$
);

-- Job 5: check-budget-goals-morning (09:00 UTC)
SELECT cron.alter_job(
  job_id := 5,
  command := $cmd$
    SELECT net.http_post(
      url := 'https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/check-budget-goals',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb2xkYXF2YmRsbG93ZXB6d2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjQ2MTYsImV4cCI6MjA3MjQwMDYxNn0.-TthPn1c2qiSQjSd7igTien0_czmLbgKWwCpBvSPV84',
        'x-internal-secret', public.get_internal_api_secret_for_cron()
      ),
      body := jsonb_build_object('triggered_at', now())
    );
  $cmd$
);