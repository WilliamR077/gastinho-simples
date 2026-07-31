# PÓS-TOOLS G1-C2 — revogação do INSERT direto em `shared_groups`

## Motivo

O fluxo antigo criava o grupo e a membership owner em operações separadas, com risco de grupo órfão. A RPC `public.create_shared_group_atomic(text, text, text)` já foi publicada, o hotfix H1 corrigiu a resolução de `extensions.gen_random_bytes(6)` e o smoke de produção foi aprovado. Com o frontend novo validado, a janela temporária de compatibilidade do `INSERT` direto pode ser encerrada.

## Alteração

A migration `20260731030000_revoke_direct_shared_group_insert.sql` revoga somente `INSERT` em `public.shared_groups` de `PUBLIC`, `anon` e `authenticated`. Criação continua disponível a usuários autenticados exclusivamente pela RPC atômica. `SELECT`, `UPDATE`, `DELETE`, policies RLS, entrada por convite, administração de membros, service role e owner da função permanecem inalterados.

O catálogo remoto pré-migration mostrou grants diretos amplos para `anon`, `authenticated`, `service_role` e owner `postgres`; `PUBLIC` não possuía grant efetivo de tabela. O `REVOKE` explícito de `PUBLIC` é defensivo e idempotente. A RPC é `SECURITY DEFINER`, pertence a `postgres`, usa `search_path=pg_catalog, public, pg_temp`, e seu owner pode inserir na tabela. Sua ACL concede `EXECUTE` a `authenticated`, `service_role` e owner, sem `PUBLIC` ou `anon`. Assim, a revogação do invocador não impede o `INSERT` executado com os privilégios do owner.

A policy de INSERT `Authenticated users can create groups` permanece instalada como camada inativa para clientes sem privilégio de tabela. Nenhuma policy é removida ou recriada nesta fase.

## Preflight

Executar somente consultas read-only antes do deploy:

```sql
SELECT
  c.relacl AS table_acl,
  c.relrowsecurity AS rls_enabled,
  pg_get_userbyid(c.relowner) AS table_owner
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'shared_groups';

SELECT
  p.proacl AS function_acl,
  pg_get_userbyid(p.proowner) AS function_owner,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config,
  has_table_privilege(
    pg_get_userbyid(p.proowner),
    'public.shared_groups',
    'INSERT'
  ) AS owner_can_insert
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'create_shared_group_atomic'
  AND pg_get_function_identity_arguments(p.oid) =
    'p_name text, p_description text, p_color text';

SELECT
  CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END AS grantee,
  acl.privilege_type,
  acl.is_grantable
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(
  COALESCE(p.proacl, acldefault('f', p.proowner))
) AS acl
WHERE n.nspname = 'public'
  AND p.proname = 'create_shared_group_atomic'
  AND pg_get_function_identity_arguments(p.oid) =
    'p_name text, p_description text, p_color text'
ORDER BY grantee, privilege_type;

SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'shared_groups'
ORDER BY policyname;
```

Reinspecionar o código sem alterar arquivos:

```powershell
rg -n -i -U --glob 'src/**' --glob 'supabase/functions/**' -- "\.from\(\s*['\"]shared_groups['\"]\s*\)[\s\S]{0,160}?\.insert\s*\(|INSERT\s+INTO\s+(public\.)?shared_groups|create_shared_group_atomic" .
```

O resultado esperado é uma chamada frontend à RPC, nenhum `INSERT` direto oficial, nenhuma criação por Edge Function/MCP e apenas os `INSERT`s internos nas migrations G1-C1/H1.

## Deploy futuro

Não executar como parte desta preparação. Em janela aprovada:

```powershell
npx --yes supabase@latest migration list --linked
npx --yes supabase@latest db push --linked --dry-run
npx --yes supabase@latest db push --linked
```

O dry-run deve propor exclusivamente `20260731030000_revoke_direct_shared_group_insert.sql`.

## Smoke pós-deploy

1. Criar um grupo temporário pelo frontend.
2. Confirmar sucesso pela RPC `create_shared_group_atomic`.
3. Confirmar exatamente uma membership com role `owner`.
4. Confirmar ausência de warnings no MCP.
5. Em ambiente controlado, tentar o `INSERT` direto com cliente autenticado e sessão real de usuário comum, via REST/PostgREST ou `node scripts/post-tools-g1-c2-negative-smoke.mjs`.
6. Confirmar erro de permissão.
7. Confirmar que nenhuma linha foi criada.
8. Excluir o grupo temporário pelo fluxo oficial.
9. Confirmar ausência de resíduos.

O teste negativo não deve ser executado pelo SQL Editor com privilégios administrativos, pois isso não simula `authenticated`. Não usar service role, não registrar o access token e não salvar credenciais no repositório. Fornecer `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_ACCESS_TOKEN` somente como variáveis de ambiente na execução manual. O script mascara o token ao não imprimi-lo e tenta limpar uma linha apenas se o hardening falhar inesperadamente.

## Rollback

Rollback conceitual, somente após aprovação explícita:

```sql
GRANT INSERT ON TABLE public.shared_groups TO authenticated;
```

Não executar automaticamente. Não conceder `INSERT` a `anon` ou `PUBLIC` sem comprovar que isso era necessário no baseline aprovado. O rollback reabre o risco de criação não atômica e grupos órfãos.
