# Fase MCP 1.2C-A — testes

Esta fase adiciona criação e edição segura de templates mensais:

- `create_recurring_expense`
- `create_recurring_income`
- `update_recurring_expense`
- `update_recurring_income`

As tools escrevem exclusivamente em `recurring_expenses` e
`recurring_incomes`. Elas não materializam lançamentos em `expenses` ou
`incomes`.

## Validação

```bash
npx tsc --noEmit
npm run build
npm run build:mcp
npm run check:mcp-bundle
npm run test:mcp:1.2c-a
```

A suíte usa os handlers reais e um cliente Supabase sintético. Ela cobre
propriedade explícita, RLS, categorias, cartões, grupos, datas civis,
concorrência otimista, corrida entre leitura e update, patch parcial, no-op,
schemas fechados, content autossuficiente, manifest e bundle.
