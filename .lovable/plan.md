

## Plano: Ajustar semântica de cores e estados ativos das tabs

Apenas mudanças de classes CSS — sem alterar layout, lógica ou dados.

---

### 1. Saldo → Azul/Ciano (não verde)

**`src/components/balance-summary.tsx`** (linhas 46-53)
- Trocar `bg-primary/10 border-primary/20` → `bg-blue-500/10 border-blue-500/20`
- Trocar `text-primary` → `text-blue-600 dark:text-blue-400`
- Aplicar em ambos os estados (positivo e negativo). Saldo positivo = azul, saldo negativo = laranja (manter)

### 2. Chips de Despesas → Vermelho (não verde/primary)

**`src/pages/Index.tsx`** (linhas 1620-1638)
- Chips "Do Mês" e "Fixas" dentro da tab Despesas: trocar `bg-primary text-primary-foreground border-primary` → `bg-red-500 text-white border-red-500`

### 3. Chips de Entradas já estão corretos

**`src/pages/Index.tsx`** (linhas 1700-1714)
- Chips da tab Entradas já usam `bg-green-500 text-white border-green-500`. Sem alteração.

### 4. Tabs principais — já estão corretas

As tabs em linhas 1585-1587 já usam:
- Despesas: `data-[state=active]:text-red-600`
- Entradas: `data-[state=active]:text-green-600`
- Metas: `data-[state=active]:text-amber-600`

Sem alteração necessária.

### 5. Metas de Saldo heading — já azul

Linha 1792 já usa `text-blue-600 dark:text-blue-400`. Sem alteração.

---

### Resumo de alterações

| Arquivo | Mudança |
|---|---|
| `balance-summary.tsx` | Saldo positivo: `text-primary` → `text-blue-600 dark:text-blue-400`, fundo `bg-primary/10` → `bg-blue-500/10` |
| `Index.tsx` | Chips despesas: `bg-primary` → `bg-red-500` (2 ocorrências, linhas 1623 e 1634) |

Total: 2 arquivos, ~6 linhas de classes CSS alteradas.

