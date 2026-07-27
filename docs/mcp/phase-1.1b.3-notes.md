# Fase MCP 1.1B.3 — content textual autossuficiente

Alguns clientes MCP utilizam apenas `content` e não tornam
`structuredContent` diretamente acessível ao modelo. Por isso, as três tools
read-only introduzidas na Fase 1.1B agora repetem no texto os dados operacionais
necessários:

- `get_spending_breakdown`: períodos solicitado e efetivo, cobertura,
  completude, contagens agregadas e todos os campos de até dez grupos;
- `search_transactions`: contagem, limite, estado e versão do cursor, próximo
  cursor, escopos, filtros aplicados e até dez transações;
- `compare_periods`: períodos e coberturas de A e B, durações, todas as métricas,
  mudanças, avisos e até dez alterações de breakdown.

O `structuredContent` permanece completo e os `outputSchema`, inputs, nomes,
anotações read-only e quantidade de tools não foram alterados.

Não houve mudança de cálculos, consultas, OAuth, RLS, banco, migrations ou
tools de escrita.
