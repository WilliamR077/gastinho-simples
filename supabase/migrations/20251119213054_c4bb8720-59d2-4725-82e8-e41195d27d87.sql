-- Ativar extensões necessárias
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Criar cron job para verificar lembretes diariamente às 9h (horário UTC)
-- Ajuste o horário conforme sua timezone (9h Brasil = 12h UTC)
select cron.schedule(
  'check-recurring-reminders-daily',
  '0 12 * * *', -- Todo dia às 12h UTC (9h Brasil)
  $$
  select net.http_post(
    url := 'https://jaoldaqvbdllowepzwbr.supabase.co/functions/v1/check-recurring-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb2xkYXF2YmRsbG93ZXB6d2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjQ2MTYsImV4cCI6MjA3MjQwMDYxNn0.-TthPn1c2qiSQjSd7igTien0_czmLbgKWwCpBvSPV84"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);