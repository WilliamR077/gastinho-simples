

## Plano: Correções + Edição Compartilhada + Detalhamento do Acerto

### Escopo

10 itens organizados em 3 prioridades: (1) correções de permissão e validação, (2) edição completa de despesa compartilhada, (3) detalhamento premium do card "Acerto entre Membros" com compartilhamento.

---

### 1. Esconder Editar/Excluir para quem não criou

**Arquivo: `transaction-detail-sheet.tsx`**

O `DrawerFooter` (linhas 375-402) mostra Editar, Duplicar e Excluir incondicionalmente. Solução:

- Comparar `(transaction as any).user_id === user?.id`
- Se `false` e `isGroupContext`, esconder os 3 botões
- Mantém a estrutura para futuro suporte a admin/dono

---

### 2. Impedir salvar compartilhada sem participantes

**Arquivo: `unified-expense-form-sheet.tsx`**

Na `handleSubmit` (linha 252), a condição `splitParticipants.length > 0` faz com que despesa compartilhada sem participantes caia no branch sem split (salva como individual). Solução:

- Se `isShared === true` e `selectedDestination !== "personal"` e `splitParticipants.length === 0`: bloquear submit e mostrar toast/mensagem inline
- Adicionar estado `splitError` exibido abaixo da seção de participantes

---

### 3. Edição completa de despesa compartilhada

**Arquivo: `expense-edit-dialog.tsx`** — Refatorar para suportar campos de split.

Mudanças:
- Adicionar props: `groupMembers`, `currentUserId`, `isGroupContext`
- Adicionar estados de split (`isShared`, `paidBy`, `splitType`, `splitParticipants`) e preencher com dados existentes (`expense.is_shared`, `expense.paid_by`, `expense.split_type`, `expense.splits`)
- Renderizar `ExpenseSplitSection` quando `isGroupContext`
- No `handleSubmit`, incluir dados de split no `ExpenseFormData`

**Arquivo: `Index.tsx`** — Na `updateExpense`:
- Se `data.isShared`: atualizar `is_shared`, `paid_by`, `split_type` na expenses, depois deletar splits antigos e inserir novos
- Se mudou de compartilhada para individual: setar `is_shared: false`, `paid_by: null`, `split_type: null`, deletar splits
- Após salvar, recarregar splits para atualizar o card de saldo

**Arquivo: `expense-list.tsx` e `recurring-expense-list.tsx`** — Passar `currentUserId` ao `TransactionDetailSheet` (já disponível via props).

**Passagem de props**: `ExpenseEditDialog` precisa receber `groupMembers` e `currentUserId` de `Index.tsx`.

---

### 4. Detalhamento do Acerto entre Membros

**Novo arquivo: `src/components/group-settlement-detail.tsx`**

Um Drawer/Sheet que abre ao clicar no card "Acerto entre Membros".

**Seções:**

1. **Cabeçalho**: nome do grupo, total a acertar, nº de transferências
2. **Quem paga para quem**: algoritmo de reconciliação que minimiza transferências
3. **Composição do saldo por membro**: lista de despesas que formaram cada saldo
4. **Clique na despesa**: abre `TransactionDetailSheet` da despesa citada
5. **Botão compartilhar**: gera texto estruturado e usa `navigator.share()` / clipboard

**Algoritmo de reconciliação (minimizar transferências):**
```
1. Calcular saldo de cada membro (paid - owed)
2. Separar devedores (saldo < 0) e credores (saldo > 0)
3. Ordenar: devedores por maior dívida, credores por maior crédito
4. Greedy matching: debtor paga ao credor o min(|dívida|, crédito)
5. Repetir até todos zerados
```

**Composição do saldo**: Para cada membro, iterar pelas despesas compartilhadas e mostrar quanto foi sua parte vs. quanto pagou em cada uma.

**Arquivo: `group-balance-summary.tsx`** — Tornar o card clicável (onClick abre o drawer de detalhamento). Adicionar `cursor-pointer` e chevron visual.

---

### 5. Compartilhar resumo do acerto

Dentro do `group-settlement-detail.tsx`:
- Botão "Compartilhar" no rodapé
- Gera texto formatado:
  ```
  📊 Acerto — Grupo: [nome]
  
  💸 Transferências:
  • William paga R$ 1.366,66 para João
  • William paga R$ 66,67 para Viviane
  
  Gerado em dd/MM/yyyy pelo Gastinho Simples
  ```
- Usa `navigator.share({ text })` se disponível, senão `navigator.clipboard.writeText()` + toast

---

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `transaction-detail-sheet.tsx` | Esconder Editar/Excluir se `user_id !== user.id` |
| `unified-expense-form-sheet.tsx` | Validação: bloquear submit se compartilhada sem participantes |
| `expense-edit-dialog.tsx` | Adicionar seção de split completa (paidBy, participantes, tipo divisão) |
| `Index.tsx` | `updateExpense`: atualizar splits no DB; passar `groupMembers`/`currentUserId` ao edit dialog |
| `expense-list.tsx` | Passar `currentUserId` ao `TransactionDetailSheet` |
| `recurring-expense-list.tsx` | Passar `currentUserId` ao `TransactionDetailSheet` |
| `group-balance-summary.tsx` | Tornar clicável, abrir drawer de detalhamento |
| `group-settlement-detail.tsx` | **Novo** — detalhamento completo do acerto com reconciliação, composição e compartilhamento |
| `expense-split-section.tsx` | Suportar preenchimento inicial (modo edição) via props opcionais |

