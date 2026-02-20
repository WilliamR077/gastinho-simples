
## Plano: Metas de Entrada + Entradas por Categoria

Duas melhorias para equiparar o sistema de entradas ao de despesas:

### 1. Metas de Entrada (Income Goals)

Permitir que o usuario defina metas de ganho (ex: "quero ganhar R$4.000 esse mes com Uber") e acompanhe o progresso conforme adiciona entradas.

**Banco de dados:**
- Adicionar novos valores ao enum `budget_goal_type`: `income_monthly_total` e `income_category`
- A tabela `budget_goals` ja suporta isso sem alteracoes estruturais (usa `type` + `category` + `limit_amount`)

**Componentes modificados:**

| Arquivo | Mudanca |
|---------|---------|
| `supabase/migrations/` | Migrar enum `budget_goal_type` para incluir `income_monthly_total` e `income_category` |
| `src/components/budget-goal-form-sheet.tsx` | Adicionar opcoes de meta de entrada (Total mensal de entradas, Por categoria de entrada). Mostrar categorias de entrada (`incomeCategoryLabels`) quando tipo for `income_category` |
| `src/components/budget-goal-edit-dialog.tsx` | Mesma logica: suportar os novos tipos de meta no formulario de edicao |
| `src/components/budget-progress.tsx` | Calcular progresso usando `incomes` + `recurringIncomes` em vez de `expenses` quando o tipo for `income_*`. Mudar visual: em vez de "Gasto", mostrar "Ganho". Quando atingir 100%, mostrar mensagem de parabens em vez de alerta |
| `src/pages/Index.tsx` | Passar `incomes` e `recurringIncomes` como props para `BudgetProgress` |
| `supabase/functions/check-budget-goals/index.ts` | Adicionar logica para metas de entrada: buscar `incomes` e `recurring_incomes` quando o tipo for `income_*`. Enviar notificacao de parabens quando atingir a meta |

**Comportamento das metas de entrada:**
- Barra de progresso verde (em vez de vermelha)
- Ao atingir 80%: "Quase la! Voce ja atingiu 80% da sua meta"
- Ao atingir 100%: "Parabens! Voce bateu sua meta de R$4.000!"
- Ao ultrapassar: "Incrivel! Voce superou sua meta em R$500!"

### 2. Entradas por Categoria (Income Category Summary)

Componente similar ao `CategorySummary` existente, mas para entradas.

| Arquivo | Mudanca |
|---------|---------|
| `src/components/income-category-summary.tsx` | **Novo componente** - Similar ao `CategorySummary`, mas usando `incomeCategoryLabels` e `incomeCategoryIcons`. Mostra totais por categoria de entrada com barras de progresso |
| `src/pages/Index.tsx` | Adicionar `IncomeCategorySummary` acima da lista de entradas na tab "Entradas", similar a como `CategorySummary` aparece para despesas |

### Detalhes tecnicos

**Migracao SQL:**
```sql
ALTER TYPE budget_goal_type ADD VALUE 'income_monthly_total';
ALTER TYPE budget_goal_type ADD VALUE 'income_category';
```

**Logica de progresso para metas de entrada no `BudgetProgress`:**
- Se `goal.type` comecar com `income_`, calcular usando entradas em vez de despesas
- Cores invertidas: verde quando progresso alto (bom!), em vez de vermelho
- Labels: "Ganho" em vez de "Gasto", "Falta" em vez de "Restam", "Meta atingida!" em vez de "Meta estourada!"

**`IncomeCategorySummary`:**
- Reutiliza a mesma estrutura visual do `CategorySummary`
- Usa `incomeCategoryLabels` e `incomeCategoryIcons` do `src/types/income.ts`
- Cores em tons de verde em vez de gradiente primario
- Titulo: "Entradas por Categoria"

### Resumo das mudancas

- 1 migracao SQL (enum)
- 1 novo componente (`income-category-summary.tsx`)
- 4 componentes modificados (budget-goal-form-sheet, budget-goal-edit-dialog, budget-progress, Index)
- 1 edge function atualizada (check-budget-goals)
- Nenhuma nova tabela necessaria
