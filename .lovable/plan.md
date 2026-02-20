

## Plano: Filtros com sub-abas (Despesas/Entradas) + Filtro de Data Personalizada

### 1. Sub-abas dentro dos filtros

Dentro da aba dobravel de filtros, adicionar duas sub-abas: **Despesas** e **Entradas**.

- **Aba Despesas**: mostra os filtros atuais (descricao, valor min/max, forma de pagamento, cartao, fatura)
- **Aba Entradas**: mostra apenas filtros relevantes para entradas (descricao, valor min/max)

Metas nao precisam de aba propria -- os filtros de descricao e valor ja se aplicam automaticamente.

### 2. Filtro de Data Personalizada

Adicionar um campo de intervalo de datas dentro dos filtros, acima das sub-abas. Quando preenchido, sobrescreve o periodo do MonthNavigator, permitindo filtrar por qualquer intervalo (ex: dia 10 a 20 de fevereiro).

Ao limpar os filtros, a data volta ao mes selecionado no MonthNavigator.

### 3. Layout dos filtros ao abrir

```text
+------------------------------------+
| Filtros                       [v]  |
+------------------------------------+
| Data Inicio: [__/__/____]          |
| Data Fim:    [__/__/____]          |
|                                    |
| [Despesas] [Entradas]              |
|                                    |
| Aba Despesas:                      |
|   Descricao | Valor Min | Valor Max|
|   Pagamento | Cartao | Fatura     |
|                                    |
| Aba Entradas:                      |
|   Descricao | Valor Min | Valor Max|
|                                    |
| [Aplicar Filtros]  [Limpar]        |
+------------------------------------+
```

---

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/components/expense-filters.tsx` | (1) Adicionar `Tabs` com duas abas: "Despesas" e "Entradas". Na aba Despesas, manter todos os filtros atuais. Na aba Entradas, mostrar apenas descricao, valor min e valor max. (2) Acima das tabs, adicionar dois campos de data (Data Inicio e Data Fim) usando `Popover` + `Calendar` (date picker). Esses campos permitem sobrescrever o `startDate` e `endDate` dos filtros. (3) Renomear a interface para `GlobalFilters` ou manter `ExpenseFilters` e adicionar um campo `filterTab` para saber qual aba esta ativa. (4) Adicionar prop `activeFilterTab` e `onFilterTabChange` para que o `Index.tsx` saiba qual aba de filtro esta ativa e aplique os filtros corretos. |
| `src/pages/Index.tsx` | (1) Adicionar estado `filterTab` para rastrear se o usuario esta filtrando despesas ou entradas. (2) Quando `filterTab === 'incomes'`, aplicar os filtros de descricao/valor apenas nas entradas. Quando `filterTab === 'expenses'`, aplicar nos despesas (comportamento atual). (3) Ajustar logica do `clearFilters` para restaurar as datas do MonthNavigator. |

### Resumo

- 2 arquivos modificados (`expense-filters.tsx`, `Index.tsx`)
- Nenhum arquivo novo
- Nenhuma mudanca no banco de dados
- Filtro de data personalizada permite ver periodos customizados
- Sub-abas separam filtros de despesas e entradas de forma clara

