

## Diagnóstico Completo: Por que as Assinaturas Não Funcionam

### Problema Principal Identificado

**O secret `GOOGLE_PLAY_SERVICE_ACCOUNT` NÃO ESTÁ CONFIGURADO no Supabase!**

Quando verifiquei os secrets disponíveis, só encontrei:
- `FIREBASE_SERVER_KEY`

**Não existe** o secret `GOOGLE_PLAY_SERVICE_ACCOUNT`, que é essencial para validar compras com a API do Google Play.

---

### Fluxo do Problema (Conta da sua mãe - vivianecolares76@gmail.com)

```text
1. Usuário seleciona Premium Plus (R$17,90)
2. Google Play processa o pagamento → SUCESSO (passa no cartão)
3. App recebe transaction.approved()
4. App chama validate-purchase Edge Function
5. Edge Function tenta ler GOOGLE_PLAY_SERVICE_ACCOUNT → NÃO EXISTE
6. Edge Function retorna { valid: false, errorCode: 'SERVICE_ACCOUNT_NOT_CONFIGURED' }
7. App NÃO chama transaction.finish() (porque validação falhou)
8. Google Play fica aguardando confirmação → mostra "Confirmar plano"
9. Após 3 dias sem confirmação → Google Play cancela e reembolsa
```

---

### Evidências nos Logs

**Logs da Edge Function validate-purchase (do contexto):**
```
❌ Google Play API error: 400 "Invalid Value"
```

Isso acontece porque:
1. Ou o `purchaseToken` está incorreto/malformado
2. Ou o `GOOGLE_PLAY_SERVICE_ACCOUNT` retornou access token inválido (provavelmente porque o secret não existe ou está mal formatado)

**Logs do Audit no banco (encontrei):**
- A compra da sua mãe em 26/01 foi registrada via webhook do Google Play:
  - `google_play_subscription_purchased` (26/01)
  - `google_play_subscription_revoked` (29/01) - após 3 dias sem confirmação
  - `google_play_subscription_expired` (29/01)

Mas todas ficaram com `user_id: 00000000-0000-0000-0000-000000000000` (system user) porque o webhook não conseguiu vincular ao usuário (não tinha o `purchase_token` salvo no banco).

---

### Problema na sua conta (vitor.romao0442@gmail.com)

Sua assinatura expirou em `2026-02-02` e o `purchase_token` está `NULL` no banco:

```
purchase_token: <nil>
expires_at: 2026-02-02 00:00:00+00
tier: premium_plus
```

Sem o `purchase_token` salvo, a Edge Function `sync-subscription` não consegue verificar a renovação com o Google Play.

---

### Problema no Webhook

O webhook do Google Play está funcionando (recebe notificações), mas:
1. Busca assinatura pelo `purchase_token` no banco
2. Como não existe (está NULL), não encontra o usuário
3. Registra no audit_log com `user_id: 00000000-0000-0000-0000-000000000000`
4. Não atualiza a assinatura de ninguém

---

## Plano de Correção

### 1. Configurar o Secret `GOOGLE_PLAY_SERVICE_ACCOUNT` (Ação sua)

Este é o passo mais crítico. Sem ele, NADA funciona.

**Como fazer:**
1. Acesse o Google Cloud Console vinculado ao Google Play Console
2. Crie uma Service Account (ou use uma existente) com permissão para Google Play Android Developer API
3. Gere uma chave JSON para essa Service Account
4. Vá em Supabase Dashboard → Settings → Functions → Secrets
5. Adicione um novo secret:
   - Nome: `GOOGLE_PLAY_SERVICE_ACCOUNT`
   - Valor: o conteúdo completo do arquivo JSON

### 2. Corrigir a Edge Function `validate-purchase`

**Mudanças:**
- Adicionar logs mais detalhados para diagnosticar exatamente onde falha
- Verificar se o `purchaseToken` está chegando corretamente
- Tratar melhor o erro quando o service account não está configurado

### 3. Corrigir o `billing-service.ts` no app

**Problemas identificados:**
- O `purchaseToken` pode não estar sendo extraído corretamente da transação
- Adicionar log completo do objeto `transaction` para debug
- **Importante**: Quando a validação falha, salvar o `purchaseToken` mesmo assim no banco local para tentativa posterior

### 4. Melhorar o Webhook para lidar com novos usuários

**Problema atual:**
- Se o `purchase_token` não está no banco, o webhook não encontra o usuário
- A compra é "perdida"

**Solução:**
- Quando não encontrar pelo `purchase_token`, tentar buscar assinaturas que:
  - Têm `product_id` igual ao `subscriptionId` da notificação
  - Foram criadas recentemente (últimas 24h)
  - Não têm `purchase_token` preenchido
- Atualizar essas assinaturas com o `purchase_token` correto

### 5. Criar um mecanismo de "recuperação" de assinaturas pendentes

**Nova funcionalidade:**
- Quando o usuário clica em "Restaurar Compras":
  - Tentar obter o `purchaseToken` real do Google Play
  - Validar no backend
  - Se válido, atualizar o banco COM o `purchase_token`
  - Isso permite que futuras renovações sejam processadas corretamente

---

## Arquivos a Modificar

1. **`supabase/functions/validate-purchase/index.ts`**
   - Melhorar logs de debug
   - Retornar erro mais específico quando service account não está configurado

2. **`supabase/functions/google-play-webhook/index.ts`**
   - Adicionar lógica para vincular `purchase_token` a assinaturas recentes sem token
   - Buscar usuário por outros critérios quando não encontrar pelo token

3. **`src/services/billing-service.ts`**
   - Melhorar extração do `purchaseToken`
   - Salvar `purchaseToken` localmente mesmo quando validação falha
   - Adicionar retry automático de validação

4. **Nova Edge Function `recover-subscription`**
   - Endpoint para o usuário recuperar/vincular assinatura manualmente
   - Consulta Google Play e atualiza banco com dados corretos

---

## Correção Imediata para Contas Afetadas

Depois de configurar o `GOOGLE_PLAY_SERVICE_ACCOUNT`:

**Para sua conta (vitor.romao0442@gmail.com):**
1. Abrir o app
2. Tocar em "Restaurar Compras"
3. Se a assinatura ainda estiver ativa no Google Play, será restaurada

**Para a conta da sua mãe (vivianecolares76@gmail.com):**
1. A assinatura foi reembolsada, então precisa assinar novamente
2. Depois de configurar o secret, a nova assinatura vai funcionar

---

## Resumo das Prioridades

| Prioridade | Ação | Quem faz |
|------------|------|----------|
| 1 (CRÍTICA) | Configurar `GOOGLE_PLAY_SERVICE_ACCOUNT` no Supabase | Você |
| 2 | Atualizar Edge Functions com melhor diagnóstico | Eu (código) |
| 3 | Melhorar billing-service.ts para extrair token corretamente | Eu (código) |
| 4 | Adicionar lógica de vinculação no webhook | Eu (código) |
| 5 | Testar fluxo completo | Você (no app) |

