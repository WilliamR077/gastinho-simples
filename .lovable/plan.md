

## Plano Revisado: Integrar Categorias no Fluxo de Despesas

### Mudança Principal

Remover `add-category` como step independente. A orientação sobre categorias passa a ser um substep dentro de `add-expense`, destacando o campo Categoria no formulário de despesa.

---

### 1. Remover step `add-category` e expandir `add-expense`

**`src/lib/onboarding/onboarding-steps.ts`**

- Remover o objeto `add-category` do array `ONBOARDING_STEPS`
- Remover `"add-category"` do `STEP_LABELS`
- Expandir `add-expense` com substeps guiados:

```
substeps: [
  {
    id: "expense-intro",
    actionType: "info",
    title: "Registre seu Primeiro Gasto",
    description: 'Vamos registrar uma despesa! Toque no botão "+" e preencha os dados. Você também poderá escolher e personalizar suas categorias.',
    emoji: "💸",
    navigateLabel: "Continuar",
  },
  {
    id: "expense-select-category",
    actionType: "select",
    targetSelector: "expense-category-field",
    title: "Escolha a Categoria",
    description: "Selecione a categoria da despesa. Você também pode gerenciar suas categorias a partir deste campo.",
    emoji: "📦",
    requiresValidation: true,
    scrollToTarget: true,
    placement: "below",
  },
]
```

### 2. Adicionar `data-onboarding` no campo Categoria dos formulários

**`src/components/expense-form-sheet.tsx`** e **`src/components/unified-expense-form-sheet.tsx`**

Ambos já têm `data-tour="form-category"` no div pai. Adicionar `data-onboarding="expense-category-field"` no mesmo div para que o onboarding engine encontre o alvo:

```html
<div className="space-y-2" data-tour="form-category" data-onboarding="expense-category-field">
```

### 3. Remover query de `user_categories` do progresso

**`src/hooks/use-onboarding-tour.tsx`**

Em `checkExistingData()`:
- Remover a query `supabase.from("user_categories")...` do `Promise.all`
- Remover a linha `if (categories.data?.length) completed.add("add-category")`
- Ajustar a desestruturação do array (remover `categories` da lista)

Isso faz com que o total de etapas reduza de 7 para 6 (desktop) e o cálculo de progresso, banner, Settings e completion dialog fiquem automaticamente corretos.

### 4. Retomada correta do fluxo

Nenhuma mudança adicional necessária. O `startOnboarding()` já usa `findIndex(s => !preCompleted.has(s.id))` e como `add-category` não existirá mais nos steps, o fluxo vai do `add-card` direto para `add-expense` (que agora inclui categorias). O `substepIndex` reseta para 0, então o usuário verá o intro e depois o substep de categoria.

---

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/onboarding/onboarding-steps.ts` | Remover step `add-category`, remover do `STEP_LABELS`, expandir `add-expense` com substep de categoria |
| `src/hooks/use-onboarding-tour.tsx` | Remover query `user_categories` do `checkExistingData()` |
| `src/components/expense-form-sheet.tsx` | Adicionar `data-onboarding="expense-category-field"` no div da categoria |
| `src/components/unified-expense-form-sheet.tsx` | Idem |

Nenhuma migração SQL.

