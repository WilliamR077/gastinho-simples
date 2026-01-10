-- Atualizar a assinatura do usuário vitor.romon0442@gmail.com para expires_at correto
UPDATE subscriptions 
SET 
  expires_at = '2026-02-02T00:00:00Z',
  updated_at = now(),
  is_active = true
WHERE user_id = '65e6ec36-089b-41f9-af7a-eaba92e30eff';