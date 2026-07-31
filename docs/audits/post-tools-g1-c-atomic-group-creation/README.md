# POST-TOOLS G1-C1 — disponibilização da criação atômica

## Causa raiz e fluxo anterior

O único fluxo oficial de criação encontrado estava em
`src/hooks/use-shared-groups.tsx`. Ele executava três requests independentes:

1. `generate_invite_code()`;
2. `INSERT` em `public.shared_groups`;
3. `INSERT` em `public.shared_group_members` com role `owner`.

Se o terceiro passo falhasse, o primeiro INSERT já estava confirmado e deixava
um grupo sem owner. O formulário correspondente é
`src/components/create-group-dialog.tsx`. Não foram encontrados outros inserts
de criação de grupo em services, componentes, Edge Functions ou tools MCP. O
INSERT de membership usado por `joinGroup` é entrada por convite e não é criação
de grupo; ele foi preservado.

## Schema, RLS, grants e regras existentes

`shared_groups` tem PK UUID, `name` obrigatório, `description` opcional,
`created_by` obrigatório, `invite_code` obrigatório e UNIQUE, `color` com
default `#6366f1`, `max_members` atualmente com default `NULL`, `is_active`
default `true` e timestamps. Seu trigger de UPDATE chama
`public.update_updated_at_column()`.

`shared_group_members` tem PK UUID, FK `group_id` com `ON DELETE CASCADE`,
`user_id` obrigatório, enum `group_member_role` (`owner`, `admin`, `member`),
`joined_at` e UNIQUE `(group_id, user_id)`.

RLS está habilitada nas duas tabelas. Antes da G1-C, INSERT em grupo exigia
`created_by = auth.uid()` e `can_create_group(auth.uid())`; INSERT de membership
permite owner/admin adicionar membros, o usuário entrar como `member` e o
criador se inserir como `owner`. Grants de tabela não eram declarados nas
migrations históricas e dependiam dos defaults do Supabase.

A regra comercial real é: somente assinatura ativa `premium` ou
`premium_plus`, no máximo três grupos ativos criados pelo usuário.
`max_members = NULL` significa ilimitado e não é configurável no formulário.

## Fluxo novo e invariantes

O frontend chama uma vez `public.create_shared_group_atomic(p_name,
p_description, p_color)`. A RPC:

- exige `auth.uid()`;
- não aceita identidade, role, invite code nem campo administrativo;
- normaliza whitespace, limita nome a 50 e descrição a 200 caracteres, rejeita
  controles e aceita somente a paleta real do formulário;
- usa `created_by = auth.uid()`;
- obtém advisory lock transacional derivado do usuário;
- valida assinatura e quota sob o lock;
- gera no banco um código de seis caracteres com o alfabeto atual e bytes
  aleatórios, tentando no máximo cinco vezes em colisões;
- insere grupo e membership owner dentro da mesma função;
- confirma exatamente uma membership owner do criador;
- retorna apenas os dados necessários do grupo e da membership.

Uma chamada de função PostgreSQL é uma única transação. Não há `BEGIN`/`COMMIT`
manual. O bloco de exception interno também é uma subtransação: se o INSERT da
membership ou a verificação final falhar, o INSERT do grupo é revertido antes
da exception segura chegar ao cliente.

## Segurança

A função é `SECURITY DEFINER` para executar as duas escritas como uma operação
controlada e indivisível. Seu `search_path` é `pg_catalog, public, pg_temp`;
tabelas, enums e a função de bytes aleatórios são qualificados; não há SQL
dinâmico nem consulta a `auth.users`.

EXECUTE foi revogado de `PUBLIC`/`anon` e concedido a `authenticated`. Não há
grant novo para `service_role`. A G1-C1 não contém `GRANT` ou `REVOKE` de tabela:
o baseline de INSERT, SELECT, UPDATE e DELETE de `shared_groups` permanece
exatamente igual. INSERT em `shared_group_members` também permanece intacto
porque o fluxo existente de entrada por convite depende dele.

O INSERT direto em `shared_groups` continua temporariamente possível para não
quebrar o frontend publicado, que ainda executa o fluxo antigo. Esse é um risco
residual consciente: clientes antigos ainda podem produzir um grupo órfão se a
membership falhar. A janela deve ser curta e monitorada; todos os fluxos do
frontend novo já usam exclusivamente a RPC.

Não foi adicionada constraint permanente ligando owner a `created_by`, nem
trigger oculto de owner. A UNIQUE existente de `(group_id, user_id)` foi
preservada. Isso evita bloquear uma futura implementação explícita de
transferência de ownership.

## Frontend, loading, erros e cache

O hook não gera invite code e não executa inserts. Ele envia somente nome,
descrição e cor normalizados à RPC, valida que veio exatamente uma linha owner,
atualiza a lista e muda o contexto apenas no sucesso. Erros usam mensagens
seguras para autenticação, validação, plano, quota, invite code e falha
transacional; SQL, constraints e UUIDs não são exibidos.

O formulário mantém seu spinner e botões desabilitados durante a chamada. Além
da proteção visual, o handler ignora submit durante loading e o hook usa uma ref
de request em andamento, fechando a janela de duplo clique antes do rerender.
Falhas não atualizam cache, não mudam contexto e não fecham o diálogo.

## Preflight e dry-run

Antes de aplicação controlada:

```text
git diff --check
npx tsc --noEmit
npx eslint src/hooks/use-shared-groups.tsx src/components/create-group-dialog.tsx \
  --rule "@typescript-eslint/no-explicit-any: off" \
  --rule "react-refresh/only-export-components: off"
npm run test:g1-c
node scripts/post-tools-g1-b-tests.mjs
npm run build
npx --yes supabase@latest migration list --linked
npx --yes supabase@latest db push --linked --dry-run
```

O esperado é 62 migrations locais, 61 remotas e somente
`20260731010000_create_shared_group_atomic.sql` no dry-run. Não executar
`db push` real nesta fase.

As duas regras desabilitadas no lint direcionado correspondem a seis catches
legados com `any` e ao provider/context exportado no mesmo arquivo; o trecho
G1-C novo não adiciona `any`. O lint estrito do arquivo continua registrando
esse baseline fora do fluxo de criação.

## Testes e limitações sem Docker

`scripts/post-tools-g1-c-tests.mjs` verifica migration, assinatura, inputs
proibidos, autenticação, search path, qualification, grants/revokes, duas
escritas, owner, quota, lock, invite code, retorno reduzido, ausência de limpeza
e o fluxo frontend. Handlers sintéticos cobrem sucesso, quota, falha RPC,
resposta inesperada, cache/contexto e duplo submit.

O teste de atomicidade modela sucesso e falha da membership e comprova
estruturalmente que grupo, membership, validações e retorno estão na mesma
função. Sem Docker ou aplicação em banco descartável, ele não é evidência de
rollback PostgreSQL real.

## Rollout coordenado

### Etapa 1 — aplicar G1-C1

- aplicar somente `20260731010000_create_shared_group_atomic.sql`;
- confirmar que a RPC existe e está disponível para `authenticated`;
- manter temporariamente o INSERT direto em `shared_groups`.

Essa ordem mantém o frontend publicado funcional enquanto torna o contrato novo
disponível. A revogação antecipada quebraria clientes antigos.

### Etapa 2 — publicar o frontend

- publicar a versão que chama exclusivamente `create_shared_group_atomic`;
- executar o smoke G1-C1;
- monitorar erros e confirmar que não há criação oficial por INSERT direto.

### Etapa 3 — futura G1-C2

Somente depois do smoke e da estabilização do frontend, criar uma migration
separada que revogue INSERT direto em `shared_groups`. A G1-C2 não faz parte
desta entrega.

Critérios para avançar:

- frontend novo publicado em todos os canais suportados;
- smoke G1-C1 aprovado;
- nenhuma chamada oficial de criação por INSERT direto;
- nenhum grupo novo sem membership;
- plano de rollback e smoke posterior revisados.

## Smoke futuro G1-C1

Após aplicar G1-C1 e publicar o frontend:

1. registrar o baseline de grupos;
2. criar grupo temporário pelo frontend;
3. confirmar exatamente uma membership `owner`;
4. confirmar `created_by` igual ao owner;
5. confirmar consistência pela tool MCP de listagem;
6. testar duplo clique e confirmar uma única criação;
7. excluir o grupo pelo fluxo oficial;
8. confirmar ausência de resíduos;
9. confirmar que nenhum grupo sem membership foi criado.

Esse smoke não é executado na G1-C1. Após a futura revogação da G1-C2, repetir
um smoke equivalente para confirmar que o frontend novo segue funcional e o
INSERT direto está bloqueado.

## Rollback

Se a G1-C1 precisar ser revertida antes da publicação do frontend:

1. manter os grants de tabela como estão — a G1-C1 não os altera;
2. remover `public.create_shared_group_atomic(text, text, text)`;
3. recarregar o schema do PostgREST;
4. não publicar o frontend dependente da RPC.

Rollback da função não altera grupos existentes. Nenhum rollback real foi
testado nesta fase.
