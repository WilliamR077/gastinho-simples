

## Plano: Reescrever PDF Export para espelhar a tela nova de Relatórios

### Resumo

Reescrever `pdf-export-service.ts` (~753 linhas) completamente e atualizar a chamada em `Reports.tsx` para passar todos os dados necessários (incomes, recurringIncomes, periodType, periodLabel, categories).

### Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `src/services/pdf-export-service.ts` | Reescrever ~90% — novas seções, remover seções antigas |
| `src/pages/Reports.tsx` | Atualizar `handleExportPDF` com novos parâmetros |

### 1. `src/pages/Reports.tsx` — Atualizar chamada

Passar parâmetros adicionais para `exportReportsToPDF`:
- `incomes`, `recurringIncomes` (já no state)
- `periodType`, `periodLabel` (já no state)

Não fazer state lifting dos toggles (`cashFlowMode`/`evolutionMode`) — o PDF exportará sempre "Por dia" e "Diário" como padrão (o PDF não tem interatividade, e evita complexidade de lifting).

### 2. `src/services/pdf-export-service.ts` — Reescrever

**Nova assinatura:**
```ts
exportReportsToPDF(params: {
  expenses, recurringExpenses, cards,
  incomes, recurringIncomes,
  startDate, endDate, periodType, periodLabel,
  isGroupContext, groupMembers, groupName?
})
```

**Manter helpers existentes:** `createPieChartCanvas`, `createLineChartCanvas`, `createBarChartCanvas`, `isNativeApp`, `saveAndShareFile`. Adaptar cores.

**Criar novo helper:** `createDualBarChartCanvas` para fluxo de caixa (barras duplas entradas vs saídas).

**12 seções do PDF na ordem (replicando exatamente o que a UI mostra):**

1. **Cabeçalho** — "Relatórios" + carteira + período formatado + data/hora geração
2. **Resumo Inteligente** — 3 linhas: total gastos + delta%, maior categoria, dia mais caro (replicar cálculos do accordion)
3. **Resumo do Período** — Tabela: Entradas/Saídas/Saldo + contagens + economia% + comparação deltas
4. **Gastos por Categoria** — Tabela com barras visuais via autoTable cell draw hook (Top 5 + Outros, com valor e %)
5. **Forma de Pagamento** — Tabela com barras, cores neutras (âmbar/roxo/ciano)
6. **Gastos por Cartão** — Donut canvas (manter `createPieChartCanvas`) + legenda com R$ e %
7. **Fluxo de Caixa** — `createDualBarChartCanvas` (barras verdes/vermelhas por dia)
8. **Evolução dos Gastos** — `createLineChartCanvas` com cor vermelha + ReferenceLine tracejada de média
9. **Maiores Gastos** — Top 10 tabela (ranking, descrição, data dd/MM ou "Fixa • Dia X", valor)
10. **Comparação vs anterior** — Tabela (Entradas/Saídas/Saldo: atual, anterior, delta com formatDeltaWithAbsolute)
11. **Taxa de Economia** — Percentual + interpretação textual
12. **Despesas Fixas** — Total + lista com status Paga/Pendente, dia, método, cartão

**Remover seções antigas:**
- "Resumo Geral" (tabela simples)
- "Evolução dos Últimos 6 Meses" (gráfico de linha antigo)
- "Comparação Mês a Mês" (tabela antiga)
- Pizzas de categoria e pagamento (substituídas por barras em tabela)
- "Lista de Despesas do Mês" (tabela completa — substituída por Top 10)

**Rodapé:** "Página X de Y — Gastinho Simples" (manter existente)

**Cores atualizadas:**
- `COLORS`: credit `#f59e0b` (âmbar), debit `#8b5cf6` (roxo), pix `#06b6d4` (ciano)
- Evolução: linha vermelha `#ef4444`, média tracejada `#f59e0b`
- Fluxo: entradas `#22c55e`, saídas `#ef4444`

**Paginação:** `checkPageBreak` existente, ajustar `requiredSpace` por seção para evitar cortar cards.

**Mobile (Capacitor):** Manter lógica `isNativeApp()` → `saveAndShareFile` existente, sem mudanças.

### Cálculos replicados do accordion

Todos os cálculos do accordion serão replicados no PDF service (filtragem por período, período anterior, deltas, topCategory, mostExpensiveDay, categoryData com Top 5+Outros, paymentMethodData, cardData, cashFlowData, evolutionData, topExpenses, savingsRate, formatDeltaWithAbsolute). Isso é necessário porque o service não tem acesso ao estado React.

