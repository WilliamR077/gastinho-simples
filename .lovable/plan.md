
## Plano: Filtros globais acima das tabs

### 1. Mover filtros de posicao

Atualmente o layout e:
```text
MonthNavigator
Filtros          <-- posicao atual
BalanceSummary
ExpenseSummary (Pix/Debito/Credito)
BudgetAlertBanner
[Despesas] [Entradas] [Metas]
```

Nova posicao:
```text
MonthNavigator
BalanceSummary
ExpenseSummary (Pix/Debito/Credito)
BudgetAlertBanner
Filtros          <-- nova posicao
[Despesas] [Entradas] [Metas]
```

O bloco de filtros (linhas 1534-1544 no `Index.tsx`) sera movido para depois do `BudgetAlertBanner` e antes das `Tabs`.

### 2. Fazer filtros funcionarem para entradas

Atualmente os filtros (descricao, valor minimo, valor maximo) so afetam despesas. Vamos aplicar os mesmos filtros de descricao e valor nas entradas:

- `displayedIncomes` passara a filtrar tambem por `filters.description`, `filters.minAmount` e `filters.maxAmount`
- `displayedRecurringIncomes` idem
- Filtros especificos de despesa (forma de pagamento, cartao, fatura) continuam afetando apenas despesas, pois entradas nao tem esses campos

### 3. Fazer filtros funcionarem para metas

Para metas, os filtros de descricao e valor serao aplicados no `BudgetProgress`:
- Filtrar metas por descricao (nome da meta) se `filters.description` estiver preenchido
- Filtrar por valor (limit_amount) se `filters.minAmount` ou `filters.maxAmount` estiver preenchido

### 4. Adaptar titulo do componente de filtros

Mudar o titulo de "Filtros" para algo mais generico, ja que agora e global. Manter como "Filtros" mesmo, sem referencia a despesas.

---

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Index.tsx` | (1) Mover bloco de filtros (linhas 1534-1544) para depois do BudgetAlertBanner (linha 1582) e antes das Tabs (linha 1585). (2) Atualizar `displayedIncomes` e `displayedRecurringIncomes` para aplicar filtros de descricao e valor. (3) Passar filtros de descricao/valor para `BudgetProgress` como props. |
| `src/components/budget-progress.tsx` | Adicionar props opcionais `descriptionFilter`, `minAmountFilter`, `maxAmountFilter` para filtrar metas exibidas pelo nome e valor limite. |

### Resumo

- 2 arquivos modificados (`Index.tsx`, `budget-progress.tsx`)
- Nenhum arquivo novo
- Nenhuma mudanca no banco de dados
- Filtros de descricao e valor funcionam para as 3 abas
- Filtros especificos (pagamento, cartao, fatura) continuam apenas para despesas
