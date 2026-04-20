

## Plano: 3 refinamentos no onboarding (cartão, categorias, meta) + reforço de posicionamento

### 1) Copy do "Limite do Cartão (Opcional)"

**`src/lib/onboarding/onboarding-steps.ts`** — substep `optional-limit`:

```text
title: "Limite do Cartão (Opcional)",
description:
  "Se quiser, informe o limite do cartão para o app acompanhar quanto dele já foi usado nas suas compras.\n\nAssim, você consegue ver o consumo do limite e evitar gastos acima do valor disponível.",
```

### 2) Responsividade de "Gerenciar Categorias" + sticky footer

**`src/components/category-manager.tsx`**:

- **`CategoryRow` responsivo**: wrapper externo `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`. Linha principal (ícone + nome + badge) ganha `w-full sm:flex-1 min-w-0`. Bloco de ações ganha `self-end sm:self-auto shrink-0` — em mobile vai para 2ª linha; em sm+ fica à direita.
- **Zero clipping horizontal**: `SheetContent` com `overflow-hidden` + reduzir padding direito do `ScrollArea`.
- **Sticky footer**: reestruturar `SheetContent` em `flex flex-col`. Header fixo, `ScrollArea` com `flex-1 min-h-0`, footer `sticky bottom-0 border-t bg-background pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]` contendo o botão "Adicionar Categoria" (ou o form inline quando `showAddForm = true`). AdMob já silenciado via `useAdBannerLock`.

### 3) Meta: tooltip compacto + posicionamento garantido

**3.1 — Compact mode para meta:**

`src/components/onboarding-tour.tsx` — adicionar `"budget-"` ao `COMPACT_SUBSTEP_PREFIXES`. Reduz largura para 280px, padding e fonte automaticamente.

**3.2 — Copy curta de "Tipo de Limite":**

`src/lib/onboarding/onboarding-steps.ts` — substep `budget-type-info`:

```text
title: "Tipo de Limite",
description:
  "Você pode criar:\n\n📊 Limite mensal total — controla os gastos do mês inteiro\n📦 Limite por categoria — controla uma categoria específica\n\nPara começar, vamos usar Limite Mensal Total, que é o mais simples.",
```

**3.3 — Reforço de posicionamento (validação extra solicitada):**

Caso `compact` sozinho não baste em viewports estreitos, aplicar **dois reforços** para todos os substeps `budget-*` que tenham `targetSelector` (não os centralizados):

a) **Placement explícito por substep** em `onboarding-steps.ts`: definir `placement: "below"` (ou `"above"` quando o alvo está no rodapé do sheet) nos substeps de meta que destacam campos do form. Como o form de meta abre como sheet/dialog cobrindo a viewport, o alvo costuma ficar na parte superior — `placement: "below"` empurra o tooltip para baixo do campo.

b) **Offset maior em modo compact para meta** — em `onboarding-tooltip.tsx`, parametrizar o `gap` do cálculo de posição: quando `targetSelector` começa com indicação de meta, usar `gap = 24` em vez de `16`, dando mais respiro entre o highlight e o tooltip. Implementação: passar uma prop opcional `extraGap?: number` ou detectar via `substep.id?.startsWith("budget-")` dentro do `updatePosition`.

c) **Algoritmo de fallback**: já existe (linhas 119-122 do `onboarding-tooltip.tsx`) — escolhe o lado com menor `overlapArea`. Adicionar tolerância: se o melhor candidato ainda tiver `overlapArea > 0`, tentar deslocar o tooltip horizontalmente (left/right do alvo) antes de aceitar overlap. Implementação simples: após calcular acima/abaixo, se ambos sobrepõem, calcular candidato `left` (tooltip à esquerda do alvo) e `right` (à direita) e escolher o de menor overlap entre os 4.

Esses 3 reforços (a + b + c) garantem que mesmo em telas estreitas o tooltip não cubra o highlight da meta. Aplicados condicionalmente — não afetam outros steps.

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/onboarding/onboarding-steps.ts` | Copy de `optional-limit` e `budget-type-info`; `placement` explícito nos substeps `budget-*` com target |
| `src/components/category-manager.tsx` | `CategoryRow` responsivo (col em mobile, row em sm+); sticky footer com botão/form de adicionar; layout flex no SheetContent |
| `src/components/onboarding-tour.tsx` | Adicionar `"budget-"` ao `COMPACT_SUBSTEP_PREFIXES` |
| `src/components/onboarding/onboarding-tooltip.tsx` | Gap maior para substeps de meta; fallback horizontal (left/right) quando above/below sobrepõem |

### Critérios de aceite

1. Copy do limite do cartão explica acompanhamento de uso. ✅
2. Ícones de ação nunca cortados (quebra para 2ª linha em mobile). ✅
3. "Adicionar Categoria" sticky no rodapé. ✅
4. Sem clipping horizontal. ✅
5. Tooltip da meta compacto. ✅
6. Tooltip não cobre alvo: compact + placement + gap maior + fallback horizontal. ✅
7. Copy de "Tipo de Limite" curta e escaneável. ✅
8. Resultado mais responsivo e premium. ✅

