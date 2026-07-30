# MCP 1.2F-D — leitura de séries parceladas

## Modelo comprovado

`expenses` e `incomes` materializam uma linha por parcela. Nas duas tabelas,
`installment_group_id` é `uuid` nullable e os campos
`installment_number`/`total_installments` são inteiros nullable com default 1.
Despesas possuem constraint histórica para número positivo e não superior ao
total; receitas não receberam constraint ou índice equivalente nas migrations.

O frontend cria um UUID por série. Despesas oferecem de 1 a 12 parcelas,
dividem o valor total por essa quantidade e persistem o quociente em cada
linha. Receitas oferecem de 2 a 48 parcelas e persistem em cada linha o valor
informado, tratando-o como valor da parcela. As datas avançam mês a mês; a
despesa persiste `YYYY-MM-DD`, enquanto a criação de receita envia o ISO gerado
por `addMonths`. O MCP preserva a data civil devolvida pelo banco e não
recalcula parcelas.

## Contrato

`get_installment_series` exige `transaction_type=expense|income` e exatamente
uma referência entre `installment_group_id` e `transaction_id`. O handler
valida o XOR e rejeita campos extras. A biblioteca MCP aceita somente um raw
Zod shape na declaração pública, portanto o manifest expressa os campos
opcionais e o objeto fechado; a restrição XOR é aplicada pelo handler antes de
qualquer consulta.

A consulta usa somente `supabaseForUser(ctx)` e permanece sob RLS. Referência
inexistente ou inacessível resulta igualmente em `RESOURCE_NOT_FOUND`.
Transação acessível sem evidência de parcelamento resulta em
`TRANSACTION_NOT_INSTALLMENT`; evidência de parcelamento sem UUID resulta em
`INSTALLMENT_SERIES_REFERENCE_MISSING`. Não há inferência por descrição,
valor ou data.

O resultado inclui o resumo factual, todas as linhas acessíveis, IDs,
`updated_at` individuais, datas, valores, lacunas, duplicidades, valores
observados de total, inconsistências de card/grupo e warnings. A ordenação é
por número válido, data e ID. Valores são convertidos para centavos antes de
soma e média. O limite comprovado do produto é 48 linhas; a consulta lê 49 para
detectar excesso e nunca devolve análise parcial.

## Payloads compatíveis

`list_expenses`, `list_incomes` e `search_transactions` agora expõem
uniformemente `installment_group_id`, `installment_number`,
`total_installments`, `is_installment` e `updated_at`. O transformador
compartilhado foi ajustado sem mudar filtros, ordenação, cursores ou cálculos.

`get_card_installments` preserva seu contrato e acrescenta `updated_at` e
`is_installment` por linha; os demais campos da série já faziam parte do
payload.

## Execução

```text
npx tsc --noEmit
npx eslint <arquivos MCP alterados>
npm run build
npm run build:mcp
npm run check:mcp-bundle
npm run test:mcp:1.2f-d
```

A suíte usa o handler real com Supabase sintético e cobre schemas, descoberta
pelas duas referências, despesas, receitas, RLS, privacidade, integridade,
centavos, datas civis, cap, conteúdo autossuficiente, payloads legados,
manifest, bundle e ausência de writes.
