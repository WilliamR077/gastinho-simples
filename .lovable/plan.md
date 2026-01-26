
Objetivo
- Fazer a assinatura “Premium Plus” finalizar corretamente no Android (sem ficar em “Confirmar plano” e sem estorno), e o app reconhecer o plano (remover anúncios / liberar recursos) logo após a compra.

O que significa “Confirmar plano” (o que o print mostra)
- Esse aviso do Google Play (“Abra este app para confirmar seu plano… senão será cancelado automaticamente”) é típico quando o Google Play está aguardando o app “confirmar/finalizar” a compra.
- Na prática isso costuma acontecer quando o app não conclui o fluxo de compra (acknowledge/finish). O Google dá um prazo (no seu print: até 29 jan) e, se o app não confirmar, ele cancela e o valor acaba sendo estornado.

Diagnóstico provável (com base no código atual)
1) O app só “finaliza” (transaction.finish()) depois que a Edge Function validate-purchase valida a compra.
2) Hoje NÃO existe o secret GOOGLE_PLAY_SERVICE_ACCOUNT configurado no projeto (verifiquei os secrets disponíveis e só existe FIREBASE_SERVER_KEY).
3) Sem GOOGLE_PLAY_SERVICE_ACCOUNT, a função validate-purchase retorna “Compra inválida” sempre.
4) Resultado:
   - a compra chega a ser criada no Google Play,
   - mas o app não valida no backend,
   - então o app não chama transaction.finish(),
   - o Google Play fica pedindo “Confirmar plano” e depois cancela/estorna.

Além disso (mesmo depois de configurar o Service Account) há 2 pontos que podem quebrar a validação:
- A chave privada do Service Account pode vir com “\\n” (texto) e o código atual não converte isso em quebra de linha real, o que faz o JWT OAuth falhar.
- Em alguns casos o plugin não expõe purchaseToken no campo transaction.purchaseToken; o token pode estar em transaction.nativePurchase.purchaseToken (o código atual já trata isso no restorePurchases, mas não trata no fluxo de compra “approved”).

Plano de correção (backend + app) — com foco em robustez

1) Configuração necessária no Google / Supabase (ação sua, guiada)
1.1) Criar/usar um Service Account com acesso ao Google Play Developer API
- No Google Play Console: Configurações > API access
- Vincular um projeto do Google Cloud (se ainda não estiver).
- Criar um Service Account e dar permissões para ler assinaturas/pedidos (pelo menos “View subscriptions and purchases” / acesso para consultar compras).
- Gerar e baixar a chave JSON do Service Account.

1.2) Adicionar o secret no Supabase (Lovable Cloud)
- Criar um secret chamado: GOOGLE_PLAY_SERVICE_ACCOUNT
- Valor: o JSON completo da chave do Service Account (copiar/colar)
Observação importante: se o JSON tiver private_key com “\\n”, está tudo bem — vamos ajustar o código para tratar isso automaticamente.

2) Ajustes no código das Edge Functions (para validar de verdade)
2.1) Corrigir leitura do private_key do Service Account
- Em validate-purchase, sync-subscription e google-play-webhook:
  - após JSON.parse(serviceAccountJson), fazer:
    - serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
  - Isso evita falha ao gerar o JWT e obter access token.

2.2) Melhorar logs/erros retornados (para diagnosticar rápido)
- Quando GOOGLE_PLAY_SERVICE_ACCOUNT estiver ausente:
  - retornar erro explícito “SERVICE_ACCOUNT_NOT_CONFIGURED”
- Quando a API do Google Play retornar erro:
  - logar status + body
  - retornar erro “GOOGLE_PLAY_API_ERROR”
Isso ajuda a identificar rapidamente se é permissão, packageName, productId, token inválido etc.

3) Ajustes no app (para não ficar preso em “Confirmar plano”)
3.1) Garantir que estamos enviando Authorization para as Edge Functions
- Em billing-service.ts:
  - validatePurchase() e syncSubscriptionFromBackend() devem enviar explicitamente:
    Authorization: `Bearer ${session.access_token}`
  - Isso evita falha silenciosa caso o invoke não esteja anexando o token em algum dispositivo.

3.2) Extrair purchaseToken corretamente no fluxo de compra (approved)
- No handler .approved(transaction):
  - tentar nesta ordem:
    - transaction.purchaseToken
    - (transaction as any).nativePurchase?.purchaseToken
    - (transaction as any).transactionId
    - transaction.id (último fallback)
- E logar (em debug) de onde veio o token.
Motivo: se mandarmos o token errado, a API do Google Play não encontra a assinatura e a validação falha.

3.3) Reforçar “restaurar/confirmar” quando o usuário reabre o app
- Hoje: checkAndSyncSubscription() só tenta sincronizar quando o banco já tem tier != free.
- Problema: quando a validação falha, o banco fica free, então NUNCA roda a sincronização automática.
- Ajuste:
  - checkAndSyncSubscription() deve tentar restorePurchases() também quando o tier for free (com throttling simples, tipo “no máximo 1x a cada X horas”, para não pesar).
  - Isso faz o app “confirmar” a assinatura ao abrir, mesmo se a primeira validação não tiver atualizado o banco.

3.4) Melhorar restorePurchases()
- Além de store.refresh(), chamar também store.restorePurchases() (quando disponível) para forçar reprocessamento de transações pendentes.
- Se detectar compra “owned” e conseguir validar, atualizar o banco e disparar refreshSubscription().

3.5) UX: feedback claro ao usuário
- Se a compra foi iniciada mas a validação falhar:
  - mostrar toast do tipo:
    “Compra pendente. Abra novamente o app para confirmar a assinatura. Se continuar, toque em ‘Restaurar Compras’.”
- Manter (ou destacar) o botão “Restaurar Compras” na tela de assinatura como solução imediata.

4) Verificações e testes (antes de publicar)
4.1) Teste de compra real (com a conta da sua mãe)
- Realizar compra Premium Plus
- Confirmar que:
  - Edge Function validate-purchase registra logs de “paymentState” e retorna valid true
  - O app chama transaction.finish()
  - O Google Play para de mostrar “Confirmar plano”
  - O app muda o plano para Premium Plus e remove anúncios (Premium Plus é sem anúncios)

4.2) Teste de “fechei e reabri”
- Fechar o app logo após comprar e reabrir
- Confirmar que a sincronização automática (restorePurchases/checkAndSyncSubscription) recupera e aplica o plano.

4.3) Teste de “Restaurar Compras”
- Clicar “Restaurar Compras” e garantir que, se a assinatura existir, o app aplica o tier correto.

5) Hardening (recomendado após estabilizar)
- Alterar supabase/config.toml para verify_jwt = true em validate-purchase e sync-subscription (e ajustar CORS/headers conforme necessário).
- Isso reduz a superfície de ataque, mantendo o mesmo comportamento funcional.

Entregáveis (o que eu vou implementar quando você trocar para o modo de edição)
- Atualizações em:
  - src/services/billing-service.ts (token extraction, headers Authorization, restorePurchases + sync start)
  - supabase/functions/validate-purchase/index.ts (private_key fix + logs)
  - supabase/functions/sync-subscription/index.ts (private_key fix + logs)
  - supabase/functions/google-play-webhook/index.ts (private_key fix + logs)
  - (opcional) supabase/config.toml (verify_jwt = true para validate-purchase e sync-subscription)
- Orientação passo-a-passo para você criar e cadastrar o GOOGLE_PLAY_SERVICE_ACCOUNT.

Dependências / o que eu preciso de você
- Você precisa adicionar o secret GOOGLE_PLAY_SERVICE_ACCOUNT com o JSON do Service Account.
Sem isso, a assinatura vai continuar falhando e o Google Play vai seguir pedindo “Confirmar plano”.

Riscos e como mitigamos
- Se o Service Account não tiver permissão correta no Play Console, a API retorna 401/403:
  - nossos logs vão mostrar claramente e a correção é ajustar permissões.
- Se o purchaseToken estiver vindo de outro campo:
  - vamos extrair por múltiplas fontes (incluindo nativePurchase.purchaseToken) e logar.

Resultado esperado
- Após a compra, o app valida no backend, finaliza a transação e o Google Play não exibe mais “Confirmar plano”.
- O plano “Premium Plus” passa a aparecer como ativo no app, e os anúncios somem automaticamente.

