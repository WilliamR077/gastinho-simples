

## Plano Revisado: Corrigir Passo 3 + Implementar Passo 4 (Entradas)

### Ajustes solicitados incorporados

1. **Passo 3 sem "Prosseguir" extra**: Remover o substep `recurring-done` (completion). Quando `expense-submitted` chegar no `recurring-submit`, o `advanceSubstepInternal` verá que não há mais substeps e chamará `completeCurrentStep()` diretamente, avançando para o passo 4 automaticamente.

2. **Passo 4 — tipo de entrada como escolha real**: O substep `income-type-info` será do tipo `select` (não `info`), com `requiresValidation: true` no target `income-type-selector`. O onboarding só avança quando o usuário realmente selecionar um tipo no RadioGroup. Nenhum tipo é pré-selecionado durante o guided flow.

3. **"Pular esta etapa" persistido**: Criar chave localStorage `gastinho_skipped_steps`. Tanto o passo 3 ("Não tenho despesa fixa") quanto o passo 4 ("Pular esta etapa") salvam o step ID nessa chave. `checkExistingData()` lê essa chave e marca esses steps como concluídos.

---

### Mudanças por arquivo

#### 1. `src/lib/onboarding/onboarding-steps.ts`

**Passo 3** — Remover `recurring-done` (completion substep, linhas 656-663). O último substep fica sendo `recurring-submit`, e quando ele avança, `completeCurrentStep()` é chamado automaticamente.

**Passo 4** — Expandir `add-income` de 1 substep para ~15:

| Substep | Tipo | Target | Notas |
|---------|------|--------|-------|
| `income-intro` | info (sem target) | — | skipLabel: "Pular esta etapa" |
| `income-click-fab` | click | `fab-main-button` | autoAdvanceOnEvent: `fab-menu-opened` |
| `income-click-btn` | click | `fab-income-button` | autoAdvanceOnEvent: `income-form-opened` |
| `income-type-select` | select | `income-type-selector` | requiresValidation: true |
| `income-description` | fill | `income-description` | requiresValidation, focusTarget |
| `income-amount` | fill | `income-amount` | requiresValidation, focusTarget |
| `income-category` | click | `income-category-field` | autoAdvanceOnEvent: income-category-selected |
| `income-date` | info | `income-date` | condition: monthly/installment (DOM check) |
| `income-day-of-month` | select | `income-day-of-month` | condition: recurring (DOM check) |
| `income-installment-count` | fill | `income-installment-count` | condition: installment (DOM check) |
| `income-installment-date` | info | `income-installment-date` | condition: installment (DOM check) |
| `income-submit` | submit | `income-submit-btn` | autoAdvanceOnEvent: `income-submitted` |

Sem substep `completion` — ao salvar, `completeCurrentStep()` avança direto para passo 5.

#### 2. `src/hooks/use-onboarding-tour.tsx`

- **Skipped steps persistence**: Nova constante `SKIPPED_STEPS_KEY`. `skipCurrentStep` salva o ID no localStorage antes de chamar `completeCurrentStep()`. `checkExistingData()` lê essa chave e adiciona ao set de completed.
- **Guided flow expandido**: `isExpenseFormGuidedFlow` renomeado para `isFormGuidedFlow` (ou mantido e expandido) para incluir `add-income`. Novo `isIncomeFormReady()` que checa `income-type-selector`.
- **`FORM_SUBSTEP_START`**: Expandido para detectar `income-type-select` quando step é `add-income`.
- **Event listener**: Expandir handler para tratar `income-category-selected`, `category-manager-opened/closed` quando no step `add-income`.

#### 3. `src/components/unified-income-form-sheet.tsx`

- Aceitar prop `preventClose?: boolean`
- Adicionar `data-onboarding` em todos os campos:
  - RadioGroup div: `income-type-selector`
  - Descrição div: `income-description`
  - Valor div: `income-amount`
  - Categoria div: `income-category-field`
  - Data (Popover div): `income-date`
  - Dia do recebimento div: `income-day-of-month`
  - Parcelas div: `income-installment-count`
  - Primeira data parcela div: `income-installment-date`
  - Submit button: `income-submit-btn`
- `useEffect` para disparar `income-form-opened` quando `open === true` e target montado
- Disparar `income-submitted` no `handleSubmit` antes de fechar
- Dia do recebimento: se for Input type=number, ok; se virar Select, usar `z-[80]` no SelectContent
- **Tipo sem default durante onboarding**: Quando o step ativo for `add-income`, iniciar `incomeType` como `""` (nenhum selecionado) para forçar escolha real

#### 4. `src/components/floating-action-button.tsx`

- Adicionar `data-onboarding="fab-income-button"` no botão "Entrada" (linha 64-70)

#### 5. `src/pages/Index.tsx`

- Importar `isFormGuidedFlow` (ou verificar `isExpenseFormGuidedFlow` expandido)
- Passar `preventClose` ao `UnifiedIncomeFormSheet` quando no guided flow do passo 4
- Bloquear `onOpenChange(false)` durante guided flow de income (mesmo padrão de expense)

#### 6. `src/components/income-category-selector.tsx`

- Disparar eventos `income-category-selected` e `category-manager-opened`/`category-manager-closed` via `gastinho-onboarding-event` (mesmo padrão do expense category-selector)

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/onboarding/onboarding-steps.ts` | Remover `recurring-done`, expandir `add-income` com ~12 substeps |
| `src/hooks/use-onboarding-tour.tsx` | Skipped steps persistence, guided flow para income |
| `src/components/unified-income-form-sheet.tsx` | data-onboarding, preventClose, eventos, tipo sem default |
| `src/components/floating-action-button.tsx` | `data-onboarding="fab-income-button"` |
| `src/pages/Index.tsx` | preventClose no income sheet |
| `src/components/income-category-selector.tsx` | Disparar eventos de onboarding |

Nenhuma migração SQL.

