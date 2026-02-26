

## Plano: Design System Mobile-First — Reduzir peso visual

### Objetivo
Aplicar espaçamento consistente, padronizar cards/tipografia/cores e criar banners slim em todos os componentes visuais da Home, sem alterar lógica, API ou rotas.

---

### 1. Escala de espaçamento e variáveis globais

**Arquivo: `src/index.css`**
- Adicionar classes utilitárias ou usar os valores Tailwind existentes (1=4px, 2=8px, 3=12px, 4=16px, 6=24px, 8=32px) de forma consistente nos componentes abaixo.

**Arquivo: `src/pages/Index.tsx`**
- Container: trocar `py-6` por `py-4` (16px)
- Entre seções (BalanceSummary, ExpenseSummary, Filtros, Tabs): usar `mb-6` (24px) consistente
- Entre itens dentro de cards/listas: `gap-3` (12px) ou `gap-4` (16px)
- Padding interno de cards: `p-4` (16px) consistente

---

### 2. Padronização de Cards — sombra sutil, fundo neutro

**Arquivo: `src/components/expense-summary.tsx`**
- Remover `bg-gradient-success`, `bg-gradient-primary`, `bg-gradient-card` dos 4 cards de resumo (PIX, Débito, Crédito, Total)
- Substituir por fundo neutro: `bg-card border border-border/50` para todos
- Cor como acento: manter ícone e texto do valor coloridos (verde para PIX, azul para débito, âmbar para crédito, primary para total), mas fundo do card sempre neutro
- Sombra: trocar `shadow-elegant` por `shadow-sm` (sutil)
- `hover:shadow-glow` → `hover:shadow-md`
- Adicionar borda-esquerda colorida (`border-l-2 border-l-green-500` para PIX, etc.) como acento visual
- Texto interno: trocar `text-success-foreground` por `text-foreground` com valores coloridos apenas no número principal
- Valor principal: `text-xl font-bold` (reduzir de `text-2xl` para caber melhor em mobile)

**Arquivo: `src/components/balance-summary.tsx`**
- Manter `bg-green-500/10`, `bg-red-500/10` pois são fundos tênues (acento, não saturados)
- Reduzir padding de `p-3` para `p-3` (manter) mas garantir `gap-2` entre os 3 mini-cards

**Arquivo: `src/components/ui/card.tsx`**
- Não alterar o componente base (já está com `shadow-sm`)

**Arquivo: `src/components/expense-list.tsx`**
- Card wrapper: trocar `bg-gradient-card border-border/50 shadow-card backdrop-blur-sm` por `bg-card border border-border/40 shadow-sm`
- Itens da lista: manter `p-4 rounded-lg border bg-card/50` → trocar para `p-3 rounded-lg border border-border/30 bg-card`
- Reduzir espaço vertical entre linhas internas: `mt-2` → `mt-1.5`, `mt-3` → `mt-2`

**Arquivo: `src/components/category-insight-card.tsx`**
- Já está com estilo leve (`rounded-lg border border-border/50 bg-card/50`). Manter, apenas garantir `p-4` e `shadow-sm`.

**Arquivo: `src/components/income-category-insight-card.tsx`**
- Mesmo tratamento que `category-insight-card.tsx`

**Arquivo: `src/components/budget-progress.tsx`**
- Cada goal card: reduzir padding do `CardHeader` e `CardContent`
- `CardHeader`: adicionar `pb-2` (reduzir de default `pb-4`)
- `CardTitle`: trocar `text-lg` por `text-base` (16px)
- Nos cards de alerta internos (dentro de cada goal), reduzir padding

---

### 3. Padronização tipográfica

Aplicar em todos os componentes tocados:

| Elemento | Atual | Novo |
|---|---|---|
| Títulos de seção (CardTitle) | `text-lg`/`text-2xl` | `text-base` (16px) |
| Valores principais (totais) | `text-2xl font-bold` | `text-xl font-bold` (mobile), `text-2xl` (desktop via `sm:text-2xl`) |
| Textos secundários (labels, datas) | `text-sm`/`text-xs` | `text-xs` (12-13px) consistente |
| Subtítulos | diversos | `text-sm font-medium` (14px) |

**Arquivos afetados:**
- `expense-summary.tsx`: valores `text-2xl` → `text-xl sm:text-2xl`
- `balance-summary.tsx`: valores `text-sm font-bold` → manter (já está pequeno)
- `expense-list.tsx`: título "Suas Despesas" `text-primary` → `text-base font-semibold text-foreground`
- `budget-progress.tsx`: `CardTitle text-lg` → `text-base`
- `month-navigator.tsx`: `text-lg font-semibold` → `text-base font-semibold sm:text-lg`

---

### 4. Semântica de cor — garantir que despesas ≠ verde

**Arquivo: `src/components/expense-summary.tsx`**
- Card de PIX: atualmente usa `bg-gradient-success` (verde) — trocar fundo para neutro, manter apenas texto/ícone em verde para acento. Alternativamente, usar azul-claro ou cinza para PIX (já que PIX é método de pagamento, não entrada)
- Decisão: PIX card → borda-esquerda `border-l-emerald-500` com fundo neutro. O verde no contexto de PIX é aceitável pois refere-se ao método (marca PIX), não à semântica entrada/saída
- Card Total: trocar `text-primary` (verde) por cor neutra — usar `text-foreground` para o valor total de despesas, pois despesas não devem ser verdes
- Card Total ícone: `text-primary` → `text-muted-foreground`

**Arquivo: `src/components/budget-progress.tsx`**
- Nas metas de despesa, a barra de progresso "safe" usa `bg-success` (verde). Manter, pois nesse contexto verde = "está OK/dentro do limite" (semântica de status, não de entrada/saída)

**Arquivo: `src/components/category-insight-card.tsx`**
- Título e valores usam `text-primary` (verde). Trocar para `text-red-500 dark:text-red-400` pois trata-se de gastos por categoria (despesa = vermelho/laranja)
- Barra de progresso: trocar `bg-gradient-primary` por `bg-red-500`

**Arquivo: `src/components/income-category-insight-card.tsx`**
- Já usa verde (`text-green-600`, `bg-green-500`). Correto, manter.

---

### 5. Banners slim para alertas

**Arquivos: `budget-alert-banner.tsx`, `income-goal-banner.tsx`, `balance-goal-banner.tsx`**

Transformar os 3 banners em estilo "slim" — 1-2 linhas com CTA inline:

- Reduzir de layout multi-linha para uma única div flexível
- Estrutura: `[Ícone] [Texto resumido 1 linha] [CTA botão pequeno] [X fechar]`
- Exemplo para `budget-alert-banner`: `🚨 2 metas estouradas — R$ 150 acima do limite [Ver metas →] [✕]`
- Remover o bloco detalhado com lista de metas individuais (o `slice(0, 2).map(...)`)
- Manter onClick no banner inteiro como fallback
- Padding: `px-4 py-2` (slim)
- Remover `mb-4` do Alert, colocar espaçamento no container pai (Index.tsx)
- Altura máxima: ~48px (2 linhas no mobile)

Mudanças específicas por banner:

**`budget-alert-banner.tsx`:**
- Linha única: `"🚨 {n} meta(s) estourada(s)!"` ou `"⚠️ {n} meta(s) precisando atenção"` + botão "Ver →"
- Remover blocos internos `.slice(0,2).map()`
- Remover o `<TrendingUp>` com texto "Clique para ver detalhes"

**`income-goal-banner.tsx`:**
- Linha única: `"🎉 Meta de entrada batida!"` ou `"💪 Quase lá!"` + botão "Ver →"
- Mesmo padrão de simplificação

**`balance-goal-banner.tsx`:**
- Linha única: `"🌟 Meta de saldo atingida!"` ou `"💪 Quase lá!"` + botão "Ver →"
- Mesmo padrão

---

### 6. Ajustes no MonthNavigator

**Arquivo: `src/components/month-navigator.tsx`**
- Reduzir `py-4` para `py-2` para ficar mais compacto
- Reduzir tamanho do ícone chevron de `h-6 w-6` para `h-5 w-5`
- Botão de navegação: `h-10 w-10` → `h-9 w-9`

---

### 7. Ajustes no CompactFilterBar

**Arquivo: `src/components/compact-filter-bar.tsx`**
- Já está razoavelmente compacto. Garantir `shadow-sm` em vez de nenhuma sombra
- Padding do botão compacto: `px-4 py-2.5` → `px-3 py-2`

---

### 8. Tabs principais — mais leves

**Arquivo: `src/pages/Index.tsx`**
- `TabsList`: adicionar `bg-muted/50` (mais translúcido) em vez do default opaco
- `mb-4` após TabsList → `mb-3`

---

### Resumo de arquivos modificados

| Arquivo | Tipo de mudança |
|---|---|
| `src/pages/Index.tsx` | Espaçamentos, tabs translúcidas |
| `src/components/expense-summary.tsx` | Cards neutros, borda-acento, tipografia, cores |
| `src/components/balance-summary.tsx` | Ajustes menores de espaçamento |
| `src/components/month-navigator.tsx` | Mais compacto |
| `src/components/budget-alert-banner.tsx` | Banner slim 1-2 linhas |
| `src/components/income-goal-banner.tsx` | Banner slim 1-2 linhas |
| `src/components/balance-goal-banner.tsx` | Banner slim 1-2 linhas |
| `src/components/category-insight-card.tsx` | Cor vermelha para despesas, shadow-sm |
| `src/components/expense-list.tsx` | Card/item mais leve, espaçamento |
| `src/components/compact-filter-bar.tsx` | Padding reduzido |
| `src/components/budget-progress.tsx` | Padding/tipografia reduzidos |

Nenhum arquivo de lógica, API, banco ou rotas será tocado.

