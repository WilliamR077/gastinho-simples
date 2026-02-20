

## Plano: Reorganizar layout da pagina inicial

Tres mudancas para deixar a pagina mais limpa e organizada:

### 1. Mover "Gastos por Categoria" para dentro da aba Despesas

Atualmente o `CategorySummary` fica acima das tabs, visivel sempre. Sera movido para dentro da aba "Despesas", logo acima das sub-abas "Do Mes" / "Fixas" -- mesma posicao que o `IncomeCategorySummary` ja ocupa na aba "Entradas".

O filtro por categoria continuara funcionando tanto para despesas do mes quanto para fixas.

### 2. Mover Filtros para acima das tabs

O componente `ExpenseFilters` sera movido para acima das tres abas (Despesas, Entradas, Metas), ficando logo apos o MonthNavigator. A ideia eh que o filtro possa ser aplicado globalmente. Por enquanto ele ja filtra despesas; futuramente pode ser expandido para entradas e metas.

### 3. Separar metas de despesas e metas de entradas na aba Metas

Na aba "Metas", criar duas secoes visuais separadas:
- **Metas de Gastos** - metas do tipo `monthly_total` e `category`
- **Metas de Entradas** - metas do tipo `income_monthly_total` e `income_category`

Cada secao tera seu proprio titulo/icone para facilitar a visualizacao.

---

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Index.tsx` | (1) Remover `CategorySummary` de antes das tabs (linhas 1507-1519) e colocar dentro de `TabsContent value="expenses"`, acima das sub-abas. (2) Os filtros (`ExpenseFilters`) ja estao acima das tabs -- manter na mesma posicao (linhas 1496-1505), apenas remover o `CategorySummary` que ficava abaixo. (3) Na aba "goals", separar as metas passando filtros para `BudgetProgress` ou criando dois blocos separados. |
| `src/components/budget-progress.tsx` | Adicionar prop opcional `filterType` ou separar internamente as metas em dois grupos: despesas (`monthly_total`, `category`) e entradas (`income_monthly_total`, `income_category`), renderizando com titulos separados. |

### Resultado visual

```text
+---------------------------+
| Header + Botoes           |
+---------------------------+
| Context Selector          |
+---------------------------+
| Navegador de Mes          |
+---------------------------+
| Filtros (colapsavel)      |
+---------------------------+
| Balance Summary           |
+---------------------------+
| [Despesas] [Entradas] [Metas] |
+---------------------------+

Aba Despesas:
  - Gastos por Categoria
  - [Do Mes] [Fixas]
  - Lista de despesas

Aba Entradas:
  - Entradas por Categoria
  - [Do Mes] [Fixas]
  - Lista de entradas

Aba Metas:
  - Metas de Gastos (titulo)
  - Cards de metas de despesa
  - Metas de Entradas (titulo)
  - Cards de metas de entrada
```

### Resumo

- 2 arquivos modificados (`Index.tsx`, `budget-progress.tsx`)
- Nenhum arquivo novo
- Nenhuma mudanca no banco de dados
- Apenas reorganizacao visual de componentes existentes

