# Fase MCP 1.2F-A — descoberta segura de grupos compartilhados

## Escopo

Esta fase adiciona somente duas tools read-only:

- `list_shared_groups`;
- `list_shared_group_members`.

Elas usam `supabaseForUser(ctx)`, não alteram registros e não implementam
criação, entrada, edição, saída, remoção, exclusão, papéis, convites, rateio ou
acerto financeiro.

## Contratos reais

`shared_groups` é visível ao criador ou a membros sob RLS. A tabela contém
`created_by`, mas esse identificador é usado somente internamente para verificar
consistência e nunca integra o contrato público. `updated_at` possui trigger.

`shared_group_members` usa `id` como `membership_id` público. A tabela não tem
`updated_at`; seu `user_id` nunca é retornado. O enum real de papel é
`owner | admin | member`, e `can_manage` segue a permissão real de update do
grupo: membership efetiva `owner` ou `admin`.

Os nomes vêm de consultas diretas a `profiles` sob RLS. A RPC
`get_group_members_with_email` não é usada, porque a consulta segura já fornece
`display_name`. Perfil ausente produz `display_name="Membro"` e
`MEMBER_PROFILE_INCOMPLETE`, sem fallback de e-mail ou UUID.

## Inconsistências

O fluxo atual cria o grupo e a membership do owner em operações separadas.
Assim, um grupo criado pelo usuário pode existir sem membership. A leitura:

- mantém o grupo visível;
- não inventa `membership_id` ou papel;
- usa `can_manage=false`;
- retorna `OWNER_MEMBERSHIP_MISSING`, `GROUP_ROLE_INCONSISTENCY` e
  `DATA_INCOMPLETE`.

Memberships duplicadas são deduplicadas por usuário, com seleção determinística
e conservadora. Divergências entre `created_by` e `role=owner` nunca são
corrigidas.

## Convite e capacidade

O código de convite não é selecionado nem retornado por padrão.
`include_invite_code=true` é opt-in e só o publica quando a membership efetiva
é `owner` ou `admin`. Para member, papel ausente ou estado duplicado, o campo é
omitido e `INVITE_CODE_NOT_AVAILABLE` é retornado.

`max_members=null` é o default real atual e significa ausência de limite
configurado; por isso `capacity_remaining=null`. Limites numéricos usam
`max(max_members-member_count, 0)`. A capacidade é factual e não promete que
uma entrada será aceita.

## Limites

Para evitar respostas parciais apresentadas como completas:

- máximo de 100 grupos acessíveis;
- máximo de 100 membros em uma listagem;
- máximo agregado de 10.000 memberships na coleção de grupos.

Excesso retorna `RESULT_SET_TOO_LARGE`. Não há paginação nesta fase porque o
produto limita a criação própria a três grupos e o contrato deve devolver a
descoberta completa em uma única resposta.

## Validação

```text
npx tsc --noEmit
npm run build
npm run build:mcp
npm run check:mcp-bundle
npm run test:mcp:1.2f-a
```

A suíte usa handlers reais com Supabase sintético e cobre RLS, isolamento,
grupos ativos/inativos, grupos órfãos, papéis, memberships duplicadas,
capacidade, nomes duplicados, perfil ausente, redaction, inputs/outputs
fechados, manifesto, bundle e ausência de writes/migrations.
