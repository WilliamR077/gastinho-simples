# MCP 1.2F-C — edição segura de grupos compartilhados

## Contrato comprovado

O formulário de gestão atual expõe edição do nome e o hook `updateGroup`
suporta o mesmo modelo de criação parcial: `name`, `description` e `color`.
Esses são os únicos campos editáveis pela tool. O banco não define limites de
texto, mas o frontend aplica 50 caracteres ao nome e 200 à descrição.

A cor usa a paleta fechada do formulário:

`#6366f1`, `#8b5cf6`, `#ec4899`, `#ef4444`, `#f97316`, `#eab308`,
`#22c55e`, `#14b8a6`, `#06b6d4` e `#3b82f6`.

O input segue o padrão das demais tools de update:

```text
group_id
expected_updated_at
changes: { name?, description?, color? }
```

`description=null` limpa explicitamente a descrição. String vazia não é
convertida silenciosamente para `null`.

## Autorização e consistência

SELECT permite criador ou membro. UPDATE permite igualmente `owner` e `admin`
por `get_group_role`. A tool consulta o grupo sob RLS, lê as memberships sob
RLS, exige uma associação atual única, exatamente um owner correspondente a
`created_by` e papéis válidos.

Member recebe `FORBIDDEN`. Grupo inexistente ou inacessível recebe
`RESOURCE_NOT_FOUND`. Grupo inativo recebe `GROUP_INACTIVE`. Qualquer
inconsistência estrutural recebe `GROUP_DATA_INCOMPLETE`, sem tentativa de
reparo.

## Concorrência e integridade

`expected_updated_at` é obrigatório e comparado antes de detectar no-op. O
UPDATE final filtra `id`, `updated_at` e `is_active=true`, permanecendo sob
RLS. Se nenhuma linha voltar, há releitura segura para distinguir remoção,
concorrência, inativação ou perda de permissão.

No-op não executa UPDATE nem renova o timestamp. O patch final contém somente
campos efetivamente alterados. `created_by`, `invite_code`, `max_members`,
`is_active` e `created_at` são selecionados internamente apenas para confirmar
que permaneceram iguais e nunca são expostos.

## Execução

```text
npm run test:mcp:1.2f-c
npx tsc --noEmit
npm run build:mcp
npm run check:mcp-bundle
```

Os testes usam o handler real com Supabase sintético e cobrem autorização,
inconsistências, grupo inativo, validação dos três campos, no-op, concorrência
inicial e corridas finais, integridade das tabelas não relacionadas, schemas,
manifest e bundle.
