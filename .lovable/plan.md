

## Plano: Refinamento UX/UI do Tutorial Guiado (v3)

Versão final com as 2 garantias de segurança de implementação adicionadas.

---

### 1. Botões padronizados (passos 3, 4, 7)

**`src/components/onboarding/onboarding-tooltip.tsx`**
- Layout sempre `flex-col gap-3`, botões `h-12 text-base font-medium`.
- Hierarquia: principal `default`, secundário `outline`.
- `pb-[env(safe-area-inset-bottom)]` no wrapper.
- Aplicado a `info`, `optional-group`, `completion`, `navigate`.

---

### 2. Copy do passo 4 (`income-intro`)

**`src/lib/onboarding/onboarding-steps.ts`**

```text
Você pode registrar 3 tipos de entrada:

💰 Entrada do mês — freelance, venda ou bônus
🔄 Entrada fixa — salário ou valor recorrente
📑 Entrada parcelada — projetos/vendas em parcelas

Escolha no formulário a opção que combina com esta entrada.
```

`whitespace-pre-line` no `<p>` da descrição.

---

### 3. Subetapas progressivas no Tipo de Entrada — **Garantia 1 (lockTarget)**

**Arquivos:**
- `unified-income-form-sheet.tsx`: `data-onboarding` em cada `RadioGroupItem` (`income-type-monthly|recurring|installment`).
- `onboarding-steps.ts`: substituir 1 substep por 4 (3 `info` com `lockTarget: true`, 1 `select` final).
- `onboarding-overlay.tsx`: nova prop `lockTarget` renderiza camada `pointer-events: auto` sobre o recorte do alvo.

**Garantia adicional — recálculo da camada bloqueadora:**
- A camada bloqueadora usa as mesmas coordenadas do `targetRect` que já é atualizado via `requestAnimationFrame` loop existente (linhas 60-78 do overlay).
- Como o overlay já roda rAF contínuo enquanto visível, scroll/resize/reflow são cobertos automaticamente.
- Adicionar listeners explícitos `window.addEventListener("scroll", ..., { passive: true, capture: true })` e `window.addEventListener("resize", ...)` para forçar `updateRect()` imediato em eventos discretos (complemento ao rAF, garante resposta instantânea).
- Cleanup: remover ambos os listeners no `return` do `useEffect`.

---

### 4. Conclusão em 2 fases (sucesso → Premium)

**`onboarding-tour.tsx`**
- State `completionPhase: "success" | "premium"`.
- Tela 1: parabéns + lista, botão `h-12` "Continuar".
- Tela 2: benefícios + 2 botões `h-12` empilhados ("Conhecer Premium" / "Talvez depois").
- `pb-[env(safe-area-inset-bottom)]` no `DialogFooter`.
- Banner via `useAdBannerLock("onboarding-completion", showCompletionDialog)`.

---

### 5. Gerenciar Categorias — layout + tooltip compact

**`category-manager.tsx`**
- Linha de ações: `flex items-center gap-0.5 shrink-0`, row pai `min-w-0`, `pl-3 pr-1`.
- `ScrollArea pr-2`, sheet content `px-4`.
- `useAdBannerLock("category-sheet", isOpen)`.

**`onboarding-tooltip.tsx`** — modo `compact`:
- `maxWidth: 280px`, `p-3`, descrição `text-xs`, esconde "Pular etapa".
- Ativado quando `currentSubstep.id` começa com `expense-category-manager-`, `recurring-category-manager-` ou `income-category-manager-`.

---

### 6. Reset ao reabrir Gerenciar Categorias — **Garantia 2 (3 contextos)**

**`use-onboarding-tour.tsx`**

Mapa evento → substep de retomada:
```text
category-manager-opened           → expense-category-manager-intro
recurring-category-manager-opened → recurring-category-manager-intro
income-category-manager-opened    → income-category-manager-intro
```

Ao receber qualquer evento `*-opened` quando o respectivo `*-closed` já está em `seenEventsRef`:
1. Remove o `*-closed`.
2. Localiza índice do `*-intro` no `currentStep.substeps` (verifica `currentStep.id` para escolher o intro correto entre os 3).
3. `setSubstepIndex(intoIndex)` para rebobinar.

Cobre primeira abertura, reaberturas e os 3 fluxos.

---

### 7. Coordenador AdMob — **Garantia 3 + segurança de cleanup**

**Arquivo novo:** `src/services/admob-visibility-coordinator.ts`

```text
class AdBannerCoordinator {
  private reasons = new Set<string>();
  requestHide(reason: string)   // adiciona ao set + hideBanner()
  releaseHide(reason: string)   // remove; se set.size === 0 → showBanner()
  forceRelease(reasonPrefix?)   // limpa razões correspondentes (cleanup defensivo)
}
```

**Hook:** `useAdBannerLock(reason: string, active: boolean)`

**Garantias de cleanup:**
- `useEffect` chama `requestHide` quando `active === true`, `releaseHide` na cleanup function.
- A cleanup roda em: (a) `active` mudar para `false`, (b) `reason` mudar (libera a antiga, registra a nova), (c) **unmount do componente**, (d) **mudança de rota** (componente desmonta naturalmente; React garante cleanup).
- Garantia extra contra leak: usar `useRef` para guardar a `reason` realmente registrada e liberar exatamente ela na cleanup, mesmo se a prop `reason` mudar entre renders.
- Safety net global em `App.tsx`: `useEffect` que escuta `location.pathname` e, em cada navegação, chama `coordinator.forceRelease()` apenas para razões com prefixo `"route-scoped:"` (opcional, evita travas se algum lock esquecer cleanup). Locks de tutorial/sheet usam nomes neutros e não são afetados.

**Uso:**
- `category-manager.tsx`: `useAdBannerLock("category-sheet", isOpen)`.
- `onboarding-tour.tsx`: `useAdBannerLock("onboarding-completion", showCompletionDialog)`.
- `use-onboarding-tour.tsx`: `useAdBannerLock("onboarding-active", isActive && currentSubstepRequiresHidden)` — segunda camada quando substeps marcam `requiresBannerHidden: true`.

Banner só reaparece quando `reasons.size === 0`. Substituir todas as chamadas diretas a `adMobService.hideBanner/showBanner` na camada de UI por `useAdBannerLock`.

---

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/onboarding/onboarding-tooltip.tsx` | Botões h-12 empilhados, modo `compact`, `whitespace-pre-line` |
| `src/components/onboarding/onboarding-overlay.tsx` | `lockTarget` + listeners de scroll/resize com cleanup |
| `src/lib/onboarding/onboarding-steps.ts` | Copy do `income-intro`, 4 substeps de tipo de entrada |
| `src/components/unified-income-form-sheet.tsx` | `data-onboarding` em cada radio |
| `src/components/onboarding-tour.tsx` | Dialog em 2 fases, `useAdBannerLock` |
| `src/components/category-manager.tsx` | Layout responsivo, `useAdBannerLock` |
| `src/hooks/use-onboarding-tour.tsx` | Reset generalizado para os 3 contextos, `useAdBannerLock` |
| `src/services/admob-visibility-coordinator.ts` | **NOVO** — coordenador + hook com cleanup robusto |

Sem migração SQL, sem mudanças em edge functions.

---

### Critérios de aceite

1. Passos 3/4/7: botões grandes empilhados, sem toque acidental.
2. Passo 4: copy curto e escaneável.
3. Tipo de entrada: 3 highlights bloqueados (clique no radio inativo) + 4º substep libera seleção; bloqueio acompanha scroll/resize.
4. Conclusão: sucesso → Premium opcional, sem ad em ambas.
5. Gerenciar categorias (3 contextos): ícones visíveis, "Adicionar" sem ad cobrindo, tooltip compacto, reabertura volta para o intro correto em despesa/fixa/entrada.
6. Banner nunca reaparece com sheet/dialog/tutorial ativo; nenhum lock fica preso após unmount ou navegação.

