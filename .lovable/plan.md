

## Plano: Reorganizar Metas com sub-abas e formulario melhorado

### 1. Sub-abas na aba Metas

Igual ao que ja existe em Despesas (Do Mes / Fixas) e Entradas (Do Mes / Fixas), a aba Metas tera duas sub-abas:

- **Metas de Despesa**: mostra apenas metas do tipo `monthly_total` e `category`
- **Metas de Entrada**: mostra apenas metas do tipo `income_monthly_total` e `income_category`

### 2. Formulario de criacao com escolha inicial

Ao abrir o sheet de nova meta, antes do formulario, mostrar duas opcoes claras com textos explicativos:

```text
+------------------------------------+
| Definir Nova Meta                  |
+------------------------------------+
|                                    |
| [Meta de Despesa]                  |
|  Defina um limite maximo de        |
|  gastos para controlar seus        |
|  gastos mensais ou por categoria.  |
|                                    |
| [Meta de Entrada]                  |
|  Defina uma meta de ganhos para    |
|  acompanhar suas receitas          |
|  mensais ou por categoria.         |
|                                    |
+------------------------------------+
```

Ao clicar em uma das opcoes, o formulario aparece com os campos relevantes (tipo + categoria + valor).

---

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/components/budget-goal-form-sheet.tsx` | (1) Adicionar estado `goalScope` com valores `null`, `'expense'` ou `'income'`. (2) Quando `goalScope === null`, mostrar duas cards clicaveis com icones e descricoes. (3) Quando selecionado, mostrar o formulario filtrado: se `expense`, mostrar opcoes `monthly_total` e `category`; se `income`, mostrar `income_monthly_total` e `income_category`. (4) Adicionar botao "Voltar" para trocar a escolha. |
| `src/pages/Index.tsx` | (1) Adicionar estado `goalSubTab` com valores `'expense'` e `'income'`. (2) Dentro de `TabsContent value="goals"`, adicionar sub-tabs com `TabsList` de 2 colunas. (3) Filtrar `budgetGoals` em duas listas: `expenseGoals` (tipos sem prefixo `income_`) e `incomeGoals` (tipos com prefixo `income_`). (4) Passar a lista filtrada correspondente para `BudgetProgress` em cada sub-tab. |
| `src/components/budget-progress.tsx` | Nenhuma mudanca necessaria -- ja renderiza corretamente metas de despesa e entrada separadamente. |

### Resumo

- 2 arquivos modificados (`budget-goal-form-sheet.tsx`, `Index.tsx`)
- Nenhum arquivo novo
- Nenhuma mudanca no banco de dados
- Formulario com escolha visual clara entre meta de despesa e meta de entrada
- Sub-abas na aba Metas separando os dois tipos

