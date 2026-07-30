-- Add columns to subscriptions table for purchase tracking
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS purchase_token TEXT,
ADD COLUMN IF NOT EXISTS product_id TEXT,
ADD COLUMN IF NOT EXISTS platform TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.subscriptions.purchase_token IS 'Token da compra do Google Play ou App Store';
COMMENT ON COLUMN public.subscriptions.product_id IS 'ID do produto comprado (ex: app.gastinho.subscription_no_ads_monthly)';
COMMENT ON COLUMN public.subscriptions.platform IS 'Plataforma da compra: android ou ios';