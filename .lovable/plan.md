## Problema

O modal "Como podemos te chamar?" falha ao salvar com:
> Could not find the table 'public.profiles' in the schema cache

Causa: a migração que cria `public.profiles` (tabela, RLS, trigger e backfill) nunca foi efetivamente aplicada no banco. Apenas a função `get_group_members_with_email` foi atualizada, e ela referencia `public.profiles` via `LEFT JOIN` (resolvido em runtime, então não quebrou na criação).

## Correção

Rodar uma migração única que cria toda a infraestrutura de `profiles` que o frontend já espera:

1. **Tabela `public.profiles`**
   - `user_id uuid PK` → FK `auth.users(id) ON DELETE CASCADE`
   - `display_name text`
   - `created_at`, `updated_at` com trigger de update

2. **GRANTs** (obrigatório p/ PostgREST enxergar):
   - `GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated`
   - `GRANT ALL ON public.profiles TO service_role`

3. **Função `shares_group_with(_a uuid, _b uuid)`** SECURITY DEFINER — true se dois usuários compartilham algum `shared_group_members`.

4. **RLS em `profiles`:**
   - SELECT: `auth.uid() = user_id OR public.shares_group_with(auth.uid(), user_id)`
   - INSERT/UPDATE: `auth.uid() = user_id`

5. **Trigger `handle_new_user_profile()` em `auth.users` AFTER INSERT**
   - Insere `display_name` a partir de `NEW.raw_user_meta_data->>'full_name'` ou `->>'name'`, com `trim`/null-safe (`NULLIF(trim(...), '')`).
   - `ON CONFLICT (user_id) DO NOTHING`.

6. **Backfill** de todos os `auth.users` em `profiles`, usando `COALESCE(full_name, name)` trimado.

7. Não precisa mexer em `get_group_members_with_email` (já está correta).

Depois que a migração rodar, o salvar do nome funciona e o modal fecha normalmente. Nenhum código frontend precisa mudar.

## Detalhes técnicos

- A função `shares_group_with` deve ser `STABLE SECURITY DEFINER SET search_path = public` para evitar recursão de RLS ao consultar `shared_group_members` dentro da policy de `profiles`.
- O trigger em `auth.users` requer SECURITY DEFINER e `SET search_path = public`.
- Backfill deve usar `ON CONFLICT (user_id) DO NOTHING` para ser idempotente.
