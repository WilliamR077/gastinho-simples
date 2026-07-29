# Fase MCP 1.2C-B — testes

Esta fase adiciona exclusão segura e permanente de templates mensais:

- `delete_recurring_expense`
- `delete_recurring_income`

As tools removem exclusivamente uma linha de `recurring_expenses` ou
`recurring_incomes`. Não removem nem alteram lançamentos reais.

## Validação

```bash
npx tsc --noEmit
npm run build
npm run build:mcp
npm run check:mcp-bundle
npm run test:mcp:1.2c-b
```

A suíte usa handlers reais e Supabase sintético. Ela cobre confirmação
explícita, propriedade, RLS, concorrência otimista, corrida durante o delete,
templates compartilhados, conteúdo autossuficiente, warnings, manifest,
bundle e preservação de despesas, receitas, cartões, categorias e grupos.
