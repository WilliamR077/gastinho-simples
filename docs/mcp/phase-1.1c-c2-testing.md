# Fase MCP 1.1C-C2 — testes

## Escopo

`get_cashflow_projection` mantém separados:

- movimentos realizados;
- lançamentos futuros materializados;
- ocorrências projetadas de templates recorrentes;
- soma matemática explícita dos três componentes.

Não existe deduplicação presumida entre lançamentos persistidos e templates.
O acumulado começa em zero no intervalo e não representa saldo bancário.

## Execução

```bash
npm run test:mcp:1.1c-c2
```

A suíte executa o handler real com Supabase sintético e cobre escopos/RLS,
períodos passados, futuros e mistos, flags de componentes, granularidades,
timestamps em São Paulo, regras A3 de recorrência, valores/datas inválidos,
hard caps, content, schema e manifest.

## Limites verificados

- 366 dias por consulta;
- 10.000 despesas;
- 10.000 receitas;
- 100 templates;
- 1.000 ocorrências recorrentes;
- nenhum resultado parcial acima desses limites.
