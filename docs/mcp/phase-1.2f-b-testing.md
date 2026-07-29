# MCP 1.2F-B — análises seguras de grupos e rateios

## Contratos reais

`expense_splits` armazena `expense_id`, `user_id`, `share_amount`,
`share_percentage` opcional, `user_email` legado e `created_at`. Há unicidade
por `(expense_id, user_id)`, FK para `expenses(id)` com `ON DELETE CASCADE`,
índices por despesa e usuário e RLS baseada no acesso à despesa pai. As tools
não selecionam nem expõem `user_email`.

Os participantes são resolvidos internamente de `user_id` para a associação
atual em `shared_group_members`. O contrato público usa somente
`membership_id`, `display_name`, papel quando pertinente e
`is_current_user`. Uma referência sem associação atual é mantida como uma
identidade histórica separada, com `membership_id=null`, nome
`Membro anterior`, warning `HISTORICAL_MEMBER_UNRESOLVED` e
`data_complete=false`.

Os tipos reais oferecidos e persistidos pelo frontend são `equal`,
`percentage` e `manual`. `share_amount` persistido é a fonte canônica para
todos os cálculos financeiros. `share_percentage` é informativo e validado
quando o tipo é `percentage`.

O pagador é `expenses.paid_by`; o frontend comprova o fallback para
`expenses.user_id` quando `paid_by` está ausente. Nenhum desses UUIDs é
exposto.

## Dinheiro, datas e invariantes

Valores monetários são convertidos de decimal para centavos inteiros antes de
somar, comparar ou gerar sugestões. Nenhuma tolerância em floating point é
usada. O rateio igual já está materializado no banco: as tools preservam os
valores persistidos e não recalculam nem redistribuem centavos.

O período padrão é o mês civil corrente em `America/Sao_Paulo`. As datas são
inclusivas, com no máximo 366 dias. Cada parcela materializada é tratada como
uma despesa individual no seu próprio `expense_date`.

Para dados completos:

- `paid_amount` soma despesas compartilhadas cujo pagador foi resolvido;
- `allocated_amount` soma `share_amount` persistido;
- `net_balance = paid_amount - allocated_amount`;
- a soma dos saldos zera somente quando total pago e total atribuído são
  iguais;
- o settlement guloso ordena maior valor absoluto primeiro e usa
  `membership_id` como desempate.

Despesas compartilhadas sem linhas não recebem divisão implícita:
`SPLIT_DETAILS_MISSING`, `no_split_rows` e `data_complete=false`.

## Segurança e limites

As três tools usam exclusivamente `supabaseForUser(ctx)`, sob RLS, sem RPC,
service role ou escrita. Grupo/despesa inexistente e inacessível permanecem
indistinguíveis. Associação atual ausente bloqueia a análise com
`GROUP_DATA_INCOMPLETE`; outras divergências históricas tornam o resultado
incompleto e bloqueiam sugestões de settlement.

Caps:

- 1.000 despesas;
- 5.000 linhas de rateio;
- 100 membros;
- 366 dias;
- 100 sugestões de transferência.

Ao exceder um cap, a tool retorna `RESULT_SET_TOO_LARGE`, sem análise parcial.

## Execução

```text
npm run test:mcp:1.2f-b
npx tsc --noEmit
npm run build:mcp
npm run check:mcp-bundle
```

Os testes usam handlers reais com Supabase sintético e cobrem os três tipos de
rateio, identidade pública, perfis ausentes, membros removidos, grupos
inconsistentes, arredondamento em centavos, períodos, caps, settlement
determinístico, isolamento RLS, schemas, manifest e bundle.
