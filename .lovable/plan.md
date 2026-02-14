

## Plano: Vincular Assinatura ao Usuario Correto

### O Problema
Quando um usuario faz login com uma segunda conta no mesmo celular, o app automaticamente restaura a assinatura do Google Play e aplica para essa segunda conta, mesmo que ela nunca tenha pago. Isso acontece porque o `checkAndSyncSubscription` chama `restorePurchases` para qualquer usuario "free", e o Google Play retorna a assinatura ativa do dispositivo independente de qual conta do app esta logada.

### Solucao

Vincular a assinatura ao usuario correto verificando no backend se aquele `purchase_token` ja pertence a outro usuario.

### Mudancas

**1. Edge Function `validate-purchase` (ou criar nova logica)**

Antes de ativar a assinatura para um usuario, verificar se o `purchase_token` ja esta vinculado a outro `user_id` na tabela `subscriptions`. Se ja estiver vinculado a outro usuario, rejeitar a validacao.

**2. `src/services/billing-service.ts` - `checkAndSyncSubscription`**

Na logica de restore para usuarios free, apos o Google Play confirmar que existe uma assinatura ativa, enviar o `purchase_token` ao backend para validacao. O backend verifica se o token ja pertence a outro usuario. Se pertencer, nao ativa a assinatura.

### Detalhes tecnicos

**Arquivo: `supabase/functions/validate-purchase/index.ts`**

Adicionar verificacao antes de fazer upsert:

```text
// Verificar se o purchase_token ja pertence a outro usuario
const { data: existingSub } = await supabaseAdmin
  .from('subscriptions')
  .select('user_id')
  .eq('purchase_token', purchaseToken)
  .neq('user_id', user.id)
  .single();

if (existingSub) {
  // Token ja vinculado a outro usuario
  return new Response(JSON.stringify({
    valid: false,
    error: 'Esta assinatura pertence a outra conta.',
    errorCode: 'TOKEN_BELONGS_TO_OTHER_USER',
  }), { status: 400, headers: corsHeaders });
}
```

**Arquivo: `supabase/functions/recover-subscription/index.ts`**

Mesma verificacao: antes de recuperar, checar se o `purchase_token` nao pertence a outro usuario.

**Arquivo: `supabase/functions/sync-subscription/index.ts`**

Mesma verificacao no fluxo de sincronizacao.

**Arquivo: `src/services/billing-service.ts`**

Na funcao `savePurchaseTokenForRetry`, tambem verificar no backend antes de salvar. E no `restorePurchases`, quando a validacao retorna `TOKEN_BELONGS_TO_OTHER_USER`, nao tentar novamente e mostrar log informativo.

### Resumo das mudancas

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/validate-purchase/index.ts` | Verificar se purchase_token ja pertence a outro usuario antes de ativar |
| `supabase/functions/recover-subscription/index.ts` | Mesma verificacao de propriedade do token |
| `supabase/functions/sync-subscription/index.ts` | Mesma verificacao de propriedade do token |
| `src/services/billing-service.ts` | Tratar erro `TOKEN_BELONGS_TO_OTHER_USER` sem retry |

### Comportamento esperado apos a mudanca

- **Usuario A** (que pagou): Login no celular -> assinatura Premium Plus funciona normalmente
- **Usuario B** (conta gratuita): Login no mesmo celular -> app tenta restaurar, backend detecta que o token pertence ao Usuario A, rejeita -> Usuario B permanece no plano gratuito
- **Usuario A** em outro celular: Login -> restaura normalmente porque o token pertence a ele

### Apos as mudancas
1. Faca `git pull`
2. Rode `npx cap sync`
3. Rode `npx cap run android`
4. Teste: logue com a conta Premium Plus e confirme que funciona. Depois troque para outra conta e confirme que ela fica como "Gratuito"
