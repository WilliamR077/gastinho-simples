# Fase MCP 1.1C-A1 — cartões factuais

## Escopo

Esta fase acrescenta somente duas tools read-only:

- `list_cards`: lista os cartões pertencentes à conta autenticada, sem cálculos.
- `get_card_installments`: lista linhas reais de `expenses` associadas ao cartão e com evidência de parcelamento.

Não há conceito de fatura nesta fase. Nenhum valor de fatura, limite disponível, recorrência ou projeção é calculado.

## Decisões factuais

- `list_cards` exige `user_id` da sessão em todas as consultas.
- O filtro de tipo é exato: `credit`, `debit` e `both` não se sobrepõem.
- `get_card_installments` valida primeiro que o cartão pertence ao usuário.
- A consulta de despesas repete os filtros explícitos por `user_id` e `card_id`, mesmo com RLS.
- Uma linha é tratada como parcela quando há `installment_group_id`, `installment_number > 1` ou `total_installments > 1`.
- Uma compra comum com metadados `1/1` e sem grupo não é tratada como série.
- Cartões inativos continuam consultáveis, pois despesas históricas podem referenciá-los.
- Despesas próprias compartilhadas são mantidas; despesas de outro proprietário são excluídas.
- Cursores usam HMAC SHA-256, expiram, possuem ordem total por campo + UUID e são vinculados ao contexto, filtros e ordenação.
- O texto de `content` inclui no máximo dez itens e preserva o cursor completo.

## Avisos de dados

Por item:

- `MISSING_INSTALLMENT_NUMBER`
- `MISSING_TOTAL_INSTALLMENTS`
- `INSTALLMENT_NUMBER_EXCEEDS_TOTAL`
- `TOTAL_INSTALLMENTS_BELOW_TWO`
- `MISSING_INSTALLMENT_GROUP_ID`
- `MISSING_CATEGORY`
- `NON_CREDIT_PAYMENT_METHOD`

Por resultado:

- `INACTIVE_CARD`
- `SERIES_COMPLETENESS_NOT_VERIFIED`
- `INCONSISTENT_INSTALLMENT_METADATA_PRESENT`

Esses avisos descrevem os dados armazenados; não completam nem corrigem metadados.

## Validação local

A suíte `test:mcp:1.1c-a1` injeta um cliente Supabase sintético no bundle de
teste e executa os handlers reais. O mock registra a tabela, projeção, filtros,
ordenação, cursores e limite, sem abrir conexão com o Supabase.

Ela cobre diretamente:

- isolamento explícito por `user_id` e `card_id`;
- resposta opaca para cartão alheio ou inexistente;
- despesas próprias compartilhadas e exclusão das despesas de outro membro;
- cartões inativos;
- três páginas consecutivas em ordem ascendente e descendente;
- desempate por UUID para nomes e datas iguais;
- output schemas e conteúdo textual;
- casos-limite de parcelamento;
- equivalência entre `hasInstallmentEvidence` e o predicado PostgREST usado pelo handler.

```text
npx tsc --noEmit
npm run test:mcp:1.1b
npm run test:mcp:1.1b1
npm run test:mcp:1.1b2
npm run test:mcp:1.1b3
npm run test:mcp:1.1b4
npm run test:mcp:1.1c-a1
npx eslint scripts/mcp-phase-1.1c-a1-tests.mjs
git diff --check
```

Como este endurecimento altera somente testes e documentação, não é necessário
regenerar manifest ou bundle.

## Smoke test posterior (não executar antes do deploy autorizado)

1. Listagem: “Liste meus cartões ativos cadastrados no Gastinho Simples.”
2. Inativos: “Liste também meus cartões inativos.”
3. Parcelas futuras: “Quais são as próximas parcelas registradas no cartão Smiles - Vivi?”
4. Parcelas realizadas: “Mostre as parcelas já ocorridas desse cartão em julho de 2026.”
5. Sem invenção: “Informe apenas dados cadastrados. Não calcule fatura nem limite disponível.”
6. Isolamento: repetir com duas contas, confirmar cartões diferentes e nenhuma exposição cruzada; consultar o cartão da outra conta deve retornar recurso não encontrado.
