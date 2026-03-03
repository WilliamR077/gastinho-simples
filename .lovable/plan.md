

## Plano: Melhorar página "Meus Cartões" + Competência de Fatura

Este é um projeto com 4 frentes: UI dos cartões, modelo de dados, cálculo de competência, e integração nos relatórios.

---

### 1. Migração DB — Novos campos na tabela `cards`

Adicionar 2 colunas à tabela `cards`:

```sql
ALTER TABLE public.cards ADD COLUMN due_day integer;
ALTER TABLE public.cards ADD COLUMN days_before_due integer DEFAULT 10;
```

- `due_day` (1-31): dia de vencimento da fatura
- `days_before_due` (ex: 10): quantos dias antes do vencimento a fatura fecha
- Manter `closing_day` e `opening_day` existentes para compatibilidade (não remover)
- **Não adicionar `competencia_fatura` na tabela `expenses`** — será calculado em runtime no frontend (evita migração de dados)

---

### 2. UI — Página "Meus Cartões" (`Cards.tsx` + `card-manager.tsx`)

**Cards.tsx:**
- Remover `<Footer />` da página
- Reduzir `max-w-4xl` para `max-w-2xl` (720px)

**card-manager.tsx — Lista de cartões:**
- Cada card mostra: Nome, Tipo (badge), Limite formatado, e para crédito: "Próx. fechamento: DD/MM" e "Próx. vencimento: DD/MM" (calculados a partir de `due_day` e `days_before_due`, ou fallback para `closing_day`)
- Substituir botões ícone (Pencil/Trash2) por `DropdownMenu` com ⋮ (MoreVertical) → "Editar" / "Excluir"

**card-manager.tsx — Formulário:**
- Campos condicionais: se tipo = "debit", esconder campos de fatura
- Se tipo = "credit" ou "both": mostrar "Dia de Vencimento" + "Dias antes do vencimento que fecha" (com valor padrão 10)
- Exibir info calculada: "Fechamento: dia X → Vencimento: dia Y"
- Manter campo `closing_day` preenchido automaticamente (= `due_day - days_before_due` ajustado) para compatibilidade

**Seletor de cor:**
- Trocar grid de retângulos `h-10` por círculos pequenos (`w-8 h-8 rounded-full`) com check icon discreto + ring quando selecionado

---

### 3. Lógica — Cálculo de competência (`billing-period.ts`)

Atualizar `CreditCardConfig` para aceitar o novo modelo:

```ts
export interface CreditCardConfig {
  opening_day: number;
  closing_day: number;
  due_day?: number;
  days_before_due?: number;
}
```

Adicionar função `getNextBillingDates(card, referenceDate)`:
- Calcula data de fechamento e vencimento para um dado mês
- Se `due_day` e `days_before_due` existem, usa: `fechamento = vencimento - days_before_due`
- Senão, fallback para `closing_day`/`opening_day` existentes
- Retorna `{ closingDate: Date, dueDate: Date, billingMonth: string }`

Atualizar `calculateBillingPeriod` para usar o novo modelo quando disponível.

---

### 4. Expense Form — Chip de fatura

**`expense-form.tsx` e `unified-expense-form-sheet.tsx`:**
- Quando `paymentMethod === "credit"` e um cartão com config de fatura está selecionado:
  - Calcular `competencia_fatura` com base na `expenseDate` + config do cartão
  - Mostrar chip informativo: "Fatura: Mar/2026 (fecha em 20/03)"
  - Chip não é editável no MVP (override manual pode vir depois)

---

### 5. Relatórios — Filtro por competência

**`report-view-model.ts`:**
- No filtro de despesas por período, quando `payment_method === "credit"` e existe `card_id` com config de fatura:
  - Usar `calculateBillingPeriod(expenseDate, cardConfig)` para determinar a competência
  - Filtrar pela competência em vez da `expense_date`
- Para `pix`/`debit`: continuar usando `expense_date` normalmente

Isso significa que no relatório de "Março 2026", uma compra no crédito feita em 27/02 (após o fechamento de fev) aparecerá em Março.

---

### Arquivos impactados

| Arquivo | Mudança |
|---|---|
| Migração SQL | `ALTER TABLE cards ADD COLUMN due_day, days_before_due` |
| `src/pages/Cards.tsx` | Remover Footer, reduzir max-width |
| `src/components/card-manager.tsx` | UI premium, swatches, dropdown menu, campos condicionais, próx. fechamento/vencimento |
| `src/types/card.ts` | Adicionar `due_day`, `days_before_due` ao `CardFormData` |
| `src/utils/billing-period.ts` | Nova função `getNextBillingDates`, atualizar `CreditCardConfig` |
| `src/components/expense-form.tsx` | Chip de fatura para crédito |
| `src/components/unified-expense-form-sheet.tsx` | Chip de fatura para crédito |
| `src/utils/report-view-model.ts` | Filtro por competência para crédito |

---

### Ordem de implementação

1. Migração DB (novos campos)
2. UI da página de cartões (visual + formulário)
3. Lógica de billing period atualizada
4. Chip de fatura no expense form
5. Filtro por competência nos relatórios

