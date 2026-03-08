

## Plano: Painel Admin Profissional

O painel atual só gerencia assinaturas. Vamos transformá-lo num dashboard completo com visão geral do negócio, métricas, gestão de usuários e ferramentas de suporte.

### Arquitetura

Uma nova edge function `admin-dashboard` para fornecer dados agregados (a `admin-subscriptions` continua para gestão de planos). O frontend será reorganizado com Tabs para separar as seções.

### Mudanças

| Arquivo | Ação |
|---|---|
| `supabase/functions/admin-dashboard/index.ts` | Nova edge function com métricas agregadas |
| `src/pages/Admin.tsx` | Reescrever com layout de tabs profissional |
| `supabase/config.toml` | Registrar nova função |

---

### Edge Function: `admin-dashboard`

Mesma validação de JWT + email admin. Um único GET que retorna:

```text
{
  overview: {
    total_users: number,          // auth.admin.listUsers().length
    active_subscribers: number,   // subscriptions is_active + tier != free
    revenue_estimate: {           // count por tier × preço
      premium: number,
      no_ads: number,
      total_mrr: number
    },
    new_users_30d: number,        // users criados nos últimos 30 dias
    new_users_7d: number
  },
  subscription_breakdown: {       // contagem por tier+platform
    { tier, platform, count }[]
  },
  top_users: {                    // top 10 por total de despesas
    { email, expense_count, income_count, total_spent }[]
  },
  recent_signups: {               // últimos 20 registros
    { email, created_at }[]
  },
  activity_stats: {
    total_expenses: number,
    total_incomes: number,
    total_groups: number,
    total_cards: number,
    expenses_30d: number,
    incomes_30d: number
  }
}
```

Todas as queries usam o `adminClient` (service_role) para acessar dados de todos os usuários.

---

### Frontend: Tabs do Painel

**Tab 1 — Visão Geral (Dashboard)**
- 4 KPI cards no topo: Total de Usuários, Assinantes Ativos, MRR Estimado (R$), Novos Usuários (30d)
- Card "Distribuição de Planos" com barras horizontais (free vs no_ads vs premium, e por plataforma: Google Play vs Manual)
- Card "Atividade da Plataforma" com números de despesas, receitas, grupos, cartões totais + delta 30d
- Card "Registros Recentes" com lista dos últimos 20 usuários cadastrados

**Tab 2 — Assinaturas (já existente, refatorado)**
- Tabela de assinantes ativos (SubscribersSection existente)
- Busca por email + concessão/revogação de plano (funcionalidade existente)

**Tab 3 — Usuários**
- Busca por email com detalhes expandidos do usuário:
  - Plano atual, data de cadastro
  - Contagem de despesas, receitas, cartões, grupos
  - Últimas 5 transações (despesas + receitas)
- Usa a `admin-dashboard` com `?email=xxx&detail=true` para retornar perfil completo

**Tab 4 — Logs de Auditoria**
- Lista das últimas ações registradas na tabela `audit_log` (já existe no banco)
- Filtro por email e tipo de ação
- Útil para rastrear atividades suspeitas

---

### Detalhes Técnicos

- A edge function `admin-dashboard` faz todas as queries em paralelo com `Promise.all` para performance
- `listUsers()` é chamado uma vez e reutilizado para todos os joins
- O frontend usa `useState` com tab ativa para lazy-load (só busca dados da tab quando selecionada)
- Reutiliza componentes existentes: `Card`, `Badge`, `Table`, `Tabs` do shadcn
- KPI cards usam ícones do lucide-react com cores semânticas (verde para receita, azul para usuários, etc.)
- Responsivo: KPI cards em grid 2x2 no mobile, 4 colunas no desktop

### Sem mudanças no banco de dados
Todas as queries são read-only usando service_role. A tabela `audit_log` já existe.

