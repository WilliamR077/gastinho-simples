

## Reorganizar Metas em 3 Sub-abas

### O que muda

Dentro da aba "Metas" do dashboard, trocar as 2 sub-abas atuais por 3:

```text
                    Metas
 Despesas  |  Entradas  |  Saldo
```

### Detalhes tecnicos

**Arquivo `src/pages/Index.tsx` (linhas 1791-1833)**:
- Trocar `grid-cols-2` por `grid-cols-3` no TabsList
- Adicionar terceira sub-aba "Saldo" com estilo azul
- Separar o filtro de goals:
  - Despesas: `monthly_total` e `category`
  - Entradas: `income_monthly_total` e `income_category`
  - Saldo: `balance_target` (removido da aba de despesas)
- Adicionar terceiro `TabsContent` com `BudgetProgress` para metas de saldo

**Arquivo `src/components/budget-progress.tsx` (linhas 561-619)**:
- Remover a logica interna de tabs (linhas 561-619) ja que o pai agora controla a separacao
- Simplificar o retorno para apenas renderizar as goals recebidas diretamente (sem sub-abas internas), mantendo os renders `renderExpenseGoal`, `renderIncomeGoal` e `renderBalanceGoal`

