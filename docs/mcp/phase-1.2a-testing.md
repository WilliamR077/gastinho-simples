# Fase MCP 1.2A — roteiro de revisão

Esta fase adiciona somente `update_expense` e `update_income`.

## Contratos

`update_expense` recebe `expense_id`, `expected_updated_at`, um objeto fechado
`changes` e, para parcelas, `confirm_single_installment_update=true`.
Os campos editáveis são `description`, `amount`, `expense_date`, `category_id`,
`payment_method` e `card_id`.

`update_income` recebe `income_id`, `expected_updated_at` e um objeto fechado
`changes`. Os campos editáveis são `description`, `amount`, `income_date` e
`income_category_id`.

Datas de despesas são datas civis `YYYY-MM-DD`. Datas civis de receitas são
persistidas como meia-noite em `America/Sao_Paulo`, pois `income_date` é
`timestamptz`.

## Validação local

```text
npx tsc --noEmit
npm run build
npm run build:mcp
npm run check:mcp-bundle
npm run test:mcp:1.2a
```

Também devem passar todas as suítes MCP anteriores e o lint direcionado.

## Verificações manuais posteriores

1. Ler uma despesa própria e copiar exatamente seu `updated_at`.
2. Alterar apenas a descrição e confirmar `before`, `after` e `changed_fields`.
3. Repetir com o `updated_at` antigo e confirmar `CONCURRENT_MODIFICATION`.
4. Em uma parcela, confirmar primeiro `CONFIRMATION_REQUIRED`; depois repetir
   com confirmação explícita e conferir `ONLY_ONE_INSTALLMENT_UPDATED`.
5. Repetir o fluxo para uma receita.
6. Confirmar que UUID inexistente e UUID de outro proprietário retornam a mesma
   resposta `RESOURCE_NOT_FOUND`.

Não usar dados reais destrutivos sem autorização explícita e não executar
deploy como parte da validação local.
