

## Plano: Corrigir Bugs do Tutorial de Configuração de Conta

### Diagnóstico Raiz

**Bug principal (steps pulando do 2 ao 7):** Os passos 2-6 (categorias, despesas, despesas fixas, receitas, metas) todos têm um único substep com `autoAdvanceOnRoute: "/"`. Quando o usuário já está na rota `/`, o `useEffect` de route-based auto-advance dispara imediatamente, completando o passo e pulando para o próximo. Isso cascata por todos os passos que apontam para `/`, até chegar no passo 7 (importar planilha) que aponta para `/settings`.

**Bug do Select:** O overlay do onboarding tem `z-[55]` e `pointer-events-auto`. O `SelectContent` renderiza via Portal com `z-50`, ficando atrás do overlay. As opções do dropdown ficam bloqueadas.

**Bug do "Limite e Cor":** O `data-onboarding="card-optional-section"` só envolve o campo de limite, não inclui a área de cores.

---

### Correção 1 — Select/Dropdown visível durante o tour

**`src/components/onboarding/onboarding-overlay.tsx`**

O overlay SVG captura todos os cliques. Preciso garantir que elementos de Portal (SelectContent, PopoverContent) fiquem acima do overlay.

Solução: Aumentar o z-index do SelectContent para ficar acima do overlay (z-55) quando o onboarding está ativo.

**`src/components/ui/select.tsx`**: Mudar `z-50` para `z-[70]` no SelectContent. Isso garante que o dropdown do Select fique acima do overlay (z-55) e do tooltip (z-65). Essa mudança é segura porque o Select já renderiza via Portal.

### Correção 2 — Separar "Limite" e "Cor" em dois substeps

**`src/lib/onboarding/onboarding-steps.ts`**

Substituir o substep `optional-limit-color` por dois substeps:

1. `optional-limit` — `actionType: "optional-group"`, `targetSelector: "card-limit-input"`, título "Limite do Cartão (Opcional)", skipLabel "Pular"
2. `select-card-color` — `actionType: "optional-group"`, `targetSelector: "card-color-picker"`, título "Cor do Cartão", sem skip (sempre continuar)

**`src/components/card-manager.tsx`**

- Mover `data-onboarding="card-optional-section"` → trocar por `data-onboarding="card-limit-input"` no div do limite
- Adicionar `data-onboarding="card-color-picker"` no div da escolha de cor

### Correção 3 — Proteção contra duplo submit

**`src/components/card-manager.tsx`**

- Adicionar state `submitting` (boolean)
- No `handleSubmit`: setar `submitting = true` no início, `false` no finally
- No botão submit: `disabled={submitting}`, texto "Salvando..." quando submitting

### Correção 4 — Mensagem inteligente no completion do cartão

**`src/lib/onboarding/onboarding-steps.ts`**

No substep `card-created` (completion), adicionar uma `condition` ou mudar a `description` para ser dinâmica.

Abordagem mais simples: no `src/components/onboarding-tour.tsx`, quando renderizar o completion do passo `add-card`, verificar quantos cartões o usuário tem e o limite do plano, e sobrescrever a description do tooltip com a mensagem correta. Exemplo: "Você ainda pode adicionar mais 1 cartão no plano gratuito." ou "Você atingiu o limite de cartões do plano gratuito."

Na prática, isso será feito no `OnboardingTooltip` ou diretamente no `onboarding-tour.tsx` passando uma description customizada quando `currentStep.id === "add-card"` e `substep.actionType === "completion"`.

### Correção 5 — Refazer substeps dos passos 2-6 (BUG PRINCIPAL)

**`src/lib/onboarding/onboarding-steps.ts`**

O problema é que os passos 2-6 têm apenas um substep "navigate" que auto-avança quando já está na rota `/`. Preciso:

1. **Remover `autoAdvanceOnRoute`** desses substeps (não devem auto-avançar por rota)
2. **Mudar o `actionType`** para que o usuário clique "Continuar" manualmente
3. Para o passo de categorias: navegar para `/` e depois ter um substep `click` apontando para o botão de configurações de categoria (preciso adicionar `data-onboarding` nesse botão)

**Passo 2 (add-category):** 
- Substep 1: `actionType: "navigate"`, sem autoAdvanceOnRoute, com `navigateTo: "/"`, `navigateLabel: "Ir para o app"`. O usuário clica e navega.
- Substep 2: `actionType: "click"`, `targetSelector: "category-settings-btn"`, título "Abra o Gerenciador de Categorias", auto-advance on event `category-manager-opened`

Preciso adicionar `data-onboarding="category-settings-btn"` no botão de configurações de categorias no `category-selector.tsx`.

**Passos 3-6 (despesas, fixas, receitas, metas):**
- Remover `autoAdvanceOnRoute: "/"` 
- Manter como `actionType: "navigate"` mas SEM auto-advance
- O usuário lê a instrução e clica "Continuar" para avançar manualmente
- Isso evita o pulo automático

### Correção 6 — Completion dialog dinâmico (resumo real)

**`src/components/onboarding-tour.tsx`**

O completion dialog atual tem lista hardcoded: `["Cartões configurados", "Primeira despesa registrada", "Metas definidas"]`.

Substituir por lista dinâmica baseada nos `completedSteps` reais do onboarding engine. Mapear cada step ID para um label legível:
- `add-card` → "Cartões configurados"
- `add-category` → "Categorias personalizadas"
- `add-expense` → "Primeira despesa registrada"
- `add-recurring-expense` → "Despesas fixas cadastradas"
- `add-income` → "Primeira receita registrada"
- `add-budget-goal` → "Meta de gastos definida"

Mostrar check verde para os concluídos, e ícone cinza/vazio para os não concluídos.

### Correção 7 — "Continuar configuração" retoma do passo certo

**`src/hooks/use-onboarding-tour.tsx`**

A função `startOnboarding()` já faz `findIndex(s => !preCompleted.has(s.id))` para encontrar o primeiro passo pendente. Mas o bug é que ao abrir, os passos auto-avançam pela rota. Com a correção 5 (remover autoAdvanceOnRoute dos passos 2-6), isso será resolvido automaticamente.

Verificar também que ao retomar, o `substepIndex` é resetado para 0, o que está correto.

### Correção 8 — Consistência de progresso

Com as correções 5 e 6, o progresso passará a ser consistente porque:
- Os passos não serão mais pulados incorretamente
- O `checkExistingData()` continua verificando dados reais no banco
- O completion dialog mostrará apenas o que foi realmente concluído

---

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/ui/select.tsx` | z-50 → z-[70] no SelectContent |
| `src/lib/onboarding/onboarding-steps.ts` | Separar limite/cor, refazer substeps dos passos 2-6 |
| `src/components/card-manager.tsx` | data-onboarding no limite e cor separados, proteção duplo submit |
| `src/components/category-selector.tsx` | Adicionar data-onboarding no botão de categorias |
| `src/components/onboarding-tour.tsx` | Completion dialog dinâmico, mensagem inteligente cartão |
| `src/hooks/use-onboarding-tour.tsx` | Nenhuma mudança estrutural (correções vêm dos steps) |

Nenhuma migração SQL necessária.

