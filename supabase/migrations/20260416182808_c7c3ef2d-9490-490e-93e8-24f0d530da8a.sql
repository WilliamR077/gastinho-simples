ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS granted_by uuid;

COMMENT ON COLUMN public.subscriptions.granted_by IS 'ID do admin que concedeu manualmente esta assinatura (NULL para assinaturas via Google Play)';