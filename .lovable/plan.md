

## Plano: Simplificar assinaturas - Remover Premium Plus e tornar Premium completo

### Resumo da mudanca

Reduzir de 4 para 3 planos:
- **Gratuito** - basico com anuncios
- **Sem Anuncios** (R$ 4,90/mes) - igual ao gratuito, mas sem anuncios
- **Premium** (R$ 14,90/mes) - tudo desbloqueado + sem anuncios (absorve o que era Premium Plus)

### Sobre o Google Play

Voce tem razao: nao precisa criar nada novo no Google Play. O produto `app.gastinho.subs_premium_monthly` ja existe la. Basta atualizar a descricao dele no Google Play Console para mencionar que agora tambem inclui "sem anuncios". O produto do Premium Plus pode ser desativado/arquivado no Google Play Console depois, mas nao precisa ser removido imediatamente.

Usuarios que ja pagam Premium Plus continuarao funcionando normalmente -- o app vai tratar `premium_plus` como equivalente a `premium` (todos os recursos + sem anuncios).

### Mudancas por arquivo

**1. `src/types/subscription.ts`**

- Atualizar o `premium` para ter `ads: false` (sem anuncios) e `importLimit: 500`
- Manter `premium_plus` no objeto para compatibilidade com usuarios existentes, mas com os mesmos valores do premium

**2. `src/services/admob-service.ts`**

- Adicionar `premium` na verificacao de premium status: `data === 'no_ads' || data === 'premium' || data === 'premium_plus'`

**3. `src/services/billing-service.ts`**

- Manter os mapeamentos do `premium_plus` para compatibilidade (usuarios existentes)
- Na logica de `restorePurchases`, tratar `premium_plus` e `premium` da mesma forma

**4. `src/pages/Subscription.tsx`**

- Remover o card do Premium Plus da lista de planos exibidos
- Atualizar `TIER_ORDER` para `["free", "no_ads", "premium"]` (para a UI)
- Na visao de usuario pago: se o tier for `premium_plus`, mostrar como "Premium" (ja que sao equivalentes agora)

**5. `src/hooks/use-shared-groups.tsx`**

- Ja funciona corretamente (verifica `premium || premium_plus`)

**6. `src/hooks/use-subscription.tsx`**

- Se o tier retornado for `premium_plus`, tratar como `premium` internamente

### Compatibilidade com usuarios existentes

Usuarios que ja pagaram Premium Plus:
- O banco de dados continua com `tier = 'premium_plus'`
- O enum no Supabase continua existindo
- O app trata `premium_plus` como equivalente a `premium`
- Nao precisa de migracao SQL

### Resumo

| Arquivo | Mudanca |
|---------|---------|
| `src/types/subscription.ts` | Premium agora tem `ads: false` e `importLimit: 500` |
| `src/services/admob-service.ts` | Adicionar `premium` na lista de tiers sem anuncios |
| `src/pages/Subscription.tsx` | Remover card do Premium Plus, tratar `premium_plus` como `premium` na UI |
| `src/hooks/use-subscription.tsx` | Normalizar `premium_plus` para `premium` |
| `src/services/billing-service.ts` | Manter compatibilidade, sem mudancas funcionais |

