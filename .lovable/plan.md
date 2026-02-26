

## Plano: Implementar duplicação completa de transações

O problema atual: `handleDuplicateExpense` só passa o `amount` e `handleDuplicateIncome` não passa nada — ambos abrem o formulário praticamente vazio.

A solução: adicionar props de `initialData` nos dois form sheets para pré-preencher todos os campos.

---

### 1. `UnifiedExpenseFormSheet` — aceitar `initialData`

**Arquivo: `src/components/unified-expense-form-sheet.tsx`**

Adicionar prop opcional:
```tsx
initialData?: {
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  expenseDate?: Date;
  categoryId?: string;
  cardId?: string;
  expenseType: "monthly" | "recurring";
  dayOfMonth?: number;
  installments?: number;
  sharedGroupId?: string | null;
};
```

No `useEffect` que roda quando `open` muda, se `initialData` existir, preencher todos os states:
- `setExpenseType(initialData.expenseType)`
- `setDescription(initialData.description)`
- `setAmount(initialData.amount.toString())`
- `setPaymentMethod(initialData.paymentMethod)`
- `setCategory(initialData.categoryId || "")` — o `CategorySelector` já seleciona pelo ID
- `setCardId(initialData.cardId || "")`
- `setExpenseDate(initialData.expenseDate || new Date())`
- `setDayOfMonth(initialData.dayOfMonth?.toString() || "1")`
- `setInstallments(initialData.installments?.toString() || "1")`
- `setSelectedDestination(initialData.sharedGroupId || "personal")`

Se `initialData` não existir, manter o reset atual.

Ao fechar o sheet (`onOpenChange(false)`), limpar `initialData` no pai.

---

### 2. `UnifiedIncomeFormSheet` — aceitar `initialData`

**Arquivo: `src/components/unified-income-form-sheet.tsx`**

Adicionar prop opcional:
```tsx
initialData?: {
  description: string;
  amount: number;
  categoryId?: string;
  incomeDate?: Date;
  incomeType: "monthly" | "recurring";
  dayOfMonth?: number;
};
```

No `useEffect` que roda quando `open` muda, se `initialData` existir:
- `setIncomeType(initialData.incomeType)`
- `setDescription(initialData.description)`
- `setAmount(initialData.amount.toString())`
- `setCategoryValue(initialData.categoryId || "")` — o `IncomeCategorySelector` já aceita ID
- `setIncomeDate(initialData.incomeDate || new Date())`
- `setDayOfMonth(initialData.dayOfMonth?.toString() || "5")`

Se não existir, manter reset.

---

### 3. `Index.tsx` — corrigir handlers de duplicação

**Arquivo: `src/pages/Index.tsx`**

Adicionar states para os dados iniciais:
```tsx
const [expenseInitialData, setExpenseInitialData] = useState<...>(undefined);
const [incomeInitialData, setIncomeInitialData] = useState<...>(undefined);
```

Reescrever `handleDuplicateExpense`:
```tsx
const handleDuplicateExpense = (expense: Expense) => {
  setExpenseInitialData({
    description: expense.description,
    amount: expense.amount,
    paymentMethod: expense.payment_method,
    expenseDate: parseLocalDate(expense.expense_date),
    categoryId: expense.category_id || expense.category,
    cardId: expense.card_id || undefined,
    expenseType: "monthly", // duplicação sempre cria "do mês"
    installments: 1, // não duplicar parcelas
    sharedGroupId: expense.shared_group_id,
  });
  setExpenseSheetOpen(true);
};
```

Reescrever `handleDuplicateIncome`:
```tsx
const handleDuplicateIncome = (income: Income) => {
  const catId = (income as any).income_category_id;
  setIncomeInitialData({
    description: income.description,
    amount: income.amount,
    categoryId: catId || income.category,
    incomeDate: parseLocalDate(income.income_date),
    incomeType: "monthly",
  });
  setIncomeSheetOpen(true);
};
```

Passar as props nos sheets:
```tsx
<UnifiedExpenseFormSheet
  ...
  initialData={expenseInitialData}
/>

<UnifiedIncomeFormSheet
  ...
  initialData={incomeInitialData}
/>
```

Limpar `initialData` quando o sheet fecha:
```tsx
onOpenChange={(open) => {
  setExpenseSheetOpen(open);
  if (!open) {
    setExpenseDefaultAmount(undefined);
    setExpenseInitialData(undefined);
  }
}}
```

Mesmo padrão para o income sheet.

---

### Resumo de alterações

| Arquivo | Mudança |
|---|---|
| `unified-expense-form-sheet.tsx` | Aceitar `initialData` prop; preencher todos os campos quando presente |
| `unified-income-form-sheet.tsx` | Aceitar `initialData` prop; preencher todos os campos quando presente |
| `Index.tsx` | Corrigir `handleDuplicateExpense` e `handleDuplicateIncome` para passar todos os dados da transação; gerenciar states de `initialData` |

3 arquivos. Sem alteração de backend/dados. O botão continua sendo "Adicionar" (criação). Formulário editável antes de salvar.

