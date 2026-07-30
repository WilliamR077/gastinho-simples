# MCP 1.2F-E — perfil pessoal

## Modelo comprovado

`public.profiles` contém `user_id uuid` como primary key e foreign key de
`auth.users(id) ON DELETE CASCADE`, `display_name text` nullable e timestamps
`created_at`/`updated_at` não nulos com default `now()`. Um trigger atualiza
`updated_at`; outro cria o perfil após o cadastro e usa `full_name` ou `name`
dos metadados Auth apenas dentro do banco.

RLS permite SELECT do próprio perfil ou de pessoas que compartilham grupo,
INSERT apenas para `auth.uid() = user_id` e UPDATE somente do próprio perfil.
Não há policy nem grant DELETE para usuários autenticados.

O frontend usa exclusivamente `display_name`, faz trim e exige entre 2 e 60
caracteres. A UI não oferece avatar nem limpeza para `null`. O hook atual usa
upsert para criação defensiva ou edição; as tools MCP separam INSERT e UPDATE
para evitar sobrescrita concorrente.

## Contratos

`get_profile` possui input vazio. O SDK transforma raw shapes vazios em um
objeto Zod permissivo e remove propriedades desconhecidas antes do handler.
Por isso, o runtime publicado agora envolve o handler Supabase com um guard
HTTP que valida os argumentos originais antes dessa transformação. O mesmo
guard protege `get_connection_identity`, a única outra tool sem parâmetros,
e fecha os schemas devolvidos por `tools/list`.

O patch reproduzível de `@lovable.dev/mcp-js` também preserva
`additionalProperties:false` no manifesto oficial para raw shapes vazios.
Assim, `{}` continua válido e qualquer propriedade adicional recebe
`INVALID_INPUT`/JSON-RPC `-32602` sem executar o handler.
Ele seleciona somente
`display_name,created_at,updated_at`, sempre filtrando internamente pelo
usuário autenticado. Perfil ausente é um estado factual, não erro, e recebe
`PROFILE_NOT_CONFIGURED`.

`update_profile` aceita somente `changes.display_name` e
`expected_updated_at` opcional/nullable. Perfil existente exige a versão lida
por `get_profile`; criação inicial exige versão ausente ou nula. A criação
confirma novamente a ausência antes do INSERT e não usa upsert. UPDATE final
filtra `user_id` interno e `updated_at`.

Nome é normalizado com trim, preserva Unicode, acentos, espaços internos e
markup como texto — comportamento compatível com o frontend React — e rejeita
comprimento fora de 2–60 ou caracteres de controle. `null` e string vazia não
são aceitos.

## Execução

```text
npx tsc --noEmit
npx eslint <arquivos MCP alterados>
npm run build
npm run build:mcp
npm run check:mcp-bundle
npm run test:mcp:1.2f-e
```

A suíte usa handlers reais com Supabase sintético e cobre leitura, ausência,
criação, update, no-op, conflitos, duplicidade legada, versão ausente, RLS,
privacidade, schemas, manifest, bundle e isolamento de todos os outros
módulos.
