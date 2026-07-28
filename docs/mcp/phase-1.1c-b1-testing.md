# Fase MCP 1.1C-B1 — metas mensais read-only

## Escopo

Esta fase adiciona somente:

- `list_goals`, para listar metas e limites mensais;
- `get_goal_progress`, para calcular progresso mensal realizado e, quando
  solicitado, uma projeção recorrente separada.

As metas não possuem contribuições, prazo, histórico persistido ou conta de
investimento. Nenhuma operação de escrita foi adicionada.

## Segurança

- `list_goals` aplica `personal`, `shared` ou `all_accessible` sob RLS.
- `get_goal_progress` valida primeiro a meta sob RLS.
- Metas pessoais consultam somente linhas próprias sem grupo.
- Metas compartilhadas consultam somente o `shared_group_id` da meta, ainda sob
  RLS.
- Nenhum identificador ou dado do proprietário é exposto; somente `is_owner` e
  `is_shared`.

## Categorias

`budget_goals.category` é preservado como texto. A correspondência usa os
snapshots já armazenados nas transações:

- despesas: `category`, `category_id` e `category_name`;
- receitas: `category`, `income_category_id` e `category_name`.

Não são consultadas tabelas de categorias pertencentes a terceiros.

## Progresso e projeção

- O mês solicitado é civil e usa `America/Sao_Paulo` para identificar mês atual.
- Mês atual considera realizado somente até hoje.
- Mês passado considera o mês completo.
- Mês futuro possui realizado zero.
- Projeções usam somente ocorrências recorrentes válidas ainda não ocorridas.
- Realizado, recorrente e total projetado permanecem em campos separados.
- Toda projeção retorna `POTENTIAL_RECURRING_OVERLAP`, pois não existe vínculo
  entre templates e lançamentos manuais.

Limites: 10.000 despesas, 10.000 receitas e 100 templates.

## Validação

`test:mcp:1.1c-b1` executa os handlers reais com um Supabase sintético. A suíte
cobre os cinco tipos de meta, escopos, RLS, categorias textuais/UUID, meses
passado/atual/futuro, percentuais, saldos positivos e negativos, projeção,
paginação, hard caps, schemas e conteúdo.

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
npm run test:mcp:1.1c-a3
npm run test:mcp:1.1c-b1
npx eslint src/lib/mcp/shared/goals.ts src/lib/mcp/tools/list-goals.ts src/lib/mcp/tools/get-goal-progress.ts scripts/mcp-phase-1.1c-b1-tests.mjs
git diff --check
```
