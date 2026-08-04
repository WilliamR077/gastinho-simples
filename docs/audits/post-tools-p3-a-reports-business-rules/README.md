# PÓS-TOOLS P3-A — Regras de negócio de Relatórios

## Escopo e pré-condições

A fase partiu da `main` limpa no commit `6570246398311a42fc65deafe30b8b0b2489aacb`, alinhada a `origin/main`, e foi executada no worktree `gastinho-simples-p3a-reports`, branch `codex/post-tools-p3-a-fix-reports-business-rules`. O projeto vinculado é `jaoldaqvbdllowepzwbr`. Antes das alterações, a CLI confirmou 64 migrations locais e remotas e `Remote database is up to date` no dry-run.

Não foram alterados banco, migrations, dados reais, Edge Functions, bundle ou tools MCP.

## Modelo real

| Fonte | Natureza | Data/status relevante | Uso em Relatórios |
| --- | --- | --- | --- |
| `expenses` | movimentação realizada | `expense_date` (`date`) | saídas, categorias, pagamentos, cartões, fluxo, evolução, ranking e comparação |
| `incomes` | movimentação realizada | `income_date` (`timestamptz`) | entradas, saldo, fluxo, comparação e taxa de economia |
| `recurring_expenses` | template de planejamento | `day_of_month`, `is_active`, `start_date`, `end_date` | bloco separado de despesas fixas previstas |
| `recurring_incomes` | template de planejamento | `day_of_month`, `is_active`, `start_date`, `end_date` | indicadores separados de entradas previstas |
| `cards` | cadastro auxiliar | `card_id`, configuração do cartão | identifica cartão apenas em despesas realizadas |
| `user_categories` e campos desnormalizados | cadastro auxiliar | `category_id`, `category_name`, `category_icon`, enum legado | resolve rótulos de categorias reais na tela e no PDF |
| `shared_group_id` + RLS | contexto | carteira pessoal ou grupo | aplicado nas cinco consultas da página |

Não existe FK, occurrence ID, `recurring_expense_id`, `recurring_income_id` ou outro identificador ligando template e movimentação. Não existe campo persistido de pago/pendente nas recorrências. A aplicação não gera automaticamente uma linha em `expenses`/`incomes` a partir de um template; o fluxo observado apenas cadastra, edita, ativa/desativa e agenda lembretes. Uma movimentação manual pode coincidir com uma recorrência sem vínculo comprovável.

Ao desativar uma despesa recorrente pela interface, `is_active` passa a `false` e `end_date` recebe a data local. Relatórios agora carrega também templates inativos para conseguir reconstruir meses históricos dentro de `start_date`/`end_date`. Templates inativos sem `end_date` são ignorados por falta de uma janela histórica comprovável.

Não há soft delete nessas quatro tabelas. Exclusões são físicas. As políticas RLS permitem leitura do próprio usuário ou de grupos dos quais ele participa; Relatórios ainda acrescenta filtros explícitos de contexto pessoal/grupo.

## Regra anterior

`buildReportViewModel` somava linhas de `expenses`/`incomes` e templates aplicáveis ao período nos mesmos totais. A mistura propagava-se para resumo, cards, categorias, forma de pagamento, cartões, fluxo, evolução, maiores gastos, comparação, taxa de economia e PDF.

Além disso, “Paga” era inferido por `day_of_month < dia de hoje`. Um relatório histórico podia exibir “Vence em X dias” relativo ao relógio atual, embora não existisse confirmação de lançamento nem pagamento.

## Regra nova

### Realizado

Somente linhas persistidas de `expenses` e `incomes` cuja data civil pertence ao período selecionado. Os totais principais são Entradas realizadas, Saídas realizadas e Resultado realizado. A taxa de economia realizada é `(entradas realizadas - saídas realizadas) / entradas realizadas`, somente quando entradas realizadas são positivas.

Categorias, pagamentos, cartões, membros, fluxo, evolução, ranking, comparação e PDF derivam dessa mesma base. A comparação é sempre realizado contra realizado.

### Previsto

Ocorrências de templates recorrentes dentro do período e da janela `start_date`/`end_date`. Dia 29/30/31 é limitado ao último dia do mês quando necessário. Os valores aparecem em “Planejamento recorrente” e “Despesas Fixas Previstas”, visualmente secundários e nunca somados ao realizado.

Para o mês atual, uma ocorrência futura pode ser “Pendente de lançamento” e mostrar dias até o vencimento. Para mês histórico, o rótulo é “Sem confirmação de lançamento” e mostra a data civil daquele mês. Para mês futuro, o rótulo é “Prevista”. Nenhum template recebe “Paga” apenas porque a data passou.

### Comprometido e deduplicação

O sistema não apresenta um total definitivo de comprometido. Sem vínculo confiável, não é possível saber se um lançamento manual materializou determinado template. Nenhuma correspondência por descrição, valor, categoria, dia, forma de pagamento ou texto foi criada. A função de domínio aceita somente IDs explicitamente ligados para retirar uma previsão; o schema atual não fornece tais IDs, portanto a interface mantém os blocos separados e declara a ausência de confirmação.

## Timezone e períodos

Relatórios trata colunas `date` como datas civis e converte `timestamptz` para o dia civil de `America/Sao_Paulo`. O cálculo cobre dia 1, instantes próximos à meia-noite, fevereiro bissexto, transição de mês e dezembro/janeiro. Essa mudança ficou restrita ao fluxo de Relatórios.

## Exportação e categorias

Tela e PDF consomem o mesmo `ReportViewModel`. A resolução prioriza `category_name` desnormalizado, depois `category_id` presente em `user_categories`, e por fim o enum legado quando não existe ID. Um `category_id` válido porém não resolvido não é silenciosamente mascarado como “Outros”; aparece como “Categoria não resolvida”, tornando o problema observável sem inventar categoria.

O PDF usa os mesmos agregados realizados da interface e inclui previsão recorrente em seção separada, com “Sem confirmação de lançamento”.

## Valores-oráculo

| Período | Realizado correto | Recorrente separado | Valor antigo incorreto |
| --- | ---: | ---: | ---: |
| janeiro/2026 | R$ 273,80 | R$ 14,90 | R$ 288,70 |
| fevereiro/2026 | R$ 717,30 | R$ 265,90 | R$ 983,20 |

Fevereiro contra janeiro usa R$ 717,30 versus R$ 273,80: diferença de R$ 443,50 e aumento aproximado de 162%. O aumento antigo de 241% não pertence à comparação realizada.

## Matriz dos componentes

| Componente | Base após P3-A |
| --- | --- |
| Resumo Inteligente | realizado; observação prevista separada |
| Cards principais | realizado |
| Planejamento recorrente | previsto, sem soma definitiva |
| Categoria | despesas realizadas |
| Forma de pagamento | despesas realizadas |
| Cartão | despesas realizadas com `card_id` |
| Fluxo de caixa | realizado |
| Evolução | despesas realizadas |
| Maiores gastos | linhas reais de `expenses`; parcelas podem ser agrupadas em períodos amplos |
| Comparação | realizado versus realizado |
| Taxa de economia | realizado, com defesa para receita zero/negativa |
| Despesas fixas | previsão relativa ao período selecionado |
| PDF | mesmo view model da interface |

## Testes de regressão

`scripts/post-tools-p3-a-reports-business-rules-tests.mjs` cobre 33 grupos: realizado sem recorrência; recorrência sem lançamento; vínculo explícito; ausência de vínculo; não duplicidade; período atual/histórico/futuro; template pendente, encerrado, inativo ou fora da janela; totais, categorias, pagamento, cartão, fluxo, ranking, comparação e taxa; oráculos de janeiro/fevereiro; remoção de R$ 983,20 e 241%; timezone; categoria no PDF; escopo MCP/migrations/dados; tokens de tema e responsividade mobile/desktop.

## Limitações

- As tools MCP permanecem inalteradas e podem continuar com semântica divergente até a P3-B.
- Não há confirmação de materialização/pagamento de templates no modelo atual.
- Não existe total “comprometido” confiável sem evolução de schema e fluxo de escrita.
- “Categoria não resolvida” exige investigação de integridade/RLS se aparecer; não é substituída por um fallback enganoso.
- Não houve deploy, smoke em dados reais, alteração remota, commit ou push.

## Roteiro de smoke futuro

1. Abrir Relatórios em desktop e mobile, nos temas claro e escuro.
2. Selecionar janeiro/2026 e confirmar Saídas realizadas de R$ 273,80; R$ 14,90 deve aparecer somente no planejamento.
3. Selecionar fevereiro/2026 e confirmar Saídas realizadas de R$ 717,30; R$ 265,90 deve aparecer separado.
4. Confirmar que categorias e formas de pagamento somam R$ 717,30 e que maiores gastos contém apenas lançamentos.
5. Confirmar comparação fevereiro/janeiro: +R$ 443,50 e aproximadamente +162%, nunca 241%.
6. Conferir taxa de economia com uma fixture de entradas conhecidas e recalcular usando somente realizado.
7. No mês histórico, confirmar data de vencimento do próprio mês e ausência de “Vence em X dias”/“Paga”.
8. No mês atual, confirmar “Pendente de lançamento” e contagem de dias apenas para ocorrência futura.
9. No mês futuro, confirmar “Prevista” e nenhum valor nos cards realizados sem movimentações persistidas.
10. Exportar PDF e comparar resumo, categorias, pagamentos, ranking, comparação e bloco previsto com a tela.
11. Alternar carteira pessoal/grupo e confirmar que nenhum item de outro contexto aparece.

Critério de aprovação: todos os agregados realizados fecham com as linhas persistidas do período; previsões ficam separadas e neutras; não há status pago sem evidência, divergência de categoria entre tela/PDF ou regressão visual em tema/tamanho de tela.
