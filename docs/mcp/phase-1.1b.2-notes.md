# Fase MCP 1.1B.2 — correções finais pré-deploy

Esta etapa corrige somente os quatro pontos encontrados na auditoria final:

- `get_spending_breakdown` explica no `content` que, quando
  `groups_truncated=true`, os dados financeiros e totais gerais continuam
  completos, mas os percentuais dos grupos exibidos podem somar menos de 100%
  porque a lista visual foi limitada;
- cursores expiram estritamente em `expires_at`, inclusive no próprio segundo
  indicado;
- `category_id`, `income_category_id`, `card_id` e `group_id` são normalizados
  para lowercase antes do fingerprint, e IDs UUID usados no cursor são
  canonicalizados da mesma forma;
- `patch-package` foi movido para `dependencies`, preservando a versão 8.0.1,
  porque o `postinstall` também precisa funcionar em `npm ci --omit=dev`.

O patch versionado do `@lovable.dev/mcp-js@0.24.0` permanece inalterado e deve
ser aplicado automaticamente em instalações normais e com `--omit=dev`.

## Padrões temporais

- `search_transactions`: `time_scope=occurred`;
- `get_spending_breakdown`: `time_scope=occurred`;
- `get_summary`: preserva `time_scope=all`;
- `compare_periods`: `time_scope=occurred`.

## Dívidas fora do escopo

- As 19 vulnerabilidades transitivas informadas pelo npm permanecem como dívida
  separada; nenhum `npm audit fix` ou upgrade geral foi executado.
- As tools legadas continuam sem `outputSchema`, conforme decisão anterior.

Não houve mudança de OAuth, RLS, banco, migrations, tools de escrita ou
quantidade de tools.
