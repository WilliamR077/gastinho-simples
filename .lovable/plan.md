

## Plano: Auto-detectar dados existentes e pular steps do onboarding

### Problema
Quando o onboarding inicia, ele sempre começa do passo 1, mesmo que o usuário já tenha cartões, despesas, metas etc. cadastrados.

### Solução
Adicionar uma função `checkExistingData` que roda ao iniciar o onboarding. Ela consulta cada tabela relevante (`cards`, `user_categories`, `expenses`, `recurring_expenses`, `incomes`, `budget_goals`) e marca como completos os steps cujos dados já existem. O onboarding então avança direto para o primeiro step pendente. Se todos já estiverem completos, mostra o diálogo de conclusão.

### Mudanças

**Arquivo: `src/hooks/use-onboarding-tour.tsx`**

1. Criar função `checkExistingData(userId)` que faz queries paralelas:
```typescript
const checkExistingData = async (userId: string) => {
  const [cards, categories, expenses, recurring, incomes, goals] = await Promise.all([
    supabase.from("cards").select("id").eq("user_id", userId).limit(1),
    supabase.from("user_categories").select("id").eq("user_id", userId).eq("is_default", false).limit(1),
    supabase.from("expenses").select("id").eq("user_id", userId).limit(1),
    supabase.from("recurring_expenses").select("id").eq("user_id", userId).limit(1),
    supabase.from("incomes").select("id").eq("user_id", userId).limit(1),
    supabase.from("budget_goals").select("id").eq("user_id", userId).limit(1),
  ]);
  // Mapear resultados para step IDs completados
};
```

2. Chamar `checkExistingData` dentro de `startOnboarding()` antes de abrir o modal

3. Pular para o primeiro step não completado. Se todos completos, mostrar diálogo de conclusão direto

4. Também verificar PIN no localStorage para step `setup-security`

### Detalhes de mapeamento step → query

| Step ID | Tabela | Condição |
|---------|--------|----------|
| `add-card` | `cards` | qualquer registro |
| `add-category` | `user_categories` | `is_default = false` |
| `add-expense` | `expenses` | qualquer registro |
| `add-recurring-expense` | `recurring_expenses` | qualquer registro |
| `add-income` | `incomes` | qualquer registro |
| `add-budget-goal` | `budget_goals` | qualquer registro |
| `setup-security` | localStorage | `gastinho_app_lock_pin` existe |
| `import-spreadsheet` | sempre pula (opcional) | - |

