# Fase MCP 1.1C-B2 — testes

## Escopo

- `get_category_usage` apresenta fatos históricos sobre categorias pessoais.
- Categorias e transações são filtradas explicitamente pelo usuário autenticado.
- UUIDs preservam categorias distintas, inclusive quando os nomes são iguais.
- Snapshots identificam referências excluídas ou inacessíveis sem consultar dados
  de outro proprietário.
- O limite afeta somente as categorias retornadas, não os totais gerais.
- A projeção da B1 só alerta possível sobreposição quando ao menos um template
  recorrente participa.

## Execução

```bash
npm run test:mcp:1.1c-b2
```

A suíte empacota e executa os handlers reais com um cliente Supabase sintético.
Ela cobre despesas, receitas, categorias ativas/inativas/não usadas, snapshots,
UUIDs duplicados por nome, isolamento pessoal, período, médias e séries mensais,
percentuais com total zero, truncamento, limites, schemas, content e o hotfix B1.

## Garantias de segurança

- Nenhum `user_id` integra o contrato público.
- Não há `scope` ou `group_id`.
- Nenhuma consulta usa `service_role`.
- Mais de 10.000 transações retorna `RESULT_SET_TOO_LARGE`, sem dados parciais.
- O conteúdo é factual e não contém recomendação financeira.
