
## Corrigir erro ao adicionar meta de entrada

### Problema
O banco de dados tem uma constraint `valid_category_for_type` que so permite dois tipos: `monthly_total` (sem categoria) e `category` (com categoria). Os novos tipos `income_monthly_total` e `income_category` nao estao incluidos nessa regra, causando o erro.

### Constraint atual
```sql
CHECK (
  (type = 'monthly_total' AND category IS NULL) OR
  (type = 'category' AND category IS NOT NULL)
)
```

### Solucao

**1. Atualizar a constraint no banco de dados (migracao SQL)**

Remover a constraint antiga e criar uma nova que inclui os 4 tipos:

```sql
ALTER TABLE budget_goals DROP CONSTRAINT valid_category_for_type;
ALTER TABLE budget_goals ADD CONSTRAINT valid_category_for_type CHECK (
  (type = 'monthly_total' AND category IS NULL) OR
  (type = 'category' AND category IS NOT NULL) OR
  (type = 'income_monthly_total' AND category IS NULL) OR
  (type = 'income_category' AND category IS NOT NULL)
);
```

**2. Corrigir mensagem de sucesso/erro no Index.tsx**

Atualmente a mensagem diz "meta de gastos" mesmo para metas de entrada. Corrigir para mostrar a mensagem correta dependendo do tipo:
- `income_*` -> "meta de entradas"
- outros -> "meta de gastos"

---

### Detalhes tecnicos

| Arquivo / Recurso | Mudanca |
|---|---|
| Migracao SQL | Atualizar constraint `valid_category_for_type` para incluir `income_monthly_total` e `income_category` |
| `src/pages/Index.tsx` | Corrigir mensagens de toast na funcao `addBudgetGoal` para diferenciar entre meta de gastos e meta de entradas |

### Resumo

- 1 migracao SQL
- 1 arquivo modificado (`Index.tsx`)
- Corrige o erro que impede criar metas de entrada
- Corrige mensagens para refletir o tipo correto de meta
