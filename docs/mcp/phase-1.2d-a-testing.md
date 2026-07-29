# Fase MCP 1.2D-A — criação, edição e exclusão de metas mensais

## Escopo

Esta fase adiciona `create_goal`, `update_goal` e `delete_goal`. As operações
atuam exclusivamente em `budget_goals`; não criam, editam ou excluem
transações, templates recorrentes, categorias ou grupos.

## Contratos reais

- `create_goal`: `type`, `limit_amount`, `category?`, `shared_group_id?`.
- `update_goal`: `goal_id`, `expected_updated_at`, `changes`.
- `delete_goal`: `goal_id`, `expected_updated_at`, `confirm_delete`.

`category` preserva a semântica textual do banco e do frontend: metas de
despesa armazenam o slug canônico da categoria; metas de receita armazenam o
UUID como texto. A referência é validada na tabela pessoal correspondente.
Tipos totais e `balance_target` não usam categoria.

`update_goal` e `delete_goal` filtram por `id`, `user_id` autenticado e
`expected_updated_at`. O trigger existente `update_budget_goals_updated_at`
avança o timestamp em updates efetivos. No-op não escreve nem altera timestamp.

`delete_goal` é permanente e exige confirmação explícita. Alertas filhos são
removidos exclusivamente pelo `ON DELETE CASCADE` de
`budget_goal_alerts.goal_id`; nenhuma cascata manual é feita.

## Execução

```text
npx tsc --noEmit
npm run build
npm run build:mcp
npm run check:mcp-bundle
npm run test:mcp:1.2d-a
```

A suíte usa os handlers reais com Supabase sintético e cobre contratos,
propriedade, RLS complementar, categorias, transições de tipo, no-op,
concorrência, confirmação, cascata, conteúdo autossuficiente, manifest e
bundle.

## Limites intencionais

As metas são mensais e o progresso permanece calculado dinamicamente. Não há
conta de investimento, poupança acumulada, contribuição, histórico persistido,
movimentação entre escopos, restauração ou operação em lote.
