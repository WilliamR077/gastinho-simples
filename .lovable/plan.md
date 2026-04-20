

## Plano: 4 ajustes finais no onboarding

### 1) Intro de "Gerenciar Categorias" — info sem spotlight restritivo

**Problema:** os 6 substeps `*-category-manager-*` usam `actionType: "info"` com `targetSelector` apontando para `category-manager-header` (intro) ou para os botões individuais. O overlay aplica spotlight focado nesses targets pequenos, deixando o resto da tela escurecido e bloqueado para clique.

**Solução:** introduzir uma nova flag `noSpotlight?: boolean` em `OnboardingSubstep` que, quando `true`:
- Renderiza o tooltip ancorado ao target (mantém o `targetSelector` para posicionamento), mas
- **Não renderiza o `OnboardingOverlay`** (sem dark mask, sem painéis bloqueantes ao redor).
- Mantém a tela inteira do sheet interativa.

**Aplicação:** marcar `noSpotlight: true` apenas nos substeps introdutórios:
- `expense-category-manager-intro`
- `recurring-category-manager-intro`
- `income-category-manager-intro`

Os substeps que apontam para botões específicos (edit/hide/delete/add/close) continuam com spotlight — esses precisam mostrar exatamente onde clicar.

**Arquivos:**
- `src/lib/onboarding/onboarding-steps.ts` — adicionar flag no tipo + marcar nos 3 intros
- `src/components/onboarding-tour.tsx` — bypass do `OnboardingOverlay` quando `noSpotlight === true`

### 2) Teclado abrindo sozinho no mobile

**Causa raiz identificada:** `use-onboarding-tour.tsx` (linhas 557-565) chama `(input as HTMLElement).focus()` em qualquer substep com `focusTarget: true`. No mobile, `.focus()` em `<input>` faz o teclado virtual subir.

Substeps com `focusTarget: true` afetados: `fill-card-name`, `fill-due-day`, `fill-close-days`, `expense-description`, `expense-amount`, `recurring-description`, `recurring-amount`, `income-description`, `income-amount`, `recurring-due-day`, `recurring-day-of-month`, `budget-amount`.

Esses são substeps de **preenchimento real** — faria sentido focar no desktop, mas no mobile o teclado encobre o tooltip e o campo. Solução:

**Detectar mobile e suprimir focus automático:**
- Em `use-onboarding-tour.tsx` linha 557, antes do `setTimeout`, verificar `window.matchMedia("(pointer: coarse)").matches` ou checar `'ontouchstart' in window`.
- Se mobile/touch → **não chamar `.focus()`**. O usuário toca no campo manualmente quando estiver pronto.
- No desktop mantém o comportamento atual.

Adicionalmente, **remover `autoFocus`** dos inputs de edição inline em `category-manager.tsx` (linha 229) e `income-category-manager.tsx` (linha 163). No mobile, abrir uma categoria para editar não deve subir teclado automaticamente.

**Arquivos:**
- `src/hooks/use-onboarding-tour.tsx` — guard `isTouchDevice` antes do focus
- `src/components/category-manager.tsx` — remover `autoFocus`
- `src/components/income-category-manager.tsx` — remover `autoFocus`

### 3) Tooltip de "Tipo de Limite" cobrindo o campo

**Contexto:** `budget-type-info` aponta para `goal-type-select`. Está em compact mode (prefixo `budget-`), com `gap = 24` e fallback horizontal já implementado. Mesmo assim cobre.

**Causa provável:** o `<SheetContent>` da meta tem altura limitada — `goal-type-select` fica próximo ao centro vertical. O algoritmo escolhe "below" (preferência do `placement: "below"`), mas no viewport mobile o espaço abaixo do select é insuficiente, então o tooltip é "clamped" e termina sobreposto.

**Solução em duas camadas:**

**A) Adicionar `forceCompactPlacement` ou estender o algoritmo de fallback:** quando o substep tem prefixo `budget-` E é `info` (não exige interação no target), priorizar o lado com **menos overlap absoluto**, mesmo que isso signifique posicionar o tooltip acima do alvo perto da borda do sheet.

Mais simples e cirúrgico: **alterar `placement` de `budget-type-info` para `"above"`** (o select fica perto do topo do form sheet — há mais espaço acima/no header da própria sheet do que abaixo, especialmente porque os campos `goal-amount-input` e `goal-submit-btn` ficam logo abaixo dele e empurram o tooltip).

**B) Reforço no algoritmo:** em `onboarding-tooltip.tsx`, quando `isBudgetSubstep && actionType === "info"` (substep não exige clique no target, apenas explica), aumentar ainda mais o `gap` (32px) e priorizar o candidato horizontal (`left`/`right`) se ambos vertical sobrepõem mesmo após clamp.

Vou aplicar ambas: trocar placement para `"above"` no substep + reforço algorítmico para casos similares.

**Arquivos:**
- `src/lib/onboarding/onboarding-steps.ts` — `budget-type-info`: `placement: "above"`
- `src/components/onboarding/onboarding-tooltip.tsx` — gap 32 + bias horizontal para budget info substeps

### 4) Fechar sheet de meta antes de iniciar Relatórios

**Causa raiz:** ao chegar em `budget-submit`, `isOnboardingGuarding === true` (substep ≥ `budget-click-btn`), então `handleFormSubmit` chama `onOpenChange(false)` mas o `handleOpenChange` **bloqueia o fechamento** (linha 106). O sheet fica aberto.

Em paralelo, o evento `goal-submitted` dispara → `completeCurrentStep("add-budget-goal")` → próximo step `view-reports` começa imediatamente, com `reports-nav-button` no header sendo destacado, mas o sheet de meta ainda na frente.

**Solução:** o `isOnboardingGuarding` deve **liberar o fechamento após o submit** ter sido confirmado. Duas opções:

**A) Em `BudgetGoalFormSheet.handleFormSubmit`:** após `onSubmit(...)`, forçar fechamento ignorando o guard. Como o submit é a saída legítima, não há risco de "fechamento prematuro".

Implementação: adicionar uma flag local `isSubmittingRef` ou simplesmente chamar `onOpenChange(false)` direto via uma prop "force close" — mais limpo: dentro do `handleFormSubmit`, chamar uma função que pula o guard.

Solução mais simples e direta: separar o fechamento do submit do fechamento por gesto. Em `handleFormSubmit`, em vez de `onOpenChange(false)` (que passa pelo guard via `<Sheet onOpenChange>`), chamar `onOpenChange(false)` direto na prop pai (`Index.tsx`). Como `handleOpenChange` é só usado no `<Sheet onOpenChange>`, a chamada direta da função pai já bypassa o guard.

Inspecionando: `handleFormSubmit` chama `onOpenChange(false)` que **é a prop direta**, então já bypassa `handleOpenChange`. ✅ A prop pai recebe `false` e fecha o sheet — `Index.tsx` linha 2347 faz `setBudgetGoalSheetOpen(open)` direto.

**Então o sheet DEVE fechar.** O problema real é **timing**: o `view-reports` step começa antes do React re-renderizar com sheet fechado. O highlight aparece sobre o sheet ainda visível por 1-2 frames.

**Solução real — atrasar a transição:** após `goal-submitted`, aguardar o sheet desmontar antes de avançar para o próximo step. Em `use-onboarding-tour.tsx`, no handler que processa `goal-submitted`/`completeCurrentStep` para `add-budget-goal`, adicionar:

- Aguardar `requestAnimationFrame` duplo (próximo paint após state update) **e** aguardar até `getReadyTargetElement("goal-amount-input")` retornar `null` (sheet desmontou) antes de chamar `setStepIndex`.

Implementação prática: em `completeCurrentStep`, quando `justId === "add-budget-goal"`, aguardar até 500ms em loop verificando se o sheet sumiu, antes de avançar para `view-reports`.

Alternativa mais simples e robusta: adicionar um `setTimeout` de ~300ms entre o `completeCurrentStep` para `add-budget-goal` e a ativação do próximo step. Suficiente para a animação de close do `<Sheet>` (Radix usa ~300ms padrão).

**Vou aplicar:** wait loop polling (até 600ms) por desmontagem do sheet de meta antes de avançar `stepIndex`.

**Arquivos:**
- `src/hooks/use-onboarding-tour.tsx` — em `completeCurrentStep`, quando `justId === "add-budget-goal"`, aguardar sheet desmontar antes de incrementar `stepIndex`

### Tabela de arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/onboarding/onboarding-steps.ts` | Tipo `OnboardingSubstep.noSpotlight?: boolean`; marcar 3 intros do category manager; mudar `budget-type-info.placement` para `"above"` |
| `src/components/onboarding-tour.tsx` | Bypass do `OnboardingOverlay` quando `noSpotlight === true` (renderiza só o tooltip) |
| `src/components/onboarding/onboarding-tooltip.tsx` | Gap 32px + bias horizontal para `info` substeps de budget |
| `src/hooks/use-onboarding-tour.tsx` | Guard `isTouchDevice` antes do `.focus()` automático; aguardar sheet de meta desmontar antes de avançar para `view-reports` |
| `src/components/category-manager.tsx` | Remover `autoFocus` do input de edição |
| `src/components/income-category-manager.tsx` | Remover `autoFocus` do input de edição |

### Critérios de aceite

1. Intros de "Gerenciar Categorias" sem spotlight restritivo — tela inteira interativa. ✅
2. Teclado não sobe sozinho no mobile em nenhum substep. ✅
3. Tooltip de "Tipo de Limite" não cobre o campo `goal-type-select`. ✅
4. Sheet de meta fecha antes do highlight de relatórios aparecer. ✅
5. Sem regressão nos demais fluxos (forms continuam funcionais; spotlight em substeps específicos continua firme). ✅

