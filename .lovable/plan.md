

## Plano: Limpar dados incorretos e prevenir reativacao

### Problema
A correcao anterior adicionou verificacao de token no backend, mas a segunda conta ja tinha "Premium Plus" salvo no banco de antes da correcao. O app simplesmente le do banco e mostra o plano salvo.

### Solucao em 2 partes

**Parte 1: Limpar dados incorretos no banco**

Executar uma query SQL para encontrar purchase_tokens duplicados e manter apenas o usuario mais antigo (o dono real). Resetar os outros para "free".

A query vai:
- Encontrar tokens duplicados na tabela `subscriptions`
- Manter o registro mais antigo (primeiro `created_at`) como dono real
- Resetar os outros registros para `tier = 'free'`, `is_active = true`, `purchase_token = NULL`

**Parte 2: Adicionar verificacao proativa no app**

Atualizar o `checkAndSyncSubscription` para que, quando o usuario tem um tier pago, o app verifique no backend se o `purchase_token` ainda pertence a ele. Se nao pertencer (porque foi limpo), o app atualiza localmente para "free".

### Detalhes tecnicos

**Migracao SQL:**
```text
-- Resetar subscriptions com purchase_token duplicado, mantendo o mais antigo
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
```

**Arquivo: `src/services/billing-service.ts`**

No `checkAndSyncSubscription`, quando o tier e pago, adicionar uma verificacao: se o `purchase_token` da assinatura no banco pertence a outro usuario (verificando via backend), resetar para free localmente.

### Sobre APK vs Google Play

A verificacao de token funciona da mesma forma no APK de debug e na versao do Google Play. O Google Play Billing Library funciona igual nos dois casos, desde que o app esteja assinado com a mesma conta do Google Play Console. A unica diferenca e que no APK de debug, voce pode estar usando uma conta de teste. Mas para esse problema especifico (dados duplicados no banco), nao faz diferenca.

### Resumo das mudancas

| Arquivo / Acao | Mudanca |
|---------|---------|
| Migracao SQL | Limpar subscriptions duplicadas, manter apenas o dono original |
| `src/services/billing-service.ts` | Verificar propriedade do token ao sincronizar assinaturas pagas |

### Comportamento esperado apos a mudanca

- A segunda conta sera imediatamente resetada para "Gratuito" pela migracao SQL
- Futuras tentativas de restaurar a assinatura na segunda conta serao bloqueadas pelo backend
- A conta original (dona da assinatura) continua funcionando normalmente

