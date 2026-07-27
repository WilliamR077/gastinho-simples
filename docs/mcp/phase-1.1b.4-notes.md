# Fase MCP 1.1B.4 — hotfix do cursor unificado

## Causa

O cursor v2 de `search_transactions` usava `transaction_type` para duas
semânticas incompatíveis: o filtro resolvido da consulta
(`expense | income | all`) e o tipo do último item da página
(`expense | income`). O smoke test de produção revelou o problema quando uma
consulta `all` terminou em despesa: o cursor carregou `expense`, e a continuação
não conseguiu satisfazer simultaneamente o filtro original e a posição do
desempate.

## Contrato v3

O cursor assinado agora separa explicitamente:

- `query_transaction_type`: filtro resolvido da consulta;
- `last_item_type`: origem do último item, usada somente na posição e no
  desempate.

O fingerprint também usa `query_transaction_type`. A ordenação total permanece
`sort_value`, tipo do item e UUID. Consultas `all` aceitam como último item tanto
despesa quanto receita; consultas exclusivas exigem o tipo correspondente.

`list_expenses` e `list_incomes` não tinham a colisão da busca unificada, pois
cada uma consulta uma única origem. Elas passam a usar o mesmo formato v3 para
manter um único contrato interno de cursor.

## Compatibilidade

`CURSOR_VERSION` foi elevado para `3`. Cursores v1 e v2 são
deliberadamente incompatíveis e retornam `INVALID_CURSOR`; eles devem ser
descartados pelo cliente. Assinatura HMAC-SHA256, fingerprint, expiração,
contexto e ordenação continuam sendo validados.

## Caso que revelou o problema

O cenário de regressão usa `transaction_type=all`, `sort_by=date`,
`sort_order=desc`, `limit=3` e `time_scope=occurred`. A primeira página contém:

1. Cross — 25/07/2026 — expense;
2. Quebra-cabeça Londres — 23/07/2026 — expense;
3. Hambúrguer - 99 — 23/07/2026 — expense.

O cursor v3 preserva `query_transaction_type=all` e
`last_item_type=expense`. A segunda página continua normalmente, sem repetir
nenhum dos três itens.

## Validação

A suíte `npm run test:mcp:1.1b4` cobre continuação após despesa e receita,
consultas exclusivas, limites 1 e 3, três ou mais páginas, empates de data e
valor, UUID igual entre origens, ordens ascendente e descendente, ausência de
perdas e duplicações, adulteração de assinatura/payload e rejeição de cursores
v1/v2.
