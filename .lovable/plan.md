

## Plano: Implementar Passo 3 Completo — Despesa Fixa

### Contexto
O passo 3 (`add-recurring-expense`) atualmente tem apenas 1 substep intro. O formulário unificado (`unified-expense-form-sheet.tsx`) já suporta o tipo "recurring" com campos específicos (Dia da Cobrança em vez de Data, sem parcelas). A infraestrutura de guided flow (preventClose, 4-panel overlay, container-aware scroll, event-driven advancement) já existe do passo 2.

### Mudanças

#### 1. `src/lib/onboarding/onboarding-steps.ts`
Expandir `RECURRING_EXPENSE_SUBSTEPS` com o fluxo completo:

| Substep | Tipo | Target | Evento/Validação |
|---------|------|--------|------------------|
| `recurring-intro` | info (sem target) | — | skipLabel: "Não tenho despesa fixa" |
| `recurring-click-fab` | click | `fab-main-button` | autoAdvanceOnEvent: `fab-menu-opened` |
| `recurring-click-btn` | click | `fab-expense-button` | autoAdvanceOnEvent: `expense-form-opened` |
| `recurring-type-info` | info | `expense-type-selector` | Explica que agora é despesa fixa |
| `recurring-description` | fill | `expense-description` | requiresValidation |
| `recurring-amount` | fill | `expense-amount` | requiresValidation |
| `recurring-day` | select | `expense-day-of-month` (novo) | requiresValidation |
| `recurring-category` | click | `expense-category-field` | autoAdvanceOnEvent: `expense-category-selected` / `category-manager-opened` |
| (category manager substeps condicionais — reutilizar os mesmos IDs/conditions do passo 2) |
| `recurring-category-after-manager` | click | `expense-category-field` | condition: manager closed |
| `recurring-payment` | select | `expense-payment` | requiresValidation |
| `recurring-card` | select | `expense-card-select` | condition: card field exists |
| `recurring-submit` | submit | `expense-submit-btn` | autoAdvanceOnEvent: `expense-submitted` |
| `recurring-done` | completion | — | proceedLabel: "Prosseguir" |

Sem substep de parcelas (despesa fixa não tem).

#### 2. `src/components/unified-expense-form-sheet.tsx`
- Adicionar `data-onboarding="expense-day-of-month"` ao div do campo "Dia da Cobrança" (linha 504)
- Expandir `isExpenseTypeLocked` para incluir o passo `add-recurring-expense` com `recurring-type-info`, forçando `expenseType = "recurring"` quando o onboarding estiver no passo 3
- No useEffect de lock (linha 136-140), tratar ambos os cenários: passo 2 trava em "monthly", passo 3 trava em "recurring"

#### 3. `src/hooks/use-onboarding-tour.tsx`
- Expandir `isExpenseFormGuidedFlow` para incluir o passo `add-recurring-expense` (além de `add-expense`)
- O `EXPENSE_FORM_SUBSTEP_START` precisa funcionar para ambos os passos
- Renomear/generalizar para cobrir os dois casos: derivar de `currentStep.substeps.findIndex(s => s.id includes "type-info")`

#### 4. `src/pages/Index.tsx`
- O `isExpenseFormGuidedFlow` já bloqueia fechamento do Sheet — como agora cobre ambos os passos, nenhuma mudança adicional necessária aqui

#### 5. `src/components/onboarding/onboarding-tooltip.tsx`
- Adicionar suporte para renderizar `skipLabel` como botão secundário em substeps do tipo `info` (quando `onSkipSubstep` é passado)
- Isso permite que o intro do passo 3 mostre "Continuar" + "Não tenho despesa fixa"

#### 6. `src/components/onboarding-tour.tsx`
- Para substeps `info` sem target, passar `onSkipSubstep` quando `skipLabel` existir (já passa para substeps com target na linha 262, mas não para os centered/sem target na linha 225-238)
- Quando `onSkipSubstep` é chamado no intro, deve chamar `skipCurrentStep` (pular para passo 4)

### Arquivos afetados
| Arquivo | Mudança |
|---------|---------|
| `src/lib/onboarding/onboarding-steps.ts` | Substeps completos do passo 3 |
| `src/components/unified-expense-form-sheet.tsx` | `data-onboarding` no Dia da Cobrança + lock de tipo para passo 3 |
| `src/hooks/use-onboarding-tour.tsx` | Generalizar guided flow para passo 3 |
| `src/components/onboarding/onboarding-tooltip.tsx` | Botão skip em info substeps |
| `src/components/onboarding-tour.tsx` | Passar onSkipSubstep para info centered |

### Pontos de atenção
- Reutilizar os mesmos `data-onboarding` targets do formulário unificado (description, amount, category, payment, card, submit) — são os mesmos campos
- Os substeps de category manager condicionais podem ser copiados do passo 2 com IDs diferentes (prefixo `recurring-`) para evitar conflito
- Não há campo de parcelas para recurring — o `condition` existente em `expense-installments` já cobre isso (field não existe no DOM quando type=recurring)
- O "Dia da Cobrança" é um Select de 1-31, não um calendário — precisa de `data-onboarding` novo e z-index correto no SelectContent

