

## Ajustes finais nas Metas

### 1. Corrigir 0% no card "Total" para metas por categoria

**Problema**: No `expense-summary.tsx` (linhas 177-183), o calculo de `budgetProgress` para metas do tipo `category` compara apenas `exp.category === goal.category`. Porem, despesas mais recentes usam `category_id` (UUID) em vez do enum legado. O componente `budget-progress.tsx` ja resolve isso com a funcao `expenseMatchesGoalCategory` que verifica ambos os campos, mas o mini-resumo no card Total nao tem essa logica.

**Solucao**: Adicionar no `expense-summary.tsx` a mesma logica de matching duplo:
- Importar `useCategories` 
- Criar funcao `expenseMatchesGoalCategory` que compara tanto `exp.category` quanto `exp.category_id` com a categoria da meta (mapeando pelo nome via `categoryLabels`)
- Aplicar essa funcao nos filtros das linhas 178-183 (despesas mensais e recorrentes)

**Arquivo**: `src/components/expense-summary.tsx`

---

### 2. Organizar metas em abas (Tabs)

**Problema atual**: As metas sao exibidas em secoes empilhadas (Metas de Gastos, Metas de Entradas, Metas de Saldo) com headers `h3`. O usuario prefere abas para melhor organizacao.

**Solucao**: Substituir a estrutura de secoes no `budget-progress.tsx` por um componente `Tabs` com tres abas:
- Aba "Despesas" (icone TrendingDown vermelho)
- Aba "Entradas" (icone TrendingUp verde)  
- Aba "Saldo" (icone Scale azul)

Cada aba so aparece se houver metas daquele tipo. A aba padrao sera a primeira que tiver metas.

**Arquivo**: `src/components/budget-progress.tsx`

---

### Detalhes tecnicos

**Arquivo `src/components/expense-summary.tsx`**:
- Importar `useCategories` de `@/hooks/use-categories`
- Adicionar hook `const { categories: expenseCategories } = useCategories()` dentro do componente
- Criar funcao helper `getCategoryIdsForGoal` que mapeia enum -> UUID via nome
- Criar funcao `expenseMatchesGoalCategory` que verifica `exp.category === goalCategory` OU `exp.category_id` esta nos IDs mapeados
- Atualizar o filtro em `budgetProgress` para usar essa funcao nos dois `.filter()` de categoria

**Arquivo `src/components/budget-progress.tsx`**:
- Importar `Tabs, TabsList, TabsTrigger, TabsContent` de `@/components/ui/tabs`
- Substituir o bloco de retorno (linhas 560-592) por estrutura de Tabs
- Definir `defaultTab` dinamicamente baseado em qual tipo tem metas
- Mostrar contadores nas abas (ex: "Despesas (2)")

