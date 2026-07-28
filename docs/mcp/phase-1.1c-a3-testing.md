# Fase MCP 1.1C-A3 — recorrências read-only

## Escopo

Esta fase adiciona somente:

- `list_recurring_transactions`, para listar templates mensais;
- `get_recurring_forecast`, para projetar ocorrências desses templates.

As tools usam apenas `recurring_expenses` e `recurring_incomes`. Elas não
consultam `expenses` ou `incomes`, não materializam lançamentos e não misturam
forecast com parcelas ou transações reais.

## Segurança e escopo

- `personal` aplica explicitamente o `user_id` autenticado.
- `shared` exige `shared_group_id` não nulo e permanece sujeito à RLS.
- `all_accessible` confia na visibilidade concedida pela RLS usando o bearer do
  usuário.
- `group_id` é um filtro adicional, nunca uma forma de contornar RLS.
- O identificador do proprietário nunca é exposto; somente `is_owner`.

## Regras da projeção

- Frequência mensal, no `day_of_month` armazenado.
- Dias inexistentes no mês são omitidos, sem ajuste para o último dia.
- `start_date=null` usa a data civil de `created_at` e gera warning.
- Intervalos inválidos e dias fora de 1–31 são sinalizados e não projetados.
- Valores não positivos permanecem factuais na ocorrência, mas não entram nas
  somas projetadas.
- Limites: 366 dias, 100 templates e 1.000 ocorrências.
- `include_occurrences=false` omite a lista, mas preserva totais e série.

## Validação

A suíte `test:mcp:1.1c-a3` injeta um cliente Supabase sintético e executa os
handlers reais. Ela cobre RLS simulada, escopos, filtros, paginação assinada,
datas civis, fevereiro comum e bissexto, virada de ano, granularidades, warnings,
hard caps, schemas e conteúdo textual.

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
npx eslint src/lib/mcp/shared/recurring.ts src/lib/mcp/tools/list-recurring-transactions.ts src/lib/mcp/tools/get-recurring-forecast.ts scripts/mcp-phase-1.1c-a3-tests.mjs
git diff --check
```
