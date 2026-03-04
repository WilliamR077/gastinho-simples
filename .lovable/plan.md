

## Plano: Toggle "Calendário | Fatura" na Home + Info de fatura no detalhe

### Resumo

Adicionar um toggle "Calendário | Fatura" na Home que muda como despesas de crédito são agrupadas por mês. Em modo "Fatura", compras no crédito feitas após o fechamento aparecem no mês seguinte. Também mostrar info de fatura no detalhe da transação.

---

### 1. Estado do toggle — `Index.tsx`

- Adicionar state `viewMode: "calendar" | "billing"` (default: `"calendar"`)
- Renderizar toggle entre o `MonthNavigator` e o `BalanceSummary`
- Usar um segmented control compacto (2 botões pill, estilo igual ao "Do Mês / Fixas" já existente)

### 2. MonthNavigator — Label condicional

- `month-navigator.tsx`: aceitar prop opcional `suffix?: string`
- Em modo "Fatura", passar `suffix="• Fatura"` → exibe "Março de 2026 • Fatura"

### 3. Filtro de despesas por competência — `Index.tsx`

- No `filteredExpenses` (useMemo linha ~1201), quando `viewMode === "billing"`:
  - Para despesas com `payment_method === "credit"` e `card_id` presente no `cardsConfigMap`: usar `calculateBillingPeriod(expenseDate, cardConfig)` para determinar o mês da fatura
  - Comparar o `billingMonth` (yyyy-MM) com o mês selecionado no navigator
  - Para pix/débito: manter filtro por `expense_date` normalmente
- Para `monthlyTotals` (linha ~1472): aplicar mesma lógica de agrupamento

### 4. CompactFilterBar — Ocultar billing period dropdown em modo calendário

- Passar nova prop `viewMode` ao `CompactFilterBar`
- Quando `viewMode === "billing"`: esconder o dropdown de "Fatura" (já está agrupado pelo mês do topo — fonte única de verdade)
- Quando `viewMode === "calendar"`: manter comportamento atual

### 5. TransactionDetailSheet — Info de fatura

- Para despesas com `payment_method === "credit"` e card com config:
  - Importar `calculateBillingPeriod` e `getNextBillingDates`
  - Calcular e exibir `DetailRow` extra: "Fatura" → "Mar/2026 (fecha 20/03, vence 30/03)"
  - Requer passar `cards` como prop (ou buscar internamente)

---

### Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `src/pages/Index.tsx` | State `viewMode`, toggle UI, lógica de filtro por competência |
| `src/components/month-navigator.tsx` | Prop `suffix` para label "• Fatura" |
| `src/components/compact-filter-bar.tsx` | Prop `viewMode`, esconder dropdown billing em modo billing |
| `src/components/transaction-detail-sheet.tsx` | Info de fatura para despesas de crédito |

Sem alterações em backend, banco de dados ou cálculos financeiros.

