# PÓS-TOOLS G1-A — Diagnóstico read-only dos grupos “Família”

Data da inspeção local: 2026-07-30

Projeto informado: `jaoldaqvbdllowepzwbr`

Commit-base inspecionado: `c623a38`

Escopo: modelo local e preparação de consulta manual; nenhum dado remoto foi consultado.

## Resumo executivo

O diagnóstico está pronto para execução manual read-only no Supabase SQL Editor.

A inspeção local comprova que:

- `shared_group_members` não possui coluna de status nem `is_active`. “Membership ativa/inativa”, “owner ativo/inativo” e flags equivalentes não são conceitos representáveis no modelo atual. A consulta retorna esses campos como `null` e marca `membership_status_supported = false`.
- `shared_group_members.role` é o enum `group_member_role`, com `owner`, `admin` e `member`.
- existe `UNIQUE (group_id, user_id)`, mas não existe constraint que garanta exatamente um owner, que o owner seja `created_by`, ou que o criador tenha membership;
- `created_by` e `shared_group_members.user_id` são UUIDs obrigatórios, porém não possuem FK local para `auth.users`;
- a criação no frontend ocorre em duas escritas separadas: primeiro o grupo, depois a membership owner. Não há transação nem RPC de criação. Uma falha entre as duas operações explica tecnicamente um grupo criado sem membership do owner;
- o frontend, as RLS, a RPC destrutiva e as tools MCP não usam uma única definição de “dono”;
- as tools MCP recentes tratam como consistente apenas o grupo com exatamente uma membership owner, pertencente a `created_by`, sem duplicatas;
- corrigir apenas membership não move nem altera dados financeiros, mas pode mudar imediatamente a visibilidade e autorização via RLS;
- não é possível determinar estaticamente se os quatro grupos “Família” têm o mesmo defeito. Isso depende do resultado da consulta manual.

O arquivo completo para copiar é [`diagnostic.sql`](./diagnostic.sql). Ele retorna uma linha JSON por grupo “Família” normalizado e por qualquer outro grupo com inconsistência estrutural equivalente.

## 1. Modelo real

### 1.1 `public.shared_groups`

Fonte principal: migration `20251204151708_86ac07c1-31ac-4793-aaa1-93a1cd4c0e76.sql`; alteração de `max_members` em `20251204201123_bddfd12d-4594-43a3-9062-677272b2ed8e.sql`; tipos gerados em `src/integrations/supabase/types.ts`.

| Coluna | Tipo final local | Null | Default / constraint |
|---|---|---:|---|
| `id` | `uuid` | não | PK, `gen_random_uuid()` |
| `name` | `text` | não | sem CHECK |
| `description` | `text` | sim | nenhum |
| `created_by` | `uuid` | não | sem FK para Auth |
| `invite_code` | `text` | não | UNIQUE |
| `color` | `text` | sim | `'#6366f1'` |
| `max_members` | `integer` | sim | default final `NULL` |
| `is_active` | `boolean` | sim | `true` |
| `created_at` | `timestamptz` | sim | `now()` |
| `updated_at` | `timestamptz` | sim | `now()` |

Índices explícitos: `created_by`, `invite_code`; o UNIQUE de `invite_code` também cria índice próprio.

Trigger: `update_shared_groups_updated_at`, antes de cada alteração de linha, chama `public.update_updated_at_column()`.

Não há CHECK para nome, cor, capacidade, código de convite ou coerência entre `created_by` e memberships.

### 1.2 `public.shared_group_members`

| Coluna | Tipo final local | Null | Default / constraint |
|---|---|---:|---|
| `id` | `uuid` | não | PK, `gen_random_uuid()` |
| `group_id` | `uuid` | não | FK para `shared_groups(id)`, `ON DELETE CASCADE` |
| `user_id` | `uuid` | não | sem FK para Auth |
| `role` | `group_member_role` | não | default `member` |
| `joined_at` | `timestamptz` | sim | `now()` |

Constraint de unicidade: `UNIQUE (group_id, user_id)`.

Índices explícitos: `user_id` e `group_id`.

Não existem:

- `status`;
- `is_active`;
- timestamp de inativação;
- enum de status;
- constraint de owner único;
- FK de `user_id` para `auth.users`;
- trigger de ownership;
- trigger que crie automaticamente a membership do criador.

Consequência: uma linha significa “membership existente”, não “membership ativa”. Inatividade de grupo e inatividade de membership são conceitos diferentes; somente o primeiro existe.

### 1.3 Enums

`public.group_member_role` contém exatamente:

- `owner`;
- `admin`;
- `member`.

Role inválida não pode ser gravada normalmente por causa do enum e do `NOT NULL`. A consulta ainda faz uma verificação defensiva com `role::text`, útil para detectar drift entre o banco efetivo e o histórico local.

### 1.4 RLS final relevante

RLS está habilitada em `shared_groups` e `shared_group_members`.

`shared_groups`:

- SELECT: o usuário vê o grupo quando `auth.uid() = created_by` ou `is_group_member(id, auth.uid())`;
- INSERT: exige `auth.uid() = created_by` e, desde a migration de 2026-07-02, `can_create_group(auth.uid())`;
- UPDATE: exige role `owner` ou `admin` via `get_group_role`;
- DELETE: exige `auth.uid() = created_by`, apesar do nome da policy afirmar “owner”.

`shared_group_members`:

- SELECT: exige que o usuário seja membro do grupo;
- INSERT: permite owner/admin adicionar, o próprio usuário entrar como `member`, ou o criador inserir a si mesmo como `owner`;
- UPDATE: exige role `owner`;
- DELETE: permite role `owner` remover memberships ou qualquer usuário remover a própria membership.

Funções auxiliares:

- `is_group_member` testa apenas existência de linha por grupo/usuário; não considera `shared_groups.is_active`;
- `get_group_role` retorna a role da linha por grupo/usuário;
- ambas são `STABLE SECURITY DEFINER`, com `search_path = public`.

Impacto da inconsistência:

- o criador sem membership ainda pode ler `shared_groups`, mas não passa nas policies que dependem de `is_group_member`;
- a UI antiga começa sua listagem por `shared_group_members`; portanto um criador sem membership pode nem ver o grupo no produto;
- despesas, receitas, recorrências, metas e rateios protegidos por `is_group_member` podem ficar inacessíveis;
- criar/reparar a membership pode restaurar acesso imediatamente, sem tocar nos registros dependentes.

### 1.5 Grants

O histórico local torna explícitos os grants de execução das funções sensíveis:

- `find_group_by_invite_code(text)`: execução revogada de `PUBLIC`/`anon` e concedida a `authenticated`;
- `generate_invite_code()`: idem;
- `delete_group_and_data(uuid, text)`: idem;
- `can_create_group(uuid)`, `is_group_member(uuid, uuid)` e `get_group_role(uuid, uuid)`: execução para `authenticated` após o hardening de 2026-05-03.

Não foram encontradas migrations com grants explícitos de tabela para `shared_groups` ou `shared_group_members`; os privilégios-base dessas tabelas dependem do bootstrap/default privileges do projeto, e RLS continua sendo a barreira por linha.

Há uma divergência importante na versão atual de `get_group_members_with_email(uuid)`: a função foi removida e recriada em 2026-06-10. Isso elimina grants associados ao objeto antigo. A migration de 2026-07-02 revoga execução de `PUBLIC` e `anon`, mas não volta a conceder explicitamente a `authenticated`. Pelo histórico local isolado, a RPC atual pode ficar sem permissão para o frontend autenticado. Isso deve ser confirmado em fase separada; não foi executada consulta de catálogo remoto.

### 1.6 Funções e RPCs

#### Criação

Não existe RPC de criação de grupo no histórico/tipos gerados.

O frontend:

1. chama `generate_invite_code()`;
2. insere em `shared_groups`;
3. insere separadamente em `shared_group_members` com role `owner`.

As etapas 2 e 3 não são atômicas. A policy de membership foi ampliada para permitir que o criador se adicione como owner, mas não garante que isso aconteça.

#### Entrada por convite

`find_group_by_invite_code(text)`:

- é `SECURITY DEFINER`;
- exige usuário autenticado;
- normaliza o código com `UPPER(TRIM(...))`;
- retorna apenas grupo ativo;
- não cria membership.

Após a busca, o frontend conta memberships e insere diretamente a própria membership como `member`. A unicidade `(group_id, user_id)` protege contra duplicidade normal.

#### Listagem de membros

A função existente chama-se `get_group_members_with_email`, no singular. Não foi encontrada função `get_group_members_with_emails`.

Versão final local:

- `SECURITY DEFINER`;
- permite chamada somente se o chamador tiver uma membership no grupo;
- faz INNER JOIN com `auth.users`, logo uma membership cujo `user_id` não exista em Auth é omitida do resultado;
- retorna UUID, role, `joined_at`, e-mail e `display_name`.

Essa RPC é usada pelo frontend antigo. As tools MCP novas não a usam: consultam memberships e profiles separadamente e não retornam e-mail/UUID de usuário em sua saída pública.

#### Exclusão

`delete_group_and_data(group_id, action)` é `SECURITY DEFINER` e considera “owner” exclusivamente o UUID de `shared_groups.created_by`.

Com `delete_all`, remove alertas, metas, despesas, recorrências, receitas e receitas recorrentes associadas, depois memberships e grupo.

Com `move_to_personal`, a versão final:

- remove alertas de metas;
- zera o vínculo de grupo de despesas, recorrências, receitas, receitas recorrentes e metas de todos os membros;
- remove memberships e o grupo.

Há divergência com o texto da UI, que afirma que metas seriam removidas; a RPC final move as metas para pessoal após remover alertas.

Não foi encontrada manipulação explícita de `expense_splits` na RPC. Em `delete_all`, apagar despesas aciona CASCADE nos rateios. Em `move_to_personal`, as despesas permanecem e os rateios também permanecem ligados a elas.

### 1.7 Invariantes e respectivas fontes

| Possível invariante | Banco/constraints | Produto/MCP | Veredito |
|---|---|---|---|
| Exatamente um owner por grupo | não garante | MCP exige exatamente um | regra operacional do MCP, não invariante do banco |
| Owner igual a `created_by` | não garante | criação tenta; exclusão usa `created_by`; MCP exige igualdade | intenção forte, mas não garantida |
| Criador sempre membro | não garante | frontend tenta em segunda escrita | intenção, com janela real de falha |
| Uma membership por usuário/grupo | UNIQUE garante | frontend/MCP também verificam | invariante real do schema local |
| Roles permitidas | enum + NOT NULL | código usa as mesmas três | invariante real |
| Status permitidos | status inexiste | código não possui status | não aplicável |
| Owner/admin obrigatoriamente ativo | atividade de membership inexiste | não modelado | não aplicável |
| Grupo inativo pode manter memberships | nenhuma cascata por `is_active` | MCP pode listar com opção; frontend filtra | permitido |
| Transferência formal de ownership | não há operação atômica/constraint | UI não oferece; MCP protege `created_by` | não suportada com segurança |
| Owner pode sair | policy permite apagar a própria linha | frontend bloqueia se `my_role = owner` | banco e frontend divergem |
| Criador pode ser diferente do owner | banco permite | MCP classifica como inconsistente; exclusão continua com criador | estado possível, mas inválido para MCP |

Observação adicional: a policy UPDATE de `shared_groups` não possui proteção de coluna. Um owner/admin que escreva diretamente pela API pode tentar alterar `created_by`; a UI e a tool MCP de atualização só alteram nome/descrição/cor. Isso não constitui fluxo suportado de transferência.

## 2. Fluxos do produto

### Criação

- limitada no frontend a premium/premium_plus e até três grupos criados;
- a policy final também chama `can_create_group`;
- código de convite e grupo são criados antes da membership owner;
- não há rollback automático se a membership falhar;
- esse fluxo é compatível com `OWNER_MEMBERSHIP_MISSING`.

### Convite e entrada

- código é reduzido a seis caracteres na UI e normalizado em maiúsculas;
- RPC localiza apenas grupos ativos;
- frontend verifica membership existente e capacidade;
- membership é inserida como `member`;
- não há status de convite pendente ou status de membership.

### Ownership e administração

- UI calcula `isOwner` por `group.my_role === 'owner'`;
- UI permite owner remover outros membros e excluir o grupo;
- owner ou admin podem editar nome no frontend;
- RLS de alteração usa role;
- RLS/RPC de exclusão usam `created_by`;
- MCP considera `is_owner` verdadeiro somente quando role, owner único e `created_by` concordam.

### Saída

- frontend impede owner de sair;
- banco permite qualquer usuário remover a própria membership, inclusive owner;
- não existe transferência obrigatória antes da saída no banco.

### Remoção de membro

- frontend só oferece ao owner e bloqueia auto-remoção;
- policy permite owner remover qualquer linha;
- remover membership não move nem apaga dados associados, mas revoga acesso via RLS.

### Atualização

- frontend permite owner/admin e escreve nome/descrição/cor;
- tool MCP `update_shared_group` exige estrutura consistente, grupo ativo, exatamente um owner igual a `created_by`, memberships sem duplicidade e controle de concorrência por `updated_at`;
- grupos inconsistentes são bloqueados pela tool com `GROUP_DATA_INCOMPLETE`.

### Listagem e contagem

- frontend conta linhas de membership e monta `roleMap` por `group_id`;
- começa pela membership do usuário; um criador sem membership fica fora da lista;
- MCP começa por grupos visíveis, inspeciona memberships, deduplica defensivamente e só fornece `member_count` quando a membership atual é visível;
- por RLS, um criador sem membership pode ver o grupo, mas não as memberships dos demais, causando `membership_id`/role/contagem indisponíveis;
- o SQL de diagnóstico deve ser executado no SQL Editor com papel administrativo para obter contagens factuais completas.

### Tools MCP de grupos

Foram encontradas:

- `list_shared_groups` — read-only;
- `list_shared_group_members` — read-only;
- `update_shared_group` — escrita limitada a metadados;
- `get_group_member_summary` e `get_group_settlement` — leitura analítica.

As duas tools de listagem emitem, entre outros:

- `OWNER_MEMBERSHIP_MISSING`;
- `GROUP_ROLE_INCONSISTENCY`;
- `DUPLICATE_MEMBERSHIP_DETECTED`;
- `DATA_INCOMPLETE`.

Elas não modelam status de membership. A tool de atualização recusa grupos estruturalmente inconsistentes.

## 3. Referências e riscos

### 3.1 Referências diretas a `shared_groups.id`

| Tabela | Coluna | Null | FK / `ON DELETE` | Membership corrigida | `created_by` alterado | Grupo excluído diretamente |
|---|---|---:|---|---|---|---|
| `shared_group_members` | `group_id` | não | CASCADE | restaura/ajusta RLS; nenhum dado financeiro muda | pode alinhar ou desalinha ownership | memberships apagadas |
| `expenses` | `shared_group_id` | sim | SET NULL | visibilidade via RLS pode mudar | sem efeito direto | vínculo fica NULL |
| `recurring_expenses` | `shared_group_id` | sim | SET NULL | visibilidade via RLS pode mudar | sem efeito direto | vínculo fica NULL |
| `incomes` | `shared_group_id` | sim | SET NULL | visibilidade via RLS pode mudar | sem efeito direto | vínculo fica NULL |
| `recurring_incomes` | `shared_group_id` | sim | SET NULL | visibilidade via RLS pode mudar | sem efeito direto | vínculo fica NULL |
| `budget_goals` | `shared_group_id` | sim | CASCADE | visibilidade via RLS pode mudar | sem efeito direto | metas apagadas |

### 3.2 Referências indiretas

| Tabela | Caminho | Efeito |
|---|---|---|
| `expense_splits` | `expense_splits.expense_id → expenses.id → shared_group_id` | CASCADE se a despesa for apagada; permanece se a despesa apenas perder o vínculo |
| `budget_goal_alerts` | `goal_id → budget_goals.id → shared_group_id` | CASCADE quando a meta é apagada; a RPC remove alertas antes de mover metas |

Não foram encontradas outras FKs diretas a `shared_groups` nas 60 migrations nem nos tipos gerados.

### 3.3 Risco por tipo de ação futura

- corrigir membership: não muda os registros dependentes; muda autorização/visibilidade;
- alterar `created_by`: não muda FKs dependentes; muda SELECT, quota de criação e autorização de exclusão;
- excluir grupo: tem efeitos heterogêneos por FK e efeitos adicionais na RPC destrutiva;
- remover membership duplicada/inconsistente: deve preservar a linha legítima e pode alterar role/acesso imediatamente.

## 4. SQL de diagnóstico

O SQL completo está em [`diagnostic.sql`](./diagnostic.sql). Ele foi mantido separado para cópia sem risco de misturar comandos operacionais do relatório.

### Escopo e formato

- normaliza nome com trim, espaços, caixa e acentos sem depender da extensão `unaccent`;
- seleciona todos os grupos cujo nome normalizado seja `familia`;
- acrescenta qualquer outro grupo estruturalmente inconsistente;
- retorna uma coluna `diagnostic` do tipo JSONB por grupo;
- não retorna e-mail, telefone, valores, descrições ou datas financeiras;
- retorna somente IDs internos necessários, roles, timestamps de grupo/membership, booleano de existência em Auth e contagens;
- o JOIN com `auth.users` retorna apenas `user_exists`; nenhuma coluna privada é projetada;
- rateios e alertas são apenas contados por vínculo indireto.

### Campos não modelados

Os seguintes campos aparecem como `null`, deliberadamente:

- memberships ativas/inativas;
- owners ativos;
- status do criador;
- owner inativo;
- criador inativo;
- memberships com status inválido;
- grupo sem membros ativos.

Isso é evidência de “não aplicável ao schema”, não ausência factual de problema.

### Prova estática de read-only

A consulta contém somente:

- uma instrução `WITH ... SELECT`;
- CTEs;
- JOINs;
- filtros;
- agregações;
- construção de JSON;
- funções de texto/apresentação sem efeito de escrita.

Não chama RPC, função administrativa ou `SECURITY DEFINER`. A única leitura fora de `public` é o LEFT JOIN booleano com `auth.users`.

## 5. Classificações possíveis

Flags estruturais:

- `MISSING_CREATOR_MEMBERSHIP`;
- `MISSING_OWNER`;
- `MULTIPLE_OWNERS`;
- `CREATOR_NOT_OWNER`;
- `OWNER_MISMATCH_CREATED_BY`;
- `DUPLICATE_MEMBERSHIP`;
- `INVALID_MEMBERSHIP_ROLE`;
- `MEMBERSHIP_USER_MISSING`;
- `GROUP_HAS_NO_MEMBERS`.

Classificação:

- `CONSISTENT`: nenhuma flag estrutural;
- uma única inconsistência: o nome da flag;
- `MULTIPLE_INCONSISTENCIES`: duas ou mais flags.

Flags de status ficam `null`, pois não há status no modelo.

O JSON inclui:

- `family_group_count`;
- `expected_family_group_count = 4`;
- `family_group_count_matches_expectation`;
- `other_inconsistent_group_count`;
- `stop_for_manual_review`.

O nome “Família” não implica classificação. Um grupo pode ser retornado por nome e ser `CONSISTENT`. Um grupo com outro nome só aparece se for estruturalmente inconsistente.

## 6. Opções preliminares de reparo

Nenhuma opção deve ser escolhida antes da fase G1-B e nenhuma foi executada.

### Opção A — criar membership owner para `created_by`

Pré-condições:

- `created_by` corresponde ao dono humano legítimo;
- usuário ainda existe em Auth;
- não existe membership desse usuário;
- não há owner legítimo diferente ou decisão humana autoriza substituí-lo.

Riscos:

- pode criar segundo owner se o grupo já tiver outro;
- concede imediatamente acesso a dados via RLS;
- pode atribuir ownership ao UUID histórico errado.

Impacto em dados associados: nenhuma alteração direta; apenas acesso/autorização.

Execução futura segura: transação única, rechecagem de invariantes e lock do grupo. Não exige necessariamente migration de schema; uma RPC administrativa auditada é preferível para reparo pontual repetível. Rollback: remover somente a membership recém-criada, desde que nenhuma ação dependente tenha ocorrido.

### Opção B — promover membership existente do criador para owner

Pré-condições:

- criador possui exatamente uma membership;
- criador é o dono legítimo;
- não existe outro owner legítimo ou há decisão explícita sobre rebaixamento.

Riscos:

- pode produzir múltiplos owners;
- muda permissões imediatamente;
- pode apagar a evidência da role histórica sem registro de auditoria externo.

Impacto em dados associados: nenhum direto; acesso e administração mudam.

Execução futura segura: transação com validação de owner único. Não exige migration; pode exigir RPC administrativa. Rollback: restaurar a role anterior registrada antes da transação.

### Opção C — corrigir `created_by` para o owner legítimo

Pré-condições:

- existe exatamente um owner inequívoco;
- evidência humana confirma que ele é o dono;
- impacto sobre quota e exclusão foi aceito.

Riscos:

- muda quem vê o grupo por ser criador;
- muda quem pode excluir via policy/RPC;
- muda a contagem usada por `can_create_group`;
- pode retirar autoridade do criador histórico.

Impacto em dados associados: nenhum FK direto, mas grande impacto de autorização.

Execução futura segura: transação e auditoria; RPC administrativa é recomendável. Migration só seria apropriada se o reparo for uma correção de dados canônica e revisada. Rollback: restaurar `created_by` anterior, desde que registrado.

### Opção D — desativar/remover membership duplicada ou inconsistente

O schema não suporta desativar membership. As alternativas reais futuras são corrigir role ou remover uma linha.

Pré-condições:

- duplicidade realmente existe no banco efetivo apesar do UNIQUE local, ou há drift de constraint;
- linha legítima foi identificada;
- dependências de acesso foram avaliadas.

Riscos:

- remover a linha errada revoga acesso;
- se a linha removida for owner, o grupo pode ficar sem owner;
- “desativar” exigiria mudança de schema e não pode ser simulado por campo inexistente.

Impacto em dados associados: nenhum direto; RLS muda.

Execução futura segura: transação, preservando exatamente uma linha legítima. Duplicidade apesar do UNIQUE deve interromper reparo e provocar inspeção de schema remoto. Rollback: reinserção da linha original com mesmo ID/role/timestamp, se permitido e registrado.

### Opção E — decisão humana obrigatória

Pré-condições:

- owner existente diverge de `created_by`;
- existem múltiplos owners;
- criador não existe em Auth;
- há dados dependentes relevantes;
- grupos históricos podem representar tentativas duplicadas;
- evidências são ambíguas.

Riscos: atraso operacional, mas evita atribuir propriedade ao usuário errado.

Impacto em dados associados: nenhum enquanto não houver ação.

Execução futura segura: manter read-only até decisão documentada. Não exige migration. Rollback não se aplica porque nada é alterado.

## 7. Arquivos

Criados:

- `docs/audits/post-tools-g1-a-family-groups/diagnostic.sql`;
- `docs/audits/post-tools-g1-a-family-groups/REPORT.md`.

Modificados em produção: nenhum.

Não foram criadas migrations; código de frontend, funções, triggers, RLS e RPCs não foram modificados. Nenhum resultado real deve ser salvo nestes arquivos ou em qualquer outro caminho versionado.

## 8. Próximo passo — execução manual

1. Abra o projeto `jaoldaqvbdllowepzwbr` no Supabase.
2. Abra SQL Editor e crie uma query nova.
3. Copie integralmente o conteúdo de [`diagnostic.sql`](./diagnostic.sql).
4. Antes de executar, confirme visualmente que começa por `WITH` e termina no único `SELECT`.
5. Execute uma única vez.
6. Interrompa e não prepare reparo se:
   - `family_group_count` não for exatamente `4`;
   - `family_group_count_matches_expectation` for `false`;
   - `other_inconsistent_group_count` for maior que zero;
   - surgir qualquer grupo que não seja “Família”;
   - alguma coluna/tabela esperada não existir;
   - houver erro de permissão ou qualquer outra falha;
   - `stop_for_manual_review` for `true`;
   - o schema remoto revelar coluna de status não presente localmente;
   - aparecer duplicidade apesar do UNIQUE local.
7. Exporte o resultado pelo SQL Editor como JSON, preferencialmente, ou CSV.
8. Não salve o resultado no repositório.

Para a fase G1-B, retornar:

- as quatro linhas JSON completas de `diagnostic`;
- qualquer linha adicional retornada;
- a mensagem de erro integral, se houver falha;
- confirmação do formato exportado;
- sem editar, resumir ou “corrigir” os IDs.

Não publicar:

- e-mails;
- telefones;
- tokens;
- metadata de Auth;
- valores ou descrições financeiras;
- datas financeiras;
- conteúdo de rateios;
- o arquivo exportado em Git, issue pública, chat público ou canal não autorizado.

Os UUIDs do diagnóstico são dados internos necessários ao reparo e devem permanecer no canal privado da fase G1-B.

## 9. Veredito

**PRONTO PARA EXECUÇÃO MANUAL READ-ONLY, com parada obrigatória diante de qualquer desvio.**

O modelo estático sustenta a consulta e as classificações, mas não sustenta escolher reparo nem afirmar que os quatro grupos têm defeitos idênticos. Essa decisão depende exclusivamente das quatro linhas reais e de qualquer grupo inconsistente adicional retornado pelo SQL Editor.
