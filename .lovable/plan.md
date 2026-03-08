

## Plano: Corrigir bug de compartilhamento de assinatura + Adicionar opção "Gratuito" no admin

### Problema 1: Assinatura "compartilhada" entre contas no mesmo dispositivo

Quando o usuário A assina e faz logout, e o usuário B faz login no mesmo dispositivo, o `checkAndSyncSubscription()` chama `restorePurchases()` que consulta o Google Play. O Google Play retorna a assinatura como `owned` (vinculada à conta Google do dispositivo, não ao usuário do app). Embora o `validatePurchase` backend tenha uma checagem de `TOKEN_BELONGS_TO_OTHER_USER`, há cenários onde o token é diferente (renovação, fallback) ou a chamada `syncSubscriptionFromBackend` bypassa essa verificação.

### Problema 2: Admin não pode rebaixar para Gratuito

O Select só oferece "Premium" e "Sem Anúncios". Falta a opção de resetar para gratuito.

---

### Mudanças

| Arquivo | Ação |
|---|---|
| `src/pages/Admin.tsx` | Adicionar "Gratuito" no Select e ajustar a lógica de "Conceder" para chamar revoke quando tier=free |
| `supabase/functions/admin-subscriptions/index.ts` | Ajustar DELETE para funcionar com qualquer platform (não apenas "manual") |
| `supabase/functions/validate-purchase/index.ts` | Reforçar: antes de dar upsert, verificar se já existe QUALQUER subscription ativa com o mesmo token em outro user |
| `supabase/functions/sync-subscription/index.ts` | Reforçar: rejeitar sync se o user não tiver purchase_token próprio (não criar assinatura do nada) |
| `src/services/billing-service.ts` | No `restorePurchases`, se o backend rejeitar com TOKEN_BELONGS_TO_OTHER_USER, limpar localStorage e NÃO tentar fallbacks |

---

### Detalhes

**Admin — opção Gratuito:**
- Adicionar `<SelectItem value="free">Gratuito</SelectItem>` no dropdown
- Quando tier selecionado for "free", o botão "Conceder" chama a mesma lógica de "Revogar" (desativar assinatura e setar tier=free)

**Admin — revogar qualquer assinatura (não só manual):**
- O DELETE atual filtra `platform = 'manual'`. Mudar para atualizar o tier para free e `is_active = true` (resetar), limpando `purchase_token`, `product_id` e `expires_at`, independente da platform.

**Billing service — parar fallbacks após rejeição:**
- Quando `validatePurchase` retorna `TOKEN_BELONGS_TO_OTHER_USER`, não tentar `recoverSubscription` nem `syncSubscriptionFromBackend` — retornar imediatamente `{ success: false }`
- Limpar `localStorage.last_restore_check` para não ficar tentando toda hora

**Backend — reforçar validação:**
- `validate-purchase`: a checagem de token duplicado já existe (linhas 112-134), manter
- `sync-subscription`: se o usuário não tiver `purchase_token` no banco, rejeitar imediatamente (não tentar criar assinatura sem prova de compra) — isso já acontece mas vamos tornar explícito

