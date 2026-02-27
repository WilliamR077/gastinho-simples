

## Plano: Melhorias 1–4

---

### 1. Bug: porcentagem errada nas Metas do Mês

**Arquivo: `src/components/expense-summary.tsx`**

O `budgetProgress` usa `monthlyExpenses` que filtra por `currentMonth`/`currentYear` (data do sistema). Quando o usuário navega para Janeiro mas estamos em Fevereiro, o cálculo fica errado.

**Correção:**
- Substituir `monthlyExpenses` por `expenses` no cálculo de `budgetProgress` (linhas 196–204) — `expenses` já vem filtrado pelo mês selecionado no navegador
- Substituir `recurringActive` por `activeRecurringExpenses` (já calculado acima com os mesmos filtros de período)
- Remover o `useMemo` de `monthlyExpenses` (linhas 177–185) e `recurringActive` (linhas 187–189) — não mais necessários

---

### 2. Build error + Botão "Ver mais"

**Arquivo: `src/pages/Index.tsx` linha 1566**
- Remover `className="bg-[#101013]"` do `ExpenseSummary`
- Adicionar prop `onNavigateToGoals={() => setActiveTab("goals")}`

**Arquivo: `src/components/expense-summary.tsx`**
- Adicionar prop `onNavigateToGoals?: () => void` na interface
- Após as metas (`budgetProgress.slice(0, 3).map(...)`), renderizar botão "Ver mais" que chama `onNavigateToGoals`

---

### 3. Bottom sheet para despesas fixas

**Arquivo: `src/components/recurring-expense-list.tsx`**
- Adicionar state `selectedExpense`
- Tornar linha clicável (`onClick`)
- Remover `DropdownMenu`
- Renderizar `TransactionDetailSheet` com ações: Editar, Ativar/Desativar, Excluir
- Adicionar props `onDuplicate?: (expense: RecurringExpense) => void`

**Arquivo: `src/components/transaction-detail-sheet.tsx`**
- Estender interface para aceitar `recurringExpense?: RecurringExpense | null` e `recurringIncome?: RecurringIncome | null`
- Quando recurring: mostrar "Dia X do mês" em vez de data, mostrar status Ativo/Inativo
- Adicionar prop opcional `onToggleActive?: (id: string, isActive: boolean) => void` para o switch
- Substituir botão "Duplicar" por switch "Ativo/Inativo" quando for recurring

---

### 4. Bottom sheet para entradas fixas

**Arquivo: `src/components/recurring-income-list.tsx`**
- Mesmo padrão: state `selectedIncome`, linha clicável, remover `DropdownMenu`, remover `AlertDialog` inline
- Renderizar `TransactionDetailSheet` com ações: Editar, Ativar/Desativar, Excluir

---

### Resumo

| Arquivo | Mudança |
|---|---|
| `expense-summary.tsx` | Corrigir cálculo de % + adicionar prop/botão "Ver mais" |
| `Index.tsx` | Remover className inválido + passar `onNavigateToGoals` |
| `transaction-detail-sheet.tsx` | Suportar recurring expenses/incomes |
| `recurring-expense-list.tsx` | Linha clicável → bottom sheet; remover DropdownMenu |
| `recurring-income-list.tsx` | Linha clicável → bottom sheet; remover DropdownMenu e AlertDialog |

5 arquivos.

