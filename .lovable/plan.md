

## Plano: Rateio de Despesas em Grupos

### Visão geral

Adicionar suporte a despesas compartilhadas (split/rateio) dentro de grupos, com 3 modos de divisão, card de saldo entre membros, e visualização clara na lista e detalhe.

---

### 1. Modelagem de banco — Nova tabela `expense_splits`

Uma nova tabela armazena os participantes e suas parcelas para cada despesa compartilhada. A despesa (`expenses`) ganha dois campos novos: `is_shared` (boolean) e `paid_by` (uuid).

```sql
-- Novos campos em expenses
ALTER TABLE expenses ADD COLUMN is_shared boolean NOT NULL DEFAULT false;
ALTER TABLE expenses ADD COLUMN paid_by uuid REFERENCES auth.users(id) DEFAULT NULL;
ALTER TABLE expenses ADD COLUMN split_type text DEFAULT NULL; -- 'equal', 'percentage', 'manual'

-- Tabela de participantes do rateio
CREATE TABLE expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  share_amount numeric NOT NULL,        -- valor final em R$
  share_percentage numeric DEFAULT NULL, -- se split_type = percentage
  created_at timestamptz DEFAULT now(),
  
  -- Campos desnormalizados para exibição (snapshot)
  user_email text DEFAULT NULL,
  
  UNIQUE(expense_id, user_id)
);

ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

-- RLS: membros do grupo da despesa podem ver os splits
CREATE POLICY "Users can view splits of their group expenses"
ON expense_splits FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.id = expense_splits.expense_id
    AND (
      e.user_id = auth.uid()
      OR (e.shared_group_id IS NOT NULL AND is_group_member(e.shared_group_id, auth.uid()))
    )
  )
);

-- INSERT: quem pode inserir despesas no grupo pode inserir splits
CREATE POLICY "Users can insert splits for their expenses"
ON expense_splits FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.id = expense_splits.expense_id
    AND e.user_id = auth.uid()
  )
);

-- DELETE: dono da despesa pode deletar splits
CREATE POLICY "Users can delete splits of their expenses"
ON expense_splits FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.id = expense_splits.expense_id
    AND e.user_id = auth.uid()
  )
);
```

**Por que esta modelagem:**
- `is_shared` na `expenses` distingue despesa individual de compartilhada sem ambiguidade
- `paid_by` é separado de `user_id` (criador) — atende ao requisito "criado por ≠ pago por"
- `split_type` registra a regra usada para referência futura
- `expense_splits` armazena o snapshot congelado dos participantes e valores
- O `share_amount` é sempre preenchido (calculado no momento da criação), independente do tipo de divisão
- `user_email` desnormalizado para que qualquer membro veja o nome do participante (mesmo padrão RLS-safe usado em category_name/card_name)

**Não alterar `recurring_expenses`** nesta fase (fora do escopo do MVP).

---

### 2. Tipos TypeScript

**Novo arquivo `src/types/expense-split.ts`:**
```typescript
export type SplitType = 'equal' | 'percentage' | 'manual';

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  share_amount: number;
  share_percentage?: number | null;
  user_email?: string | null;
  created_at: string;
}

export interface SplitParticipant {
  userId: string;
  email: string;
  amount: number;
  percentage?: number;
}
```

**Atualizar `src/types/expense.ts`:**
- Adicionar `is_shared`, `paid_by`, `split_type` ao tipo `Expense`
- Adicionar `splits?: ExpenseSplit[]` opcional

**Atualizar `ExpenseFormData`:**
- Adicionar campos: `isShared`, `paidBy`, `splitType`, `participants: SplitParticipant[]`

---

### 3. Formulário de criação — Seção "Rateio"

**Arquivo: `src/components/unified-expense-form-sheet.tsx`**

Quando o destino selecionado for um grupo, exibir nova seção após os campos atuais:

1. **Tipo da despesa**: Individual / Compartilhada (RadioGroup, default Individual)
2. Se Compartilhada:
   - **Pago por**: Select com membros do grupo (default = usuário atual)
   - **Participantes**: Checkboxes com membros do grupo (multi-select)
   - **Tipo de divisão**: Igualitária / Porcentagem / Valor manual (RadioGroup, default Igualitária)
   - **Preview da divisão**: mostra valor por pessoa calculado
   - Se Porcentagem: campos de % por participante (validar soma = 100%)
   - Se Manual: campos de R$ por participante (validar soma = total)

**Arredondamento igualitário**: distribuir centavos restantes ao primeiro participante.
Exemplo: R$100/3 → R$33,34 + R$33,33 + R$33,33.

Precisará receber `groupMembers` como prop (já disponível em Index.tsx).

---

### 4. Persistência — `addExpense` em Index.tsx

Ao submeter despesa compartilhada:
1. Inserir na `expenses` com `is_shared: true`, `paid_by`, `split_type`
2. Após obter o `id` da despesa inserida, inserir N linhas em `expense_splits` com os participantes e seus `share_amount`
3. Manter comportamento atual para despesas individuais (sem alterar nada)

---

### 5. Novo componente — Card "Acerto entre Membros"

**Novo arquivo: `src/components/group-balance-summary.tsx`**

Props: `expenses: Expense[]`, `groupMembers: SharedGroupMember[]`

Lógica:
- Filtrar `expenses` onde `is_shared === true`
- Para cada despesa compartilhada, buscar seus `splits` (carregados junto com as despesas via query)
- Calcular por membro:
  - `totalPaid` = soma de `amount` das despesas onde `paid_by === userId`
  - `totalOwed` = soma de `share_amount` de todos os splits onde `user_id === userId`
  - `balance = totalPaid - totalOwed`
- Exibir lista de membros com saldo, cor do membro, e indicação visual (positivo = tem a receber, negativo = deve)

Será renderizado em Index.tsx logo após o card "Gastos por Membro", apenas quando `currentContext.type === 'group'`.

---

### 6. Lista de despesas — Badge "Compartilhada"

**Arquivo: `src/components/expense-list.tsx`**

Para despesas onde `is_shared === true`:
- Mostrar badge discreto "Compartilhada" + número de participantes
- Mostrar "Sua parte: R$ X" se o usuário atual estiver nos splits
- Manter visual limpo para despesas individuais (sem mudança)

---

### 7. Detalhe da despesa — Seção "Rateio"

**Arquivo: `src/components/transaction-detail-sheet.tsx`**

Quando `expense.is_shared === true`:
- Mostrar "Pago por" com nome e cor do membro (similar a "Criado por")
- Mostrar "Tipo: Igualitária/Porcentagem/Manual"
- Mostrar lista de participantes com valor de cada um
- Mostrar "Sua parte: R$ X"

---

### 8. Carregamento dos splits

**Em Index.tsx `loadExpenses`**: após carregar expenses, fazer uma query secundária para carregar os splits de despesas compartilhadas:

```typescript
// Após carregar expenses
const sharedExpenseIds = expenses.filter(e => e.is_shared).map(e => e.id);
if (sharedExpenseIds.length > 0) {
  const { data: splits } = await supabase
    .from('expense_splits')
    .select('*')
    .in('expense_id', sharedExpenseIds);
  // Mapear splits para cada expense
}
```

---

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | 3 novos campos em `expenses`, nova tabela `expense_splits` com RLS |
| `src/types/expense-split.ts` | Novo — tipos de split |
| `src/types/expense.ts` | Adicionar `is_shared`, `paid_by`, `split_type`, `splits?` |
| `src/components/unified-expense-form-sheet.tsx` | Seção de rateio no formulário |
| `src/pages/Index.tsx` | Persistência dos splits, carregamento, estado, novo card |
| `src/components/group-balance-summary.tsx` | Novo — card "Acerto entre Membros" |
| `src/components/expense-list.tsx` | Badge "Compartilhada" + "Sua parte" |
| `src/components/transaction-detail-sheet.tsx` | Seção de rateio no detalhe |
| `src/components/group-member-summary.tsx` | Sem alteração (mantido como está) |

### Preparação para evolução futura

- A tabela `expense_splits` é genérica o suficiente para ser referenciada por `recurring_expenses` no futuro (bastaria adicionar `recurring_expense_id`)
- O campo `split_type` permite adicionar novos modos de divisão
- O snapshot desnormalizado (`user_email`, `share_amount`) garante que despesas antigas não quebram quando membros saem do grupo
- A separação clara entre "Gastos por Membro" (quanto pagou) e "Acerto entre Membros" (saldo) facilita futuras features como liquidação manual e histórico de pagamentos

