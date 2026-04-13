

## Plano: Barra de uso do limite com separação fatura atual vs. limite comprometido

### Objetivo
Mostrar em cada card de cartão (quando `card_limit` estiver preenchido) três informações distintas:
- **Limite comprometido** (barra de progresso): inclui fatura atual + saldo restante de parcelas futuras
- **Fatura atual**: valor que cai na fatura aberta do mês
- **Disponível estimado**: `card_limit - limite comprometido`

### Lógica de cálculo

**Fatura atual (R$ W):**
- Despesas com `payment_method = 'credit'` e `card_id = X` cuja `expense_date` cai no período da fatura aberta (calculado via `calculateBillingPeriod` comparando com o `billingMonth` atual do cartão)
- Inclui parcelas cujo `installment_number` corresponde ao mês atual

**Limite comprometido (R$ X):**
- Fatura atual (R$ W) +
- Saldo restante de parcelas futuras: para cada `installment_group_id` distinto que aparece nas despesas do cartão, calcular `amount × (total_installments - installment_number)` usando apenas a parcela de maior `installment_number` (a mais recente), para obter quanto ainda vai cair nas faturas seguintes
- Recorrentes: **não** soma o template recorrente; só conta as despesas reais já geradas que caem na fatura atual (já estão contadas em "fatura atual")

**Disponível estimado (R$ Z):**
- `card_limit - limite comprometido`

### Exibição no card

Abaixo das datas de fechamento/vencimento, quando `card_limit` > 0:

```text
[===████████████░░░░░░] 72%
Limite comprometido: R$ 3.600 de R$ 5.000
Disponível estimado: R$ 1.400
Fatura atual: R$ 1.800
⚠️ Estimativa — não reflete pagamentos já realizados
```

Cores da barra: verde (<70%), amarelo (70-85%), laranja (85-95%), vermelho (>95%)

### Implementação

Ao carregar os cartões, buscar também as despesas de crédito de cada cartão que tenha limite. Agrupar os cálculos em uma função auxiliar dentro do componente.

**Query:** Uma única query buscando todas as despesas de crédito dos cartões com limite (filtrando por `card_id in (...)`, `payment_method = 'credit'`). Campos necessários: `amount`, `expense_date`, `card_id`, `installment_group_id`, `installment_number`, `total_installments`.

### Arquivo afetado

| Arquivo | Mudança |
|---|---|
| `src/components/card-manager.tsx` | Buscar despesas de crédito, calcular fatura atual + limite comprometido, renderizar barra + textos |

Nenhuma migração SQL necessária.

