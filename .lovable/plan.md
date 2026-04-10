

## Plano: Corrigir notificações repetidas de metas (deploy da lógica de cruzamento de faixa)

### Problema
A deduplicação atual na linha 239 usa `.eq("alert_date", today)` — ou seja, verifica apenas se já enviou **hoje**. Como o cron roda todo dia, se a meta continua em 100%, o usuário recebe a mesma notificação **todo dia**, indefinidamente. É exatamente o que mostra o print.

### Solução
Trocar a deduplicação de "por dia" para "por mês/ciclo". Dentro de um mesmo mês, cada nível (80%, 95%, 100%) só é enviado **uma vez**. Só reseta no próximo mês.

### Mudança no `supabase/functions/check-budget-goals/index.ts`

**Antes (linha 234-239):**
```ts
.eq("alert_date", today)
```

**Depois:**
```ts
.gte("alert_date", monthStart)
```

Isso garante que, se já existe um alerta de nível 100 para aquele goal_id em qualquer dia do mês atual, não envia de novo. Só vai enviar novamente no próximo mês quando `monthStart` mudar.

### Também: respeitar toggles de notificação

Consultar `notification_settings` do usuário antes de enviar, verificando os toggles `notify_expense_goals`, `notify_income_goals` e `notify_balance_goals` (criados na migration anterior). Se o toggle estiver desligado, pula o envio.

### Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/check-budget-goals/index.ts` | `.eq("alert_date", today)` → `.gte("alert_date", monthStart)` + consultar `notification_settings` |

Após editar, fazer deploy da edge function.

