

## Plano: Cor real do cartão + Filtro por cartão específico

### Causa raiz da inconsistência de cor

A cor do cartão em "Gastos por Método" usa `expense.card?.color`, que vem de um JOIN com a tabela `cards`. Devido ao RLS, `cards` só é visível para o dono — outros membros do grupo recebem `card: null`, caindo no fallback genérico (`#FFA500` para crédito, `#3B82F6` para débito). É o mesmo padrão do bug anterior com `card_name`.

**Solução**: Denormalizar `card_color` nas tabelas `expenses` e `recurring_expenses`, da mesma forma que já existe `card_name`.

### Mudanças

#### 1. Migração: adicionar coluna `card_color`

```sql
ALTER TABLE expenses ADD COLUMN card_color text DEFAULT NULL;
ALTER TABLE recurring_expenses ADD COLUMN card_color text DEFAULT NULL;

-- Backfill dados existentes a partir dos cards
UPDATE expenses e SET card_color = c.color FROM cards c WHERE e.card_id = c.id AND e.card_color IS NULL;
UPDATE recurring_expenses re SET card_color = c.color FROM cards c WHERE re.card_id = c.id AND re.card_color IS NULL;
```

#### 2. `src/pages/Index.tsx` — Salvar `card_color` no INSERT

Nos inserts de `addExpense` e `addRecurringExpense`, adicionar `card_color: selectedCard?.color || null` junto ao `card_name`.

#### 3. `src/components/expense-summary.tsx` — Usar cor denormalizada + Filtro por cartão

**Cor**: Mudar `expense.card?.color || '#FFA500'` para `expense.card?.color || expense.card_color || '#FFA500'` (prioriza join local, fallback para denormalizado, depois genérico).

**Filtro por cartão**: 
- Nova prop `onCardClick?: (cardName: string, method: PaymentMethod) => void` e `activeCardName?: string`
- Tornar cada item de cartão clicável
- Destacar visualmente o cartão selecionado (background sutil)

#### 4. `src/pages/Index.tsx` — Handler de filtro por cartão

- Novo estado `activeCardFilter: { cardName: string; method: PaymentMethod } | null`
- `handleCardFilter(cardName, method)`: toggle filtro
- Aplicar filtro em `displayedExpenses` e `displayedRecurringExpenses`: filtrar por `card_name === cardName` (ou "Sem cartão" para `card_name === null`)
- Incluir no `hasActiveFilters` e `clearAllFilters`
- Passar `onCardClick` e `activeCardName` ao `ExpenseSummary`

#### 5. `src/components/expense-list.tsx` — Cor do nome do cartão

No `methodLabel`, separar o rendering: "Crédito" em cor normal + nome do cartão com `style={{ color: cardColor }}`, usando `expense.card?.color || expense.card_color || undefined`.

#### 6. `src/components/recurring-expense-list.tsx` — Mesma cor do cartão

Mesmo padrão: colorir o nome do cartão com a cor real.

#### 7. Tipos — Atualizar `Expense` e `RecurringExpense`

Adicionar `card_color?: string | null` nos tipos (após a migração, o campo estará no DB e nos types gerados, mas enquanto os types não se atualizam, declarar no type extension).

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar `card_color` em expenses e recurring_expenses |
| `src/types/expense.ts` | Adicionar `card_color` no type |
| `src/types/recurring-expense.ts` | Adicionar `card_color` no type |
| `src/pages/Index.tsx` | Salvar `card_color` nos inserts, novo estado/handler de filtro por cartão, aplicar filtro |
| `src/components/expense-summary.tsx` | Usar cor denormalizada, tornar cartões clicáveis, highlight ativo |
| `src/components/expense-list.tsx` | Colorir nome do cartão |
| `src/components/recurring-expense-list.tsx` | Colorir nome do cartão |

