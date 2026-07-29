# Fase MCP 1.2E-B — exclusão segura de categorias

As tools `delete_expense_category` e `delete_income_category` fazem exclusão
física somente de categoria pessoal inativa, não protegida, sem referências,
com confirmação explícita e `expected_updated_at`.

Nenhuma referência é reatribuída ou removida. Despesas, receitas, parcelas,
recorrências e metas bloqueiam a exclusão. Metas de despesa são reconhecidas
tanto pelo UUID canônico quanto pelos slugs legados comprovados.

A categoria fallback é protegida pela combinação estável criada pelos RPCs
iniciais (`is_default=true` e `display_order=8`), além do nome atual `Outros`.
As demais categorias default seguem o comportamento do frontend e podem ser
excluídas quando satisfazem todas as barreiras MCP.

Execute:

```text
npm run test:mcp:1.2e-b
```
