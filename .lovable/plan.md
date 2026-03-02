

## Plano: PDF 1:1 com a tela — extrair view model compartilhado

### Problema raiz

O `pdf-export-service.ts` recalcula todos os dados independentemente (linhas 352-530), usando um `getCategoryInfo` diferente do accordion (não tem acesso ao hook `useCategories()`). Isso gera divergências nos valores de categoria, agrupamento "Top 5 + Outros", e potencialmente em outros blocos.

### Solução

Extrair toda a lógica de cálculo do accordion para uma função pura `buildReportViewModel()`. Tanto o accordion quanto o PDF consomem o mesmo resultado.

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/utils/report-view-model.ts` | **Novo** — função pura com todos os cálculos |
| `src/components/reports-accordion.tsx` | Substituir ~200 linhas de `useMemo` por chamada ao view model |
| `src/pages/Reports.tsx` | Computar view model, passar para accordion e para PDF |
| `src/services/pdf-export-service.ts` | Remover ~180 linhas de recálculo, receber view model pronto |

### 1. `src/utils/report-view-model.ts` (novo)

Função pura que recebe os dados brutos + categories e retorna o objeto completo:

```ts
export interface ReportViewModel {
  filteredExpenses, filteredRecurringExpenses, filteredIncomes, filteredRecurringIncomes,
  totalPeriod, totalIncomes, balance,
  previousTotalExpenses, previousTotalIncomes, previousBalance,
  expenseDelta, incomeDelta, balanceDelta, savingsRate,
  topCategory, mostExpensiveDay,
  categoryData, paymentMethodData, cardData, memberData,
  cashFlowData, evolutionData, dailyAverage,
  topExpenses
}

export function buildReportViewModel(params: BuildParams): ReportViewModel
```

Move todas as computações dos ~30 `useMemo` do accordion para esta função. A função aceita `categories` (array de `UserCategory`) como parâmetro para resolver nomes/ícones, eliminando a divergência do `getCategoryInfo`.

Para `cashFlowData` e `evolutionData`, a função retorna os dados **raw** (modo "daily"). Os modos "cumulative" e "weekly" são derivações aplicadas no ponto de consumo (accordion para UI, PDF para export).

### 2. `src/components/reports-accordion.tsx`

- Importar `buildReportViewModel`
- Substituir os ~30 `useMemo` por um único `useMemo` que chama `buildReportViewModel({ expenses, recurringExpenses, incomes, recurringIncomes, cards, categories, startDate, endDate, periodType, isGroupContext, groupMembers })`
- Manter states locais `cashFlowMode` e `evolutionMode` para derivar os dados de gráfico a partir do raw
- Renderização inalterada

### 3. `src/pages/Reports.tsx`

- Importar `buildReportViewModel` e `useCategories`
- Computar o view model com `useMemo`
- Passar o view model para `ReportsAccordion` via nova prop `viewModel`
- Passar o view model para `exportReportsToPDF` no `handleExportPDF`

### 4. `src/services/pdf-export-service.ts`

- Alterar `ExportReportParams` para receber `viewModel: ReportViewModel` em vez de dados brutos
- Remover linhas 352-530 (toda a seção "DATA CALCULATIONS")
- Usar diretamente `viewModel.categoryData`, `viewModel.paymentMethodData`, etc.
- Resultado: PDF renderiza exatamente os mesmos arrays/valores que a UI, sem possibilidade de divergência

### Resultado

- Qualquer mudança na lógica de cálculo (filtros, agrupamentos, "Top 5 + Outros") é feita em um único lugar
- PDF e UI sempre mostram dados idênticos por construção
- Redução de ~180 linhas duplicadas no PDF service

