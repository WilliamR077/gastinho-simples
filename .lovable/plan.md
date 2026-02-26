

## Plano: Reorganizar UI do Dashboard - Remover efeito sanduiche

### Problema atual

A tela principal empilha multiplas barras de controle uma sobre a outra:
1. MonthNavigator
2. BalanceSummary
3. ExpenseSummary
4. Banners de alerta
5. Filtros (card collapsible com tabs internas Despesas/Entradas)
6. Tabs principais (Despesas/Entradas/Metas) - full-width
7. Dentro de Despesas: CategorySummary (accordion) + sub-tabs Do Mes/Fixas
8. Dentro de Entradas: IncomeCategorySummary (accordion) + sub-tabs Do Mes/Fixas
9. Dentro de Metas: sub-tabs Despesas/Entradas/Saldo
10. FAB (+) e botao Calculadora como 2 botoes flutuantes separados

Resultado: "sanduiche" de controles onde o conteudo real (listas) fica enterrado.

### Arquivos que serao criados

**`src/components/compact-filter-bar.tsx`** - Nova barra de filtros compacta que substitui `ExpenseFilters`. No estado padrao mostra uma unica linha:
```text
[📅 Fev 2026]  [2 filtros ativos]  [Editar ▼]  [✕ Limpar]
```
Ao clicar em "Editar", expande e mostra o formulario completo de filtros (descrição, valores, pagamento, cartão, fatura, datas personalizadas). Os campos exibidos adaptam-se automaticamente a tab ativa: na tab Despesas mostra campos de pagamento/cartão/fatura; na tab Entradas mostra apenas descrição e valores; na tab Metas mostra apenas descrição e valores. Remove-se o toggle interno Despesas/Entradas.

**`src/components/category-insight-card.tsx`** - Novo componente que transforma o CategorySummary de accordion em card de insight. Mostra as top 3 categorias com barras de progresso inline, total, e um botao "Ver detalhes" que expande para mostrar todas. Visual de card de conteudo, nao de settings/accordion.

**`src/components/income-category-insight-card.tsx`** - Mesmo conceito para entradas. Mostra top 3 categorias de entrada com barras verdes e "Ver detalhes".

### Arquivos que serao modificados

**`src/pages/Index.tsx`** - Refatoracao principal:

1. **Filtros**: Substituir `<ExpenseFilters>` por `<CompactFilterBar>`, passando `activeTab` para adaptacao automatica dos campos.

2. **Sub-tabs Do Mes/Fixas → Chips**: Dentro da tab Despesas e Entradas, trocar a `TabsList grid-cols-2` (Do Mes / Fixas) por chips pequenos inline no header da lista:
```text
Suas Despesas          [Do Mês ●] [Fixas]
```
Usar botoes `variant="outline"` pequenos (`size="sm"`) com `rounded-full` para visual de chip. O chip ativo fica com fundo preenchido.

3. **CategorySummary → CategoryInsightCard**: Substituir o `<CategorySummary>` accordion pelo novo `<CategoryInsightCard>` que mostra top 3 categorias por padrao com opcao "Ver todas".

4. **IncomeCategorySummary → IncomeCategoryInsightCard**: Mesmo para entradas.

5. **Metas - remover sub-tabs**: Na tab Metas, remover a `<Tabs>` interna com Despesas/Entradas/Saldo. Em vez disso, renderizar 3 secoes na mesma tela:
   - Secao "Limites de Despesas" com `<BudgetProgress>` filtrado para expense goals
   - Secao "Metas de Entradas" com `<BudgetProgress>` filtrado para income goals
   - Secao "Metas de Saldo" com `<BudgetProgress>` filtrado para balance goals
   Cada secao com um titulo e divisor visual. Secoes vazias sao omitidas.

6. **FAB unificado**: Mover `onCalculatorClick` para dentro do `FloatingActionButton`, removendo o botao de calculadora separado. O FAB fica com 4 opcoes: Meta, Entrada, Despesa, Calculadora.

7. **Espacamentos**: Reduzir `mb-8` do ExpenseSummary para `mb-4`. Remover `mb-4` extras entre controles. Usar `gap-3` consistente.

**`src/components/floating-action-button.tsx`** - Incorporar botao de calculadora como 4a opcao dentro do menu do FAB (icone Calculator, cor neutra/secondary). Remover o botao fixo separado de calculadora que ficava sempre visivel.

**`src/components/expense-filters.tsx`** - Manter arquivo existente mas a interface publica (props e tipos exportados como `ExpenseFilters`, `FilterTab`) continua disponivel para o novo componente reutilizar. O componente visual antigo deixa de ser usado no Index.

### Detalhes tecnicos

- `CompactFilterBar` recebe `activeTab: "expenses" | "incomes" | "goals"` e mostra campos condicionalmente
- Contagem de filtros ativos calculada a partir de `filters.description`, `filters.minAmount`, `filters.maxAmount`, `filters.paymentMethod`, `filters.cardId`, `filters.billingPeriod`
- Os chips Do Mes/Fixas usam o estado `expenseSubTab`/`incomeSubTab` existente, apenas mudando o visual de tabs para botoes pill
- Na aba Metas sem sub-tabs, os 3 blocos de `BudgetProgress` ficam empilhados verticalmente com headers `<h3>` simples e `<Separator>` entre eles
- O FAB unificado mantem a mesma logica de backdrop e animacao, adicionando Calculator como 4o item com cor `bg-secondary`

### Resumo visual

```text
ANTES (sanduiche):
[MonthNavigator]
[BalanceSummary]
[ExpenseSummary]
[Banners]
[====== Filtros (card pesado) ======]
[== Despesas | Entradas | Metas ==]  ← tabs full-width
  [=== Gastos por Categoria ===]     ← accordion
  [== Do Mes | Fixas ==]             ← segunda barra tabs
  [Lista...]

DEPOIS (limpo):
[MonthNavigator]
[BalanceSummary]
[ExpenseSummary]
[Banners]
[📅 Fev 2026 | 0 filtros | Editar ▼]  ← barra compacta
[== Despesas | Entradas | Metas ==]
  [Card insight: Top categorias]        ← card leve
  Suas Despesas  [Do Mes●] [Fixas]      ← chips inline
  [Lista...]
```

### Ordem de implementacao

1. `compact-filter-bar.tsx` (novo)
2. `category-insight-card.tsx` (novo)
3. `income-category-insight-card.tsx` (novo)
4. `floating-action-button.tsx` (modificar - unificar calculadora)
5. `src/pages/Index.tsx` (modificar - integrar tudo)

