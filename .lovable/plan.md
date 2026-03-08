

## Plano: Listagem de assinaturas ativas no painel admin

### Mudanças

| Arquivo | Ação |
|---|---|
| `supabase/functions/admin-subscriptions/index.ts` | Adicionar rota GET sem `?email` (ou com `?list=active`) que retorna todas as assinaturas ativas com email do usuário |
| `src/pages/Admin.tsx` | Adicionar seção com tabela/lista de todos os assinantes ativos, carregada ao abrir a página |

### Edge Function

No handler GET, quando não houver parâmetro `email`, buscar todas as assinaturas ativas:
1. Query `subscriptions` com `is_active = true` e `tier != 'free'`
2. Para cada assinatura, buscar o email do usuário via `adminClient.auth.admin.getUserById()`
3. Retornar array com `{ email, tier, platform, started_at, expires_at }`

Para evitar N+1 queries, usar `adminClient.auth.admin.listUsers()` uma vez e fazer join em memória.

### Frontend (Admin.tsx)

- Ao montar o componente, chamar GET sem `?email` para carregar lista
- Exibir em um Card separado "Assinantes Ativos" acima da seção de busca
- Tabela simples com colunas: Email, Plano (badge), Plataforma, Início, Expiração
- Estado de loading enquanto carrega
- Ao clicar em um email da lista, preencher o campo de busca e disparar a busca individual (para poder gerenciar)

