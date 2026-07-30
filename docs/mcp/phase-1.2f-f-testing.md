# MCP 1.2F-F — preferências pessoais de notificação

## Modelo comprovado

`public.notification_settings` possui `id uuid` como primary key, `user_id uuid`
não nulo com unique constraint, quatro toggles históricos e três toggles
posteriores de metas. Todos os toggles são booleanos não nulos com default
`true`. `created_at` e `updated_at` são não nulos com default `now()`, e o
trigger compartilhado renova `updated_at`.

RLS permite SELECT, INSERT, UPDATE e DELETE somente quando
`auth.uid() = user_id`. A fase usa exclusivamente SELECT, INSERT e UPDATE sob
`supabaseForUser(ctx)`.

## Escopo público

A interface atual exibe e salva somente:

- `is_enabled`;
- `notify_3_days_before`;
- `notify_1_day_before`;
- `notify_on_day`.

Os campos `notify_expense_goals`, `notify_income_goals` e
`notify_balance_goals` são consumidos por processamento de metas, mas não são
configuráveis na UI e permanecem fora do MCP. Permissões do sistema, tokens
FCM, lembretes dispensados no `localStorage`, horários fixos do serviço legado
e qualquer operação de entrega também ficam fora.

Quando não existe linha, o produto aplica os quatro defaults `true` sem
persisti-los. Uma atualização explícita cria a linha e completa campos omitidos
com esses defaults, como o upsert do frontend, mas o MCP usa INSERT separado
para não sobrescrever corridas.

## Garantias

`get_notification_settings` é somente leitura e usa o guard HTTP de input vazio
do hotfix 1.2F-E1. `update_notification_settings` aceita patch parcial fechado,
exige `expected_updated_at` para linha existente, executa UPDATE por usuário e
versão e não escreve em no-op.

Nenhuma das tools consulta `user_fcm_tokens`, pede permissão, agenda, envia ou
testa notificações.
