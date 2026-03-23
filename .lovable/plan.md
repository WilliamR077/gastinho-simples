

## Plano: Corrigir Passo 2 do Onboarding (Despesa do Mês)

### Problema

O passo 2 atual tem um substep `expense-intro` do tipo `info` que, ao clicar "Continuar", avança direto para `expense-description`. Mas o formulário de despesa ainda não foi aberto, então o `MutationObserver` fica esperando eternamente por `[data-onboarding="expense-description"]` que não existe no DOM.

Além disso, o FAB (`+`) e o botão "Despesa" no menu do FAB não têm atributos `data-onboarding`, então o spotlight não consegue encontrá-los.

---

### Mudanças

#### 1. Adicionar `data-onboarding` no FAB e no botão Despesa

**`src/components/floating-action-button.tsx`**

- Botão FAB principal: adicionar `data-onboarding="fab-main-button"`
- Botão "Despesa" no menu: adicionar `data-onboarding="fab-expense-button"`

#### 2. Reescrever os substeps do `add-expense`

**`src/lib/onboarding/onboarding-steps.ts`**

Substituir `EXPENSE_SUBSTEPS` por um fluxo stateful com etapas reais:

```
1. expense-intro       → info: "Qual foi a última coisa que você gastou?"
2. expense-click-fab   → click: targetSelector="fab-main-button", autoAdvanceOnEvent="fab-menu-opened"
3. expense-click-btn   → click: targetSelector="fab-expense-button", autoAdvanceOnEvent="expense-form-opened"
4. expense-type-info   → info: "Estamos adicionando uma Despesa do Mês. A Despesa Fixa virá no próximo passo."
5. expense-description → fill: targetSelector="expense-description", requiresValidation
6. expense-amount      → fill: targetSelector="expense-amount", requiresValidation
7. expense-date        → optional-group: targetSelector="expense-date", skipLabel="Manter hoje"
8. expense-category    → select: targetSelector="expense-category-field", requiresValidation
9. expense-payment     → select: targetSelector="expense-payment", requiresValidation
10. expense-card       → select: targetSelector="expense-card-select", requiresValidation, condition: débito/crédito selecionado
11. expense-installments → select: targetSelector="expense-installments", requiresValidation, condition: crédito selecionado
12. expense-submit     → submit: targetSelector="expense-submit-btn", autoAdvanceOnEvent="expense-submitted"
13. expense-done       → completion: "Despesa Registrada!"
```

As etapas 10 e 11 usam `condition` para verificar se o campo existe no DOM (os campos só renderizam quando débito/crédito é selecionado).

#### 3. Emitir eventos do FAB

**`src/components/floating-action-button.tsx`**

Quando o menu abrir (`setIsOpen(true)`), disparar:
```ts
window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: "fab-menu-opened" }));
```

#### 4. Emitir evento ao abrir formulário de despesa

**`src/pages/Index.tsx`**

No callback `onExpenseClick` do FAB, quando `setExpenseSheetOpen(true)` é chamado, disparar:
```ts
window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: "expense-form-opened" }));
```

#### 5. Emitir evento ao salvar despesa

**`src/pages/Index.tsx`**

Na função `addExpense`, após inserção com sucesso no Supabase, disparar:
```ts
window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: "expense-submitted" }));
```

#### 6. Adicionar `data-onboarding` nos campos faltantes

**`src/components/unified-expense-form-sheet.tsx`**

- Campo de cartão: adicionar `data-onboarding="expense-card-select"` no div/Select de seleção de cartão
- Campo de parcelas: adicionar `data-onboarding="expense-installments"` no div/Select de parcelas
- Tipo de despesa: adicionar `data-onboarding="expense-type-selector"` no RadioGroup

**`src/components/expense-form-sheet.tsx`** (mesmo padrão, para o formulário legado)

#### 7. Conditions para substeps condicionais

As conditions de `expense-card` e `expense-installments` verificam se o elemento existe no DOM:

```ts
condition: () => !!document.querySelector('[data-onboarding="expense-card-select"]')
```

```ts
condition: () => !!document.querySelector('[data-onboarding="expense-installments"]')
```

Isso funciona porque esses campos só são renderizados quando débito/crédito é selecionado.

---

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/onboarding/onboarding-steps.ts` | Reescrever `EXPENSE_SUBSTEPS` com 13 substeps |
| `src/components/floating-action-button.tsx` | Adicionar `data-onboarding` no FAB e botão Despesa, emitir evento |
| `src/pages/Index.tsx` | Emitir eventos `expense-form-opened` e `expense-submitted` |
| `src/components/unified-expense-form-sheet.tsx` | Adicionar `data-onboarding` no cartão, parcelas e tipo |
| `src/components/expense-form-sheet.tsx` | Adicionar `data-onboarding` no cartão e parcelas |

Nenhuma migração SQL. Nenhuma mudança nos outros passos do onboarding.

