
# Plano de Hardening — Fase 2 (Revisado Final, dividido em blocos)

## 1. Resumo das mudanças vs. plano anterior

- Execução particionada em **5 blocos independentes** (A, B, C, D, E), cada um com migration própria, testes próprios e rollback próprio.
- Bloco E é apenas **relatório**, sem alterar `package.json` ou lockfile.
- `generate_invite_code()` confirmadamente chamada pelo frontend (`use-shared-groups.tsx:200`); **mantida com EXECUTE para authenticated**.
- Matriz antes/depois de grants entregue.
- `check_rate_limit` agora usa `pg_advisory_xact_lock(hashtextextended(_action || coalesce(_user_id::text,_ip_hash,''),0))` para serializar concorrência por chave, decisão e insert atômicos.
- Removida dependência de `current_user` em SECURITY DEFINER. Proteção é exclusivamente via `REVOKE ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE ... TO service_role`.
- Cron de cleanup idempotente via `cron.unschedule` em bloco `DO`.
- `rate_limit_events`: RLS habilitada, sem policies (PostgREST não retorna nada para anon/authenticated), e `REVOKE ALL` para anon/authenticated. Schema GraphQL exclui implicitamente.
- send-notification: bypass de cron só após validação **constant-time** do header `x-internal-secret`. Validação acontece **antes** de qualquer leitura de body, usuário comum nunca consegue passar essa porta.
- PIN: callers de `verifyPin` (apenas 1: `app-lock-screen.tsx`) atualizado para `await`. v1 só removido **depois** que v2 é gravado com sucesso.
- RequireAuth/RequireAdmin com lista explícita de rotas públicas; deep link preservado via `state.from`.

## 2. Blocos de execução

### Bloco A — DB hardening (linter, search_path, grants, GraphQL exposure)

#### A.1 Matriz antes/depois de grants

| Função | Chamada pelo frontend (`supabase.rpc`)? | Trigger / default / policy / RLS expr? | Manter EXECUTE para `authenticated`? | Revogar `anon`? | Risco de quebra |
|---|---|---|---|---|---|
| `has_role(uuid, app_role)` | Sim (`use-is-admin.tsx`) | Usada em RLS policy de `admin_notifications_log` (mas RLS roda como `authenticated`/`postgres`, GRANT já tem) | **Sim** (manter) | Sim, revogar de anon | Baixo |
| `get_user_subscription_tier(uuid)` | Sim (`use-subscription`, `admob-service`, `billing-service`) | Não | **Sim** | Sim | Baixo |
| `can_create_group(uuid)` | Sim (indireto via `use-shared-groups`) | Não | **Sim** | Sim (já revogado em migration anterior) | Baixo |
| `is_group_member(uuid,uuid)` | Não direto, mas usada em **várias RLS policies** (expenses, incomes, etc.) | **Sim — em RLS expressions** | **Sim** (RLS exec como authenticated chama) | Sim | **Médio se revogar de authenticated** → manter |
| `get_group_role(uuid,uuid)` | Não direto, usada em RLS de `shared_group_members`, `shared_groups` | **Sim — RLS** | **Sim** | Sim | Médio se revogar |
| `find_group_by_invite_code(text)` | Sim (`use-shared-groups:262`) | Não | **Sim** | Já revogado anon | Baixo |
| `get_group_members_with_email(uuid)` | Sim (`use-shared-groups:446`) | Não | **Sim** | Já revogado anon | Baixo |
| `delete_group_and_data(uuid,text)` | Sim (`use-shared-groups:374`) | Não | **Sim** | Já revogado anon | Baixo |
| `generate_invite_code()` | **Sim (`use-shared-groups:200`)** — não é default da coluna `invite_code` (default não definido no schema) | Não | **SIM — manter** | Já revogado anon | **Quebraria criação de grupo se revogado** |
| `initialize_user_categories(uuid)` | Sim (`category-selector`, `use-categories`) | Não | **Sim** | Sim | Baixo |
| `initialize_user_income_categories(uuid)` | Sim | Não | **Sim** | Sim | Baixo |
| `migrate_expense_categories(uuid)` | Sim (one-shot na inicialização) | Não | **Sim** | Sim | Baixo |
| `migrate_income_categories(uuid)` | Sim | Não | **Sim** | Sim | Baixo |
| `migrate_credit_card_config()` | Não (nenhum hit em src) | Não | **Não — revogar de authenticated e anon** | Sim | Baixo |
| `update_updated_at_column()` | Não | Função-trigger (não há triggers no DB hoje, mas é o padrão) | **Não — revogar de PUBLIC/anon/authenticated** (triggers rodam como dono da tabela, não dependem de GRANT EXECUTE público) | Sim | Baixo |
| `update_user_fcm_tokens_updated_at()` | Não | Função-trigger (idem) | **Não — revogar** | Sim | Baixo |
| `get_internal_api_secret_for_cron()` (Fase 1) | Não | Cron command | Já só `postgres` | Já fechado | n/a |

> **Decisão crítica**: `is_group_member` e `get_group_role` são usadas dentro de RLS expressions e `authenticated` precisa conseguir avaliá-las. **Manter EXECUTE para authenticated** mesmo gerando warning 0029 — esse warning é falso positivo nesse caso. Documentar na security memory.

#### A.2 GraphQL exposure (lint 0026/0027)

Tabelas a sair do GraphQL anon (REVOKE SELECT ON ... FROM anon):

| Tabela | RLS já protege? | Anon pode SELECT hoje? | Ação |
|---|---|---|---|
| `audit_log` | Sim (somente próprio user) | Aparece no GraphQL anon como objeto | REVOKE SELECT FROM anon |
| `admin_notifications_log` | Sim | Idem | REVOKE SELECT FROM anon |
| `budget_goal_alerts` | Sim | Idem | REVOKE SELECT FROM anon |
| `user_roles` | Sim (próprio user) | Idem | REVOKE SELECT FROM anon |
| `notification_settings` | Sim | Idem | REVOKE SELECT FROM anon |
| `expense_splits` | Sim | Idem | REVOKE SELECT FROM anon |
| `rate_limit_events` (criada no Bloco B) | RLS + sem policies | n/a | REVOKE ALL FROM anon, authenticated |

> Não revogamos SELECT de `authenticated` em `audit_log`/`user_roles` etc., porque RLS já filtra a `auth.uid() = user_id` e o usuário precisa ler os próprios.

#### A.3 Migration A — `phase2a_db_hardening`

```sql
-- A.1 search_path em funções faltantes
ALTER FUNCTION public.update_user_fcm_tokens_updated_at()
  SET search_path = public;

-- A.2 Funções internas (não chamadas pelo client) — revogar EXECUTE total
REVOKE EXECUTE ON FUNCTION public.migrate_credit_card_config()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_fcm_tokens_updated_at()      FROM PUBLIC, anon, authenticated;

-- A.3 Funções user-facing — garantir só anon revogado, authenticated mantém
DO $$
DECLARE fns text[] := ARRAY[
  'public.has_role(uuid, public.app_role)',
  'public.get_user_subscription_tier(uuid)',
  'public.can_create_group(uuid)',
  'public.is_group_member(uuid, uuid)',
  'public.get_group_role(uuid, uuid)',
  'public.find_group_by_invite_code(text)',
  'public.get_group_members_with_email(uuid)',
  'public.delete_group_and_data(uuid, text)',
  'public.generate_invite_code()',
  'public.initialize_user_categories(uuid)',
  'public.initialize_user_income_categories(uuid)',
  'public.migrate_expense_categories(uuid)',
  'public.migrate_income_categories(uuid)'
];
f text;
BEGIN
  FOREACH f IN ARRAY fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- A.4 GraphQL exposure: revogar SELECT a anon em tabelas internas
REVOKE SELECT ON public.audit_log              FROM anon;
REVOKE SELECT ON public.admin_notifications_log FROM anon;
REVOKE SELECT ON public.budget_goal_alerts     FROM anon;
REVOKE SELECT ON public.user_roles             FROM anon;
REVOKE SELECT ON public.notification_settings  FROM anon;
REVOKE SELECT ON public.expense_splits         FROM anon;
```

- **Idempotente**: sim. REVOKE/GRANT são idempotentes, `ALTER FUNCTION ... SET` também.
- **Testes Bloco A**:
  - Login + listar categorias (init + migrate funcionam) — usuário comum.
  - Criar grupo (gera invite_code) — não quebra.
  - Aceitar invite — `find_group_by_invite_code` funciona.
  - Listar membros — `get_group_members_with_email` funciona.
  - Deletar grupo — `delete_group_and_data` funciona.
  - Ler RLS-protected (expenses com `is_group_member`) — funciona.
  - GraphQL anon probe: `audit_log`, `admin_notifications_log`, `user_roles` não aparecem.
  - Linter: warnings devem cair de 67 → ~10 (apenas 0014, 0032 e os 0029 dos helpers RLS legítimos).
- **Rollback Bloco A**: migration espelho com `GRANT EXECUTE ... TO anon` e `GRANT SELECT ... TO anon` para restaurar estado anterior.

---

### Bloco B — Rate limit

#### B.1 Migration B — `phase2b_rate_limit`

```sql
-- B.1 Tabela
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid NULL,
  ip_hash     text NULL,
  action      text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_events_action_user_time_idx
  ON public.rate_limit_events (action, user_id, occurred_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS rate_limit_events_action_iphash_time_idx
  ON public.rate_limit_events (action, ip_hash, occurred_at DESC)
  WHERE ip_hash IS NOT NULL;

-- B.2 RLS sem policies = ninguém via PostgREST. GRANT/REVOKE adicional defesa em profundidade.
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limit_events FROM PUBLIC, anon, authenticated;
GRANT  ALL ON public.rate_limit_events TO service_role;

-- B.3 RPC com pg_advisory_xact_lock (serialização por (action, user/ip))
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _action          text,
  _user_id         uuid,
  _ip_hash         text,
  _max_per_minute  int,
  _max_per_hour    int
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key  text := _action || ':' || coalesce(_user_id::text, _ip_hash, '');
  v_count_min int;
  v_count_hr  int;
BEGIN
  -- Trava por chave dentro da transação. Sem current_user check:
  -- a única proteção é GRANT EXECUTE TO service_role (ver bloco abaixo).
  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  SELECT count(*) INTO v_count_min
  FROM public.rate_limit_events
  WHERE action = _action
    AND occurred_at > now() - interval '1 minute'
    AND ((_user_id IS NOT NULL AND user_id = _user_id)
      OR (_user_id IS NULL AND _ip_hash IS NOT NULL AND ip_hash = _ip_hash));

  IF v_count_min >= _max_per_minute THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'minute', 'retry_after', 60);
  END IF;

  SELECT count(*) INTO v_count_hr
  FROM public.rate_limit_events
  WHERE action = _action
    AND occurred_at > now() - interval '1 hour'
    AND ((_user_id IS NOT NULL AND user_id = _user_id)
      OR (_user_id IS NULL AND _ip_hash IS NOT NULL AND ip_hash = _ip_hash));

  IF v_count_hr >= _max_per_hour THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'hour', 'retry_after', 600);
  END IF;

  INSERT INTO public.rate_limit_events(user_id, ip_hash, action)
  VALUES (_user_id, _ip_hash, _action);

  RETURN jsonb_build_object('allowed', true);
END $$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text,uuid,text,int,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text,uuid,text,int,int) TO service_role;

-- B.4 Cron cleanup idempotente
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rate-limit-cleanup') THEN
    PERFORM cron.unschedule('rate-limit-cleanup');
  END IF;
  PERFORM cron.schedule(
    'rate-limit-cleanup',
    '0 4 * * *',
    $cron$ DELETE FROM public.rate_limit_events WHERE occurred_at < now() - interval '24 hours' $cron$
  );
END $$;
```

**Por que `pg_advisory_xact_lock`**: serializa todas as transações que disputam a mesma chave `(action, user_id|ip_hash)`. O lock é liberado automaticamente no commit/rollback, não polui se função der erro. É barato (~µs) e localizado (não bloqueia outros usuários/ações). Garante que count + insert é atômico, sem permitir TOCTOU. Hash via `hashtextextended(text, 0)` retorna `bigint` que é o tipo aceito pelo lock.

**Por que não `current_user`**: dentro de SECURITY DEFINER `current_user` retorna o **dono da função** (postgres), não o invoker. Era proteção quebrada. A defesa real é a combinação:
- `REVOKE ALL ... FROM PUBLIC, anon, authenticated` — PostgREST/GraphQL não conseguem invocar.
- `GRANT EXECUTE ... TO service_role` — só edge functions com SERVICE_ROLE_KEY chamam.
- Edge function nunca expõe service role ao client (já é regra do projeto).

#### B.2 Edge function helper (`supabase/functions/_shared/rate-limit.ts`)

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const svc = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export interface RateLimitOptions {
  action: string;
  userId: string | null;
  ipHash?: string | null;
  maxPerMinute: number;
  maxPerHour: number;
  failClosed?: boolean; // default false
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  reason?: string;
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  try {
    const { data, error } = await svc.rpc("check_rate_limit", {
      _action: opts.action,
      _user_id: opts.userId,
      _ip_hash: opts.ipHash ?? null,
      _max_per_minute: opts.maxPerMinute,
      _max_per_hour: opts.maxPerHour,
    });
    if (error) throw error;
    const allowed = (data as any)?.allowed === true;
    return {
      allowed,
      retryAfter: (data as any)?.retry_after,
      reason: (data as any)?.reason,
    };
  } catch (e) {
    console.error("rate_limit.error", String(e));
    return { allowed: !opts.failClosed }; // fail-open ou fail-closed
  }
}

export function ipHashFromRequest(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (!xff) return null;
  const first = xff.split(",")[0].trim();
  // hash não-criptográfico aceitável só para chave de bucket
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(first))
    .then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,"0")).join(""))
    .catch(() => first) as unknown as string;
}
```

> Nota: `ipHashFromRequest` na implementação real será `async` e o helper devolverá string. Detalhe entregue na implementação.

#### B.3 Limites e fail-mode por function

| Function | userId fonte | min | hora | Fail-mode |
|---|---|---|---|---|
| validate-purchase | JWT validado (já presente) | 5 | 30 | open |
| recover-subscription | JWT | 2 | 10 | **closed** |
| sync-subscription | JWT | 10 | 60 | open |
| send-notification (modo user) | JWT | 10 | 100 | open |
| send-notification (modo cron) | bypass total | — | — | n/a |
| notify-group-expense | JWT | 10 | 60 | open |
| delete-user-account | JWT | 1 | 3 | **closed** |
| admin-dashboard | JWT (admin já validado antes) | 60 | 600 | open |
| admin-notifications | JWT (admin) | 5 | 50 | **closed** |
| admin-subscriptions | JWT (admin) | 30 | 300 | open |

#### B.4 send-notification — bypass cron seguro

Sequência rígida na entrada da função:

```ts
const internalSecret = Deno.env.get("INTERNAL_API_SECRET")!;
const headerSecret = req.headers.get("x-internal-secret") ?? "";
// Constant-time compare:
const isCronCall = headerSecret.length > 0 && timingSafeEqual(headerSecret, internalSecret);

if (isCronCall) {
  // bypass rate limit, mas continua validando body
} else {
  // Authorization: Bearer <jwt> obrigatório
  const userId = await validateJwtAndGetUserId(req);
  const rl = await checkRateLimit({ action: "send-notification", userId, maxPerMinute: 10, maxPerHour: 100 });
  if (!rl.allowed) return jsonResponse(req, { error: "rate_limited" }, 429);
}
```

`timingSafeEqual` (helper local com `crypto.subtle` ou loop XOR) — usuário comum sem conhecimento do secret nunca consegue ativar `isCronCall`. Mesmo que envie header vazio ou string aleatória, comparação retorna false em tempo constante.

#### B.5 Testes Bloco B

| Teste | Esperado |
|---|---|
| 6 chamadas/min em recover-subscription com user X | 6ª retorna 429 com `retry_after` |
| 2 sessões paralelas (concorrência) chamando 5x cada simultaneamente | total aceito ≤ limite (sem race) |
| validate-purchase fluxo real Google Play | 200 |
| send-notification cron com header correto | 200 sem rate limit |
| send-notification cron com header errado/ausente vindo de user comum | 401 ou rate-limited normal |
| delete-user-account 2x em 1 min | 2ª 429 |
| Banco temporariamente indisponível durante check | recover-sub falha closed (503), sync-sub fail-open (200) |
| GraphQL/REST direto em `rate_limit_events` com anon | erro/empty |

#### B.6 Rollback Bloco B

```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rate-limit-cleanup') THEN
    PERFORM cron.unschedule('rate-limit-cleanup');
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.check_rate_limit(text,uuid,text,int,int);
DROP TABLE IF EXISTS public.rate_limit_events;
```
+ remover chamadas `await checkRateLimit(...)` das 9 functions (1 linha cada).

---

### Bloco C — PIN/App Lock seguro (PBKDF2 + cooldown)

#### C.1 Mudanças

- `src/services/app-lock-service.ts`:
  - `setPin(pin)` → `async`. Gera salt 16B, PBKDF2-SHA256 200k iterações, grava JSON em `app_lock_pin_v2`. Só remove `app_lock_pin` (v1) **depois** de gravar v2 com sucesso (ordem: write v2 → readback v2 → removeItem v1).
  - `verifyPin(pin)` → `async`. Lê v2 primeiro; se ausente, lê v1 (compatibilidade).
  - Novo `needsReset(): boolean` — true se v1 presente e v2 ausente.
  - Cooldown: chave `app_lock_attempts` = `{count, lockedUntil}`. Após 3 falhas: 30s; 5: 2min; 7: 10min; 10: 1h. Reset ao acertar.
  - **Nenhum log** de pin/hash/salt; logs só `pin.failed { attempts }` e `pin.locked { until }`.
- `src/components/app-lock-screen.tsx`:
  - `handlePinSubmit` vira async, `await verifyPin`.
  - Se `appLockService.needsReset()` ao desbloquear corretamente → render fluxo "Defina um novo PIN" inline antes de chamar `onUnlock`.
  - UI de cooldown: input/numpad desabilitados, contagem regressiva "Aguarde Xs".
- `src/components/security-settings.tsx`:
  - Banner "Seu PIN usa formato antigo. Reconfigure por segurança." quando `needsReset`.
- `src/App.tsx`: nenhum caller adicional de `verifyPin` (verificado: única chamada é `app-lock-screen.tsx`).

#### C.2 Migração v1 → v2

1. Usuário com `app_lock_pin` (v1) abre app → tela de lock.
2. Tenta PIN: `verifyPin` confere v1.
3. Se correto: serviço marca `needsReset=true`. Tela exibe "Por segurança, defina seu novo PIN".
4. Usuário digita novo PIN duas vezes → `setPin` grava v2 → readback OK → `removeItem('app_lock_pin')` → `onUnlock`.
5. Se usuário fecha app no meio: v1 ainda existe, próximo lock pede de novo.
6. Biometria: pode desbloquear independente; se v2 ausente e biometria desbloqueia, exibe mesma tela de redefinição (não obrigatória, mas fortemente sugerida — botão "depois" permitido apenas via biometria, pois v1 só gera risco se ladrão tiver acesso ao localStorage).

#### C.3 Testes Bloco C

| Teste | Esperado |
|---|---|
| Novo usuário define PIN | Apenas `app_lock_pin_v2` em localStorage |
| Usuário com v1, digita correto | Pedido de redefinição; após salvar, v1 ausente |
| Usuário com v1, fecha antes de redefinir | v1 persiste, v2 ausente, pode tentar de novo |
| 3 PINs errados | Cooldown 30s, numpad disabled |
| 5 errados | 2min |
| 10 errados | 1h |
| Cooldown expira, PIN correto | Unlock |
| `console` (modo nativo) durante tentativas | Sem PIN, sem hash, sem salt |
| PIN v2 — readback após reload | Funciona |

#### C.4 Rollback Bloco C

3 arquivos editados. Reverter via revert do commit. Usuários que já migraram ficam em v2; v1 não retorna automaticamente — aceitável (usuário pode redefinir via "Esqueci PIN" → reativar).

---

### Bloco D — RequireAuth / RequireAdmin

#### D.1 Mudanças

- `src/components/auth-guards.tsx` (novo):

  ```tsx
  export function RequireAuth({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const location = useLocation();
    if (loading) return <FullScreenSpinner />;
    if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;
    return <>{children}</>;
  }

  export function RequireAdmin({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading } = useAuth();
    const { isAdmin, loading: roleLoading } = useIsAdmin();
    const location = useLocation();
    if (authLoading || roleLoading) return <FullScreenSpinner />;
    if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;
    if (!isAdmin) return <Navigate to="/" replace />;
    return <>{children}</>;
  }
  ```

- `src/App.tsx`: aplicar guards no `<Routes>`:

  | Rota | Guard |
  |---|---|
  | `/landing`, `/about`, `/contact`, `/privacy`, `/auth`, `/reset-password` | nenhum (públicas) |
  | `/`, `/account`, `/cards`, `/settings`, `/reports`, `/subscription`, `/notification-debug` | `RequireAuth` |
  | `/admin` | `RequireAdmin` |
  | `*` (NotFound) | nenhum |

- `src/pages/Auth.tsx`: ao logar com sucesso, ler `location.state?.from` e `navigate(from || '/')`.
- `src/pages/Admin.tsx`: remover guard inline `if (!user || !isAdmin) return <Navigate ...>` (já feito pelo wrapper). Manter `useIsAdmin` somente para condicional UI residual se necessário, ou remover.

#### D.2 Cuidados

- `/reset-password` permanece pública: o link de recovery do Supabase abre nessa URL com tokens no hash. Se exigíssemos auth, quebraríamos o flow.
- `<FullScreenSpinner>` deve ser componente neutro (logo + spinner) — sem flash do conteúdo privado.
- AppLockScreen continua acima dos guards (já é o caso em `App.tsx`).

#### D.3 Testes Bloco D

| Teste | Esperado |
|---|---|
| Deslogado em `/account` | Redirect para `/auth`, sem flash |
| Após login, redirect | Volta para `/account` |
| Deslogado em `/landing` | Carrega normal |
| Deslogado em `/reset-password?...` | Carrega normal, recovery flow funciona |
| User comum em `/admin` | Redirect para `/` |
| Admin em `/admin` | Carrega painel |
| Refresh em `/admin` como admin | Não pisca tela "/" |

#### D.4 Rollback Bloco D

3 arquivos. Reverter commit.

---

### Bloco E — Auditoria de dependências (somente relatório)

- Rodar `bun pm audit --prod` (e `npm audit --omit=dev` como fallback) e gerar relatório markdown em `/mnt/documents/phase2-deps-audit.md`.
- Listar:
  - CVEs por severidade.
  - Pacotes >1 ano sem update.
  - Duplicações suspeitas: `@capgo/capacitor-purchases` vs `cordova-plugin-purchase` — confirmar via `rg "cordova-plugin-purchase|CdvPurchase" src/ android/` se ainda usado.
- **Não alterar `package.json` nem lockfile**. Se houver CVE high/critical, listar separadamente para decisão explícita.
- Sem migration. Sem rollback (apenas leitura).

---

## 3. Testes obrigatórios consolidados

| # | Bloco | Teste | Esperado |
|---|---|---|---|
| 1 | A | Linter Supabase após migration | Warnings caem para ~10 (apenas 0014, 0032, 0029-de-funções-RLS-legítimas) |
| 2 | A | Criar grupo (gera invite_code) | OK |
| 3 | A | Listar/aceitar/sair grupo | OK |
| 4 | A | Listar categorias (init+migrate) | OK |
| 5 | A | Deletar grupo via RPC | OK |
| 6 | A | GraphQL anon: `audit_log` | Não aparece |
| 7 | A | Login + Index normal | OK |
| 8 | B | Burst 6 calls/min em recover-subscription | 6ª = 429 |
| 9 | B | 2 sessões paralelas burst | Sem race |
| 10 | B | validate-purchase real | 200 |
| 11 | B | Webhook Google Play | 200 (não tocado) |
| 12 | B | send-notification cron com secret | 200 sem rate limit |
| 13 | B | send-notification user comum | rate limit aplicado |
| 14 | B | delete-user-account 2x | 2ª 429 |
| 15 | B | rate_limit_events via REST anon/authenticated | vazio/erro |
| 16 | C | Novo PIN | Só v2 |
| 17 | C | Migração v1 → v2 | v1 some após redefinição |
| 18 | C | 3 erros → cooldown | Bloqueado 30s |
| 19 | C | Logs durante erro | Sem PIN/hash/salt |
| 20 | D | Deslogado em rota privada | Redirect /auth |
| 21 | D | Login com `state.from` | Redirect correto |
| 22 | D | User comum em /admin | Redirect / |
| 23 | D | Admin em /admin | Carrega |
| 24 | D | reset-password com token | Funciona |
| 25 | E | Relatório gerado | Arquivo em /mnt/documents |
| 26 | A+B | Usuário A não acessa dados do B | RLS bloqueia |

## 4. Rollback resumido

| Bloco | Rollback |
|---|---|
| A | Migration espelho com GRANTs reversos |
| B | Drop function + drop table + cron.unschedule + reverter chamadas nas 9 functions |
| C | Revert dos 3 arquivos (usuários migrados ficam em v2) |
| D | Revert dos 3 arquivos |
| E | n/a |

## 5. Checklist manual (Dashboard) — após blocos A–D

- [ ] Auth → Leaked Password Protection: ON
- [ ] Auth → Min password length ≥ 10
- [ ] Auth → OTP expiry ≤ 10 min
- [ ] Auth → Email confirmation required
- [ ] Auth → Enumeration protection ON
- [ ] Auth → Rate limits internos com valores conservadores
- [ ] Auth → Site URL = produção
- [ ] Auth → Redirect URLs whitelist apenas: `https://gastinho-simples.lovable.app/**`, preview Lovable, `capacitor://localhost`, `https://localhost`
- [ ] Auth → Provider Google client IDs corretos
- [ ] DB → Extensions `pg_net`/`pg_cron`/`pgcrypto` em schema `extensions` (manual)
- [ ] DB → Linter rerodado, ~10 warnings residuais
- [ ] Edge Functions → INTERNAL_API_SECRET rotacionado (Fase 1) confirmado
- [ ] Vault → `internal_api_secret_for_cron` presente
- [ ] Google Cloud → service account com escopo mínimo
- [ ] Google Play Console → RTDN + license testers OK

## 6. Critérios de aprovação

Fase 2 fechada quando:

1. Bloco A: linter ≤ 10 warnings, todos os 7 testes A passam.
2. Bloco B: 8 testes B passam, incluindo concorrência e bypass cron seguro.
3. Bloco C: 4 testes C passam, sem logs sensíveis.
4. Bloco D: 5 testes D passam, sem flash, deep link OK.
5. Bloco E: relatório entregue, sem CVE high/critical não documentado.
6. Checklist manual marcado.
7. Memory atualizada (rate limit, PIN v2, guards).

---

**Aguardando aprovação para iniciar pelo Bloco A.** Cada bloco subsequente terá nova confirmação de execução.
