

## Plano: Corrigir fechamento do "Nova Entrada" + validação do início do fluxo

### Mudança principal

**`src/hooks/use-onboarding-tour.tsx`** — bloco `FORM_SUBSTEP_START` para `add-income`:

Antes apontava para `income-type-select` (4º). Agora aponta para o primeiro substep que exige form aberto: `income-type-info-monthly` (ou `income-type-select` como fallback se os info substeps não existirem).

```text
if (currentStep?.id === "add-income") {
  const candidates = ["income-type-info-monthly", "income-type-select"];
  const firstFormIdx = currentStep.substeps.findIndex(s => candidates.includes(s.id));
  return firstFormIdx >= 0 ? firstFormIdx : currentStep.substeps.length;
}
```

### Validação: o ajuste afeta o início do fluxo antes do sheet abrir?

Antes de `income-type-info-monthly`, o step `add-income` tem substeps que abrem o FAB e clicam em "Entrada":
- `add-income-fab` (clicar no FAB) — `actionType: "click"`, target fora do sheet
- `add-income-pick-income` (escolher "Entrada" no menu do FAB) — `actionType: "click"`, target fora do sheet

Esses 2 substeps ficam **antes** do novo `FORM_SUBSTEP_START`, então:
- `isFormGuidedFlow === false` → `preventClose` no sheet permanece `false` (o sheet ainda nem está montado, então é irrelevante)
- A guarda em `Index.tsx` (`if (!open && isExpenseFormGuidedFlow && currentStep?.id === "add-income") return`) **não dispara**, permitindo que o FAB e o menu funcionem normalmente
- `isFormReady()` continua retornando `false` para esses substeps (eles não dependem do form), então `pendingAdvance` não bloqueia o avanço

Resultado: o início do fluxo (FAB → menu → abrir sheet) permanece idêntico. O `preventClose` só passa a valer a partir do momento em que o sheet já está aberto e o tutorial entra no primeiro substep informativo dentro dele.

### Reforço defensivo extra

Para eliminar qualquer risco de o `preventClose` ativar **antes** do sheet abrir (caso de race condition entre o avanço de substep e a montagem do sheet), adicionar uma checagem mínima em `isFormGuidedFlow` ou no consumidor:

- Manter `isFormReady()` como guarda dupla: enquanto `isFormReady()` retornar `false` para um substep `>= FORM_SUBSTEP_START`, o `pendingAdvance` aguarda o target real aparecer (via `MutationObserver`).
- Isso garante que mesmo se o substep avançar para `income-type-info-monthly` antes do sheet terminar de montar, o spotlight só calcula o highlight quando `[data-onboarding="income-type-monthly"]` existir no DOM.

Sem mudanças adicionais necessárias — a infraestrutura existente cobre esse caso.

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/use-onboarding-tour.tsx` | `FORM_SUBSTEP_START` do `add-income` aponta para `income-type-info-monthly` |

Sem mudanças em sheet, steps, tooltip ou overlay.

### Critérios de aceite

1. FAB → "Entrada" continua funcionando normalmente (substeps fora do form não afetados).
2. Sheet abre e permanece aberto durante os 3 substeps `income-type-info-*` (preventClose ativo).
3. "Continuar" em cada info substep só avança o substep, sem fechar o sheet.
4. Highlights mudam entre os 3 radios sem desmontar o sheet.
5. `income-type-select` final libera a seleção real.
6. Se houver atraso na montagem do sheet, `pendingAdvance` + `MutationObserver` aguardam o target.

