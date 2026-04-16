

## Plano: Concessões manuais com duração configurável, revogação explícita e regra de prioridade

### 1. Causa raiz do bug

`billing-service.ts` (linhas ~1004-1026) reseta para `free` qualquer assinatura paga sem `purchase_token`. Concessões manuais nascem sem token → são derrubadas no próximo sync.

### 2. Regra de prioridade entre manual e Google Play (decisão)

**Google Play sempre prevalece sobre manual quando ativa**, com as seguintes nuances:

| Cenário | Regra |
|---|---|
| Manual ativo → usuário assina Google Play | Google Play sobrescreve. `platform='google_play'`, `purchase_token` setado, `expires_at` = data do Google. Concessão manual é perdida (loja é fonte de verdade enquanto ativa). |
| Google Play ativo → admin concede manual | **Bloqueado pelo edge function**: retorna erro "Usuário tem assinatura ativa via Google Play. Aguarde expiração ou revogue antes de conceder manualmente." Evita inconsistência silenciosa. |
| Google Play **expira/cancela** + manual existente | Sync detecta cancelamento → resetaria para free, MAS se houver registro histórico de concessão manual válida (`platform='manual'` em row separada ou flag), restaura manual. **Implementação simples:** mantemos apenas 1 row em `subscriptions` por usuário, então Google Play sobrescreve mesmo. Para suportar restauração, precisaríamos histórico — fora de escopo. **Decisão pragmática:** documentar que Google Play sobrescreve manual definitivamente. |
| Tiers diferentes (manual=premium, loja=no_ads) | Loja prevalece quando ativa, mesmo que tier menor. Fonte de verdade = pagamento real. |

**Resumo curto exibido ao admin:** "Concessão manual é perdida se o usuário assinar via Google Play depois. Para garantir, oriente o usuário a não assinar enquanto tiver acesso manual."

### 3. Mudanças

#### `supabase/functions/admin-subscriptions/index.ts`
- POST aceita `duration: "1m" | "3m" | "6m" | "1y" | "lifetime"`
- Calcular `expires_at` por calendário usando `new Date()` + `setMonth()` / `setFullYear()` (não +N dias)
- **Bloquear concessão se usuário já tem `platform='google_play'` ativa e não expirada** → retorna 409 com mensagem clara
- GET retorna campos extras: `granted_by_email` (admin), `granted_at` (= `started_at` quando platform=manual), status efetivo calculado
- Novo endpoint/method para listar com filtros (status: ativo/expirado/vitalício)

#### Migration SQL
- Adicionar coluna `granted_by` (uuid, nullable) em `subscriptions` para registrar admin que concedeu
- Não precisa trigger; preenchida pelo edge function

#### `src/services/billing-service.ts` — `checkAndSyncSubscription`
- Adicionar `platform` ao SELECT
- No bloco que reseta para free quando tier pago não tem purchase_token:
  ```
  if (tier !== 'free' && !purchase_token && platform !== 'manual') {
    // resetar para free
  }
  // se platform === 'manual': pular APENAS este bloco, continuar resto da função
  ```
- **Não usar early return** — restante da lógica (verificação de expires_at, etc.) continua executando normalmente
- Lógica natural de `expires_at < now()` já cuida da expiração (via `get_user_subscription_tier` RPC)

#### `src/pages/Admin.tsx` — Painel
- Form de concessão: adicionar Select de duração (1 mês / 3 meses / 6 meses / 1 ano / Vitalício), default Vitalício
- Tabela/lista de assinantes com colunas:
  - Email
  - Tier
  - **Status efetivo**: badge colorido (Ativo verde / Expirado cinza / Vitalício roxo / Revogado vermelho)
  - **Origem**: badge (manual / google_play)
  - **Expira em**: data formatada ou "—" para vitalício
  - **Concedido por**: email do admin (quando manual)
  - **Concedido em**: data
- **Botão "Revogar acesso manual"** explícito (vermelho, com confirmação) — separado do select de tier. Só aparece quando `platform=manual`
- Filtros: Todos / Ativos / Expirados / Vitalícios

### 4. Testes a executar (após implementação)

| # | Teste | Como validar | Resultado esperado |
|---|---|---|---|
| 1 | Conceder premium manual 1 mês | Conceder via admin, chamar `checkAndSyncSubscription` 5x simulado | tier permanece `premium`, `expires_at` ≈ hoje+1mês |
| 2 | Expiração natural | Atualizar `expires_at` para `now() - 1 day` via SQL, chamar `get_user_subscription_tier` | retorna `free` |
| 3 | Vitalício | Conceder lifetime, chamar sync repetido | tier permanece `premium`, `expires_at` = NULL |
| 4 | Revogação manual | Clicar "Revogar acesso manual" | tier vira `free` imediatamente, `platform='manual'`, `expires_at=null` |
| 5 | Conflito Google Play ativo + tentativa manual | Setar manualmente `platform='google_play'`, `expires_at=futuro`, tentar conceder via admin | edge function retorna 409 com mensagem clara |
| 6 | Manual + sync Google Play sobrescreve | Manual ativo, simular validate-purchase com purchase_token | `platform='google_play'`, `purchase_token` setado, manual perdido |

Testes 1, 3, 4: via UI do admin + leitura SQL.  
Testes 2, 5, 6: via SQL direto + chamada de função.

### 5. Entregáveis após implementação

1. **Arquivos alterados**:
   - `supabase/functions/admin-subscriptions/index.ts`
   - `src/services/billing-service.ts`
   - `src/pages/Admin.tsx`
   - Migration: adicionar coluna `granted_by` em `subscriptions`

2. **Regra de prioridade documentada** (acima na seção 2)

3. **Resumo dos 6 testes** com resultado de cada um

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/admin-subscriptions/index.ts` | duration calendário, bloquear conflito Google Play, retornar campos extras |
| `src/services/billing-service.ts` | proteger platform=manual sem early return |
| `src/pages/Admin.tsx` | Select duração, tabela rica, botão revogar explícito, filtros |
| Migration SQL | coluna `granted_by` em `subscriptions` |

