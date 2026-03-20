

## Plano Revisado: Parcelamento como Série (com reforços confirmados)

### Estratégia

Mesma base do plano aprovado, com dois reforços explícitos:

---

### Reforço 1 — Proteção nos handlers (não só na UI)

Em `Index.tsx`, nos 4 handlers (`deleteExpense`, `deleteIncome`, `updateExpense`, `updateIncome`):

**Guard no início de cada função:**
- Buscar o item no state local pelo `id`
- Se `installment_group_id` existir E `installment_number > 1` → bloquear com toast de erro ("Esta parcela não pode ser editada/excluída diretamente. Use a 1ª parcela da série.") e retornar sem executar
- Isso garante que mesmo se a UI falhar em esconder os botões, a operação é barrada na lógica

Exemplo para `deleteExpense`:
```
const expense = expenses.find(e => e.id === id);
if (expense?.installment_group_id && (expense?.installment_number ?? 1) > 1) {
  toast({ title: "Ação bloqueada", description: "Use a 1ª parcela para gerenciar esta série.", variant: "destructive" });
  return;
}
```

Mesma lógica para `deleteIncome`, `updateExpense`, `updateIncome`.

---

### Reforço 2 — Tratamento de datas na edição da série

**Análise:** Os edit dialogs atuais permitem alterar a data (`expenseDate` / `incomeDate`). Na edição da 1ª parcela de uma série, a data editada será tratada assim:

**Abordagem:** Ao editar a 1ª parcela de uma série:
- A **data da 1ª parcela** é atualizada para o valor informado no formulário
- As **datas das parcelas 2+ são recalculadas** incrementando mês a mês a partir da nova data da 1ª parcela
- Parcela 2 = data da 1ª + 1 mês, Parcela 3 = data da 1ª + 2 meses, etc.
- Isso mantém o cronograma consistente e previsível

Campos propagados na série (mesma lógica para despesas e entradas):
- `description` → atualizada com sufixo `(X/N)` preservado
- `amount` → mesmo valor em todas
- `category` / `category_id` / `category_name` / `category_icon` → propagados
- `expense_date` / `income_date` → recalculadas mês a mês
- Para despesas: `card_id`, `card_name`, `card_color`, `payment_method` → propagados
- **Preservados individualmente:** `installment_number`, `paid_by` (responsável por parcela)

---

### Implementação completa (6 partes)

#### 1. `transaction-detail-sheet.tsx`
- Parcela 2+: esconder Editar/Excluir, banner de aviso, botão "Abrir 1ª parcela"
- Parcela 1: badge "Gerencia esta série", ações normais
- Novo prop `onOpenFirstInstallment`

#### 2. `Index.tsx` — Guards nos handlers
- `deleteExpense`, `deleteIncome`: guard de `installment_number > 1`, depois exclusão em lote por `installment_group_id`
- `updateExpense`, `updateIncome`: guard de `installment_number > 1`, depois edição em lote com recálculo de datas

#### 3. `Index.tsx` — Exclusão em lote
- Se parcela 1 com `installment_group_id`: `supabase.delete().eq('installment_group_id', groupId)`, atualizar state removendo todas

#### 4. `Index.tsx` — Edição em lote
- Buscar todas parcelas da série, atualizar campos comuns + recalcular datas, preservar `installment_number` e `paid_by`

#### 5. `expense-list.tsx` e `income-list.tsx`
- Mensagem de confirmação diferenciada para série na 1ª parcela
- Esconder delete na UI para parcelas 2+

#### 6. `Index.tsx` — Handler `handleOpenFirstInstallment`
- Busca parcela 1 no state, abre detail sheet

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `transaction-detail-sheet.tsx` | Banner, ações condicionais, botão "Abrir 1ª parcela" |
| `Index.tsx` | Guards, exclusão em lote, edição em lote com recálculo de datas, handler abrir 1ª parcela |
| `expense-list.tsx` | Mensagem de série, esconder ações em parcela 2+ |
| `income-list.tsx` | Mensagem de série, esconder ações em parcela 2+ |

Nenhuma migração SQL necessária.

