

## Plano: Lote final de correções no onboarding (revisado)

### 1) Proteção de fechamento no fluxo de Meta

**`src/components/budget-goal-form-sheet.tsx`**:
- Ler `currentStep` e `substepIndex` do contexto do onboarding.
- Calcular `isOnboardingGuarding = currentStep?.id === "add-budget-goal" && substepIndex >= índiceDe("budget-click-btn")`.
- No `<SheetContent>`: `onPointerDownOutside`, `onEscapeKeyDown` e `onInteractOutside` chamam `e.preventDefault()` quando `isOnboardingGuarding`.
- No `<Sheet onOpenChange>`: ignorar `open=false` quando `isOnboardingGuarding`.

### 2) Fechamento do Category Manager — eventos por contexto

**Identificar componentes**: `src/components/category-manager.tsx` (despesa), `src/components/income-category-manager.tsx` (entrada). Para despesa fixa/recorrente, verificar se há `recurring-category-manager.tsx` ou se reutiliza `category-manager` com prop de contexto.

**Estratégia**:
- Adicionar prop opcional `context?: "expense" | "recurring" | "income"` no `category-manager` (default `"expense"`).
- Mapa de eventos:
  - `expense` → `category-manager-closed`
  - `recurring` → `recurring-category-manager-closed`
  - `income` → `income-category-manager-closed`
- No `onOpenChange(false)` do `<Sheet>`, despachar `window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: { event: <evento_do_contexto> } }))` antes do `onClose`.
- `income-category-manager.tsx` despacha sempre `income-category-manager-closed` (componente dedicado).
- Atualizar callers do `category-manager` para passar `context="recurring"` quando aberto a partir do form de recorrente.

Garante que X, outside click, ESC e gesto disparem o evento correto para cada fluxo do onboarding.

### 3) Cancelamento/skip do PIN

- **`onboarding-steps.ts`**: adicionar `skipLabel: "Configurar depois"` no substep `settings-pin-info`.
- **`security-settings.tsx`**: no `onOpenChange(false)` do dialog de PIN sem submit, despachar `gastinho-onboarding-event` com `security-pin-cancelled`.
- **`use-onboarding-tour.tsx`**: listener para `security-pin-cancelled` que avança o substep (equivalente a skip).

### 4) Cleanup defensivo do AdMob em mudança de rota

**`src/App.tsx`**:
- `useEffect(() => { adBannerCoordinator.forceReleaseByPrefixes(["category-", "expense-form-", "income-form-", "budget-", "card-", "recurring-"]); }, [location.pathname])`.
- Locks legítimos em sheets que sobrevivem à navegação serão re-registrados pelo `useAdBannerLock` no novo render.
- Se `forceReleaseByPrefixes` não existir no `adBannerCoordinator`, adicionar método ou usar `forceRelease(prefix)` em loop.

### 5) Intro do Category Manager — target específico

**`category-manager.tsx`** e **`income-category-manager.tsx`**:
- Adicionar `data-onboarding="category-manager-header"` (ou `income-category-manager-header`) no `<SheetTitle>`.

**`onboarding-steps.ts`**:
- Substeps `*-category-manager-intro` trocam `targetSelector` de `category-manager-sheet` → `category-manager-header` (e equivalente para income).

### 6) Copies mais curtas

**`onboarding-steps.ts`**:
- `expense-category`: `"Abra a lista e escolha uma categoria. Para criar ou editar, toque em 'Gerenciar categorias'."`
- `reports-period`: `"Use o seletor para mudar o período dos relatórios."` (sem menção a Premium).

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/budget-goal-form-sheet.tsx` | `preventClose` por substep do onboarding |
| `src/components/category-manager.tsx` | Prop `context`; evento contextual em qualquer fechamento; `data-onboarding` no header |
| `src/components/income-category-manager.tsx` | Evento `income-category-manager-closed` em qualquer fechamento; `data-onboarding` no header |
| Callers do `category-manager` (recurring) | Passar `context="recurring"` |
| `src/components/security-settings.tsx` | Despachar `security-pin-cancelled` em cancelamento |
| `src/lib/onboarding/onboarding-steps.ts` | `skipLabel` no PIN; novos targets de intro; copies encurtadas |
| `src/hooks/use-onboarding-tour.tsx` | Listener para `security-pin-cancelled` |
| `src/services/admob-visibility-coordinator.ts` | Garantir método de release por prefixos (se necessário) |
| `src/App.tsx` | `useEffect([location.pathname])` chamando release por prefixos |

### Critérios de aceite

1. Sheet de meta protegido entre `budget-click-btn` e finalização. ✅
2. Cada fluxo (despesa/recorrente/entrada) recebe seu evento correto em qualquer forma de fechamento. ✅
3. PIN cancelado dispara evento + tem `skipLabel`. ✅
4. Route change limpa locks órfãos por prefixos conhecidos. ✅
5. Intro de categorias usa header específico, não sheet inteiro. ✅
6. Copies de `expense-category` e `reports-period` reduzidas. ✅
7. Sem regressões no restante do fluxo. ✅

