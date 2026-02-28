

## Plano: Ajustes finais de UI/UX na tela Relatórios

3 arquivos, ~12 mudanças pontuais.

---

### 1. `src/components/period-selector.tsx`

**Labels pt-BR (linhas 149-163):**
- `Tri` → `Trimestre`
- `Custom` → `Personalizado`
- Labels já existentes (`Mês`, `Ano`) mantidos

Não adicionar "Semana" — exigiria novo `PeriodType`, lógica de `startOfWeek`/`endOfWeek`, e propagação em `reports-accordion.tsx`. Complexidade desproporcional ao ganho.

---

### 2. `src/components/reports-accordion.tsx`

**2A. Cores de Forma de Pagamento (linha 46-50):**
Trocar `COLORS` para cores neutras sem semântica bom/ruim:
```ts
const COLORS = {
  credit: "#f59e0b",  // âmbar
  debit: "#8b5cf6",   // roxo
  pix: "#06b6d4",     // ciano
};
```

**2B. Grid mais suave nos gráficos (linhas 680, 716):**
- Alterar `strokeOpacity={0.5}` → `strokeOpacity={0.3}` no `CartesianGrid` de Fluxo de Caixa e Evolução dos Gastos

**2C. Evolução dos Gastos — toggle Diário/Semanal (linhas 697-729):**
- Adicionar state `evolutionMode: "daily" | "weekly"` no componente
- Adicionar `ToggleGroup` (Diário | Semanal) antes do gráfico (mesmo padrão do cashFlowMode)
- Em modo semanal: agrupar `evolutionData` por semana (soma de 7 dias), label = "Sem 1", "Sem 2", etc.
- Só exibir toggle quando `periodType === "month"`

**2D. Maiores Gastos — datas consistentes (linhas 746-756):**
- Substituir `e.date` direto por lógica: se `e.type === 'recurring'`, mostrar `Fixa • Dia ${dayOfMonth}` como subtítulo
- Se `e.type === 'expense'`, sempre usar `format(parseLocalDate(e.date), "dd/MM")`
- Ajustar o tipo de `topExpenses` para incluir `dayOfMonth` quando recurring

**2E. Resumo Inteligente — diferença absoluta + proteção contra % absurdo (linhas 444-463):**
- Linha 1: após o `formatDelta`, adicionar diferença absoluta: `(+R$ X)` ou `(-R$ X)`
- Quando `previousTotalExpenses` < 10 (quase zero), substituir delta por texto `"(novo)"` ou `"(sem base)"` em vez de `↑ 5000%`
- Mesma lógica para `incomeDelta` no resumo de comparação (linhas 512-524 e 790-798)

**2F. `formatDelta` — adicionar valor absoluto (linha 402-406):**
Criar `formatDeltaWithAbsolute(delta, currentVal, previousVal)` que retorna:
- Se `previousVal < 10`: `"sem base"`
- Senão: `"↑ 12% (+R$ 150,00)"` ou `"↓ 8% (-R$ 50,00)"`

---

### Resumo

| Arquivo | Mudanças |
|---|---|
| `period-selector.tsx` | Renomear 2 labels |
| `reports-accordion.tsx` | Cores pagamento, grid suave, toggle semanal, datas consistentes, delta absoluto + proteção % |

2 arquivos, sem mudanças em backend/cálculos.

