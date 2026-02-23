

## Corrigir filtro de "Entradas por Categoria"

### Problema

Quando voce clica em uma categoria no "Entradas por Categoria", o componente `IncomeCategorySummary` envia o `income_category_id` (UUID) como chave do filtro. Porem, o filtro no `Index.tsx` compara esse UUID apenas com `i.category` (que contem o valor do enum antigo como "freelance", "salario", etc.), nunca com `i.income_category_id`. Como o UUID nunca bate com o enum, todas as entradas sao filtradas e somem.

### Solucao

Alterar as duas funcoes de filtragem em `src/pages/Index.tsx` para verificar tanto `income_category_id` quanto `category`:

**Arquivo: `src/pages/Index.tsx`**

1. **Linha ~1375** - Filtro de entradas mensais (`displayedIncomes`):
   - De: `if (activeIncomeCategoryFilter && i.category !== activeIncomeCategoryFilter) return false;`
   - Para: `if (activeIncomeCategoryFilter && (i as any).income_category_id !== activeIncomeCategoryFilter && i.category !== activeIncomeCategoryFilter) return false;`

2. **Linha ~1389** - Filtro de entradas recorrentes (`displayedRecurringIncomes`):
   - De: `if (activeIncomeCategoryFilter && i.category !== activeIncomeCategoryFilter) return false;`
   - Para: `if (activeIncomeCategoryFilter && (i as any).income_category_id !== activeIncomeCategoryFilter && i.category !== activeIncomeCategoryFilter) return false;`

### Resumo

- 1 arquivo modificado (`src/pages/Index.tsx`)
- 2 linhas alteradas
- Corrige o filtro para funcionar tanto com o sistema novo (UUID) quanto com o antigo (enum string)

