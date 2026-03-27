

## Plano Revisado: Implementar Passo 5 — Metas (com locks em scope e subtipo)

### Ajustes incorporados

1. **Subtipo travado em "Limite mensal total"**: Durante o onboarding, o Select de tipo de meta fica desabilitado/locked com valor `monthly_total`. O usuário não consegue trocar para "Limite por categoria".

2. **`goal-submitted` só após sucesso real**: O evento é disparado em `Index.tsx` dentro do `addBudgetGoal`, somente após o `insert` retornar sem erro. Não é disparado no componente do formulário.

---

### Mudanças por arquivo

#### 1. `src/lib/onboarding/onboarding-steps.ts`

Expandir `add-budget-goal` de 1 substep para 7:

| Substep | Tipo | Target | Notas |
|---------|------|--------|-------|
| `budget-intro` | info | — | Explica 3 tipos, recomenda Meta de Despesa. Sem skipLabel |
| `budget-click-fab` | click | `fab-main-button` | autoAdvanceOnEvent: `fab-menu-opened` |
| `budget-click-btn` | click | `fab-goal-button` | autoAdvanceOnEvent: `goal-form-opened` |
| `budget-scope-select` | click | `goal-scope-expense` | autoAdvanceOnEvent: `goal-scope-selected` |
| `budget-type-info` | info | `goal-type-select` | Explica "Limite mensal total" recomendado, tipo travado |
| `budget-amount` | fill | `goal-amount-input` | requiresValidation, focusTarget |
| `budget-submit` | submit | `goal-submit-btn` | autoAdvanceOnEvent: `goal-submitted` |

Sem completion substep — ao salvar, `completeCurrentStep()` avança direto para passo 6. Sem `skipLabel`.

#### 2. `src/components/budget-goal-form-sheet.tsx`

- Aceitar prop `preventClose?: boolean` — quando true, bloquear `onOpenChange(false)`
- Aceitar prop `onboardingActive?: boolean` — quando true:
  - Cards de "Meta de Entrada" e "Meta de Saldo" ficam com `pointer-events-none opacity-50`
  - Após selecionar scope "expense", o Select de tipo fica `disabled` com valor travado em `monthly_total`
  - O botão "Voltar" fica desabilitado
- Adicionar `data-onboarding` nos elementos:
  - Card "Meta de Despesa": `goal-scope-expense`
  - Div do Select de tipo: `goal-type-select`
  - Input do valor: `goal-amount-input`
  - Botão submit: `goal-submit-btn`
- Disparar `goal-form-opened` via useEffect quando `open === true` e scope cards montados
- Disparar `goal-scope-selected` quando `handleScopeSelect("expense")` é chamado
- **Não** disparar `goal-submitted` aqui — isso será feito no `Index.tsx` após sucesso real

#### 3. `src/components/floating-action-button.tsx`

- Adicionar `data-onboarding="fab-goal-button"` no botão "Meta" (linha 57)

#### 4. `src/hooks/use-onboarding-tour.tsx`

- Expandir `isFormGuidedFlow` para incluir `add-budget-goal`
- Expandir `FORM_SUBSTEP_START` para detectar `budget-scope-select` quando step é `add-budget-goal`
- Expandir `isFormReady` para checar `goal-scope-expense` quando no passo de metas
- Expandir event listener para tratar `goal-scope-selected`

#### 5. `src/pages/Index.tsx`

- Passar `preventClose` e `onboardingActive` ao `BudgetGoalFormSheet` quando `isFormGuidedFlow && currentStep?.id === "add-budget-goal"`
- Bloquear `onOpenChange(false)` para o goal sheet durante guided flow
- No `addBudgetGoal`, após sucesso do insert (linha ~1130), disparar `goal-submitted`:
  ```typescript
  window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: "goal-submitted" }));
  ```

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/onboarding/onboarding-steps.ts` | Expandir `add-budget-goal` com 7 substeps |
| `src/components/budget-goal-form-sheet.tsx` | data-onboarding, preventClose, onboardingActive, locks |
| `src/components/floating-action-button.tsx` | `data-onboarding="fab-goal-button"` |
| `src/hooks/use-onboarding-tour.tsx` | Guided flow para metas |
| `src/pages/Index.tsx` | preventClose no goal sheet, disparar goal-submitted após sucesso |

Nenhuma migração SQL.

