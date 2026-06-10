## Objetivo

Substituir a exibição do e-mail (ou prefixo) por um **nome** real do usuário em todo o app — especialmente nos grupos compartilhados (lista de membros, "Gastos por Membro", "Acerto entre Membros", divisões de despesa, detalhes de transação, relatórios e PDFs).

## Coleta do nome

1. **Cadastro por e-mail/senha** (`/auth`): novo campo obrigatório "Nome" no formulário de cadastro. Enviado via `supabase.auth.signUp({ options: { data: { full_name } } })`.
2. **Login com Google**: o trigger em `auth.users` lê `raw_user_meta_data->>'full_name'` (ou `name`) e já popula o perfil. No frontend, após `SIGNED_IN`, o `useProfile` faz um *upsert defensivo* lendo `session.user.user_metadata.full_name || .name` caso o perfil esteja vazio (cobre casos de race com o trigger ou metadados que só chegam pelo provider).
3. **Usuários existentes (ou Google sem nome)**: ao entrar no app, se `display_name` estiver vazio, abre um **modal obrigatório** (Dialog não dismissível: sem ESC, sem clique fora, sem botão fechar, sem "pular"). O modal exibe **duas ações apenas**: "Salvar" (habilita após validação) e "Sair da conta" (faz `supabase.auth.signOut()` e volta para `/auth`).

Validação do campo: `trim`, mínimo 2, máximo 60 caracteres. String vazia após `trim` é tratada como `null`.

## Banco (migração Supabase)

- Criar tabela `public.profiles`:
  - `user_id uuid PK references auth.users(id) on delete cascade`
  - `display_name text` (nullable)
  - `created_at`, `updated_at` + trigger `update_updated_at_column`
- `GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated; GRANT ALL ON public.profiles TO service_role;` (sem `anon`).
- **RLS restrito** (sem liberar todos para qualquer authenticated):
  - Função `SECURITY DEFINER` `public.shares_group_with(_viewer uuid, _target uuid) RETURNS boolean` que retorna `true` quando os dois usuários compartilham pelo menos um `shared_group_members.group_id` (consulta direta em `shared_group_members`, sem recursão em `profiles`).
  - Policy SELECT: `auth.uid() = user_id OR public.shares_group_with(auth.uid(), user_id)`.
  - Policy INSERT/UPDATE: apenas `auth.uid() = user_id`.
- Trigger `on_auth_user_created` em `auth.users` (AFTER INSERT):
  - `INSERT INTO public.profiles (user_id, display_name) VALUES (NEW.id, NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')), ''))`.
- Backfill em uma única instrução:
  - `INSERT INTO public.profiles (user_id, display_name) SELECT id, NULLIF(TRIM(COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name')), '') FROM auth.users ON CONFLICT (user_id) DO NOTHING;`
- Atualizar a RPC `get_group_members_with_email` para também retornar `display_name` via `LEFT JOIN public.profiles p ON p.user_id = m.user_id`. Mantém `user_email` como fallback.

## Frontend

### Novos arquivos
- `src/hooks/use-profile.tsx` — `AuthProvider`-friendly: carrega o perfil do usuário atual, expõe `displayName`, `loading`, `updateDisplayName(name)` e `refresh()`. Após login com Google, se `profile.display_name` for `null` mas houver `user.user_metadata.full_name || .name`, faz `upsert` automático.
- `src/components/profile-name-gate.tsx` — Dialog não dismissível (`onOpenChange` no-op; `onEscapeKeyDown`/`onPointerDownOutside` `preventDefault`). Sem "X" no canto. Botões: **Salvar** e **Sair da conta**.
- `src/utils/member-display.ts` — `getMemberDisplayName(member)`: retorna `display_name` se houver; caso contrário, prefixo do e-mail (`email.split('@')[0]`).

### Editados
- `src/pages/Auth.tsx` — input "Nome" na aba de cadastro; envia em `options.data.full_name`.
- `src/components/auth/require-auth.tsx` — renderiza `<ProfileNameGate />` ao lado do `<Outlet />`.
- `src/types/shared-group.ts` — `display_name?: string | null` em `SharedGroupMember`.
- `src/hooks/use-shared-groups.tsx` — propaga `display_name` da RPC.
- `src/pages/Account.tsx` — campo "Nome" editável; ao salvar com sucesso, **invalida caches**: chama `refresh()` do `use-profile`, `loadGroups()` do `use-shared-groups`, e dispara um evento global (`window.dispatchEvent(new Event('profile:updated'))`) que `Index`, `Reports` e qualquer consumidor podem ouvir para refazer fetch — relatórios/PDFs leem do estado já atualizado.
- **Componentes que mostram e-mail** — todos passam pelo helper:
  - `src/components/group-management-sheet.tsx`
  - `src/components/group-member-summary.tsx`
  - `src/components/group-balance-summary.tsx`
  - `src/components/group-settlement-detail.tsx`
  - `src/components/expense-split-section.tsx`
  - `src/components/expense-list.tsx`
  - `src/components/recurring-expense-list.tsx`
  - `src/components/income-list.tsx`
  - `src/components/recurring-income-list.tsx`
  - `src/components/transaction-detail-sheet.tsx`
  - `src/components/reports-accordion.tsx`
  - `src/pages/Reports.tsx`
  - `src/utils/report-view-model.ts`
  - `src/services/pdf-export-service.ts`
  - `src/components/unified-expense-form-sheet.tsx`

### Busca global de "leakers" de e-mail

Antes da implementação, rodar `rg -n "email\.split\(['\"]@['\"]\)|\.split\('@'\)|user_email"` e garantir que **todos** os usos de exibição passem por `getMemberDisplayName`. Buscas em login/convite (onde o e-mail é dado real) continuam usando o e-mail.

## Fora de escopo

- Billing, cartões, lógica de cálculo.
- Onboarding existente (microstep engine) — o gate é um Dialog independente.
- O e-mail continua armazenado e usado para login/convites/denormalização interna.

## Checklist de teste manual

1. Novo cadastro por e-mail → digita "Maria Silva" → grupos mostram "Maria Silva".
2. Login com Google (conta com nome) → entra direto, sem modal.
3. Login com Google sem nome no token → modal obrigatório aparece; opção "Sair da conta" desloga e volta para `/auth`.
4. Conta antiga (sem perfil) → modal obrigatório; após salvar, app carrega.
5. Em `Account`, editar nome → grupos, relatórios e o PDF refletem o novo nome após reload do contexto.
6. Membro sem `display_name` aparece como prefixo do e-mail (fallback) e não quebra UI.
7. Usuário A consegue ler o nome do usuário B somente quando compartilham grupo (validar tentando consultar `profiles` de alguém sem grupo em comum).
