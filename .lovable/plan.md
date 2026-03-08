

## Plano: Painel Admin para Gerenciar Assinaturas Manuais

### Abordagem

Criar uma página `/admin` protegida por verificação de email hardcoded (`gastinhosimples@gmail.com`) no frontend, com uma edge function segura no backend para buscar e modificar assinaturas de qualquer usuário (usando service_role key). Não será necessário tabela de roles — o acesso é restrito a um único email verificado via `auth.uid()`.

### Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `supabase/functions/admin-subscriptions/index.ts` | Nova edge function: GET (listar/buscar usuários+assinatura por email), POST (conceder plano), DELETE (revogar plano). Valida que o caller é `gastinhosimples@gmail.com` via JWT. |
| `src/pages/Admin.tsx` | Nova página com: campo de busca por email, exibição do status atual do usuário, botões para conceder Premium/Sem Anúncios/revogar. |
| `src/App.tsx` | Adicionar rota `/admin` |

### Edge Function: `admin-subscriptions`

- **Autenticação**: Decodifica JWT do header Authorization, busca email do usuário no Supabase Auth. Se não for `gastinhosimples@gmail.com`, retorna 403.
- **GET `?email=xxx`**: Usa service_role client para buscar usuário por email em `auth.users`, depois busca assinatura em `subscriptions`.
- **POST `{ email, tier }`**: Faz upsert na tabela `subscriptions` com `platform = 'manual'`, `expires_at = null`, `is_active = true`.
- **DELETE `{ email }`**: Remove registro com `platform = 'manual'` da tabela `subscriptions`.

### Página Admin (`src/pages/Admin.tsx`)

- Protegida: verifica `useAuth()` email === `gastinhosimples@gmail.com`, senão redireciona.
- Campo de busca por email do usuário alvo.
- Exibe: email, tier atual, plataforma, data de expiração.
- Ações: Select para escolher tier (premium, no_ads) + botão "Conceder", botão "Revogar" (voltar ao gratuito).
- Feedback com toast de sucesso/erro.

### Segurança

- A edge function valida o email do admin server-side via JWT — não depende de nada client-side.
- Usa `createClient` com `SUPABASE_SERVICE_ROLE_KEY` para operações admin.
- O email admin é hardcoded na edge function (não no frontend).

