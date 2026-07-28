# Fase MCP 1.1C-C1 — testes

## Escopo

- `get_cashflow_series` agrega somente despesas e receitas realizadas.
- O corte temporal usa a data civil de `America/Sao_Paulo`.
- Receitas com timestamp são convertidas para a data civil antes do agrupamento.
- As granularidades são dia civil, semana de segunda a domingo e mês civil.
- O acumulado começa em zero no intervalo consultado e não representa saldo
  bancário anterior.
- O content de `get_category_usage` representa todas as categorias retornadas:
  até dez detalhadas e as demais em formato compacto.

## Execução

```bash
npm run test:mcp:1.1c-c1
```

A suíte empacota e executa os handlers reais com Supabase sintético. Ela cobre
escopos e RLS, grupos, parcelas realizadas e futuras, granularidades, períodos
vazios, acumulado, cortes parciais, futuro, viradas de mês/ano, timestamps,
valores e datas inválidos, limites, schemas, content e a correção textual B2.

## Segurança

- A tool usa somente `supabaseForUser(ctx)`.
- O contrato não aceita nem retorna `user_id`.
- Apenas `expenses` e `incomes` são consultadas.
- Cada fonte possui hard cap independente de 10.000 registros.
- Resultados acima do cap falham sem retornar uma série parcial.
