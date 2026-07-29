# Fase MCP 1.2E-A — categorias pessoais

## Escopo

A fase adiciona quatro operações pessoais:

- `create_expense_category`
- `update_expense_category`
- `create_income_category`
- `update_income_category`

`list_categories` passa a expor `updated_at` e aceita
`include_inactive`, mantendo `false` como padrão.

Categorias de despesa também expõem `goal_reference`. A referência canônica é
o UUID pessoal da categoria e pode ser copiada diretamente para
`create_goal.category`. Os nove slugs históricos usados pelo frontend
(`alimentacao`, `saude` etc.) continuam aceitos e não são reescritos.

## Contratos reais

Criação aceita `name` e `icon` opcional. Os demais valores são definidos pelo
servidor conforme o gerenciador do aplicativo: categoria ativa, não default,
cor padrão do tipo e `display_order` após a maior ordem pessoal existente.

Edição exige `category_id`, `expected_updated_at` e ao menos uma alteração em
`changes`. Os únicos campos editáveis são `name`, `icon` e `is_active`.
`color`, `display_order`, `is_default`, `user_id` e timestamps não são aceitos.

## Segurança

Todas as consultas usam o cliente autenticado por requisição e filtro explícito
por `user_id`. A atualização atômica inclui `id`, `user_id` e
`expected_updated_at`. Recurso ausente ou pertencente a outra conta retorna o
mesmo `RESOURCE_NOT_FOUND`.

Desativação preserva transações, parcelas, recorrências e metas. A categoria
`Outros`, usada como fallback do aplicativo, não pode ser editada. Renomear uma
categoria de despesa só é bloqueado quando existe meta legada vinculada ao slug
dependente do nome. Metas novas vinculadas pelo UUID preservam a referência e
não impedem a alteração do nome.

## Execução

```text
npm run test:mcp:1.2e-a
```

A suíte executa os handlers reais com um cliente Supabase sintético e verifica
criação, defaults, contrato fechado, propriedade, referências, desativação,
no-op, concorrência otimista inicial e atômica, conteúdo autossuficiente,
manifest e ausência de alterações indiretas.
