

## Plano: Melhorias 1–4 ✅ Concluído

---

### 1. ✅ Bug: porcentagem errada nas Metas do Mês

Corrigido: `budgetProgress` agora usa `expenses` (filtrado pelo mês selecionado) em vez de `monthlyExpenses` (que usava o mês do sistema).

### 2. ✅ Build error + Botão "Ver mais"

- Removido `className="bg-[#101013]"` inválido do `ExpenseSummary` em `Index.tsx`
- Adicionado prop `onNavigateToGoals` e botão "Ver mais" após as metas

### 3. ✅ Bottom sheet para despesas fixas

- `recurring-expense-list.tsx`: linhas clicáveis abrem `TransactionDetailSheet`
- `transaction-detail-sheet.tsx`: suporta `recurringExpense` com "Dia do mês" e switch Ativo/Inativo

### 4. ✅ Bottom sheet para entradas fixas

- `recurring-income-list.tsx`: mesmo padrão com `TransactionDetailSheet`

---

### Pendente: Melhoria 5

- Tirar espaço preto abaixo do footer (`pb-44` → `pb-24` em Index.tsx)
