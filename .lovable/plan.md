

## Corrigir constraint do banco de dados para metas de entrada

### Problema confirmado

A constraint `valid_category_for_type` na tabela `budget_goals` ainda esta com a definicao antiga:

```sql
CHECK (
  (type = 'monthly_total' AND category IS NULL) OR
  (type = 'category' AND category IS NOT NULL)
)
```

Os tipos `income_monthly_total` e `income_category` nao estao incluidos, causando erro 400 ao tentar inserir metas de entrada.

### Solucao

**1. Migracao SQL - Atualizar a constraint**

Executar uma migracao que:
- Remove a constraint antiga
- Cria uma nova com os 4 tipos aceitos
- Notifica o PostgREST para recarregar o schema

```sql
ALTER TABLE budget_goals DROP CONSTRAINT IF EXISTS valid_category_for_type;
ALTER TABLE budget_goals ADD CONSTRAINT valid_category_for_type CHECK (
  (type = 'monthly_total' AND category IS NULL) OR
  (type = 'category' AND category IS NOT NULL) OR
  (type = 'income_monthly_total' AND category IS NULL) OR
  (type = 'income_category' AND category IS NOT NULL)
);
NOTIFY pgrst, 'reload schema';
```

**2. Corrigir mensagens de toast no Index.tsx**

Na funcao `addBudgetGoal`, as mensagens dizem "meta de gastos" mesmo para metas de entrada. Corrigir para mostrar "meta de entradas" quando o tipo comecar com `income_`.

---

### Detalhes tecnicos

| Recurso | Mudanca |
|---|---|
| Migracao SQL | `DROP` + `ADD CONSTRAINT` com 4 tipos + `NOTIFY pgrst` |
| `src/pages/Index.tsx` | Mensagens de toast diferenciadas por tipo de meta |

### Resumo

- 1 migracao SQL (esta e a mudanca principal que resolve o erro)
- 1 arquivo modificado (`Index.tsx`) para mensagens corretas
- O `NOTIFY pgrst, 'reload schema'` garante que o PostgREST reconheca a mudanca imediatamente

