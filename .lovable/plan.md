

# Plano: Comparação sempre com base no período anterior

## Problema

No relatório "Comparação" (página de Relatórios), todas as linhas mostram **"sem base"** porque o cálculo do período anterior:

1. **Ignora despesas e entradas fixas** (recorrentes) — só soma `expenses`/`incomes` regulares. Como o usuário tem 3 entradas fixas no dia 5, o `previousTotalIncomes` fica em R$ 0,00 e cai na regra `< 10` → "sem base".
2. **Ignora competência de cartão de crédito** (billing period) na soma anterior, divergindo da soma atual.
3. **Não suporta `custom` nem `all`**: `previousPeriodDates` fica `null` para esses tipos, então não há comparação.
4. **Threshold artificial de R$ 10**: `if (previousVal < 10) return "sem base"` — esconde a base mesmo quando ela existe e é pequena (ex.: R$ 3,00 anterior é base válida).

## Solução

### 1. `src/utils/report-view-model.ts` — recalcular período anterior corretamente

Substituir o bloco `// Previous period` (linhas 203–232) por uma versão que:

**a) Define `previousPeriodDates` para todos os tipos:**
- `month` → mês anterior (já feito).
- `quarter` → 3 meses anteriores ao quarter atual (corrigir cálculo: hoje pega "mês anterior ao início" como fim, o que distorce; usar `subQuarters(startDate, 1)` como início e o último dia desse trimestre como fim).
- `year` → ano anterior completo (já feito).
- `custom` → mesma duração em dias deslocada para trás: `prevEnd = startDate - 1 dia`, `prevStart = prevEnd - (endDate - startDate)`.
- `all` → sem período anterior (manter `null`); a UI dirá "Todo o histórico" sem comparação (caso legítimo).

**b) Inclui recorrentes e respeita competência de crédito**, espelhando exatamente a lógica de `filteredExpenses`/`filteredIncomes`/`filteredRecurringExpenses`/`filteredRecurringIncomes` (incluindo `usesCard`/billing period). Extrair em uma função helper interna `computeTotalsForPeriod(start, end, periodType)` que retorna `{ totalExpenses, totalIncomes }` e usar tanto para o período atual quanto anterior — isso elimina divergências futuras.

**c) Mantém `xxxDelta` como `null` apenas quando o valor anterior é exatamente 0** (não mais `< 10`). Quando há base mínima real, calcular o percentual.

### 2. `src/components/reports-accordion.tsx` — remover threshold de 10 e melhorar fallback

- `formatDeltaWithAbsolute` (linha 104): trocar `if (previousVal < 10) return "sem base"` por `if (previousVal === 0 && currentVal === 0) return "—"` e `if (previousVal === 0 && currentVal > 0) return "novo"` (rótulo positivo: "começou agora", em vez de "sem base").
- Linha 520: remover a checagem `item.previous < 10 && item.current > 0`. Mostrar sempre o delta (ou "novo" quando `previous === 0`).
- Adicionar exibição do **rótulo do período anterior** ao lado de "Anterior: R$ X,XX" (ex.: "Anterior (Mar/2026): R$ 1.000,00") para deixar claro qual é a base sendo comparada. Calcular esse label a partir de `previousPeriodDates` + `periodType`.

### 3. `src/services/pdf-export-service.ts` — espelhar UI

- Aplicar mesma mudança em `formatDeltaWithAbsolute` (linha 292).
- Incluir rótulo do período anterior na seção de comparação para paridade total UI ↔ PDF.

## Casos de teste obrigatórios

1. Mês atual com entradas fixas → linha "Entradas" mostra delta vs mês anterior (não mais "sem base").
2. Trimestre → comparação correta com trimestre anterior (3 meses).
3. Ano → comparação com ano anterior completo.
4. Custom (ex.: 10 dias) → comparação com 10 dias anteriores ao início selecionado.
5. "Todo o histórico" → bloco de comparação oculto ou exibe "—" (sem comparação aplicável).
6. Período anterior com 0 e atual com valor → mostra "novo" em vez de "sem base".
7. Despesas de crédito do período anterior caem na competência correta (mesma lógica do atual).

## Arquivos alterados

1. `src/utils/report-view-model.ts` — refatorar bloco do período anterior + helper interno + suporte a custom.
2. `src/components/reports-accordion.tsx` — remover threshold, adicionar rótulo do período base, mudar fallback.
3. `src/services/pdf-export-service.ts` — espelhar UI.

**Total:** 3 arquivos. Sem migration, sem mudança de schema.

