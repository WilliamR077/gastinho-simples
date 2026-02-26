

## Plano: Listas de transações escaneáveis (estilo app financeiro)

Apenas UI/estilo/layout — sem alterar lógica, dados, filtros ou rotas.

---

### 1. ExpenseList — rows compactas

**Arquivo: `src/components/expense-list.tsx`**

Reestruturar cada item de multi-linha vertical para row horizontal única:

```text
┌──────────────────────────────────────────────┐
│ 🍔  Almoço restaurante      -R$ 45,00       │
│     Alimentação • 15/02  💳 Crédito   ⋮     │
└──────────────────────────────────────────────┘
```

Mudanças específicas:
- **Remover "Criado em"** (linhas 155-163): excluir bloco inteiro
- **Remover Badge grande colorido** (linhas 166-187): substituir por indicador sutil inline na segunda linha — ícone do método (Smartphone/CreditCard h-3 w-3) + texto curto ("PIX", "Crédito - Nubank") em `text-xs text-muted-foreground`, sem fundo saturado
- **Layout da row**: manter `flex` mas achatar para 2 linhas máximo:
  - Linha 1: `[emoji categoria] [descrição] [parcelas se houver]` ... `[valor em vermelho alinhado à direita]`
  - Linha 2 (subtexto): `[nome categoria] • [data] • [ícone método + texto curto]` ... `[botões ⋮ e calculadora]`
- **Valor**: mover para a mesma linha da descrição, alinhado à direita com `ml-auto`
- **Remover ícone circular colorido duplicado** (linhas 132-136): o emoji da categoria já está presente, não precisa de 2 ícones. Remover o `<div className="p-2 rounded-full">` com ícone de método de pagamento
- **Espaçamento**: trocar `space-y-3` por `divide-y divide-border/30` entre items e remover `rounded-lg border` de cada item individual — usar padding `py-3 px-1` por item
- **Grupo badge**: manter inline mas sem fundo saturado — texto `text-xs text-indigo-500` com ícone Users
- **Padding do card**: `p-0` no CardContent, padding nos items via `py-3 px-4`

### 2. IncomeList — rows compactas

**Arquivo: `src/components/income-list.tsx`**

Mesmo padrão do ExpenseList:

- **Remover "Criado em"** (linhas 114-119)
- **Remover ícone circular duplicado** (linhas 97-100): o `<div className="p-2 rounded-full bg-green-500">` é redundante com o emoji na linha 104
- **Layout row**: 
  - Linha 1: `[emoji] [descrição]` ... `[+R$ valor em verde]`
  - Linha 2: `[categoria] • [data]` ... `[⋮]`
- **Card wrapper**: trocar `bg-gradient-card border-border/50 shadow-card backdrop-blur-sm` por `bg-card border border-border/40 shadow-sm`
- **Items**: trocar `space-y-3` por `divide-y divide-border/30`, itens com `py-3 px-4` sem borda/rounded individual

### 3. RecurringExpenseList — rows compactas

**Arquivo: `src/components/recurring-expense-list.tsx`**

- **Card wrapper** (linha 75): trocar `bg-gradient-card border-border/50 shadow-card backdrop-blur-sm` por `bg-card border border-border/40 shadow-sm`
- **CardTitle** (linha 77): trocar `text-primary` por `text-base font-semibold text-foreground`
- **Layout da row**: achatar para 2 linhas como ExpenseList
  - Linha 1: `[emoji] [descrição]` ... `[valor em vermelho]`
  - Linha 2: `[categoria] • Dia [n] • [método sutil]` ... `[⋮]`
- **Remover Badge colorido** (linhas 116-131): substituir por texto `text-xs text-muted-foreground` com ícone inline
- **Valor** (linha 137): trocar `text-primary` por `text-red-500 dark:text-red-400` (despesa = vermelho)
- **Items inativos**: manter `opacity-60`
- **Espaçamento**: `divide-y divide-border/30` em vez de `space-y-3`

### 4. RecurringIncomeList — rows compactas

**Arquivo: `src/components/recurring-income-list.tsx`**

- **Card wrapper** (linhas 70, 82-84): trocar `bg-gradient-card` por `bg-card border border-border/40 shadow-sm`
- **Remover ícone Wallet** circular (linhas 91-93): redundante com emoji
- **Layout row**: mesmo padrão
  - Linha 1: `[emoji] [descrição]` ... `[+valor em verde]`
  - Linha 2: `[categoria] • Dia [n]` ... `[⋮]`
- **Espaçamento**: `divide-y divide-border/30`

### 5. FAB não cobre conteúdo

**Arquivo: `src/pages/Index.tsx`**

- Linha 1486 já tem `pb-36` no container principal — suficiente para o FAB posicionado em `bottom-20` (80px) + altura do botão (56px) = ~136px. `pb-36` = 144px. Adequado, sem alteração necessária.

### 6. Seletor de mês — sem duplicação

- Verificado: existe apenas 1 `MonthNavigator` (linha 1503) no topo. Não há duplicação. Sem alteração.

---

### Resumo de alterações

| Arquivo | Mudança |
|---|---|
| `expense-list.tsx` | Row compacta 2 linhas, remover "Criado em", badge sutil inline, divide-y |
| `income-list.tsx` | Row compacta, remover "Criado em", remover ícone duplicado, bg-card |
| `recurring-expense-list.tsx` | Row compacta, badge sutil, valor em vermelho, bg-card, divide-y |
| `recurring-income-list.tsx` | Row compacta, remover Wallet icon, bg-card, divide-y |

Nenhuma alteração de lógica, dados, filtros ou rotas. FAB e MonthNavigator já estão corretos.

