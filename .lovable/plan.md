

## Plano: Busca e filtros no histórico de notificações

### Mudança

| Arquivo | Ação |
|---|---|
| `src/pages/Admin.tsx` | Adicionar barra de busca e filtros acima da lista de logs na `NotificationsTab` |

### Detalhes

Dentro da `NotificationsTab`, entre o `CardHeader` do histórico e a lista de logs (linha ~730):

1. **Campo de busca** — `Input` que filtra logs por título, corpo ou email do destinatário (filtro local em `logs`)
2. **Filtro por status** — `Select` com opções: "Todos", "Enviado", "Parcial", "Sem tokens", "Falhou"
3. **Filtro por tipo** — `Select` com opções: "Todos", "Broadcast", "Usuário específico"
4. **Aplicar filtros** — `useMemo` que retorna `filteredLogs` com base nos 3 critérios acima, usado no `.map()` da lista

Novos states: `searchLog`, `statusFilter`, `typeFilter`. Layout horizontal dos filtros acima da lista.

