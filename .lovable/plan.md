
## Plano: Filtro por categoria nas entradas + Filtros acima das tabs

Duas mudancas:

### 1. Adicionar filtro por categoria clicavel no "Entradas por Categoria"

Mesmo comportamento que ja existe no "Gastos por Categoria": ao clicar numa categoria, filtra as listas de entradas (do mes e fixas).

| Arquivo | Mudanca |
|---------|---------|
| `src/components/income-category-summary.tsx` | Adicionar props `onCategoryClick` e `activeCategory`. Tornar cada item clicavel com estilo de destaque (igual ao `CategorySummary`). |
| `src/pages/Index.tsx` | (1) Criar estado `activeIncomeCategoryFilter` similar ao `activeCategoryFilter`. (2) Criar funcao `handleIncomeCategoryFilter` similar a `handleCategoryFilter`. (3) Filtrar entradas e entradas recorrentes pela categoria selecionada antes de passar para `IncomeList` e `RecurringIncomeList`. (4) Passar `onCategoryClick` e `activeCategory` para `IncomeCategorySummary`. (5) Incluir o filtro de categoria de entrada no `hasActiveFilters` e no `clearAllFilters`. |

### 2. Os filtros ja estao acima das tabs

Verificando o codigo, o componente `ExpenseFilters` ja esta posicionado acima das tres abas (linha 1496, antes das Tabs na linha 1546). A posicao atual ja atende o que voce pediu -- os filtros ficam acima dos botoes Despesas/Entradas/Metas.

No futuro, podemos expandir esse filtro para tambem afetar entradas e metas, mas por enquanto ele ja esta na posicao correta.

---

### Detalhes tecnicos

**`income-category-summary.tsx`** - Adicionar ao componente:
- Props: `onCategoryClick?: (category: string) => void` e `activeCategory?: string`
- No `div` de cada categoria: adicionar `cursor-pointer`, `hover:bg-muted/50`, `onClick` e estilo de destaque quando ativa (ring)
- Mesmo padrao visual usado no `CategorySummary`

**`Index.tsx`** - Mudancas:
- Novo estado: `const [activeIncomeCategoryFilter, setActiveIncomeCategoryFilter] = useState<string | null>(null)`
- Nova funcao `handleIncomeCategoryFilter` que alterna o filtro e mostra toast
- Filtrar `incomes` e `recurringIncomes` pela categoria antes de passar para as listas
- Adicionar botao "Limpar filtros" nas sub-abas de entradas quando filtro ativo

### Resumo

- 2 arquivos modificados (`income-category-summary.tsx`, `Index.tsx`)
- Nenhum arquivo novo
- Nenhuma mudanca no banco de dados
