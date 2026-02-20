

## Plano: Resumo de gastos por membro no grupo

### O que sera feito

Criar um novo componente `GroupMemberSummary` que aparece **apenas quando o usuario esta no contexto de um grupo**. Ele mostra quanto cada membro gastou no periodo selecionado, com o email do membro e o total formatado em moeda.

### Onde aparece

Na pagina Index.tsx, logo abaixo do `BalanceSummary` e acima do `ExpenseSummary`, visivel apenas quando `currentContext.type === 'group'`.

### Como funciona

1. Usar os dados ja carregados: `filteredExpenses` (despesas do periodo) + `recurringExpenses` ativas + `groupMembers` (ja carregados com email via RPC)
2. Agrupar despesas por `user_id`, somar valores
3. Cruzar com `groupMembers` para mostrar o email de cada membro
4. Incluir tambem despesas recorrentes ativas de cada membro

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/components/group-member-summary.tsx` | **Novo componente** - Recebe `expenses`, `recurringExpenses` e `groupMembers` como props. Agrupa por `user_id`, exibe card com avatar colorido, email truncado e total. Respeita o toggle de visibilidade de valores. |
| `src/pages/Index.tsx` | Importar e renderizar `GroupMemberSummary` entre `BalanceSummary` e `ExpenseSummary`, condicionado a `currentContext.type === 'group'`. Passar `filteredExpenses`, `recurringExpenses` filtradas e `groupMembers`. |

### Visual do componente

Um card compacto com lista horizontal ou vertical dos membros:

```text
+------------------------------------------+
|  Gastos por Membro                       |
|  ----------------------------------------|
|  🔵 joao@email.com         R$ 860,00    |
|  🟢 maria@email.com        R$ 330,00    |
+------------------------------------------+
```

- Cada membro tem um circulo colorido gerado a partir do indice
- Email truncado para caber em telas pequenas
- Valores respeitam o toggle "ocultar valores" (mostra `R$ ****` quando oculto)
- Ordenado do maior gasto para o menor

### Dados necessarios

Todos os dados ja estao disponiveis no Index.tsx:
- `filteredExpenses` - despesas do periodo filtrado (ja filtradas por grupo via `loadExpenses`)
- `recurringExpenses` - despesas recorrentes (ja filtradas por grupo)
- `groupMembers` - membros do grupo com email (ja carregados via `getGroupMembers` RPC)

Nao precisa de mudancas no banco de dados.

