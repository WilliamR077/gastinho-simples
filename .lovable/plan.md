

## Plano: Notificacao push quando alguem adiciona despesa no grupo

### O que sera feito

Quando um membro adicionar uma despesa em um grupo compartilhado, todos os **outros** membros do grupo receberao uma notificacao push tipo: "Joao adicionou R$800,00 (Mercado) no grupo Viagem SP".

### Arquitetura

A notificacao sera disparada pelo frontend apos inserir a despesa com sucesso. Uma nova edge function `notify-group-expense` recebe os dados da despesa e envia push para todos os membros do grupo, exceto quem adicionou.

### Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/notify-group-expense/index.ts` | **Nova edge function** - Recebe `group_id`, `user_id` (quem adicionou), `description`, `amount`, `category_name` e `group_name`. Busca todos os membros do grupo (exceto o autor), busca seus FCM tokens e envia notificacao via a logica existente do `send-notification`. |
| `supabase/config.toml` | Adicionar entrada `[functions.notify-group-expense]` com `verify_jwt = false` |
| `src/pages/Index.tsx` | Na funcao `addExpense`, apos inserir com sucesso e quando `groupId` estiver definido, chamar `supabase.functions.invoke("notify-group-expense", ...)` de forma assincrona (fire-and-forget, sem bloquear o fluxo). |

### Fluxo

1. Usuario adiciona despesa no grupo
2. Despesa e inserida no banco com sucesso (fluxo atual)
3. Frontend chama `notify-group-expense` em background (sem await bloqueante)
4. Edge function busca membros do grupo (exceto o autor)
5. Para cada membro, busca FCM tokens e envia push via Firebase FCM HTTP v1 API
6. Membros recebem: "Joao adicionou R$800,00 (Mercado) no grupo Viagem SP"

### Detalhes da Edge Function

A edge function `notify-group-expense`:
- Recebe: `{ group_id, user_id, description, amount, category_name, group_name }`
- Usa `SUPABASE_SERVICE_ROLE_KEY` para buscar membros do grupo na tabela `shared_group_members`
- Busca email do autor na tabela `auth.users` para usar o nome no push
- Para cada membro (exceto autor), busca tokens em `user_fcm_tokens`
- Reutiliza a mesma logica de autenticacao OAuth2 + FCM HTTP v1 do `send-notification`
- Notificacao nao e critica: se falhar, nao afeta o fluxo do usuario

### Formato da notificacao

```text
Titulo: "[Nome do Grupo]"
Corpo: "joao@email.com adicionou R$800,00 (Mercado)"
```

### Seguranca

- A funcao valida o `INTERNAL_API_SECRET` igual ao `send-notification`
- Nao precisa de JWT pois a autenticacao e feita via secret interno
- O frontend envia o header `x-internal-secret` que ja esta configurado como secret no Supabase

### Observacoes

- O disparo e fire-and-forget: nao bloqueia a UI do usuario
- Se o usuario nao tiver FCM token (ex: nao usa app nativo), simplesmente ignora
- Funciona apenas para despesas normais (nao recorrentes, por enquanto)
- Nenhuma mudanca no banco de dados necessaria

