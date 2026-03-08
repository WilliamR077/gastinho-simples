

## Plano: Corrigir aritmética de datas do billing + filtro só crédito + multi-cartões

### Problema 1: `computeClosingDay` usa aritmética fixa (dia - offset + 30)

Em `card-manager.tsx` linha 80-84 e no preview do formulário (linha 334), o fechamento é calculado como `dueDay - daysBefore + 30` — ignora meses reais. Também em `billing-period.ts`, `calculateBillingPeriod` calcula o fechamento posicionando o due_day no mesmo mês da despesa e subtraindo dias, mas o modelo correto é: o vencimento da fatura M fica no mês M+1, e o fechamento = vencimento - dias_antes.

### Problema 2: Modo Fatura mostra PIX/Débito

Em `Index.tsx` linhas 1225-1234, quando `viewMode === "billing"` mas a despesa NÃO é crédito, o código cai no `else` e filtra por data — deveria retornar `false` diretamente.

### Problema 3: Multi-cartões sem seleção obrigatória

Não há exigência de selecionar um cartão no modo Fatura. Sem isso, faturas de cartões com ciclos diferentes se misturam.

---

### Mudanças

#### 1. `src/utils/billing-period.ts` — Reescrever `calculateBillingPeriod` (novo modelo)

Nova lógica para `due_day + days_before_due`:

```ts
// Para determinar a qual fatura M (yyyy-MM) uma compra pertence:
// Fatura "M" tem vencimento no mês M+1, dia due_day (clamped)
// Fechamento = vencimento - days_before_due (subtração real de dias via Date)
// Período da fatura M = (fechamento da fatura M-1) + 1 dia  até  fechamento da fatura M
// 
// Algoritmo: testar fatura do mês da compra e do mês anterior.
// Se compra <= fechamento do mês → pertence a esse mês
// Senão → pertence ao mês seguinte
```

Criar helper `getBillingClosingDate(billingMonth: string, config)`:
- Parse `billingMonth` → ano/mês (ex: "2026-03" → março)
- `dueDate = new Date(ano, mês, clamp(due_day, daysInMonth))` — vencimento no próprio mês da fatura (NÃO mês+1, conforme o pedido do usuário: fatura de março fecha em março e vence em abril)

Correção: conforme o critério de aceite do usuário:
- Fatura de Março/2026, vencimento dia 10 → `dueDate = 10/04/2026` (mês seguinte)
- `closingDate = dueDate - 12 dias = 29/03/2026`
- `previousDueDate = 10/03/2026`, `previousClosingDate = 26/02/2026`
- Período = 27/02 a 29/03

Então a fórmula é:
```ts
function getClosingDateForBillingMonth(year: number, month: number, dueDay: number, daysBefore: number): Date {
  // Vencimento cai no MÊS SEGUINTE ao mês da fatura
  const nextMonth = month + 1;
  const ny = nextMonth > 11 ? year + 1 : year;
  const nm = nextMonth > 11 ? 0 : nextMonth;
  const dueDate = new Date(ny, nm, Math.min(dueDay, daysInMonth(ny, nm)));
  const closingDate = new Date(dueDate);
  closingDate.setDate(closingDate.getDate() - daysBefore);
  return closingDate;
}
```

`calculateBillingPeriod(expenseDate, config)`:
- Tentar fatura do mês da despesa: calcular closingDate e previousClosingDate
- previousClosingDate = closingDate da fatura do mês anterior
- Se `expenseDate > previousClosingDate && expenseDate <= closingDate` → fatura desse mês
- Senão se `expenseDate > closingDate` → fatura do mês seguinte
- Senão → fatura do mês anterior

Também atualizar `getNextBillingDates` com a mesma lógica corrigida (vencimento no mês seguinte).

#### 2. `src/components/card-manager.tsx`

- **Remover `computeClosingDay`** (linhas 80-84) — não mais necessário
- **Formulário preview** (linha 331-339): trocar texto para:
  ```
  "Vence dia {due_day} • Fecha {days_before_due} dias antes"
  ```
  E adicionar "Próximo fechamento: DD/MM • Próximo vencimento: DD/MM" usando `getNextBillingDates` com data real.
- No `handleSubmit` (linhas 112-120): calcular `closing_day` usando a nova `getClosingDateForBillingMonth` para o mês atual, pegar `.getDate()` (compatibilidade).

#### 3. `src/pages/Index.tsx` — Modo Fatura só crédito + cartão obrigatório

**Filtro (linhas 1207-1235):**
- Quando `viewMode === "billing"`: se `expense.payment_method !== "credit"` → `return false` (não cair no else)

**Totais (linhas 1482-1498):**
- Mesma correção: no modo billing, só considerar crédito

**Toggle UI (linhas 1556-1582):**
- Quando `viewMode === "billing"` e existem 2+ cartões de crédito: mostrar seletor de cartão obrigatório abaixo do toggle
- Se 1 cartão: auto-selecionar
- Se 0 cartões de crédito: mostrar mensagem "Cadastre um cartão de crédito"
- Adicionar state `billingCardId: string | null` — no filtro, usar esse cartão como `filters.cardId` forçado

---

### Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `src/utils/billing-period.ts` | Reescrever cálculo: vencimento no mês+1, subtração real de dias |
| `src/components/card-manager.tsx` | Preview com datas reais, remover `computeClosingDay` |
| `src/pages/Index.tsx` | Modo Fatura: só crédito, seletor de cartão obrigatório |

