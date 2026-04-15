

## Plano: Source of truth compartilhada para gasto de crédito por cartão

### Resumo

Extrair a lógica de "gasto atual de crédito por cartão" em uma função utilitária compartilhada, usada tanto pela home (ExpenseSummary) quanto pelo card-manager. O comprometido futuro continua como cálculo separado no card-manager.

### Mudanças

**1. Novo utilitário: `src/utils/credit-card-spend.ts`**

Função pura `calculateCreditCardSpend`:

```text
calculateCreditCardSpend(
  expenses: Expense[],           // despesas já filtradas pelo mês calendário
  recurringExpenses: RecurringExpense[],  // fixas ativas
  startDate: Date,               // início do período (ex: Apr 1)
  endDate: Date                  // fim do período (ex: Apr 30)
) → Record<string, { total: number; color: string }>
```

Lógica (extraída da ExpenseSummary linhas 103-125):
- Filtra `expenses` por `payment_method === 'credit'`, agrupa por `card.name`/`card_name`, soma `amount`
- Filtra `recurringExpenses` por `is_active && payment_method === 'credit'` e `day_of_month` dentro do período
- Soma as fixas aos totais por cartão
- Retorna o mesmo `Record<string, { total, color }>` que hoje o ExpenseSummary calcula inline

**2. `src/components/expense-summary.tsx`**

- Importar `calculateCreditCardSpend`
- Substituir o cálculo inline de `creditCardTotals` (linhas 103-125) pela chamada à função compartilhada
- Comportamento idêntico, zero mudança visual

**3. `src/utils/card-limit-calculator.ts`** — Refatorar

Nova interface:
```text
CardLimitBreakdown {
  currentSpend: number;          // gasto atual (= home)
  futureInstallments: number;    // saldo comprometido futuro
  committedLimit: number;        // currentSpend + futureInstallments
  available: number;             // limit - committedLimit (pode ser negativo)
  exceeded: number;              // max(0, committedLimit - limit)
  percentage: number;
}
```

Nova assinatura:
```text
calculateCardLimitBreakdown(
  currentCardSpend: number,      // resultado da função compartilhada para este cartão
  allExpenses: CardExpenseRecord[],
  cardId: string,
  config: CreditCardConfig,
  cardLimit: number
) → CardLimitBreakdown
```

Lógica:
- `currentSpend` = parâmetro recebido (já calculado pela source of truth)
- `futureInstallments`: para cada `installment_group_id` com parcela no billing period atual (via `calculateBillingPeriod`), calcular `amount × (total - N)`
- `committedLimit = currentSpend + futureInstallments`
- `available = cardLimit - committedLimit`
- `exceeded = Math.max(0, -available)`

**4. `src/components/card-manager.tsx`**

- Importar `calculateCreditCardSpend`
- Buscar `recurring_expenses` ativas de crédito vinculadas aos cartões com limite
- Chamar `calculateCreditCardSpend` para obter o gasto atual por cartão (by card name → precisa mapear para card id)
- Passar o `currentSpend` do cartão para `calculateCardLimitBreakdown`
- Atualizar rótulos na UI:

```text
Gasto atual do cartão: R$ X
Comprometido futuro (parceladas): R$ Y
Limite comprometido: R$ Z de R$ Limite
Disponível estimado: R$ W        (ou "Ultrapassado em R$ X" em vermelho)
Inclui despesas do mês e saldo futuro de parceladas
```

- Quando `available < 0`: texto em vermelho "Ultrapassado em R$ |valor|"
- Quando `futureInstallments === 0`: omitir a linha "Comprometido futuro"

### Breakdown esperado (BB, abril 2026)

```text
currentSpend = R$ 201,41  (5 avulsos + 3 fixas, = home)
futureInstallments = Notebook (400×1) + Máquina (500×1) = R$ 900,00
committedLimit = R$ 1.101,41
available = R$ 1.198,00 - R$ 1.101,41 = R$ 96,59
```

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/utils/credit-card-spend.ts` | NOVO — source of truth compartilhada |
| `src/utils/card-limit-calculator.ts` | Refatorar para receber currentSpend como parâmetro |
| `src/components/expense-summary.tsx` | Usar função compartilhada |
| `src/components/card-manager.tsx` | Usar função compartilhada + rótulos novos + ultrapassagem |

Nenhuma migração SQL necessária.

