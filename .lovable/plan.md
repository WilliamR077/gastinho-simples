

## Ajustes nas Metas e Novidades

### Problemas identificados e solucoes

---

### 1. Card "Total" mostrando metas de entrada (bug)

**Problema**: O componente `ExpenseSummary` recebe todas as `budgetGoals` (incluindo `income_monthly_total` e `income_category`) e exibe no mini-resumo "Metas do Mes". Como as metas de entrada nao sao calculadas nesse componente (ele so calcula `monthly_total` e `category`), elas aparecem com 0%.

**Solucao**: No `Index.tsx`, ao passar `budgetGoals` para `<ExpenseSummary>`, filtrar apenas metas de despesa:

```
budgetGoals={budgetGoals.filter(g => g.type === "monthly_total" || g.type === "category")}
```

Tambem no `expense-summary.tsx`, melhorar o label para nao exibir "Total" duplicado - usar "Limite Mensal" em vez de "Total" para `monthly_total`.

---

### 2. Banner de alerta (`goalsAtRisk`) incluindo metas de entrada

**Problema**: O calculo de `goalsAtRisk` no `Index.tsx` processa todas as metas, mas so calcula corretamente as de despesa. Metas de entrada (`income_*`) ficam com `totalSpent = 0`, logo nao atingem 80%, mas poderiam causar confusao futura.

**Solucao**: Filtrar `goalsAtRisk` para considerar apenas metas de despesa (`monthly_total` e `category`).

---

### 3. Novo tipo de meta: Meta de Saldo

**Solucao**: Criar um novo tipo `balance_target` no enum `budget_goal_type`.

- **Migracao SQL**: Adicionar `'balance_target'` ao enum
- **Logica**: Saldo = (entradas do mes + recorrentes ativas) - (despesas do mes + recorrentes ativas). A meta e atingida quando saldo >= `limit_amount`
- **UI no `budget-goal-form-sheet.tsx`**: Adicionar uma terceira opcao no seletor de tipo: "Meta de Saldo" com explicacao
- **UI no `budget-progress.tsx`**: Renderizar meta de saldo com visual proprio (azul/neutro), mostrando saldo atual vs meta
- **Constraint**: `balance_target` exige `category IS NULL` (nao faz sentido por categoria)

---

### 4. Banner celebratorio para metas de entrada na tela principal

**Solucao**: Criar um componente `IncomeBudgetAlertBanner` (ou expandir o existente) com visual verde/positivo, que apareca na tela principal quando:
- Meta de entrada >= 80%: "Quase la! Voce atingiu X% da sua meta de entrada"
- Meta de entrada >= 100%: "Parabens! Voce bateu/superou sua meta de entrada!"

Este banner sera posicionado logo abaixo do banner de alertas de despesa existente.

---

### Detalhes tecnicos

**Arquivos modificados**:

| Arquivo | Mudanca |
|---|---|
| `src/pages/Index.tsx` | Filtrar budgetGoals para ExpenseSummary; filtrar goalsAtRisk so para despesas; calcular incomeGoalsAchieved; renderizar IncomeBudgetAlertBanner |
| `src/components/expense-summary.tsx` | Melhorar label de "Total" para "Limite Mensal" |
| `src/components/budget-alert-banner.tsx` | (sem mudanca, ja funciona so para despesas apos filtro no Index) |
| `src/components/budget-goal-form-sheet.tsx` | Adicionar opcao "Meta de Saldo" no seletor de tipo |
| `src/components/budget-goal-edit-dialog.tsx` | Suportar tipo `balance_target` |
| `src/components/budget-progress.tsx` | Adicionar `renderBalanceGoal` com calculo saldo = entradas - despesas |
| `supabase/functions/check-budget-goals/index.ts` | Adicionar logica para `balance_target` |

**Novos arquivos**:

| Arquivo | Descricao |
|---|---|
| `src/components/income-goal-banner.tsx` | Banner verde celebratorio para metas de entrada atingidas/quase atingidas |

**Migracao SQL**:
- Adicionar `'balance_target'` ao enum `budget_goal_type`
- Atualizar constraint `valid_category_for_type` para incluir `balance_target` (categoria deve ser null)

