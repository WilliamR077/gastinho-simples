

## Plano: Auto-avanço em selects do tutorial

### Problema
Nos passos com campo select (tipo do cartão, forma de pagamento, selecionar cartão), o usuário precisa selecionar a opção **e depois** clicar "Próximo". São cliques desnecessários que tornam o tutorial arrastado.

### Solução
Adicionar uma nova propriedade `autoAdvanceOnSelect` nos substeps de tipo `select`. Quando ativa, o sistema detecta a mudança de valor no select e avança automaticamente após um breve delay (400ms para não parecer brusco), **sem mostrar botão "Próximo"**.

### Substeps afetados

| Passo | Substep ID | Campo |
|---|---|---|
| 1 — Cartão | `select-card-type` | Tipo do cartão |
| 2 — Despesa | `expense-payment` | Forma de pagamento |
| 2 — Despesa | `expense-card` | Selecionar cartão |
| 3 — Despesa Fixa | `recurring-payment` | Forma de pagamento |
| 3 — Despesa Fixa | `recurring-card` | Selecionar cartão |

**Não afetados**: `expense-installments` (parcelas), `recurring-day` (dia da cobrança) — mantêm botão "Próximo".

### Lógica de auto-avanço

1. Adicionar `autoAdvanceOnSelect?: boolean` na interface `OnboardingSubstep`
2. No `use-onboarding-tour.tsx`, criar um `MutationObserver` que observa o elemento target do substep atual quando `autoAdvanceOnSelect === true`
3. O observer monitora mudanças no texto do `[role="combobox"]` (trigger do Radix Select) — quando o texto muda de placeholder ("Selecione...") para um valor real, dispara `advanceSubstep()` após 400ms de delay
4. O delay evita avanço brusco e dá tempo para a animação de fechamento do dropdown

### Mudanças no tooltip

No `onboarding-tooltip.tsx`, quando o substep tem `autoAdvanceOnSelect: true`, **não renderizar** o bloco de botões "Próximo". O tooltip mostra apenas título + descrição, sem botão de ação — a seleção no dropdown é a ação.

### Garantia de não-regressão

- A propriedade é opt-in (`autoAdvanceOnSelect`), então substeps que não a definem continuam com botão "Próximo"
- O observer é limpo via cleanup do `useEffect`, evitando memory leaks
- A validação `isCurrentTargetValid` continua existindo para os substeps sem auto-avanço
- Substeps de `fill`, `click`, `submit`, `info`, `completion` não são afetados

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/onboarding/onboarding-steps.ts` | Adicionar `autoAdvanceOnSelect: true` nos 5 substeps listados + interface |
| `src/hooks/use-onboarding-tour.tsx` | MutationObserver para auto-avanço em selects com delay de 400ms |
| `src/components/onboarding/onboarding-tooltip.tsx` | Ocultar botão "Próximo" quando `autoAdvanceOnSelect` está ativo |

Nenhuma migração SQL.

