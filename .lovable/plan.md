

## Plano: Polimento UX do Parcelamento como Série

### Visão Geral

7 ajustes de UX nos modais de edição e exclusão de séries parceladas (despesas e entradas). Nenhuma mudança de lógica principal.

---

### 1. Descrição base sem sufixo no campo de edição

**Utility function** em `src/lib/utils.ts`:
```ts
export function stripInstallmentSuffix(desc: string): string {
  return desc.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
}
```

**`expense-edit-dialog.tsx`** — no `form.reset()` (linha 127): usar `stripInstallmentSuffix(expense.description)` em vez de `expense.description` quando `expense.total_installments > 1`.

**`income-edit-dialog.tsx`** — mesma lógica no `form.reset()` (linha 65): usar `stripInstallmentSuffix(income.description)` quando `(income as any).total_installments > 1`.

A exibição visual `(X/N)` nas listas e no detalhe **não muda** — continua usando `expense.description` ou o badge existente diretamente.

### 2. Aviso melhorado no modal de edição

**`expense-edit-dialog.tsx`** — substituir o bloco de aviso existente (linhas 378-383) por um mais completo:

```
⚠️ Você está editando a 1ª parcela de uma série com N parcelas. 
As alterações feitas aqui serão aplicadas às demais parcelas da série. 
O número de parcelas não pode ser alterado nesta tela.
```

Usar `border-amber-200 bg-amber-50` no dark e light, com ícone `AlertTriangle`.

**`income-edit-dialog.tsx`** — adicionar bloco similar quando `income.total_installments > 1 && income.installment_number === 1`, antes dos botões de ação.

### 3. Resumo do total da série (tempo real)

**`expense-edit-dialog.tsx`** — abaixo do campo de valor, quando série (`expense.total_installments > 1`):
- Mostrar: `N parcelas × R$ X = R$ Total`
- Usar `form.watch("amount")` para atualizar em tempo real
- Texto auxiliar: "Alterar o valor da parcela atualizará todas as parcelas da série."

**`income-edit-dialog.tsx`** — mesma lógica: abaixo do campo de valor, quando `income.total_installments > 1`.

### 4. Confirmação de exclusão mais forte

**`expense-list.tsx`** (linhas 243-270) — quando `isDeleteSeries`:
- `AlertDialogAction` com classe `bg-destructive text-destructive-foreground hover:bg-destructive/90`
- Adicionar ícone `AlertTriangle` no título
- Texto: "⚠️ Atenção: esta é a 1ª parcela de uma série com N parcelas. Excluir esta parcela também excluirá as demais parcelas da série."

**`income-list.tsx`** (linhas 186-213) — mesma melhoria visual.

---

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/utils.ts` | Nova função `stripInstallmentSuffix` |
| `src/components/expense-edit-dialog.tsx` | Strip sufixo, aviso série melhorado, resumo total tempo real |
| `src/components/income-edit-dialog.tsx` | Strip sufixo, aviso série, resumo total tempo real |
| `src/components/expense-list.tsx` | AlertDialog de exclusão com visual de alerta mais forte |
| `src/components/income-list.tsx` | AlertDialog de exclusão com visual de alerta mais forte |

Nenhuma migração SQL necessária. Lógica principal inalterada.

