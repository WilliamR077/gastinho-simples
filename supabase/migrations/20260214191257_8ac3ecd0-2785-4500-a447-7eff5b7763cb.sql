-- Resetar subscriptions com purchase_token duplicado, mantendo o mais antigo (dono real)
UPDATE subscriptions 
SET tier = 'free', 
    is_active = true, 
    purchase_token = NULL, 
    product_id = NULL, 
    expires_at = NULL
WHERE id IN (
  SELECT s.id 
  FROM subscriptions s
  INNER JOIN (
    SELECT purchase_token, MIN(created_at) as first_created
    FROM subscriptions 
    WHERE purchase_token IS NOT NULL
    GROUP BY purchase_token 
    HAVING COUNT(*) > 1
  ) dup ON s.purchase_token = dup.purchase_token 
       AND s.created_at > dup.first_created
);