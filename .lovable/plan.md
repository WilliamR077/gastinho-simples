

## Plano: Corrigir renovação de assinatura Google Play

### Causa raiz confirmada

O DB mostra exatamente o problema descrito:
- `user_id: 65e6ec36` (você) — `platform: android`, `is_active: false`, `expires_at: 2026-03-15` 
- `user_id: a0ff8162` — `platform: manual`, `is_active: true`, mesmo `purchase_token`

A ownership check em `validate-purchase` (linha 113-118) usa `.eq('purchase_token', purchaseToken).neq('user_id', user.id).single()` — encontra o registro manual do outro usuário e bloqueia.

Adicionalmente, `checkAndSyncSubscription` (linha 967) vê `is_active: false` + `expires_at` no passado, e como `currentTier` seria `'free'` (pois `get_user_subscription_tier` retorna `'free'` quando `is_active = false` ou expirado), ele entra no branch de `free` e tenta `restorePurchases()`, que por sua vez chama `validate-purchase`, que é bloqueada novamente.

### Mudanças

#### 1. Migração SQL — Limpeza + proteções estruturais

```sql
-- Limpar token de registros manuais
UPDATE subscriptions SET purchase_token = NULL 
WHERE platform = 'manual' AND purchase_token IS NOT NULL;

-- Reativar assinatura do usuário correto
UPDATE subscriptions SET is_active = true, expires_at = '2026-04-15T16:43:44.963Z'
WHERE user_id = '65e6ec36-089b-41f9-af7a-eaba92e30eff' AND platform = 'android';

-- Constraint: manual nunca pode ter token
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_manual_no_token
CHECK (platform <> 'manual' OR purchase_token IS NULL);

-- Índice único para tokens Android
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_android_token_unique
ON subscriptions (purchase_token) WHERE platform = 'android' AND purchase_token IS NOT NULL;
```

#### 2. `validate-purchase/index.ts` — Ownership check só Android + maybeSingle

Linhas 113-118: mudar para `.eq('platform', 'android').maybeSingle()` em vez de `.single()`.

#### 3. `recover-subscription/index.ts` — Mesma correção

Linhas 125-130: `.eq('platform', 'android').maybeSingle()`.

#### 4. `sync-subscription/index.ts` — Mesma correção

Duas queries de ownership (linhas ~80-88 e ~76): adicionar `.eq('platform', 'android')` e usar `.maybeSingle()`.

#### 5. `google-play-webhook/index.ts` — Buscar só Android + abortar em ambiguidade

Linhas 124-128: trocar `.single()` por `.eq('platform', 'android').maybeSingle()`. Se retornar mais de um registro (que o unique index previne), logar erro e abortar.

#### 6. `billing-service.ts` — `checkAndSyncSubscription` tratar `is_active: false` com token

Na lógica de `checkAndSyncSubscription` (linhas 947-1037):
- Antes do check de `currentTier === 'free'`, adicionar: se `subscription?.purchase_token` existe mas `!subscription?.is_active`, forçar `restorePurchases()` imediatamente (sem throttling de 4h) pois indica inconsistência.
- Isso cobre o caso em que o tier no DB é "premium" mas `is_active=false` — a RPC `get_user_subscription_tier` retorna `'free'`, mas o registro real tem token.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Limpeza de token manual, constraint, unique index |
| `validate-purchase/index.ts` | Ownership: `.eq('platform','android').maybeSingle()` |
| `recover-subscription/index.ts` | Ownership: `.eq('platform','android').maybeSingle()` |
| `sync-subscription/index.ts` | Ownership: `.eq('platform','android').maybeSingle()` |
| `google-play-webhook/index.ts` | Busca: `.eq('platform','android').maybeSingle()` |
| `billing-service.ts` | `checkAndSyncSubscription`: tratar `is_active=false` + token |

