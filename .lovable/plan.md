

## Corrigir erro ao adicionar meta de entrada

### Problema
A constraint `valid_category_for_type` na tabela `budget_goals` ainda so aceita os tipos `monthly_total` e `category`. Os novos tipos `income_monthly_total` e `income_category` nao foram adicionados, causando o erro 400 ao inserir.

### Solucao

**1. Migracao SQL - Atualizar a constraint**

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

O `NOTIFY pgrst` garante que o PostgREST recarregue o schema e reconheca a nova constraint imediatamente.

**2. Corrigir mensagens de toast no Index.tsx (linhas 935-945)**

Na funcao `addBudgetGoal`, as mensagens dizem "meta de gastos" mesmo para metas de entrada. Corrigir para verificar se o tipo comeca com `income_` e mostrar "meta de entradas" ou "meta de gastos" conforme o caso.

---

### Detalhes tecnicos

| Recurso | Mudanca |
|---|---|
| Migracao SQL | `DROP` + `ADD CONSTRAINT` incluindo os 4 tipos + `NOTIFY pgrst` |
| `src/pages/Index.tsx` (linhas 932-945) | Adicionar logica para detectar tipo `income_*` e usar "meta de entradas" nas mensagens de sucesso e erro |

### Resumo

- 1 migracao SQL
- 1 arquivo modificado (`Index.tsx`)
- Corrige o bloqueio que impede criar metas de entrada
- Mensagens de feedback agora refletem o tipo correto de meta

