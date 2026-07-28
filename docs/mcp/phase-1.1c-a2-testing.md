# Fase MCP 1.1C-A2 — resumo factual de cartão

## Escopo

Esta fase acrescenta somente a tool read-only `get_card_summary`. Ela agrega
linhas reais de `expenses` pertencentes ao usuário autenticado, vinculadas ao
cartão consultado e com `payment_method=credit`. `recurring_expenses` não é
consultada.

## Semântica do período

`billing_month` é o mês de referência da fatura calculada pelo aplicativo, não
necessariamente o mês civil da compra. A implementação reutiliza
`calculateBillingPeriod` e `getClosingDateForBillingMonth`.

No modelo atual (`due_day` + `days_before_due`), a fatura do mês M vence no mês
M+1. Seu período começa no dia posterior ao fechamento da fatura anterior e
termina no fechamento calculado para M.

No fallback legado, `opening_day` e `closing_day` permitem determinar o
intervalo, mas o vencimento não é inferido: `due_date=null` e
`INVALID_CARD_CONFIGURATION` é retornado. Se nenhum modelo determinar o período
com segurança, a tool retorna erro estruturado `INVALID_DATA`.

## Limites factuais

- Os totais representam somente lançamentos registrados no Gastinho.
- Não existe tabela real de faturas.
- Pagamento, quitação, saldo bancário e limite liberado não são conhecidos.
- Parcelas futuras entram somente quando já existem como linhas materiais em
  `expenses`.
- `time_scope=all` inclui todo o período; `occurred` limita o conjunto agregado
  às datas até hoje em `America/Sao_Paulo`.
- Mais de 10.000 linhas produz `RESULT_SET_TOO_LARGE`, sem resultado parcial.
- Categorias são agregadas integralmente; somente as dez principais são
  exibidas.

## Segurança

O handler valida primeiro `cards.id + cards.user_id`. Cartão alheio e
inexistente produzem o mesmo `RESOURCE_NOT_FOUND`. A consulta posterior repete
explicitamente `expenses.user_id`, `expenses.card_id` e
`expenses.payment_method=credit`, além do intervalo calculado.

## Testes

`npm run test:mcp:1.1c-a2` executa o handler real com um cliente Supabase
sintético e cobre isolamento, configurações atual e legada, datas, timezone,
totais, parcelas, categorias, maior transação, limites, content e contrato.

```text
npx tsc --noEmit
npm run build
npm run build:mcp
npm run check:mcp-bundle
npm run test:mcp:1.1b
npm run test:mcp:1.1b1
npm run test:mcp:1.1b2
npm run test:mcp:1.1b3
npm run test:mcp:1.1b4
npm run test:mcp:1.1c-a1
npm run test:mcp:1.1c-a2
npx eslint src/lib/mcp/shared/card-summary.ts src/lib/mcp/tools/get-card-summary.ts scripts/mcp-phase-1.1c-a2-tests.mjs
git diff --check
```
