

## Plano: Corrigir Skip e Layout do Passo de Importação de Planilha

### Causa Raiz

**Bug 1 — Skip não funciona**: Na `onboarding-tour.tsx` linha 279, quando o substep tem `targetSelector` (como `settings-import` que aponta para `settings-import-card`), o `onSkipSubstep` é passado como `advanceSubstep` em vez de `handleSkipSubstep`. Isso significa que ao clicar "Não tenho planilha", o evento `settings-import-skipped` **nunca é disparado**, então o `condition` dos substeps seguintes (`settings-import-open` e `settings-import-done`) não detecta o skip — e o tutorial fica preso no botão de importar.

**Bug 2 — Botão grande**: O `navigateLabel: "Tenho planilha e quero importar"` é longo demais e renderiza como texto do botão "Continuar", estourando o card.

### Mudanças

#### 1. `src/components/onboarding-tour.tsx` (linha 279)
Trocar `onSkipSubstep={currentSubstep.skipLabel ? advanceSubstep : undefined}` por `onSkipSubstep={currentSubstep.skipLabel ? handleSkipSubstep : undefined}` — garantindo que o evento de skip seja disparado para substeps com target.

#### 2. `src/lib/onboarding/onboarding-steps.ts` (substep `settings-import`)
- Encurtar `navigateLabel` para `"Tenho planilha"` (ou `"Quero importar"`)
- Encurtar `skipLabel` para `"Não tenho"` (ou manter `"Não tenho planilha"` que já é ok)

#### 3. `src/components/onboarding/onboarding-tooltip.tsx` (linhas 222-233)
Adicionar `flex-wrap` ou `flex-col` no container dos botões quando ambos `skipLabel` e `navigateLabel` existem, para evitar overflow em telas menores.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/onboarding-tour.tsx` | Usar `handleSkipSubstep` para substeps com target |
| `src/lib/onboarding/onboarding-steps.ts` | Encurtar labels dos botões |
| `src/components/onboarding/onboarding-tooltip.tsx` | Layout responsivo nos botões |

