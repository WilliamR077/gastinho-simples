# Fase MCP 1.1A — Notas de Projeto e Documentação

Este documento reúne os entregáveis **de projeto** da Fase 1.1A que **não**
foram implementados neste bloco (por acordo): plano de escopo, roteiro de
teste de isolamento entre contas, política `WITH CHECK` recomendada para
UPDATE, desenho da idempotência, desenho da auditoria e nota de desempenho
para futuras agregações.

Nada aqui altera banco, RLS ou tools. É referência para blocos 1.1B/1.1C/1.1D
e Fase 1.2.

---

## 1. Escopo (`personal | shared | all_accessible`)

- **Estado atual (1.1A):** o tipo e o helper `src/lib/mcp/shared/scope.ts`
  existem, mas **não são aplicados** em nenhuma tool pública. Todas as tools
  atuais continuam com o filtro explícito `.eq("user_id", ctx.getUserId())`
  — semântica `personal`, idêntica ao comportamento pré-1.1A.
- **Problema com "filtro simples":** `shared_group_id IS NOT NULL` filtra
  linhas compartilhadas, mas não garante que o usuário atual pertence ao
  grupo. Um simples `OR user_id = uid OR shared_group_id IS NOT NULL` sob
  RLS depende de a política já cobrir os dois caminhos num único SELECT.
- **Opções em análise (decisão antes de 1.1B/1.1C):**
  1. **RLS-only:** um único `SELECT` **sem** `.eq("user_id", ...)`. Só é
     seguro se a política `SELECT` de `expenses`/`incomes` já autoriza tanto
     linhas próprias quanto linhas de grupos aos quais o usuário pertence.
     Precisa ser validado consultando as policies atuais antes de adotar.
  2. **Duas consultas + união:** query pessoal (`user_id = uid`) + query
     compartilhada (`shared_group_id IN (...meus grupos...)`), dedup por id.
     Mais round-trips, porém explícito e auditável.
  3. **RPC `SECURITY INVOKER`:** função Postgres que faz a união em SQL e
     devolve o conjunto. Melhor performance, muda pouca coisa no cliente.
- **Regra dura:** nenhuma dessas opções usa `service_role`. `all_accessible`
  não será ligado silenciosamente em `list_expenses`/`get_summary` sem
  aprovação e testes de isolamento repassados.

---

## 2. Teste de isolamento entre contas — procedimento

**Setup:**
- Conta A: usuário isolado, uma categoria e uma despesa próprias.
- Conta B: usuário isolado, **sem** participação em grupos da conta A.
- Contas C e D: participantes do mesmo grupo compartilhado. Cada uma tem
  também uma despesa **pessoal** (fora de qualquer grupo).

**Procedimento de troca de conta OAuth (obrigatório entre A → B, C → D):**
1. No cliente MCP (Claude/ChatGPT/Cursor), **desconectar** ou remover o
   conector do Gastinho Simples.
2. No app Supabase Auth, revogar/recriar o grant se necessário
   (`Auth → OAuth → grants` no dashboard). Trocar apenas a sessão do app
   **não** troca o token OAuth do conector.
3. No navegador, sair da conta Gastinho e limpar cookies do domínio.
4. Fazer login na conta desejada.
5. Conectar o conector MCP novamente.
6. Chamar **`get_connection_identity`** antes de qualquer outra tool.
7. Iniciar **nova conversa** no cliente MCP (evita cache de contexto).

**Asserts a registrar (com evidência de output real das tools):**
- `get_connection_identity` retorna `user_id_suffix` e `email_masked`
  distintos entre A e B, e entre C e D.
- Conta A chamando `list_expenses`/`get_summary` não vê linhas de B.
- Conta B chamando `list_expenses`/`get_summary` não vê linhas de A.
- Contas C e D, no escopo atual `personal`, veem apenas as próprias
  linhas (o teste de escopo `all_accessible`/`shared` fica para depois
  da decisão do item 1).
- Trocar apenas a sessão do app **não** é aceito como troca de identidade
  OAuth do conector.

Sem esse pacote de evidências (com tokens OAuth distintos), o isolamento
**não é declarado validado**.

---

## 3. Revisão do risco de UPDATE RLS — política `WITH CHECK` recomendada

**Reclassificação do risco:** permitir alteração de `user_id` durante UPDATE
pode transferir/injetar linhas para outro usuário. Isso é violação de
integridade entre contas, não apenas ausência de escalada horizontal.
Portanto, antes de qualquer tool de UPDATE (Fase 1.2), aplicar em migration
dedicada (**não** nesta fase):

```sql
-- expenses
DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
CREATE POLICY "expenses_update"
  ON public.expenses
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- incomes
DROP POLICY IF EXISTS "incomes_update" ON public.incomes;
CREATE POLICY "incomes_update"
  ON public.incomes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- recurring_expenses
DROP POLICY IF EXISTS "recurring_expenses_update" ON public.recurring_expenses;
CREATE POLICY "recurring_expenses_update"
  ON public.recurring_expenses
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- recurring_incomes
DROP POLICY IF EXISTS "recurring_incomes_update" ON public.recurring_incomes;
CREATE POLICY "recurring_incomes_update"
  ON public.recurring_incomes
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

Antes de aplicar, ler as policies atuais para preservar cláusulas de
compartilhamento (grupos) que possam existir hoje. Se houver cláusula de
grupo no `USING`, o `WITH CHECK` precisa espelhá-la para não quebrar edição
legítima de linhas compartilhadas.

---

## 4. Desenho da idempotência (create_expense/create_income) — sem implementar

**Requisitos:** concorrência, chamadas simultâneas, falha parcial, retry
após timeout, `request_hash` incompatível para a mesma chave,
estados `processing/completed/failed`, resposta armazenada, expiração,
transação atômica.

**Opções analisadas:**

| Opção | Concorrência | Atomicidade | Complexidade | Auditabilidade |
|---|---|---|---|---|
| 1. Tabela simples + lógica na Edge Function | frágil (race na leitura antes do INSERT) | não garante | baixa | fraca |
| 2. RPC transacional (sem tabela dedicada) | não resolve, cria/atualiza inline | boa dentro da RPC | média | ruim (não há trilha) |
| 3. **Tabela `mcp_operations` + RPC transacional (recomendada)** | resolvida por unique index em `(user_id, idempotency_key)` | RPC única faz upsert + insert de negócio | média | forte |

**Recomendação: Opção 3.**

Esqueleto (para Fase 1.2 — **não** aplicar agora):

```sql
CREATE TABLE public.mcp_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  request_hash TEXT NOT NULL,       -- hash canônico do input
  status TEXT NOT NULL CHECK (status IN ('processing','completed','failed')),
  result JSONB,                     -- payload devolvido no primeiro completed
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE (user_id, idempotency_key)
);
```

Semântica da RPC `mcp_create_expense_idempotent(input jsonb, idempotency_key text)`:

1. `INSERT ... ON CONFLICT (user_id, idempotency_key) DO NOTHING RETURNING id`.
2. Se **conflito**: ler a linha existente.
   - `request_hash` diferente → devolver `IDEMPOTENCY_KEY_MISMATCH` sem
     mutar nada.
   - `status = completed` → devolver `result` armazenado.
   - `status = processing` → devolver `IN_PROGRESS`; cliente pode fazer poll
     ou retry.
   - `status = failed` e `expires_at > now()` → devolver o erro anterior.
3. Se **inserido novo**: executar o INSERT de negócio dentro da **mesma**
   transação. Ao final, `UPDATE mcp_operations SET status='completed', result=...`.
   Em erro, `status='failed'` com `error_code`. Nunca deixar `processing`
   aberto (usar `EXCEPTION` do plpgsql).
4. Cron/job periódico apaga linhas `expires_at < now()`.

RLS: `mcp_operations` acessível somente ao próprio usuário; nunca por `anon`;
apenas `authenticated` com `user_id = auth.uid()`.

---

## 5. Desenho da auditoria — sem implementar

**Análise de `public.audit_log`:**
- Hoje o app permite INSERT via frontend em vários pontos. Isso significa
  que o usuário pode forjar `action`/`details` do próprio user, o que torna
  o log **não confiável** como trilha oficial de operações MCP.
- Para MCP precisamos garantir que a origem (`tool_name`), o resultado
  (`success`/`error_code`) e o `mcp_operation_id` sejam preenchidos pelo
  **servidor** e não pelo cliente.

**Recomendação (para Fase 1.2 — não aplicar agora):** criar tabela dedicada
`public.mcp_audit_events` **sem INSERT direto** pelo frontend, alimentada
apenas por RPC `SECURITY DEFINER` (a mesma RPC de idempotência pode gravar).

```sql
CREATE TABLE public.mcp_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tool_name TEXT NOT NULL,
  operation_id UUID REFERENCES public.mcp_operations(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success','error')),
  error_code TEXT,
  input_hash TEXT,                 -- nunca o input cru
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- SELECT: dono; INSERT/UPDATE/DELETE: negado a authenticated/anon.
-- Escrita apenas via RPC SECURITY DEFINER controlada.
```

`audit_log` fica reservado ao uso legado do app; eventos MCP não entram
lá.

---

## 6. Desempenho das futuras agregações

Nenhuma dessas tools é implementada em 1.1A. Notas para as fases
seguintes:

| Tool | Estratégia | Intervalo máx | Registros máx | Comportamento em excesso |
|---|---|---|---|---|
| `get_spending_breakdown` | RPC SQL com `GROUP BY category_id` | 12 meses | ~50k linhas → agregado | recusar com `RANGE_TOO_LARGE`; sugerir subdividir |
| `get_cashflow_series` | RPC SQL com `date_trunc` (`day`/`week`/`month`) | 24 meses | agregação SQL, não retorna linhas cruas | recusar > 24 meses |
| `compare_periods` | duas execuções de `get_summary` internas | dois intervalos de até 12 meses cada | — | recusar se qualquer intervalo > 12 meses |
| `get_category_usage` | RPC SQL, `COUNT + SUM` por categoria | 12 meses | agregado | recusar > 12 meses |

**Impacto:** Edge Functions do Supabase têm limite de tempo e memória. RPC
SQL é o caminho para conjuntos grandes; agregação em memória só é aceitável
para intervalos curtos. Adicionar `LIMIT` defensivo em todas as tools raw
(list_*) — já feito.

---

## 7. Checklist da Fase 1.1A

- [x] Nenhuma migration aplicada nesta fase.
- [x] Nenhuma tool financeira nova além de `get_connection_identity`.
- [x] `list_expenses` deixou de usar o campo inexistente `is_shared` e passa
      a derivar `is_shared = shared_group_id !== null`.
- [x] Helper compartilhado `supabaseForUser` em `src/lib/mcp/shared/`.
- [x] `errors.ts` e `dates.ts` publicados com os códigos exigidos.
- [x] `scope.ts` criado como fundação — não aplicado às tools atuais.
- [x] Documentação de teste de isolamento, WITH CHECK, idempotência,
      auditoria e desempenho registrada neste arquivo.
