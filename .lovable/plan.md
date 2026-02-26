

## Plano: Unificar BalanceSummary + compactar ExpenseSummary

Apenas alterações de layout/estilo — sem alterar lógica, cálculos ou dados.

---

### 1. BalanceSummary → Card único "Resumo do Mês"

**Arquivo: `src/components/balance-summary.tsx`**

Substituir os 3 mini-cards separados por 1 card único com 3 colunas internas:

```text
┌─────────────────────────────────────────────┐
│  Resumo do Mês                              │
│  ┌──────────┬──────────┬──────────┐         │
│  │ ▲ Entradas│ ▼ Saídas │ 💰 Saldo │         │
│  │ R$ 5.000 │ R$ 3.200 │ R$ 1.800 │         │
│  └──────────┴──────────┴──────────┘         │
└─────────────────────────────────────────────┘
```

- Wrapper: `<div className="rounded-lg border border-border/50 bg-card shadow-sm p-4">`
- Título: `<h3 className="text-xs font-medium text-muted-foreground mb-3">Resumo do Mês</h3>`
- Dentro: `grid grid-cols-3 gap-3` com divs simples (sem borda/fundo individual)
- Cada coluna: ícone + label (text-xs) + valor (text-sm font-bold) com cores semânticas mantidas (verde entradas, vermelho saídas, azul saldo)
- Remover os `bg-green-500/10`, `bg-red-500/10`, `bg-blue-500/10` dos itens individuais — a cor fica só no texto/ícone
- Separadores verticais opcionais via `divide-x divide-border/30` no grid

### 2. ExpenseSummary → Seção compacta de rows

**Arquivo: `src/components/expense-summary.tsx`**

Substituir os 4 Cards grandes (PIX, Débito, Crédito, Total) por uma lista compacta de rows dentro de 1 card:

```text
┌─────────────────────────────────────────────┐
│  Gastos por Método              Total: R$X  │
│  ─────────────────────────────────────────── │
│  📱 PIX          R$ 500,00      3 transações│
│  💳 Débito       R$ 0,00        0 transações│  ← opacidade reduzida
│  💳 Crédito      R$ 1.200,00    5 transações│
│     ● Nubank: R$ 800  ● Inter: R$ 400      │
│  ─────────────────────────────────────────── │
│  🎯 Metas do Mês  [progresso...]            │
└─────────────────────────────────────────────┘
```

Detalhes:
- 1 card wrapper: `rounded-lg border border-border/50 bg-card shadow-sm p-4`
- Header: "Gastos por Método" + Total alinhado à direita
- Cada método de pagamento vira uma row clicável: `flex items-center justify-between py-2 cursor-pointer`
  - Esquerda: ícone colorido (h-4 w-4) + nome (text-sm)
  - Direita: valor (text-sm font-semibold) + contagem (text-xs text-muted-foreground)
  - Quando `activePaymentMethod` coincide: `bg-muted/50 rounded-md -mx-2 px-2` (highlight suave)
  - Separadores entre rows: `border-b border-border/30 last:border-0`
- **Valor R$ 0**: row fica com `opacity-50` e sem detalhes de cartão expandidos
- Detalhes por cartão (crédito/débito): exibidos inline abaixo da row correspondente, com indent (`pl-8`), dots coloridos + nome + valor em `text-xs`
- Seção "Metas do Mês" no rodapé do card: mantida como está (progress bars), separada por `border-t border-border/50 mt-3 pt-3`
- Cores dos ícones/valores mantidas: emerald para PIX, blue para débito, amber para crédito, muted para total
- Remover os `<Card>`, `<CardHeader>`, `<CardContent>` individuais — tudo dentro de 1 card

### 3. Index.tsx — ajuste de espaçamento

**Arquivo: `src/pages/Index.tsx`**

- `mb-4` entre BalanceSummary e ExpenseSummary → `mb-3` (12px, mais coeso)
- Demais espaçamentos mantidos

---

### Resumo de alterações

| Arquivo | Mudança |
|---|---|
| `src/components/balance-summary.tsx` | 3 mini-cards → 1 card com 3 colunas internas |
| `src/components/expense-summary.tsx` | 4 cards grandes → 1 card com rows compactas |
| `src/pages/Index.tsx` | Ajuste de `mb-4` → `mb-3` entre seções |

Nenhuma alteração de lógica, cálculos, API ou rotas.

