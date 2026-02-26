

## Plano: Metas premium e menos agressivas

Apenas UI/estilo/layout — sem alterar lógica, cálculos ou dados.

---

### 1. Alertas → banners slim (1–2 linhas)

**Arquivo: `src/components/budget-progress.tsx`**

Substituir os blocos `<Alert>` grandes (linhas 316-343, 416-443, 538-554) por banners inline slim:

```text
Antes:
┌──────────────────────────────────────────┐
│ ⚠️  Alerta! Você está quase estourando   │
│     a meta.                              │
│     Restam apenas R$ 50,00 para não      │
│     estourar.                            │
└──────────────────────────────────────────┘

Depois:
│ ⚠️ Quase no limite · restam R$ 50   [Ajustar] │
```

- Remover `<Alert>` + `<AlertDescription>` com blocos multi-linha
- Substituir por `<div className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs">` com:
  - Ícone (h-3.5 w-3.5) + texto curto inline (1 linha) + botão "Ajustar" (chama `onEdit(goal)`)
  - Fundo: sem fundo saturado, apenas `border-l-2` com cor semântica
- Para despesas: `border-l-2 border-destructive/50 bg-muted/50` + texto `text-xs text-muted-foreground`
- Para entradas: `border-l-2 border-green-500/50 bg-muted/50`
- Para saldo: `border-l-2 border-blue-500/50 bg-muted/50`

### 2. Cards de meta → fundo neutro, cor apenas em acentos

**Arquivo: `src/components/budget-progress.tsx`**

**Expense goals (renderExpenseGoal, linha 265-267):**
- Remover `${config.bgColor}` do Card className
- Usar sempre `bg-card` como fundo, independente do alert level
- Manter `border-l-2 ${config.borderColor}` como acento lateral (substituindo borda completa colorida)
- Resultado: `className="transition-all shadow-sm bg-card border-border/40 border-l-2 ${config.borderColor}"`

**Income goals (renderIncomeGoal, linhas 362-367):**
- Remover `bg-green-500/10`, `bg-green-400/5` — usar `bg-card` sempre
- Acento lateral: `border-l-2 border-green-500/50`

**Balance goals (renderBalanceGoal, linhas 491-495):**
- Remover `bg-blue-500/10`, `bg-blue-400/5` — usar `bg-card` sempre  
- Acento lateral: `border-l-2 border-blue-500/50`

### 3. Padronizar layout das 3 categorias de meta

Todas as metas (despesa, entrada, saldo) seguirão o mesmo layout compacto:

```text
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│ 🍔 Alimentação                          ⋮    │
│ Meta: R$ 500    Gasto: R$ 420    84.0%        │
│ ████████████████████░░░░                      │
│ ⚠️ Restam R$ 80                    [Ajustar]  │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

- CardHeader: `pb-1` (era `pb-2`) — mais compacto
- CardContent: `space-y-2` (era `space-y-3`)
- Linha de valores: `flex justify-between text-xs` (era `text-sm`)
- Progress bar: `h-2` (era `h-4` default) — barra mais fina e elegante
- Linha inferior: banner slim inline (item 1)

### 4. Espaçamento entre seções

**Arquivo: `src/components/budget-progress.tsx`**

- Linha 561: trocar `space-y-4` por `space-y-3` (12px entre cards)
- CardHeader padding: `p-4 pb-1` (compactar)
- CardContent padding: `px-4 pb-3 pt-0`

### 5. Form "Definir Nova Meta" — neutralizar

**Arquivo: `src/components/budget-goals-form.tsx`**

- Linha 60: trocar `bg-gradient-card border-border/50 shadow-card backdrop-blur-sm` por `bg-card border border-border/40 shadow-sm`
- Linha 62: trocar `text-primary` por `text-foreground`

---

### Resumo de alterações

| Arquivo | Mudança |
|---|---|
| `budget-progress.tsx` | Cards neutros (bg-card + border-l-2), alertas slim 1 linha, progress h-2, espaçamento compacto |
| `budget-goals-form.tsx` | Card neutro, título sem cor primária |

2 arquivos. Sem alteração de lógica.

