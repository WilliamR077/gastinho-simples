

## Corrigir coluna category para aceitar categorias de entrada

### Problema raiz

A coluna `category` na tabela `budget_goals` usa o tipo enum `expense_category`, que so contem valores de despesa:
`alimentacao, transporte, lazer, saude, educacao, moradia, vestuario, servicos, outros`

Quando voce tenta criar uma meta de entrada com categoria `freelance`, o banco rejeita porque `freelance` nao existe no enum `expense_category`. A constraint `valid_category_for_type` ja foi corrigida - o problema agora e o tipo da coluna.

### Solucao

**Migracao SQL - Alterar o tipo da coluna `category` para `text`**

Mudar o tipo de `expense_category` para `text` permite que tanto categorias de despesa quanto de entrada sejam armazenadas. Isso e mais flexivel e evita ter que manter dois enums separados.

```sql
ALTER TABLE budget_goals 
  ALTER COLUMN category TYPE text 
  USING category::text;
NOTIFY pgrst, 'reload schema';
```

### Detalhes tecnicos

| Recurso | Mudanca |
|---|---|
| Migracao SQL | `ALTER COLUMN category TYPE text` na tabela `budget_goals` + `NOTIFY pgrst` |

### Por que `text` em vez de criar um novo enum?

- A tabela `budget_goals` precisa aceitar categorias de dois dominios diferentes (despesas e entradas)
- A constraint `valid_category_for_type` ja garante que `category` so e preenchida quando o tipo exige
- A validacao de quais categorias sao validas ja e feita no frontend (Select com opcoes fixas)
- Nenhum outro arquivo precisa ser alterado - o codigo ja envia as categorias como strings

### Resumo

- 1 migracao SQL (alterar tipo da coluna de `expense_category` para `text`)
- 0 arquivos de codigo modificados
- Resolve definitivamente o erro 400 ao criar metas de entrada com categorias como `freelance`, `salario`, etc.

