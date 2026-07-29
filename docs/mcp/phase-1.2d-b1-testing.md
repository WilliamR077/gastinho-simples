# Fase MCP 1.2D-B1 — criação e edição segura de cartões

## Modelo e contratos

`cards` é a tabela canônica. Ela aceita `credit`, `debit` e `both`, possui
`updated_at` mantido por trigger e não possui compartilhamento. Os contratos
públicos são:

- `create_card`: `name`, `card_type`, `color?`, `card_limit?`, `due_day?`,
  `days_before_due?`, `is_active?`;
- `update_card`: `card_id`, `expected_updated_at`, `changes`.

`opening_day` e `closing_day` são derivados no servidor com o mesmo helper do
frontend. Crédito e `both` exigem vencimento; a antecedência usa o default real
de 10 dias. Débito não mantém configuração de cobrança.

O nome é aparado e limitado a 100 caracteres no contrato MCP para proteger a
interface, que não possuía limite explícito. A cor é restrita à paleta real do
CardManager. Limite omitido ou `null` significa não informado; valores
informados precisam ser positivos e finitos.

## Legado

`credit_card_configs` permanece apenas como fallback para lançamentos antigos e
uma tela legada isolada. O CardManager atual cria e edita somente `cards`; não
há trigger ou sincronização bidirecional. As novas tools não consultam nem
escrevem na tabela legada.

## Segurança

As operações usam `supabaseForUser(ctx)`. O insert deriva `user_id`; a edição
filtra por `id`, `user_id` e `expected_updated_at`. Não há número de cartão,
CVV, credencial bancária, compartilhamento, exclusão ou comunicação com
emissor.

Desativação preserva despesas, parcelas, templates e snapshots. Antes do
update, são contadas somente referências da conta autenticada; nenhuma linha
referenciada é alterada.

## Execução

```text
npx tsc --noEmit
npm run build
npm run build:mcp
npm run check:mcp-bundle
npm run test:mcp:1.2d-b1
```
