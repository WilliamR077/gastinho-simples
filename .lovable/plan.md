

## Plano: Despesa Parcelada em Grupo com Responsável por Parcela

### Estratégia

Cada parcela de uma despesa parcelada já é um registro individual na tabela `expenses` (com `installment_group_id` compartilhado). A coluna `paid_by` já existe na tabela. A abordagem é:

1. Reutilizar `paid_by` em cada parcela para indicar o responsável individual
2. Não criar novas tabelas nem colunas — apenas preencher `paid_by` por parcela na criação
3. Bloquear combinação de rateio compartilhado (`is_shared`) com responsáveis por parcela

---

### 1. Formulário — `unified-expense-form-sheet.tsx`

Condição de exibição: `selectedDestination !== "personal"` E `paymentMethod === "credit"` E `parseInt(installments) > 1` E `expenseType === "monthly"`

Nova seção "Responsável pelas parcelas" com RadioGroup:
- `"same"` → Mesmo responsável em todas (default) — mostra Select com membros do grupo
- `"per_installment"` → Definir responsável por parcela — mostra N selects, um por parcela

Preview: "Parcela 1/3 — mês/ano — responsável: fulano"

**Bloqueio com rateio**: Quando esta seção estiver ativa (per_installment mode), desabilitar a seção de rateio compartilhado e vice-versa. Se `isShared === true`, esconder esta seção. Se `installmentAssignment === "per_installment"`, esconder rateio. Mensagem: "Nesta versão, escolha entre despesa compartilhada ou responsáveis por parcela."

Novos estados:
- `installmentAssignment: "same" | "per_installment"` (default `"same"`)
- `installmentResponsibles: Record<number, string>` — mapa parcela → userId
- `sameResponsible: string` — userId do responsável único (default currentUserId)

### 2. Persistência — `Index.tsx` (bloco de múltiplas parcelas, ~linha 750)

No loop de criação de parcelas (`for (let i = 1; i <= installments; i++)`):
- Se `installmentAssignment === "per_installment"`: adicionar `paid_by: installmentResponsibles[i]` a cada registro
- Se `installmentAssignment === "same"`: adicionar `paid_by: sameResponsible` a todos
- Não setar `is_shared: true` (não é rateio)

O `ExpenseFormData` precisa de novos campos opcionais:
- `installmentAssignment?: "same" | "per_installment"`
- `installmentResponsibles?: Record<number, string>`
- `sameResponsible?: string`

### 3. "Gastos por Membro" — `group-member-summary.tsx`

Hoje usa `exp.user_id` para contabilizar. Ajustar para:
- Se `exp.paid_by` estiver preenchido, usar `exp.paid_by` em vez de `exp.user_id`
- Isso faz com que cada parcela conte para o membro responsável automaticamente

### 4. Lista — `expense-list.tsx`

Quando `isGroupContext` e `expense.paid_by` e `expense.paid_by !== expense.user_id`:
- Mostrar o responsável (`paid_by`) em vez do criador na linha de membros
- Badge "Resp: fulano" na linha da parcela

### 5. Detalhe — `transaction-detail-sheet.tsx`

Quando a despesa tem `paid_by` diferente do `user_id`:
- Mostrar "Responsável: fulano" além de "Criado por: ciclano"
- Se pertence a um grupo de parcelas (`installment_group_id`), já existe a seção de parcelas do conjunto — adicionar o nome do responsável de cada parcela nessa listagem

### 6. Validações

- Cada parcela precisa ter responsável válido (membro do grupo)
- `installmentAssignment === "per_installment"` bloqueia `isShared`
- `isShared === true` bloqueia `installmentAssignment === "per_installment"`

---

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/types/expense.ts` | Novos campos opcionais em `ExpenseFormData` |
| `src/components/unified-expense-form-sheet.tsx` | Nova seção "Responsável pelas parcelas" + bloqueio mútuo com rateio |
| `src/pages/Index.tsx` | Preencher `paid_by` por parcela na criação |
| `src/components/group-member-summary.tsx` | Usar `paid_by` quando disponível |
| `src/components/expense-list.tsx` | Mostrar responsável da parcela |
| `src/components/transaction-detail-sheet.tsx` | Mostrar responsável no detalhe + responsáveis por parcela no conjunto |

Nenhuma migração SQL necessária — `paid_by` já existe na tabela `expenses`.

