

## Plano: Corrigir Scroll/Travamento do Passo 2 no Formulário de Despesa

### Causa Raiz

Dois problemas combinados:

1. **`scrollIntoView` errado**: O `handleTargetAppeared()` em `use-onboarding-tour.tsx` (linha 239) chama `el.scrollIntoView({ behavior: "smooth", block: "center" })` diretamente no elemento. Quando o alvo está dentro de um Sheet (que é um container `fixed` com scroll próprio), o `scrollIntoView` tenta rolar o **body da página** em vez do container do Sheet, causando o deslocamento caótico.

2. **`document.body.style.overflow = "hidden"`**: O overlay do onboarding trava o scroll do body (linha 54-60 do `onboarding-overlay.tsx`). Isso conflita com o Sheet que já tem seu próprio mecanismo de scroll. O `scrollIntoView` tenta rolar algo que está travado, gerando comportamento imprevisível.

### Solução

Modificar `handleTargetAppeared()` para fazer scroll **dentro do container scrollável correto** (o Sheet) em vez de usar `scrollIntoView` no body.

---

### Mudança 1 — `src/hooks/use-onboarding-tour.tsx`

Reescrever `handleTargetAppeared()` (linhas 235-251):

```ts
function handleTargetAppeared(el: HTMLElement) {
  if (!currentSubstep) return;

  if (currentSubstep.scrollToTarget) {
    // Find the scrollable container (Sheet content, dialog, or fallback to viewport)
    const scrollContainer = el.closest('[data-radix-scroll-area-viewport], [role="dialog"], .overflow-y-auto, .overflow-auto');
    
    if (scrollContainer) {
      // Scroll within the container, not the page
      const containerRect = scrollContainer.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const relativeTop = elRect.top - containerRect.top + scrollContainer.scrollTop;
      const targetScroll = relativeTop - containerRect.height / 3;
      
      scrollContainer.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: "smooth",
      });
    } else {
      // No container found — use scrollIntoView but with "nearest" to minimize movement
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  if (currentSubstep.focusTarget) {
    setTimeout(() => {
      const input =
        el.tagName === "INPUT" || el.tagName === "TEXTAREA"
          ? el
          : el.querySelector("input, textarea, select");
      if (input) (input as HTMLElement).focus();
    }, 400);
  }
}
```

### Mudança 2 — `src/components/onboarding/onboarding-overlay.tsx`

Remover o lock de `document.body.style.overflow = "hidden"` (linhas 54-60). O Sheet já gerencia seu próprio scroll, e travar o body causa conflito. O bloqueio de cliques já é feito pelos 4 painéis, então não precisa travar scroll do body separadamente.

Substituir por: não fazer nada (remover o useEffect inteiro de overflow).

### Mudança 3 — Substep `expense-type-info` sem `scrollToTarget`

**`src/lib/onboarding/onboarding-steps.ts`** (linhas 203-211):

O substep `expense-type-info` é do tipo `info` com `targetSelector` e `scrollToTarget: true`. Ao avançar dele para `expense-description`, o `handleTargetAppeared` tenta fazer scroll para o campo description, mas o Sheet pode não ter estabilizado ainda.

Remover `scrollToTarget: true` do `expense-type-info` (é um info step, não precisa scroll) e adicionar um pequeno delay na transição. Na verdade, manter `scrollToTarget` nos substeps de `fill`/`select` mas garantir que o scroll use o container correto (já resolvido pela Mudança 1).

---

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/use-onboarding-tour.tsx` | Reescrever `handleTargetAppeared` para scroll dentro do container correto |
| `src/components/onboarding/onboarding-overlay.tsx` | Remover lock de `document.body.style.overflow` |

Nenhuma migração SQL. Nenhuma mudança nos outros passos.

