# Fase MCP 1.2D-B2 — exclusão segura de cartões

## Semântica inspecionada

- `cards` não possui `deleted_at`; a exclusão MCP é permanente.
- O frontend trata “remover” como desativação (`is_active=false`) e não faz
  exclusão física.
- As referências reais são `expenses.card_id` e
  `recurring_expenses.card_id`.
- As duas FKs foram criadas sem `ON DELETE`; no PostgreSQL isso corresponde ao
  comportamento padrão `NO ACTION`.
- `credit_card_configs` não possui `card_id` nem relação direta com `cards` e
  não é consultada ou alterada pela tool.

## Política

`delete_card` exige `card_id`, `expected_updated_at` e
`confirm_delete=true`. O cartão precisa pertencer ao usuário autenticado, estar
inativo e não ter despesas ou templates recorrentes vinculados.

As referências são classificadas em despesas históricas, lançamentos futuros,
parcelas e templates ativos/inativos. A contagem total usa linhas distintas,
sem somar novamente despesas que também sejam parcelas.

O delete final repete atomicamente os filtros por `id`, `user_id`,
`updated_at` e `is_active=false`. Nenhuma referência é limpa e nenhuma
operação é feita em `credit_card_configs` ou no banco emissor.

## Validação

```text
npm run test:mcp:1.2d-b2
npx tsc --noEmit
npm run build
npm run build:mcp
npm run check:mcp-bundle
```

O smoke test de produção deve ser feito apenas depois de revisão e deploy,
usando um cartão temporário inativo e sem referências.
