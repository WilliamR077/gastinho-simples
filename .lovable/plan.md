

## Plano: Melhorias no Painel Admin

### Mudanças

| # | Item | Arquivo(s) | Descrição |
|---|------|-----------|-----------|
| 1 | Botão voltar | `Admin.tsx` | Adicionar botão/link "← Início" no header que navega para `/` |
| 2 | Refresh overview após ação | `Admin.tsx` | Extrair `fetchDashboard` como função reutilizável. Passar callback `onSubscriptionChange` para `SubscriptionsTab` que reseta `dashFetched` para forçar reload |
| 3 | Tabela assinantes sem scroll horizontal | `Admin.tsx` | Remover colunas "Plataforma", "Início" e "Expiração" da tabela de assinantes ativos — mostrar layout de cards empilhados (email + badge) em vez de `<Table>` com 5 colunas |
| 4 | Click no assinante preenche busca | `Admin.tsx` | Já existe `onClick={() => handleSearch(sub.email)}` — mas precisa fazer scroll até a seção "Gerenciar Assinatura". Adicionar `useRef` no card de gerenciar e `scrollIntoView` após o click |
| 5 | Pesquisa inteligente de email | `Admin.tsx` + `admin-dashboard` edge function | Adicionar endpoint `?action=list_emails` no `admin-dashboard` que retorna todos emails. No frontend, filtrar emails conforme digitação e mostrar dropdown de sugestões |
| 6 | Listagem de usuários | `Admin.tsx` + `admin-dashboard` | Adicionar endpoint `?action=list_users` que retorna todos usuários com email, created_at e tier. No `UsersTab`, carregar lista completa com busca/filtro local |
| 7 | Ações de admin sobre usuário | `Admin.tsx` + nova edge function `admin-users` | Ao clicar em um usuário na lista, mostrar painel com ações: excluir conta (chama `delete-user-account` existente ou `adminClient.auth.admin.deleteUser`), gerenciar assinatura (redireciona para aba), ver detalhes |
| 8 | Aba Notificações | `Admin.tsx` + nova edge function `admin-notifications` | Nova aba com: listagem de notificações enviadas (query `user_fcm_tokens` + logs), formulário para enviar notificação personalizada (título, corpo, destinatário ou broadcast) usando Firebase Cloud Messaging via service account |

---

### Detalhes Técnicos

**Item 1 — Navegação voltar:**
- Adicionar `import { useNavigate } from "react-router-dom"` e botão `<Button variant="ghost" onClick={() => navigate("/")}><ArrowLeft /> Início</Button>` no header.

**Item 2 — Refresh overview:**
- Mover fetch do dashboard para função `refreshDashboard()`. Expor via prop ou callback. Após `handleAction` com sucesso em `SubscriptionsTab`, chamar `refreshDashboard()`.

**Item 3 — Cards sem scroll:**
- Substituir a `<Table>` de assinantes por uma lista de cards compactos: cada card mostra email (truncado) e badge do plano. Clicável. Sem scroll horizontal.

**Item 4 — Auto-scroll:**
- Já funciona a busca. Adicionar `ref` no card "Gerenciar Assinatura" e chamar `ref.current?.scrollIntoView({ behavior: 'smooth' })` após click.

**Item 5 — Autocomplete de email:**
- No `admin-dashboard`, adicionar rota `?action=list_emails` que retorna `{ emails: string[] }` com todos emails de usuários.
- No frontend, carregar emails uma vez no mount. Usar `useState` + filtro local para mostrar dropdown de sugestões conforme digitação. Ao selecionar, preenche o campo e faz a busca.

**Item 6 — Listagem de usuários:**
- No `admin-dashboard`, adicionar rota `?action=list_users` que retorna array de `{ email, created_at, tier, is_active }`.
- No `UsersTab`, carregar lista no mount. Mostrar tabela/cards com filtro local por email. Paginação simples (mostrar 50 por vez).

**Item 7 — Ações sobre usuário:**
- Ao clicar em um usuário na lista, expandir painel com:
  - **Excluir conta**: chama `adminClient.auth.admin.deleteUser(user_id)` via nova edge function `admin-users` (método DELETE). Confirmação com dialog.
  - **Gerenciar assinatura**: muda para aba "Assinaturas" e preenche email.
  - **Ver detalhes**: mostra stats do usuário (já existe a lógica no `admin-dashboard?email=...`).

**Item 8 — Aba Notificações:**
- Nova edge function `admin-notifications`:
  - GET: lista notificações enviadas (criar tabela `admin_notifications_log` com campos: id, title, body, target_type, target_email, sent_at, status).
  - POST: envia notificação via Firebase usando `FIREBASE_SERVICE_ACCOUNT_JSON`. Pode enviar para um usuário específico (busca FCM token) ou broadcast (todos tokens).
- Nova aba no admin com:
  - Formulário: título, corpo, destinatário (email ou "todos").
  - Lista de notificações enviadas com data e status.
- Criar migration para tabela `admin_notifications_log`.
- Tabs passam de `grid-cols-4` para `grid-cols-5` para incluir "Notificações".

