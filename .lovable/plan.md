

## Plano: Corrigir cálculo de limite e ajustar rótulos do card

### Decisão de produto oficializada

- **Home** = gasto lançado no mês (despesas reais + fixas geradas, modo calendário ou fatura)
- **Card do cartão** = fatura aberta projetada completa (todas as despesas cujo billing period = fatura atual, incluindo parcelas previstas)
- **Limite comprometido** = fatura aberta projetada + saldo futuro de parcelas ainda comprometidas
- Divergência entre home e card é comportamento esperado

### Sobre o R$ 32,09

Não reproduzível com dados e código atuais. Diagnóstico final: estado anterior ou transitório dos dados. A nova função recalcula do zero sem depender de estado prévio — o problema não se repete.

### Mudanças

**1. Novo arquivo: `src/utils/card-limit-calculator.ts`**

Função pura `calculateCardLimitBreakdown(expenses, cardId, config)` retornando `{ currentInvoice, futureInstallments, committedLimit, available, percentage }`.

Regras:
- Usa `parseLocalDate()` para todas as datas
- Fatura atual: despesas cujo `calculateBillingPeriod() === currentBillingMonth`
- Para cada `installment_group_id`, encontra a parcela que cai na fatura atual (N/T), calcula `futureInstallments += amount × (T - N)`. Se o grupo não tem parcela na fatura atual, ignora
- Não inclui templates de `recurring_expenses`

**2. Arquivo: `src/components/card-manager.tsx`**

- Remover lógica inline de cálculo (linhas 291-355)
- Importar e usar `calculateCardLimitBreakdown`
- Trocar `new Date(exp.expense_date)` por `parseLocalDate()` (já feito na nova função)

**3. Ajuste de rótulos na UI** (linhas 596-634)

Antes:
```
Limite comprometido ... X%
Comprometido: R$ X de R$ Y
Disponível estimado: R$ Z
Fatura atual: R$ W
Estimativa — não reflete pagamentos já realizados
```

Depois:
```
Limite comprometido ... X%
Fatura aberta projetada: R$ W
Limite comprometido: R$ X de R$ Y
Disponível estimado: R$ Z
Inclui parcelas previstas na fatura e saldo futuro comprometido
```

Ordem: fatura primeiro (mais concreto), comprometido depois (fatura + futuro), disponível por último. Aviso reescrito para ser descritivo em vez de apenas "estimativa".

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/utils/card-limit-calculator.ts` | NOVO — função pura de cálculo |
| `src/components/card-manager.tsx` | Usar nova função + rótulos atualizados |

Nenhuma migração SQL necessária.

