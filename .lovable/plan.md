

## Plano: Progressão dinâmica do onboarding com recálculo combinado

### Causa raiz

`completeCurrentStep()` em `src/hooks/use-onboarding-tour.tsx` avança via `stepIndex + 1`. Quando uma etapa antiga reabre (usuária deletou única entrada) e é refeita, o tour entra em uma etapa já concluída cuja UI mudou (ex.: meta com CTA de upgrade no lugar de "Adicionar Meta") e trava.

### Mudança 1 — Helper unificado `computeRealCompleted`

Combina **4 fontes** para nunca regredir:

```text
async function computeRealCompleted(justCompletedId?: string): Promise<Set<string>> {
  const result = new Set<string>();
  
  // 1. DB (estado real persistido)
  if (user) {
    const fromDb = await checkExistingData(user.id);
    fromDb.forEach((id) => result.add(id));
  }
  
  // 2. Skipped steps (localStorage SKIPPED_KEY)
  const skipped = JSON.parse(localStorage.getItem(SKIPPED_KEY) || "[]");
  skipped.forEach((id: string) => result.add(id));
  
  // 3. Step recém-concluído (ainda não refletido no DB)
  if (justCompletedId) result.add(justCompletedId);
  
  // 4. Progresso local válido (completedSteps em memória — cobre etapas
  //    concluídas nesta sessão que ainda não tenham dado persistido,
  //    ou cuja detecção via DB seja indireta)
  completedSteps.forEach((id) => result.add(id));
  
  return result;
}
```

União estrita: nada some. Critérios 1, 2, 3, 4, 7.

### Mudança 2 — `completeCurrentStep` async com busca do próximo pendente

```text
async function completeCurrentStep() {
  if (!currentStep) return;
  
  const justId = currentStep.id;
  const nextLocal = new Set([...completedSteps, justId]);
  setCompletedSteps(nextLocal);
  
  const real = await computeRealCompleted(justId);
  
  // Procura adiante; se não achar, do início (cobre etapa reaberta no meio)
  const findNextPending = (fromIdx: number) =>
    availableSteps.findIndex((s, idx) => idx >= fromIdx && !real.has(s.id));
  
  let nextIdx = findNextPending(stepIndex + 1);
  if (nextIdx === -1) nextIdx = findNextPending(0);
  
  if (nextIdx === -1) {
    setIsOpen(false);
    setShowCompletionDialog(true);
    localStorage.setItem(STORAGE_KEY, "true");
    localStorage.removeItem(PROGRESS_KEY);
    return;
  }
  
  setStepIndex(nextIdx);
  setSubstepIndex(0);
  setPendingAdvance(null);
  seenEventsRef.current.clear();
  
  const nextStep = availableSteps[nextIdx];
  if (nextStep.targetRoute && nextStep.targetRoute !== location.pathname) {
    navigate(nextStep.targetRoute);
  }
}
```

Critério 6.

### Mudança 3 — Revalidação ao trocar de step

`useEffect([stepIndex, isOpen])`:
- Chama `computeRealCompleted()` (sem `justCompletedId`).
- Se `currentStep.id ∈ real` E não está no índice anteriormente validado → pula automaticamente para o próximo pendente via mesma lógica.
- Guard de loop: `useRef<number | null>` armazena último `stepIndex` revalidado; só roda uma vez por índice.

Critério 3.

### Mudança 4 — Fallback no observer de target ausente

No `MutationObserver` que aguarda target (linhas ~134-167), no `setTimeout` de 10s:
- Se target não apareceu, chama `computeRealCompleted()`.
- Se `currentStep.id ∈ real` (ex.: `budget_goals` já tem registro mas botão virou upgrade CTA) → trata como concluído via `completeCurrentStep()`.
- Senão → mantém usuário no step (tooltip permite "Pular").

Critérios 4, 5.

### Mudança 5 — `skipCurrentStep`, `proceedToNextStep`

Já chamam `completeCurrentStep()` no final → herdam toda a lógica nova. `repeatStep` só altera `substepIndex` → não afeta.

### Mudança 6 — `startOnboarding`

Já busca primeiro pendente via `findIndex(!preCompleted.has(s.id))` (linha 706). Atualizar para usar `computeRealCompleted()` também, garantindo consistência (skipped + DB + local) na inicialização.

### Por que combinar 4 fontes (não só DB)

- **Só DB**: skipped reaparecem (usuária pula passo que não quer fazer → volta no DB vazio).
- **Só completedSteps local**: perde DB ao reload (state reseta, etapa antiga concluída antes do reload some).
- **Só skipped + DB**: etapa recém-concluída pode não estar no DB ainda (latência de write/read) → reentra na mesma etapa.
- **União das 4**: monotonicamente crescente dentro de uma sessão; nunca regride.

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/use-onboarding-tour.tsx` | Novo helper `computeRealCompleted`; `completeCurrentStep` async; `useEffect` de revalidação por `stepIndex`; fallback de 10s no observer; `startOnboarding` usando o helper |

Sem mudanças em sheets, steps, tooltip ou DB.

### Critérios de aceite (mapeados)

1. Etapa antiga reaberta: `startOnboarding` + `computeRealCompleted` cobrem. ✅
2. Concluir recalcula via união das 4 fontes. ✅
3. Steps já concluídos pulados: `useEffect` de revalidação. ✅
4. Target ausente: fallback de 10s + DB → conclui ou mantém com "Pular". ✅
5. Limite de plano: `budget_goals` no DB faz step ser pulado antes de tentar abrir. ✅
6. Sempre próximo **incompleto**, nunca `+1` cego. ✅
7. Tudo completo → `completion dialog` + `STORAGE_KEY`. ✅

