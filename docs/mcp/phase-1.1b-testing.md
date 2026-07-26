# Fase MCP 1.1B — testes e decisões

## Escopo confirmado

As policies `SELECT` existentes de `expenses` e `incomes` permitem uma linha
quando `auth.uid() = user_id` ou quando `shared_group_id` pertence a um grupo
do usuário por `is_group_member(...)`.

- `personal`: filtro adicional `user_id = ctx.getUserId()`. Inclui lançamentos
  próprios com `shared_group_id`.
- `shared`: filtro adicional `shared_group_id IS NOT NULL`; a RLS decide quais
  grupos são acessíveis.
- `all_accessible`: sem filtro de proprietário; a RLS devolve a união segura.
- Nenhum resultado público contém `user_id` ou dados pessoais do proprietário.

## Datas e paginação

- `date` é sempre `expense_date`/`income_date`; `created_at` é separado.
- O dia atual usa `America/Sao_Paulo`.
- `list_expenses`/`list_incomes` mantêm `time_scope=all`.
- `search_transactions` e `get_spending_breakdown` usam
  `time_scope=occurred` por padrão.
- `get_summary` preserva o padrão histórico `time_scope=all`.
- `compare_periods` usa `time_scope=occurred` por padrão, conforme seu schema e
  implementação.
- Cursores v2 usam payload Base64URL assinado com HMAC-SHA256, expiração e
  fingerprint SHA-256 dos filtros. Cursores v1 são rejeitados.
- A busca unificada usa valor, tipo (`expense` antes de `income`) e ID como
  ordenação total.
- A busca unificada aplica o mesmo limite keyset a cada tabela, mescla e ordena
  os candidatos. O tipo no cursor preserva despesas e receitas mesmo quando os
  UUIDs sintéticos são iguais.
- A paginação não promete snapshot: inserções anteriores ao cursor podem exigir
  reinício da busca.

## Limites de segurança

- Limite público máximo: 100 itens.
- Analytics: intervalo máximo de 366 dias.
- Agregação em memória: páginas internas e hard cap de 10.000 linhas por
  tabela/período. Ao atingir o cap, retorna `RESULT_SET_TOO_LARGE`; nunca
  apresenta parcial como completo.
- Nenhuma migration ou RPC foi criada.

## Testes puros

Executar:

```bash
node scripts/mcp-phase-1.1b-tests.mjs
```

O script valida datas, intervalos, escopos, datas futuras, cursores, ordenação
estável, deduplicação, savings rate, percentuais com base zero e período
anterior de mesma duração.

## Smoke tests no Claude

1. “Liste minhas cinco despesas mais recentes já realizadas.”
2. “Quais são minhas próximas cinco parcelas?”
3. “Procure todos os gastos com gasolina nos últimos 90 dias.”
4. “Mostre meus gastos deste mês por categoria.”
5. “Compare este mês com o mês anterior.”
6. “Mostre somente despesas compartilhadas.”
7. “Mostre todos os dados aos quais tenho acesso.”
8. Repetir consultas com duas contas isoladas e confirmar conjuntos distintos.
9. Repetir com duas contas no mesmo grupo:
   - `personal` inclui somente linhas de propriedade da conta;
   - `shared` inclui linhas do grupo permitidas pela RLS;
   - `all_accessible` inclui pessoais e compartilhadas, sem duplicidade.

Registrar em cada teste: conta mascarada, `connection_reference`, parâmetros
aplicados, contagem e cursores. Nunca registrar tokens.
