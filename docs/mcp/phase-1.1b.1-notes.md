# Fase MCP 1.1B.1 — correções pré-deploy

## Cursor v2

As tools `list_expenses`, `list_incomes` e `search_transactions` usam cursor v2:

- payload canônico com contexto, ordenação, posição, fingerprint SHA-256 dos
  filtros, emissão e expiração;
- assinatura HMAC-SHA256 com `MCP_CURSOR_SECRET`;
- validade de 24 horas;
- rejeição pública uniforme com `INVALID_CURSOR`;
- cursores v1 são deliberadamente incompatíveis e devem ser descartados após a
  publicação.

Antes do deploy, configurar um segredo aleatório exclusivo sem registrá-lo em
logs ou no repositório:

```bash
npx --yes supabase@latest secrets set MCP_CURSOR_SECRET=<valor-seguro>
```

Esse comando está documentado, mas não é executado nesta fase.

Na busca unificada, a ordem total é: valor solicitado, `expense` antes de
`income`, e UUID. A ordem de tipo permanece fixa em paginação ascendente e
descendente; o UUID acompanha o sentido solicitado.

O cursor é estável para o conjunto observado, mas não representa um snapshot do
banco. Uma transação criada antes da posição atual pode não aparecer na mesma
sequência. Reinicie a busca para obter o estado mais recente.

## Datas e cobertura

- Dia e mês corrente usam `America/Sao_Paulo`.
- Listagens e busca aceitam intervalos abertos.
- Analytics usam intervalos fechados de no máximo 366 dias.
- `requested_period` registra o pedido original.
- `effective_period` registra a interseção com `time_scope`.
- `coverage_warning` explica cortes ou períodos efetivos vazios.

Quando `get_summary` compara um período parcialmente ocorrido, o período
anterior usa os dias imediatamente anteriores com a mesma duração efetiva.

## Filtros exclusivos

`card_id` e `payment_method` exigem `transaction_type=expense`. Combinações com
`income` ou `all` retornam `INVALID_FILTER_COMBINATION`.

## Bundle no Windows

Não há versão posterior à `@lovable.dev/mcp-js@0.24.0`. O patch versionado em
`patches/` faz o externalizador reconhecer caminhos absolutos do Windows como
arquivos locais.

Fluxo reproduzível:

```bash
npm run build:mcp
npm run check:mcp-bundle
```

O verificador falha se a Edge Function contiver caminho absoluto, `npm:C:`,
import local não empacotado ou não contiver as três tools da Fase 1.1B.

## Dívida futura

As tools legadas ainda não possuem `outputSchema`. Isso permanece fora do
escopo corretivo 1.1B.1.
