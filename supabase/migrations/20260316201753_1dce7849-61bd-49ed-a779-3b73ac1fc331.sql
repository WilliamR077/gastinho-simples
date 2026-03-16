-- Limpar purchase_token de registros manuais (não deveria existir)
UPDATE subscriptions SET purchase_token = NULL 
WHERE platform = 'manual' AND purchase_token IS NOT NULL;

-- Reativar assinatura do usuário correto
UPDATE subscriptions SET is_active = true, expires_at = '2026-04-15T16:43:44.963Z'
WHERE user_id = '65e6ec36-089b-41f9-af7a-eaba92e30eff' AND platform = 'android';

-- Constraint: registros manuais nunca podem ter purchase_token
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_manual_no_token
CHECK (platform <> 'manual' OR purchase_token IS NULL);

-- Índice único para tokens Android (previne duplicatas futuras)
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_android_token_unique
ON subscriptions (purchase_token) WHERE platform = 'android' AND purchase_token IS NOT NULL;