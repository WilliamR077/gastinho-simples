

## Plano: Correções P0/P1/P2 no Tutorial de Configuração

### BUG 1 — Transição Passo 1 → Passo 2 (P0)

**Causa raiz**: `completeCurrentStep()` (linha 511-514 de `use-onboarding-tour.tsx`) navega para `nextStep.targetRoute` se definido, mas `add-expense` não tem `targetRoute` definido. O usuário fica na tela de cartões (`/cards`) e o passo 2 tenta encontrar `fab-main-button` que só existe na home (`/`).

**Correção**: No `completeCurrentStep()`, quando o próximo step não tem `targetRoute` e a rota atual não é `/`, navegar para `/` antes de iniciar o passo. Alternativa mais simples e cirúrgica: adicionar `targetRoute: "/"` na definição do step `add-expense` em `onboarding-steps.ts`.

**Arquivo**: `src/lib/onboarding/onboarding-steps.ts` — adicionar `targetRoute: "/"` ao step `add-expense`.

---

### BUG 2 — Validação "Forma de Pagamento" (P0)

**Causa raiz**: `isCurrentTargetValid` (linha 688-698 de `use-onboarding-tour.tsx`) para selects verifica `val !== "Selecione"`, mas o placeholder é "Selecione a forma de pagamento" — que é diferente de "Selecione", passando a validação incorretamente.

**Correção**: Mudar a verificação para `!val.startsWith("Selecione")` ou verificar se o placeholder text contém "Selecione". Mais robusto: checar se o `data-placeholder` attribute existe no trigger ou se o valor do combobox contém a palavra "Selecione" (case-insensitive startsWith).

**Arquivo**: `src/hooks/use-onboarding-tour.tsx` — alterar a validação de select na função `isCurrentTargetValid`.

---

### MELHORIA 3 — Botão "Voltar" nos formulários (P1)

**Implementação**:

1. Adicionar `goBackSubstep` ao context do onboarding em `use-onboarding-tour.tsx`:
   - Volta para `substepIndex - 1`, pulando substeps cujo `condition` retorna false (buscando para trás)
   - Só disponível quando `substepIndex > FORM_SUBSTEP_START` (dentro do formulário)

2. Expor `goBackSubstep` e um flag `canGoBack` no context

3. Na `onboarding-tooltip.tsx`, adicionar prop `onBack` e renderizar botão "Voltar" quando fornecido, ao lado esquerdo dos botões de ação (para actionTypes `fill`, `select`, `info`, `optional-group`)

4. Na `onboarding-tour.tsx`, passar `onBack={canGoBack ? goBackSubstep : undefined}` ao tooltip quando em guided form flow

**Arquivos**: `src/hooks/use-onboarding-tour.tsx`, `src/components/onboarding/onboarding-tooltip.tsx`, `src/components/onboarding-tour.tsx`

---

### MELHORIA 4 — Expandir ícones de categorias (P2)

**Arquivo**: `src/components/category-manager.tsx` e `src/components/income-category-manager.tsx`

Atual: 36 emojis em `EMOJI_OPTIONS`. Expandir para ~70+ com emojis relevantes para finanças pessoais:

Adicionar: 🍽️ (refeição), 🥗 (almoço saudável), 🍳 (café da manhã), 🧃 (bebida), ⛽ (combustível), 🚕 (taxi/uber), 🚍 (ônibus), 🏍️ (moto), 🧾 (conta/taxa), 💡 (luz/energia), 💧 (água), 📡 (internet), 📺 (TV/streaming), 🏫 (escola), 👶 (criança), 🐾 (pet), 💍 (joias/presente), 🛍️ (compras), 📦 (delivery), 🏗️ (reforma), 🔑 (aluguel), 🧹 (limpeza), 🧴 (higiene), 💄 (beleza), 🎂 (festa), 🎄 (natal), 🏸 (esporte), 🎾 (tênis), 🎒 (material escolar), 💉 (vacina/saúde), 🦷 (dentista), 👓 (ótica), 🧥 (roupas), 👟 (calçados)

---

### MELHORIA 5 — Expandir cores de cartões (P2)

**Arquivo**: `src/components/card-manager.tsx`

Atual: 8 cores em `availableColors`. Expandir para ~16 com cores visualmente distintas e legíveis no dark mode:

Adicionar: Ciano (#06B6D4), Lima (#84CC16), Amber (#F59E0B), Teal (#14B8A6), Fúcsia (#D946EF), Slate (#64748B), Sky (#0EA5E9), Emerald (#059669)

---

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/onboarding/onboarding-steps.ts` | `targetRoute: "/"` no step `add-expense` |
| `src/hooks/use-onboarding-tour.tsx` | Fix validação select + `goBackSubstep` + `canGoBack` |
| `src/components/onboarding/onboarding-tooltip.tsx` | Prop `onBack` + botão "Voltar" |
| `src/components/onboarding-tour.tsx` | Passar `onBack` ao tooltip |
| `src/components/category-manager.tsx` | Expandir `EMOJI_OPTIONS` |
| `src/components/income-category-manager.tsx` | Expandir `EMOJI_OPTIONS` |
| `src/components/card-manager.tsx` | Expandir `availableColors` |

Nenhuma migração SQL.

