

## Plano: Bottom sheet de detalhes para transações

Criar um componente de bottom sheet reutilizável que abre ao tocar numa linha de despesa ou entrada, exibindo detalhes completos e ações.

---

### 1. Novo componente: `src/components/transaction-detail-sheet.tsx`

Componente genérico que recebe dados de despesa OU entrada e exibe um Drawer (vaul) com:

**Conteúdo:**
- Handle de arraste (já incluso no DrawerContent)
- Emoji + Título (descrição) + Valor (vermelho para despesa, verde para entrada)
- Separador
- Lista de detalhes em formato label/valor:
  - Categoria (emoji + nome)
  - Data (formato dd/MM/yyyy)
  - Método de pagamento / Cartão (só despesas)
  - Parcelas (só se > 1)
  - Grupo compartilhado (se houver)
  - Criado em (formato dd/MM/yyyy HH:mm)
- Separador
- 3 botões de ação: Editar, Duplicar, Excluir

**Props:**
```tsx
interface TransactionDetailSheetProps {
  expense?: Expense | null;
  income?: Income | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  formatCurrency: (value: number) => string;
}
```

Usa `Drawer` / `DrawerContent` / `DrawerHeader` / `DrawerFooter` do vaul — fecha ao arrastar para baixo e ao tocar no overlay automaticamente.

Layout dos botões de ação no footer:
```tsx
<DrawerFooter className="flex-row gap-2 pb-safe">
  <Button variant="outline" className="flex-1" onClick={onEdit}>
    <Pencil /> Editar
  </Button>
  <Button variant="outline" className="flex-1" onClick={onDuplicate}>
    <Copy /> Duplicar
  </Button>
  <Button variant="outline" className="flex-1 text-destructive" onClick={onDelete}>
    <Trash2 /> Excluir
  </Button>
</DrawerFooter>
```

---

### 2. Integrar no `expense-list.tsx`

- Adicionar state: `const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)`
- Adicionar prop: `onDuplicateExpense?: (expense: Expense) => void`
- No `<div>` de cada linha, adicionar `onClick={() => setSelectedExpense(expense)}` com `cursor-pointer`
- Remover o `DropdownMenu` (3 pontos) de cada linha — as ações agora vivem no bottom sheet
- Manter o botão de calculadora (se existir) como ação rápida na linha
- Renderizar `<TransactionDetailSheet>` no final do componente

---

### 3. Integrar no `income-list.tsx`

- Mesmo padrão: state `selectedIncome`, onClick na linha, remover DropdownMenu
- Adicionar prop `onDuplicate?: (income: Income) => void`
- Renderizar `<TransactionDetailSheet>` com dados de income

---

### 4. Propagar `onDuplicate` no `Index.tsx`

- Adicionar handlers `handleDuplicateExpense` e `handleDuplicateIncome` que abrem o form sheet pré-preenchido com os dados da transação (mesma lógica do edit, mas sem ID — cria nova)
- Passar as novas props para `<ExpenseList>` e `<IncomeList>`

---

### Resumo de alterações

| Arquivo | Mudança |
|---|---|
| `transaction-detail-sheet.tsx` | Novo componente — Drawer com detalhes + ações |
| `expense-list.tsx` | Linha clicável → abre sheet; remove DropdownMenu |
| `income-list.tsx` | Linha clicável → abre sheet; remove DropdownMenu |
| `Index.tsx` | Adicionar handlers de duplicação e passar props |

4 arquivos. Sem alteração de dados/backend.

