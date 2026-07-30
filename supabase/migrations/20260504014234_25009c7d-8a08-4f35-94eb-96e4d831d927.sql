-- Block B: Rate Limiting Infrastructure

-- 1. Tabela para tracking de eventos de rate limit
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id BIGSERIAL PRIMARY KEY,
  bucket_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_bucket_created
  ON public.rate_limit_events (bucket_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_created_at
  ON public.rate_limit_events (created_at);

-- RLS: enable but no policies for anon/authenticated (only service_role bypasses RLS).
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

-- Lockdown: revogar tudo de PUBLIC/anon/authenticated.
REVOKE ALL ON TABLE public.rate_limit_events FROM PUBLIC;
REVOKE ALL ON TABLE public.rate_limit_events FROM anon;
REVOKE ALL ON TABLE public.rate_limit_events FROM authenticated;
REVOKE ALL ON SEQUENCE public.rate_limit_events_id_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.rate_limit_events_id_seq FROM anon;
REVOKE ALL ON SEQUENCE public.rate_limit_events_id_seq FROM authenticated;

-- 2. RPC check_rate_limit
-- Retorna jsonb { allowed, remaining, retry_after_seconds, limit, window_seconds }.
-- Usa pg_advisory_xact_lock(hashtextextended(bucket_key, 0)) para evitar
-- race conditions entre count + insert dentro da mesma janela.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket_key TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
  v_oldest TIMESTAMPTZ;
  v_retry_after INTEGER;
BEGIN
  -- Defesa em profundidade: bloquear papéis API.
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_bucket_key IS NULL OR length(p_bucket_key) = 0 THEN
    RAISE EXCEPTION 'bucket_key required';
  END IF;
  IF p_max_requests <= 0 OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'invalid limits';
  END IF;

  -- Lock por bucket dentro da transação atual: serializa chamadas concorrentes
  -- com o mesmo bucket_key, evitando contagem stale entre count e insert.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_bucket_key, 0));

  v_window_start := now() - make_interval(secs => p_window_seconds);

  SELECT COUNT(*), MIN(created_at)
    INTO v_count, v_oldest
  FROM public.rate_limit_events
  WHERE bucket_key = p_bucket_key
    AND created_at >= v_window_start;

  IF v_count >= p_max_requests THEN
    v_retry_after := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (v_oldest + make_interval(secs => p_window_seconds) - now())))::INTEGER
    );
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_seconds', v_retry_after,
      'limit', p_max_requests,
      'window_seconds', p_window_seconds
    );
  END IF;

  INSERT INTO public.rate_limit_events (bucket_key) VALUES (p_bucket_key);

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', p_max_requests - v_count - 1,
    'retry_after_seconds', 0,
    'limit', p_max_requests,
    'window_seconds', p_window_seconds
  );
END;
$$;

-- Grants: somente service_role pode executar.
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- 3. Função de cleanup (idempotente).
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  -- Mantemos 24h de histórico para suportar janelas longas com folga.
  DELETE FROM public.rate_limit_events
  WHERE created_at < now() - interval '24 hours';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_rate_limit_events() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_rate_limit_events() FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_rate_limit_events() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_events() TO service_role;

-- 4. Cron cleanup idempotente (a cada hora). Remove agendamento anterior se existir.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-rate-limit-events')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'cleanup-rate-limit-events'
    );
    PERFORM cron.schedule(
      'cleanup-rate-limit-events',
      '17 * * * *',
      $cron$ SELECT public.cleanup_rate_limit_events(); $cron$
    );
  END IF;
END $$;