

## Plano: Refatoração completa do onboarding com microsteps declarativos

### Arquitetura

Substituir o sistema atual de "subPhase" genérico por um modelo declarativo de **steps + substeps**, onde cada substep define: alvo, tipo de ação, texto, condição de conclusão e placement do tooltip.

### Novos arquivos

**`src/lib/onboarding/onboarding-steps.ts`** — Configuração declarativa

Define tipos e configuração de todos os steps/substeps:

```typescript
type SubstepActionType = "navigate" | "click" | "fill" | "select" | "optional-group" | "submit" | "completion";

interface OnboardingSubstep {
  id: string;
  targetSelector?: string; // data-onboarding="..."
  actionType: SubstepActionType;
  title: string;
  description: string;
  emoji: string;
  placement?: "above" | "below" | "auto";
  // Completion rules
  autoAdvanceOnClick?: boolean;      // click: advance when target clicked
  autoAdvanceOnRoute?: string;       // navigate: advance when route matches
  requiresValidation?: boolean;      // fill: show "Próximo" button, enabled when valid
  validationFn?: (el: HTMLElement) => boolean; // check if input is valid
  autoAdvanceOnSubmit?: boolean;     // submit: advance via explicit event
  skipLabel?: string;                // optional: show skip button
  focusTarget?: boolean;             // auto-focus the target element
  scrollToTarget?: boolean;          // scrollIntoView before showing
  // Completion step specific
  repeatLabel?: string;
  proceedLabel?: string;
}

interface OnboardingStepConfig {
  id: string;
  detectionTable?: string;
  targetRoute?: string;
  substeps: OnboardingSubstep[];
}
```

**Etapa de Cartões — substeps concretos:**

1. `go-to-cards` — navigate, autoAdvanceOnRoute: "/cards"
2. `click-add-card` — click, target: `cards-add-btn`, autoAdvanceOnClick
3. `fill-card-name` — fill, target: `card-name-input`, requiresValidation (não vazio), focusTarget
4. `select-card-type` — select, target: `card-type-select`, autoAdvanceOnClick (com botão Próximo)
5. `fill-due-day` — fill, target: `card-due-day-input`, requiresValidation (1-31), condicional (só crédito)
6. `fill-close-days` — fill, target: `card-close-days-input`, requiresValidation (1-28), condicional
7. `optional-limit-color` — optional-group, target: `card-optional-section`, skipLabel: "Pular"
8. `submit-card` — submit, target: `card-submit-btn`, autoAdvanceOnSubmit
9. `card-created` — completion, repeatLabel: "Adicionar outro", proceedLabel: "Prosseguir"

---

**`src/hooks/use-onboarding-engine.tsx`** — Hook/Provider central (substitui use-onboarding-tour)

Estado principal:
- `currentStepIndex` — step principal (cards, expenses, etc.)
- `currentSubstepIndex` — substep dentro do step
- `isOpen`
- Funções: `advanceSubstep()`, `skipStep()`, `skipOnboarding()`, `repeatStep()`, `notifyEvent(eventName)`

Lógica do engine:
- Observa rota via `useLocation` para auto-advance de substeps `navigate`
- Usa `MutationObserver` para detectar quando target aparece no DOM
- `scrollIntoView({ behavior: "smooth", block: "center" })` antes de posicionar
- Recalcula posição via `requestAnimationFrame` loop (não setInterval)
- Expõe `notifyEvent("form-opened")`, `notifyEvent("card-submitted")` para componentes externos chamarem
- Cleanup: restaura z-index/position de elementos ao mudar substep

---

**`src/components/onboarding/onboarding-overlay.tsx`** — Overlay + Spotlight

- SVG mask com recorte no alvo (já existe, será extraído e melhorado)
- O alvo recebe `position: relative; z-index: 60` para ficar acima do overlay
- O overlay bloqueia cliques (`pointer-events: auto`) exceto no recorte
- Padding de 8px ao redor do alvo

**`src/components/onboarding/onboarding-tooltip.tsx`** — Tooltip posicionado

- Calcula posição via `getBoundingClientRect()` do alvo
- Placement auto: abaixo se cabe, senão acima
- Clamp para não sair da viewport (especialmente mobile)
- Conteúdo dinâmico baseado no `actionType`:
  - `fill`: mostra botão "Próximo" (disabled até validação)
  - `click/submit`: só texto instrucional
  - `optional-group`: botões "Pular" e "Continuar"
  - `completion`: botões "Adicionar outro" e "Prosseguir"
- Sempre mostra: "Passo X de Y", botão X (fechar), "Pular etapa"
- Seta visual (CSS triangle) apontando para o alvo

**`src/components/onboarding/onboarding-renderer.tsx`** — Componente principal

- Renderiza overlay + tooltip para substeps interativos
- Renderiza Dialog modal para substeps "navigate" e "completion"
- Substitui `<OnboardingTour />` no App.tsx

---

### Mudanças em `src/components/card-manager.tsx`

Adicionar `data-onboarding` em todos os alvos:

| Elemento | Atributo |
|----------|----------|
| Botão Adicionar | `data-onboarding="cards-add-btn"` |
| Input Nome | `data-onboarding="card-name-input"` |
| Select Tipo | `data-onboarding="card-type-select"` |
| Input Vencimento | `data-onboarding="card-due-day-input"` |
| Input Dias antes | `data-onboarding="card-close-days-input"` |
| Div limite+cor | `data-onboarding="card-optional-section"` |
| Botão Submit | `data-onboarding="card-submit-btn"` |

Eventos para o engine:
- Quando `showForm` muda para true → `notifyEvent("card-form-opened")`
- Após INSERT com sucesso → `notifyEvent("card-submitted")`

### Mudanças em `src/App.tsx`

- Trocar `OnboardingProvider` por novo provider
- Trocar `<OnboardingTour />` por `<OnboardingRenderer />`

### Arquivos removidos/obsoletos

- `src/components/onboarding-tour.tsx` — substituído por `onboarding-renderer.tsx`
- O hook `use-onboarding-tour.tsx` será reescrito como `use-onboarding-engine.tsx` (mesmo path para minimizar imports)

### Comportamento de recuperação

- Se o alvo sumir do DOM (usuário fechou formulário), o engine volta ao substep anterior relevante (ex: `click-add-card`)
- Se o alvo não aparecer em 3s, mostra fallback "O elemento não foi encontrado. Tente clicar manualmente."
- Fechar tutorial sempre disponível

### Responsividade

- Tooltip com `max-width: min(320px, calc(100vw - 32px))`
- Em mobile, quando teclado abre (viewport height diminui), reposicionar tooltip acima do campo
- `scrollIntoView` antes de cada substep com alvo

### Arquivos afetados (resumo)

| Arquivo | Ação |
|---------|------|
| `src/lib/onboarding/onboarding-steps.ts` | Criar — config declarativa |
| `src/hooks/use-onboarding-tour.tsx` | Reescrever — engine com substeps |
| `src/components/onboarding/onboarding-overlay.tsx` | Criar — overlay SVG |
| `src/components/onboarding/onboarding-tooltip.tsx` | Criar — tooltip posicionado |
| `src/components/onboarding-tour.tsx` | Reescrever — renderer principal |
| `src/components/card-manager.tsx` | Editar — data-onboarding + eventos |
| `src/components/tour-overlay.tsx` | Pode ser removido (substituído) |

