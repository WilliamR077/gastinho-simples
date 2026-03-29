

## Plano Revisado: Implementar Passo 7 — Relatórios (Completo)

### Ajustes incorporados

1. **Todos os blocos cobertos**: ContextSelector, Comparação com período anterior e Gastos por Membro agora estão explicitamente incluídos no fluxo (com `condition` para os condicionais).

2. **Premium lock explícito**: Fluxo de Caixa e Evolução dos Gastos usam textos diferentes conforme o estado de desbloqueio. O substep terá descrição fixa que cobre ambos os cenários (ex: "Este relatório mostra X. Se estiver bloqueado, ele faz parte do plano Premium."). Como o texto do substep é estático, incluiremos uma nota genérica que funciona para ambos os estados.

3. **Accordion: abrir antes de explicar**: Para cada bloco que é um AccordionItem, o tutorial vai **programaticamente abrir o accordion** antes de destacar o conteúdo. Isso será feito adicionando `onBeforeHighlight` nos substeps que, via DOM, disparam um click no AccordionTrigger caso o item esteja fechado (`data-state="closed"`). Alternativa mais simples: usar `defaultValue` expandido no Accordion quando onboarding estiver ativo, ou destacar o AccordionItem inteiro (trigger + content) usando o `data-onboarding` no `AccordionItem` — o Accordion já tem `type="multiple"` e `defaultValue={["category", "payment-method"]}`, então podemos expandir o `defaultValue` para incluir todos os items durante o onboarding.

**Decisão**: A abordagem mais robusta é colocar o `data-onboarding` no `AccordionItem` e, no substep, antes de posicionar o tooltip, forçar a abertura do item. Faremos isso no `handleTargetAppeared` do engine: se o target é um AccordionItem com `data-state="closed"`, clicar no trigger automaticamente.

---

### Substeps completos do passo `view-reports` (~16 substeps)

| # | Substep | Tipo | Target | Notas |
|---|---------|------|--------|-------|
| 1 | `reports-intro` | info | — | Introdução. Sem skipLabel |
| 2 | `reports-nav` | click | `reports-nav-button` | autoAdvanceOnRoute: `/reports` |
| 3 | `reports-context` | info | `reports-context-selector` | Explica seletor de contexto (pessoal vs grupo). condition: DOM check |
| 4 | `reports-period` | info | `reports-period-selector` | Explica seletor de período |
| 5 | `reports-summary` | info | `reports-period-summary` | Resumo Entradas/Saídas/Saldo |
| 6 | `reports-smart-summary` | info | `reports-smart-summary` | condition: DOM. Resumo inteligente |
| 7 | `reports-category` | info | `reports-category` | Gastos por categoria. scrollToTarget |
| 8 | `reports-payment` | info | `reports-payment-method` | Forma de pagamento. scrollToTarget |
| 9 | `reports-cards` | info | `reports-cards` | condition: DOM. Gastos por cartão |
| 10 | `reports-cashflow` | info | `reports-cashflow` | Fluxo de caixa. Texto cobre premium lock |
| 11 | `reports-evolution` | info | `reports-evolution` | Evolução gastos. Texto cobre premium lock |
| 12 | `reports-top` | info | `reports-top-expenses` | Maiores gastos (Top 10) |
| 13 | `reports-comparison` | info | `reports-comparison` | condition: DOM. Comparação período anterior |
| 14 | `reports-savings` | info | `reports-savings-rate` | condition: DOM. Taxa de economia |
| 15 | `reports-members` | info | `reports-members` | condition: DOM. Gastos por membro (grupo) |
| 16 | `reports-recurring` | info | `reports-recurring` | Despesas fixas |
| 17 | `reports-done` | info | — | Mensagem final, completeCurrentStep() |

### Textos para blocos premium-locked

- **Fluxo de Caixa**: "Este relatório compara suas entradas e saídas ao longo do tempo. Com ele, você identifica os dias em que mais gastou ou recebeu. Disponível no plano Premium — mas você já pode ver como ele funciona!"
- **Evolução dos Gastos**: "Aqui você acompanha a evolução dos seus gastos dia a dia ou semana a semana. Ajuda a identificar padrões e picos. Disponível no plano Premium."

Esses textos funcionam tanto para quem tem premium (verá o gráfico atrás) quanto para quem não tem (verá o lock).

### Accordion: abertura automática

No `handleTargetAppeared` em `use-onboarding-tour.tsx`, adicionar lógica: se o elemento-alvo encontrado tem `data-state="closed"` (é um AccordionItem fechado), clicar no `AccordionTrigger` filho para abri-lo, aguardar 300ms, e só então posicionar o tooltip. Isso garante que o conteúdo do relatório fique visível quando o tooltip aparecer.

---

### Mudanças por arquivo

#### 1. `src/lib/onboarding/onboarding-steps.ts`
Reescrever `view-reports` com ~17 substeps conforme tabela acima. Cada bloco accordion terá `scrollToTarget: true`.

#### 2. `src/components/app-header.tsx`
Adicionar `data-onboarding="reports-nav-button"` no botão de relatórios.

#### 3. `src/components/reports-accordion.tsx`
Adicionar `data-onboarding` em cada bloco:
- Resumo Inteligente: `reports-smart-summary`
- Resumo do Período: `reports-period-summary`
- AccordionItem category: `reports-category`
- AccordionItem payment-method: `reports-payment-method`
- AccordionItem cards: `reports-cards`
- AccordionItem cashflow: `reports-cashflow`
- AccordionItem evolution: `reports-evolution`
- AccordionItem top-expenses: `reports-top-expenses`
- AccordionItem comparison: `reports-comparison`
- AccordionItem savings-rate: `reports-savings-rate`
- AccordionItem members: `reports-members`
- AccordionItem recurring: `reports-recurring`

#### 4. `src/pages/Reports.tsx`
- `data-onboarding="reports-period-selector"` no PeriodSelector
- `data-onboarding="reports-context-selector"` no ContextSelector

#### 5. `src/hooks/use-onboarding-tour.tsx`
- No `handleTargetAppeared`, adicionar lógica de auto-abertura de AccordionItem fechado (click no trigger se `data-state="closed"`)

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/onboarding/onboarding-steps.ts` | Reescrever `view-reports` com ~17 substeps |
| `src/components/app-header.tsx` | `data-onboarding="reports-nav-button"` |
| `src/components/reports-accordion.tsx` | `data-onboarding` em todos os 12 blocos |
| `src/pages/Reports.tsx` | `data-onboarding` no PeriodSelector e ContextSelector |
| `src/hooks/use-onboarding-tour.tsx` | Auto-abertura de AccordionItem fechado |

Nenhuma migração SQL.

