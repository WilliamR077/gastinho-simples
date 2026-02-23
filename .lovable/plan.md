
As tarefas automáticas (Cron Jobs) estavam falhando com erro 401 (Não autorizado) porque não enviavam o segredo de segurança `x-internal-secret`. Agora que você forneceu o valor, vou configurar o banco de dados para incluir essa autenticação.

### O que será feito:

1.  **Atualização dos Cron Jobs existentes**:
    *   Vou recriar o agendamento de `check-recurring-reminders-daily` (lembretes de despesas) para as 12:00, incluindo o header `x-internal-secret`.
    *   Vou recriar o agendamento de `check-budget-goals-daily` (verificação de metas) para as 20:00, incluindo o header `x-internal-secret`.

2.  **Novo agendamento matinal**:
    *   Vou criar um novo agendamento `check-budget-goals-morning` para as 09:00, permitindo que o app envie notificações motivacionais logo no início do dia.

3.  **Sincronização de Segurança**:
    *   Vou garantir que as Edge Functions estejam prontas para validar este segredo.

### Detalhes técnicos:

*   **Execução SQL**: Utilizarei comandos `cron.unschedule` e `cron.schedule` via banco de dados.
*   **Headers**: As requisições HTTP POST agora incluirão:
    *   `Authorization: Bearer [ANON_KEY]`
    *   `x-internal-secret: [SEU_NOVO_SECRET]`
*   **Edge Functions**: Verificarei se as funções `check-budget-goals` e `check-recurring-reminders` estão usando `Deno.env.get("INTERNAL_API_SECRET")` corretamente.

Ao final, as notificações automáticas de metas e despesas recorrentes voltarão a funcionar sem intervenção manual.
