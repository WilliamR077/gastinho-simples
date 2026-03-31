
## Plano: Corrigir Travamento em Relatórios + Liberar Cashflow/Evolução no Gratuito Mensal

### Causa Raiz do Travamento

O `isOnboardingTargetReady` em `target-utils.ts` rejeita elementos com `data-state="closed"` quando detecta que são tipo accordion (verifica `data-orientation`). O Radix AccordionItem recebe `data-orientation` do provider, então AccordionItems fechados (cashflow, evolution, top-expenses, etc.) são rejeitados como "not ready". O `getReadyTargetElement` retorna `null`, o engine faz `queuePendingAdvance`, o MutationObserver espera 10s e morre. Tour trava.

A ironia: o `handleTargetAppeared` TEM a lógica de auto-abrir accordions fechados, mas nunca é chamado porque o elemento é rejeitado antes.

### Mudanças

#### 1. `src/lib/onboarding/target-utils.ts` — Corrigir rejeição de AccordionItem

Quando `closedAncestor === el` (o próprio elemento é o AccordionItem fechado), **não rejeitar**. O header/trigger do AccordionItem é visível mesmo quando fechado. Só rejeitar quando o elemento está **dentro** de um accordion fechado (descendente do content).

```typescript
if (closedAncestor && closedAncestor !== el) {
  // Only reject descendants of closed accordions, not the item itself
  ...
}
```

Isso permite que `getReadyTargetElement` encontre AccordionItems fechados, `handleTargetAppeared` roda, auto-abre, e o tour continua.

#### 2. `src/components/reports-accordion.tsx` — Liberar Cashflow e Evolução no mensal

Atualmente usa `hasAdvancedReports` para decidir se mostra o gráfico ou o lock. A prop `periodType` já está disponível. Mudar a lógica:

```typescript
const showCashflowChart = hasAdvancedReports || periodType === "month";
const showEvolutionChart = hasAdvancedReports || periodType === "month";
```

- Remover o ícone Crown do trigger quando desbloqueado
- Usar `showCashflowChart` em vez de `hasAdvancedReports` no content
- Manter o lock apenas para períodos avançados

#### 3. `src/lib/onboarding/onboarding-steps.ts` — Atualizar textos

Remover menções fixas a "Premium" dos substeps `reports-cashflow` e `reports-evolution`. Usar textos neutros:

- **Cashflow**: "Aqui você compara entradas e saídas ao longo do tempo. Identifique os dias em que mais gastou ou recebeu."
- **Evolution**: "Este relatório mostra como seus gastos evoluíram ao longo do tempo. Ajuda a identificar padrões e picos."

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/onboarding/target-utils.ts` | Não rejeitar AccordionItem quando `closedAncestor === el` |
| `src/components/reports-accordion.tsx` | Liberar cashflow/evolução quando `periodType === "month"` |
| `src/lib/onboarding/onboarding-steps.ts` | Atualizar textos dos substeps cashflow e evolução |
