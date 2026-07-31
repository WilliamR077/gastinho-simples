# PÓS-TOOLS P2-A — diagnóstico de datas e completude de parcelas

## 1. Pré-condições

- Repositório-base: `C:\Users\Joao\Documents\GitHub\gastinho-simples`.
- Branch-base: `main`, limpa e alinhada com `origin/main`.
- Commit-base: `c837c363a355933405cb64d006f6aa73454ce98f` (`fix: prevent automatic installment deletion during loading`).
- Project ref: `jaoldaqvbdllowepzwbr`.
- `supabase migration list --linked`: 64 locais, 64 remotas, zero local-only e zero remote-only.
- `supabase db push --linked --dry-run`: `Remote database is up to date.`
- Worktree: `C:\Users\Joao\Documents\GitHub\gastinho-simples-p2`.
- Branch: `codex/post-tools-p2-diagnose-installment-series-errors`.

Nenhum SQL remoto foi executado. As duas chamadas do CLI acima consultaram somente o histórico de migrations e calcularam o dry-run exigido.

## 2. Localização exata dos códigos

### `INSTALLMENT_DATE_INVALID`

- Fonte editável: `src/lib/mcp/shared/installment-series-read.ts`, `rowDate` (linhas 196–218) e `analyzeInstallmentSeries` (linhas 275–502); o push ocorre nas linhas 380–385.
- Tool: `get_installment_series`, registrada por `src/lib/mcp/tools/get-installment-series.ts`; handler em `getInstallmentSeries` (linhas 522–605 do helper).
- Bundle gerado: `supabase/functions/mcp/index.ts`, guard na linha 5540.
- Manifest: `.lovable/mcp/manifest.json`, enum de output na linha 2969.
- Condição literal: depois de normalizar cada data com `rowDate`, `rows.some(row => !isValidIsoDate(rowDate(type, row)))`.
- Input disponível: `transaction_type` e exatamente um de `installment_group_id`/`transaction_id`; depois da leitura, todas as linhas acessíveis da tabela escolhida e as colunas listadas em `EXPENSE_COLUMNS`/`INCOME_COLUMNS`.
- Query anterior: opcionalmente uma `.maybeSingle()` por `id`; depois `.eq("installment_group_id", id)`, três ordens e `.limit(49)` em `expenses` ou `incomes`.
- Momento: após todas as leituras, durante a análise em memória, antes da resposta. Não há escrita em nenhum ponto.
- Natureza: warning de domínio no array `warnings`, não exceção, `throw`, fallback nem `mcpError`.
- Resposta ao cliente: aparece em `structuredContent.warnings`, `structuredContent.series.warnings` e no texto `warnings=[...]`. A tool continua bem-sucedida, mas `integrity_status` vira `inconsistent` e `data_complete` vira `false`.

### `SERIES_COMPLETENESS_NOT_VERIFIED`

- Fonte editável: `src/lib/mcp/shared/card-factual.ts` (enum, linha 15) e `src/lib/mcp/tools/get-card-installments.ts`, handler e condição na linha 192.
- Tool: `get_card_installments`.
- Bundle gerado: `supabase/functions/mcp/index.ts`, condição na linha 4526.
- Manifest: `.lovable/mcp/manifest.json`, enum de output na linha 2783.
- Condição literal: `installments.length > 0`. Não existe contagem de N, busca da parcela 1, detecção de lacuna ou comparação de metadados para este código.
- Input disponível: `card_id`, escopo temporal, datas opcionais, ordenação, limite e cursor.
- Queries anteriores: cartão próprio por `id` + `user_id` com `.maybeSingle()`; despesas por `user_id`, `card_id`, evidência de parcelamento, filtros temporais/de data/cursor, ordem por `expense_date,id` e `.limit(limit + 1)`.
- Momento: após cortar a página em `rows.slice(0, limit)`, antes de construir a resposta. Não há escrita.
- Natureza: warning factual/conservador, não erro, fallback ou prova de série incompleta.
- Resposta ao cliente: `structuredContent.series_warnings` e texto `Avisos da série: [...]`.

## 3. Fonte de verdade MCP

`src/lib/mcp/index.ts` e seus módulos em `src/lib/mcp/**` são a fonte editável. O plugin `mcpPlugin()` de `@lovable.dev/mcp-js/stacks/supabase/vite`, configurado em `vite.config.ts`, participa do `vite build`; `npm run build:mcp` executa `vite build`, extrai o manifest com `lovable-mcp-extract-manifest` e valida o bundle com `scripts/check-mcp-bundle.mjs`. O artefato autocontido implantável é `supabase/functions/mcp/index.ts`; `.lovable/mcp/manifest.json` é o catálogo gerado.

Os dois códigos e suas condições existem na fonte, bundle e manifest. A verificação local do bundle passou sem regenerá-lo. Isso comprova sincronismo semântico do checkout, não qual hash está implantado: o repositório não contém recibo/hash do deploy atual e esta fase proibiu consulta ou deploy remoto. Portanto, código implantado diferente continua possível, mas não comprovado.

## 4. Modelo real

Não existe tabela-pai de série, FK de uma parcela para a parcela 1, constraint de progressão mensal, constraint de owner/contexto uniforme nem unicidade por `(installment_group_id, installment_number)`.

### `expenses`

- PK `id uuid`; `user_id uuid NOT NULL` com FK para Auth e cascade.
- Data: `expense_date date NOT NULL DEFAULT CURRENT_DATE`; o cliente Supabase tipa como `string`.
- Parcelas: `installment_group_id uuid NULL DEFAULT NULL`, `installment_number integer NULL DEFAULT 1`, `total_installments integer NULL DEFAULT 1`.
- Check `check_installment_number`: `installment_number > 0 AND installment_number <= total_installments`. Pelo comportamento ternário do SQL, valores nulos não são rejeitados. Não há check independente para total, grupo ou coerência entre linhas.
- Índices relevantes: `idx_expenses_installment_group`, `idx_expenses_expense_date`, `idx_expenses_user_date`, PK e índices de usuário/cartão/grupo compartilhado. O índice de grupo não é unique.
- `shared_group_id uuid NULL` referencia `shared_groups` com `ON DELETE SET NULL`; não é acoplado ao UUID da série.
- `created_at` e `updated_at` são `timestamptz NOT NULL`; trigger atualiza `updated_at`.
- RLS habilitada. SELECT permite owner ou membro do `shared_group_id`; UPDATE/DELETE históricos continuam restritos ao `user_id`; INSERT exige owner e membership quando compartilhada.
- Não há status/soft delete em `expenses`.

### `incomes`

- PK `id uuid`; `user_id uuid NOT NULL`, mas a migration de criação não declara FK para Auth.
- Data: `income_date timestamptz NOT NULL DEFAULT now()`; o cliente Supabase tipa como `string`.
- Parcelas: `installment_group_id uuid NULL DEFAULT NULL`, `installment_number integer NULL DEFAULT 1`, `total_installments integer NULL DEFAULT 1`.
- Não há check de número/total nem índice de `installment_group_id` nas 64 migrations.
- `shared_group_id uuid NULL` referencia `shared_groups` com `ON DELETE SET NULL`.
- `created_at` e `updated_at` são `timestamptz NOT NULL`; trigger atualiza `updated_at`.
- RLS habilitada. SELECT permite owner ou membro do grupo; INSERT exige owner/membership; UPDATE/DELETE exigem owner.
- Não há status/soft delete em `incomes`.

### Invariantes que o banco não garante

Em ambas as tabelas são possíveis grupo nulo, lacunas, números duplicados, totais divergentes, datas fora de ordem e mistura de `user_id`/`shared_group_id` sob o mesmo UUID de grupo. Em `expenses`, o check impede número não positivo ou maior que total somente quando os dois operandos são não nulos. Em `incomes`, nem essa proteção existe. O mesmo UUID pode existir simultaneamente nas duas tabelas porque não há namespace/tabela-pai comum.

Recorrências vivem em `recurring_expenses`/`recurring_incomes`; não são parcelas-pai e os dois guards não as consultam. Não foram encontradas RPCs ou triggers que completem/reconstruam séries.

## 5. `INSTALLMENT_DATE_INVALID`

### Regra atual e parsing

`isValidIsoDate` exige string exata `YYYY-MM-DD`, cria `${s}T00:00:00Z` e exige round-trip idêntico. `rowDate` trata as tabelas de modo diferente:

- expense: aceita `YYYY-MM-DD`; qualquer outro valor é devolvido cru e falha no validator;
- income: aceita `YYYY-MM-DD`; caso contrário tenta `new Date(raw)` e converte o instante para data civil em `America/Sao_Paulo`.

Assim, `null`, `undefined`, vazio e timestamp em uma linha de expense ativam o warning. Timestamp ISO/offset válido em income não ativa. Uma string impossível de expense ativa; uma string impossível que o parser JavaScript normalize em income pode deixar de ativar, embora PostgreSQL `timestamptz` não aceite tal valor na persistência.

O guard não recebe objetos `Date` nem números do Supabase segundo os tipos atuais. Se um mock/bundle/adaptador os fornecer, a função espera string e pode falhar antes do warning; o handler captura e devolve `READ_FAILED`.

### Meses e timezone

O analisador não compara mês esperado, data completa, dia original ou ordem cronológica. Portanto 31/01 seguido de 03/03 (overflow de `setMonth`), meses repetidos, lacunas, regressão e mudança do dia permanecem datas individualmente válidas e não ativam o warning. Timezone pode mudar a data civil de income, mas um timestamp parseável ainda produz uma string válida.

O frontend de despesas usa `Date.setMonth`, que pode fazer overflow nos dias 29–31, e persiste `YYYY-MM-DD`. O frontend de receitas usa `date-fns/addMonths` e envia `toISOString()` para `timestamptz`. Esses caminhos explicam sequências civis inesperadas, mas não este warning por si só.

### Classificação baseada em evidência

- Confirmada: o guard classifica formato incompatível/ausente após a query; em expense, exige a representação de `date` esperada pelo PostgREST.
- Confirmada: não é uma validação de aritmética mensal.
- Descartada para dados normalmente persistidos: data impossível ou nula em `expense_date`/`income_date`, pois os tipos PostgreSQL e `NOT NULL` impedem isso.
- Possível, não comprovada: resposta/mock fora do contrato, bundle implantado diferente ou serialização inesperada.
- Timezone: afeta o dia normalizado de income, mas não foi comprovado como causa do warning.

Para fechar um caso real ainda são necessários apenas: tool chamada, `transaction_type`, representação JSON exata de `transaction_date`/campo bruto e identificação técnica da linha. Não publicar descrição nem valor.

## 6. `SERIES_COMPLETENESS_NOT_VERIFIED`

### Algoritmo real

Não há algoritmo de completude associado ao código. Toda página não vazia de `get_card_installments` recebe o warning. A tool:

- consulta somente `expenses`;
- exige explicitamente `user_id = sessão` e `card_id`;
- aplica por padrão `time_scope=future`;
- aceita intervalo de datas;
- pagina por cursor;
- limita a página a 20 por padrão e 100 no máximo;
- não agrupa por `installment_group_id`.

Logo, uma série 1..N perfeita gera o warning; falta, duplicidade e total divergente também geram exatamente o mesmo warning; resposta vazia ou query com erro não o gera (o erro de query vira `INTERNAL_ERROR`).

RLS permite ao membro ler lançamentos compartilhados de outro owner, mas o filtro explícito `user_id = sessão` os exclui dessa tool. Filtros temporal/mensal, cartão, cursor e limite tornam a consulta deliberadamente parcial. `.single()` não é usada para parcelas; `.maybeSingle()` é usada somente na validação do cartão.

### Estrutural, visível e histórico

- Completude estrutural: 1..N, sem duplicidade, N uniforme, mesmo UUID e contexto. O banco não a garante.
- Completude visível: linhas restantes após RLS e filtros da sessão.
- Completude histórica: todas as linhas realmente existentes.

`get_card_installments` não tenta provar nenhuma delas. O warning comunica justamente essa ausência de prova. `get_installment_series` possui um analisador estrutural separado: lê até 49 linhas acessíveis por grupo, recusa analisar parcialmente acima de 48 e calcula totais, lacunas, duplicidades, faixa, referência e metadados. Mesmo ele prova somente o conjunto visível sob RLS, não a existência histórica invisível.

### Classificação baseada em evidência

- Confirmada: regra intencional e mais conservadora que um teste de integridade; qualquer resultado não vazio ativa.
- Confirmada: query parcial por design (owner, cartão, tempo, intervalo, cursor e limite).
- Confirmada: member não vê registros do outro owner nesta tool apesar de a RLS permitir leitura compartilhada.
- Descartada como requisito do guard: parcela 1, última parcela, N, lacuna, duplicidade, datas e contexto não são avaliados.
- Possível para divergência entre visível e histórico: RLS e mistura de owner/contexto; requer o SQL administrativo manual para quantificar.

## 7. Relação entre os códigos

Classificação: **independentes**.

`INSTALLMENT_DATE_INVALID` é produzido por `get_installment_series` ao analisar datas de expenses ou incomes. `SERIES_COMPLETENESS_NOT_VERIFIED` é produzido por `get_card_installments` para qualquer página não vazia de expenses. Nenhum chama o outro; nenhum bloqueia ou mascara o outro; ambos são warnings após leituras e antes da resposta. Podem aparecer em interações sobre a mesma série, mas por causas e tools distintas.

## 8. Operações e mutações

| Operação | Pode emitir um dos códigos? | Leituras/validação relevantes | Escrita antes do warning |
|---|---|---|---|
| `get_card_installments` | `SERIES_COMPLETENESS_NOT_VERIFIED` | cartão próprio; página filtrada de expenses | nenhuma |
| `get_installment_series` | `INSTALLMENT_DATE_INVALID` | referência opcional; série acessível; análise local | nenhuma |
| criação MCP de expense/income | não | valida input e insere uma linha simples; MCP não cria série | não aplicável |
| criação parcelada no frontend | não emite os códigos | gera várias linhas; `setMonth`/`addMonths` | pode haver inserts parciais porque o frontend insere linha a linha; não é fluxo dos warnings |
| atualização MCP de parcela | não | lê linha/versão; atualiza somente uma linha | não aplicável |
| atualização de série no frontend | não | lê irmãs e atualiza cada linha | pode haver writes parciais; não é fluxo dos warnings |
| exclusão MCP de parcela | não | lê linha/versão; exclui uma linha confirmada | não aplicável |
| exclusão de série no frontend | não | delete por UUID de grupo | não aplicável |
| detalhes no frontend | não | query por grupo, ordenada | nenhuma |
| rateio, recorrência, importação | não | não chamam os dois guards | nenhuma ligada aos códigos |

Nos dois avisos observados, nenhuma mutação ocorre antes ou depois da condição.

## 9. Matrizes sintéticas

A suite `scripts/post-tools-p2-installment-series-tests.mjs` importa o analisador real de TypeScript em memória, sem banco. Ela cobre 23 casos de data (os 22 pedidos mais o parser permissivo de income) e reproduz literalmente o guard de completude em 30 cenários.

Casos que produzem `INSTALLMENT_DATE_INVALID`: timestamp UTC entregue como `expense_date`, string vazia, `null`, `undefined` e data impossível em expense. Os demais casos pedidos não produzem porque são datas válidas isoladamente ou timestamps normalizados de income. Em especial, sequência mensal não é validada.

Casos que produzem `SERIES_COMPLETENESS_NOT_VERIFIED`: cenários 1–23 e 26–29, porque há ao menos uma expense visível na página. Cenários 24 (query com erro) e 25 (vazia) não produzem. O cenário 30, apenas em incomes, não é alcançado pela tool. Owner/member, duplicidade, lacuna e ordem não alteram a condição depois que existe uma linha visível.

A suite também impede diff em frontend/MCP/Edge Functions/migrations, confirma 64 migrations, exige SQL read-only, proíbe campos privados no SQL e verifica que os dois códigos permanecem na fonte e bundle sem pressupor causa comum.

## 10. SQL diagnóstico

Arquivo: `docs/audits/post-tools-p2-installment-series-errors/diagnostic.sql`.

Ele contém apenas `SELECT`, `WITH`, CTEs, agregações, funções de catálogo/apresentação, windows e `generate_series`. Não contém escrita, DDL, grants, RPC com efeito, tabela temporária ou referência a `auth.users`. A saída detalhada é um JSON por UUID de série e usa somente IDs técnicos, datas, números, contagens e flags. Expenses e incomes são identificados e analisados separadamente.

Como as duas datas são colunas PostgreSQL tipadas e `NOT NULL`, o SQL não pode provar a representação JSON que chega ao Deno nem uma “data inválida” que o banco não consegue armazenar. Por isso `invalid_date_status` declara a limitação, `potential_INSTALLMENT_DATE_INVALID` é zero e o diagnóstico se limita à ordem/coerência mensal. Essas anomalias temporais não equivalem ao guard atual.

### Execução manual

1. Abra o SQL Editor do projeto `jaoldaqvbdllowepzwbr` com função administrativa autorizada.
2. Cole o arquivo e execute cada statement separadamente.
3. Guarde localmente os resultados; não os adicione ao Git.
4. Pode compartilhar apenas os campos JSON previstos. Não publique qualquer coluna adicional, descrição, valor, categoria, cartão, observação, nome, e-mail, telefone, token ou metadata Auth.

O primeiro bloco confirma catálogo. O bloco detalhado retorna zero ou mais linhas JSON. O último retorna exatamente uma linha JSON de resumo.

## 11. Hipóteses classificadas

| Hipótese | Classificação | Evidência |
|---|---|---|
| input da tool inválido causa os códigos | descartada | input inválido retorna `INVALID_INPUT`; os códigos surgem depois das queries |
| data persistida impossível/nula | descartada no modelo atual | `date/timestamptz NOT NULL` |
| formato incompatível em expense | possível e reproduzido | timestamp em `expense_date` ativa o warning sintético; PostgREST normal deve devolver `date` civil |
| timezone causa warning | possível, não comprovada | normalização de income muda o dia, mas continua válida |
| aritmética de mês causa warning de data | descartada | guard não compara progressão; overflows válidos passam |
| inconsistência histórica estrutural | possível | banco não garante unicidade/completude; medir com SQL manual |
| query parcial causa warning de completude | confirmada por design | filtros e paginação; warning é incondicional em página não vazia |
| RLS/member causa visão incompleta | possível | RLS + filtro explícito de owner podem divergir da história compartilhada |
| resposta MCP parcial | confirmada para `get_card_installments` | página limitada; não agrupa série |
| conflito expenses/incomes | possível no UUID, irrelevante aos guards | tabelas consultadas separadamente |
| bundle local desatualizado | descartada semanticamente | fonte/bundle/manifest contêm as mesmas condições |
| deploy remoto diferente | possível, não verificado | não há recibo local e consulta remota/deploy estão fora do escopo |
| mesma causa para os dois códigos | descartada | tools, dados e condições diferentes |

## 12. Validações

Resultados finais registrados nesta execução:

- `node scripts/post-tools-p2-installment-series-tests.mjs`: aprovado.
- `npx tsc --noEmit` com compilador local: aprovado.
- ESLint direcionado ao script: aprovado.
- `npm run build`: aprovado com `node_modules` disponível. O plugin reescreveu o bundle MCP (SHA-256 mudou de `6B1D5A58A175A425CCBA6153AA401973FE2A7106F572C189983898C2260219AB` para `852943730008B3433E0F626709D95B5F8CECB936CA144FD708A9CD479F0E6DB1`); ele foi imediatamente restaurado ao `HEAD` e voltou ao hash original. O manifest permaneceu no hash `6A63FAF81CCE5624808B2F35BDAC9FE6D28C904520854C47A7FBE11D4DA9E5C5`.
- `git diff --check`: aprovado.
- migration list final: 64/64, sem versões exclusivas.
- db push final `--dry-run`: `Remote database is up to date.`
- SQL remoto: não executado.

## 13. Próximo passo e roteamento P2-B

- Se o SQL mostrar séries estruturalmente incompletas, duplicadas, totais divergentes ou contexto misto, encaminhar a evidência técnica para **P2-B2**. Não limpar nem reconstruir dados nesta fase.
- Se o SQL mostrar séries completas e a interação apenas exibir `SERIES_COMPLETENESS_NOT_VERIFIED`, isso confirma o comportamento incondicional atual e também encaminha a decisão de semântica/UX para **P2-B2**.
- Se `INSTALLMENT_DATE_INVALID` reaparecer com dados normais, capturar a tool, `transaction_type` e representação JSON exata da data. Como o SQL não pode armazenar datas inválidas, encaminhar divergência de serialização/validator/bundle para **P2-B1**.
- Sequências mensais suspeitas no SQL devem ser revisadas manualmente; elas não reproduzem o warning atual, mas podem orientar a definição futura de P2-B1 sem presumir correção.

## 14. Veredito

**P2-A pronta para execução manual read-only.** O diagnóstico separa os dois warnings, reproduz seus guards atuais, não altera produção e entrega SQL que o usuário pode executar manualmente. Nenhuma correção foi implementada e a P2-B não foi iniciada.
