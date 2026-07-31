# PÓS-TOOLS G1-B — execução controlada

Este documento acompanha a remoção defensiva dos quatro grupos históricos
“Família” vazios. A migration ainda não foi aplicada.

Escopo exato:

- `35d36f8d-1d3c-4cc4-896a-46872bbe9b75`
- `55c7716c-1e38-48b9-978f-d16b52305310`
- `5d77b853-ff7f-4247-bc66-09b4ae32cf55`
- `cf7d4e2a-b925-404e-9ecc-9f814adf15b0`

A execução futura deve parar diante de qualquer divergência. Nunca substituir
os UUIDs por um filtro genérico de nome.

## Efeito e reversibilidade

A migration remove somente quatro linhas de `public.shared_groups`, depois de
confirmar identidade, ausência de memberships e ausência de dependências.

Embora os grupos estejam vazios, a exclusão remove seus metadados:

- nome;
- descrição;
- cor;
- código de convite;
- timestamps;
- `created_by`;
- estado ativo.

Não existe rollback automático. Uma restauração exigiria reinserir manualmente
as quatro linhas completas a partir do snapshot privado feito antes da
aplicação. Nenhum SQL de restauração é criado ou executado nesta fase.

## 1. Preflight manual read-only

Execute esta consulta no SQL Editor imediatamente antes do deploy. Ela retorna
`safe_to_apply = true` somente quando os quatro alvos ainda correspondem à
auditoria G1-A e continuam completamente vazios.

```sql
WITH
target_ids(id) AS (
  VALUES
    ('35d36f8d-1d3c-4cc4-896a-46872bbe9b75'::uuid),
    ('55c7716c-1e38-48b9-978f-d16b52305310'::uuid),
    ('5d77b853-ff7f-4247-bc66-09b4ae32cf55'::uuid),
    ('cf7d4e2a-b925-404e-9ecc-9f814adf15b0'::uuid)
),
expected AS (
  SELECT
    '65e6ec36-089b-41f9-af7a-eaba92e30eff'::uuid
      AS created_by
),
target_groups AS (
  SELECT
    g.id,
    g.created_by,
    g.is_active,
    translate(
      lower(regexp_replace(btrim(g.name), '\s+', ' ', 'g')),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ) AS normalized_name
  FROM public.shared_groups AS g
  JOIN target_ids AS t
    ON t.id = g.id
),
facts AS (
  SELECT
    (SELECT count(*) FROM target_groups) AS target_group_count,
    (
      SELECT count(*)
      FROM target_groups AS tg
      CROSS JOIN expected AS e
      WHERE tg.created_by <> e.created_by
    ) AS creator_mismatch_count,
    (
      SELECT count(*)
      FROM target_groups
      WHERE normalized_name <> 'familia'
    ) AS name_mismatch_count,
    (
      SELECT count(*)
      FROM target_groups
      WHERE is_active IS DISTINCT FROM true
    ) AS inactive_count,
    (
      SELECT count(*)
      FROM public.shared_group_members AS m
      WHERE m.group_id IN (SELECT id FROM target_ids)
    ) AS membership_count,
    (
      SELECT count(*)
      FROM public.expenses AS x
      WHERE x.shared_group_id IN (SELECT id FROM target_ids)
    ) AS expense_count,
    (
      SELECT count(*)
      FROM public.incomes AS x
      WHERE x.shared_group_id IN (SELECT id FROM target_ids)
    ) AS income_count,
    (
      SELECT count(*)
      FROM public.recurring_expenses AS x
      WHERE x.shared_group_id IN (SELECT id FROM target_ids)
    ) AS recurring_expense_count,
    (
      SELECT count(*)
      FROM public.recurring_incomes AS x
      WHERE x.shared_group_id IN (SELECT id FROM target_ids)
    ) AS recurring_income_count,
    (
      SELECT count(*)
      FROM public.budget_goals AS x
      WHERE x.shared_group_id IN (SELECT id FROM target_ids)
    ) AS budget_goal_count,
    (
      SELECT count(*)
      FROM public.expense_splits AS es
      JOIN public.expenses AS x
        ON x.id = es.expense_id
      WHERE x.shared_group_id IN (SELECT id FROM target_ids)
    ) AS expense_split_count,
    (
      SELECT count(*)
      FROM public.budget_goal_alerts AS bga
      JOIN public.budget_goals AS x
        ON x.id = bga.goal_id
      WHERE x.shared_group_id IN (SELECT id FROM target_ids)
    ) AS budget_goal_alert_count
),
baseline AS (
  SELECT
    count(*) AS non_target_group_count,
    md5(
      coalesce(
        string_agg(g.id::text, ',' ORDER BY g.id),
        ''
      )
    ) AS non_target_group_id_fingerprint
  FROM public.shared_groups AS g
  WHERE g.id NOT IN (SELECT id FROM target_ids)
),
global_dependency_counts AS (
  SELECT
    (SELECT count(*) FROM public.expenses) AS all_expenses,
    (SELECT count(*) FROM public.incomes) AS all_incomes,
    (SELECT count(*) FROM public.recurring_expenses)
      AS all_recurring_expenses,
    (SELECT count(*) FROM public.recurring_incomes)
      AS all_recurring_incomes,
    (SELECT count(*) FROM public.budget_goals) AS all_budget_goals,
    (SELECT count(*) FROM public.expense_splits) AS all_expense_splits,
    (SELECT count(*) FROM public.budget_goal_alerts)
      AS all_budget_goal_alerts
)
SELECT
  f.*,
  b.*,
  gdc.*,
  (
    f.target_group_count = 4
    AND f.creator_mismatch_count = 0
    AND f.name_mismatch_count = 0
    AND f.inactive_count = 0
    AND f.membership_count = 0
    AND f.expense_count = 0
    AND f.income_count = 0
    AND f.recurring_expense_count = 0
    AND f.recurring_income_count = 0
    AND f.budget_goal_count = 0
    AND f.expense_split_count = 0
    AND f.budget_goal_alert_count = 0
  ) AS safe_to_apply
FROM facts AS f
CROSS JOIN baseline AS b
CROSS JOIN global_dependency_counts AS gdc;
```

Antes de continuar:

1. exija `safe_to_apply = true`;
2. exija `target_group_count = 4`;
3. exija zero em todos os campos de mismatch, membership e dependência;
4. registre fora do Git `non_target_group_count`,
   `non_target_group_id_fingerprint` e as contagens globais;
5. interrompa se qualquer valor divergir.

## 2. Snapshot privado

Depois do preflight e antes do deploy, execute:

```sql
SELECT g.*
FROM public.shared_groups AS g
WHERE g.id IN (
  '35d36f8d-1d3c-4cc4-896a-46872bbe9b75'::uuid,
  '55c7716c-1e38-48b9-978f-d16b52305310'::uuid,
  '5d77b853-ff7f-4247-bc66-09b4ae32cf55'::uuid,
  'cf7d4e2a-b925-404e-9ecc-9f814adf15b0'::uuid
)
ORDER BY g.id;
```

Exporte as quatro linhas como JSON e mantenha o arquivo em armazenamento
privado fora do repositório. O snapshot contém códigos de convite e outros
metadados internos:

- não adicionar ao Git;
- não colar em issue, PR ou canal público;
- não compartilhar códigos de convite;
- restringir acesso às pessoas responsáveis pela aplicação e rollback.

Não criar tabela de backup no banco.

## 3. Aplicação futura

Os comandos previstos são:

```powershell
npx --yes supabase@latest migration list --linked
npx --yes supabase@latest db push --linked --dry-run
npx --yes supabase@latest db push --linked
```

Nesta fase G1-B, somente os dois primeiros podem ser executados. O terceiro
comando depende de revisão humana, preflight aprovado e snapshot concluído.

O dry-run deve propor exclusivamente:

`20260731001344_remove_empty_orphan_family_groups.sql`

## 4. Postflight read-only

### 4.1 Alvos removidos e nenhum órfão “Família” remanescente

```sql
WITH target_ids(id) AS (
  VALUES
    ('35d36f8d-1d3c-4cc4-896a-46872bbe9b75'::uuid),
    ('55c7716c-1e38-48b9-978f-d16b52305310'::uuid),
    ('5d77b853-ff7f-4247-bc66-09b4ae32cf55'::uuid),
    ('cf7d4e2a-b925-404e-9ecc-9f814adf15b0'::uuid)
),
orphan_family_groups AS (
  SELECT g.id
  FROM public.shared_groups AS g
  WHERE translate(
    lower(regexp_replace(btrim(g.name), '\s+', ' ', 'g')),
    'áàâãäéèêëíìîïóòôõöúùûüç',
    'aaaaaeeeeiiiiooooouuuuc'
  ) = 'familia'
    AND NOT EXISTS (
      SELECT 1
      FROM public.shared_group_members AS m
      WHERE m.group_id = g.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.expenses AS x
      WHERE x.shared_group_id = g.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.incomes AS x
      WHERE x.shared_group_id = g.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.recurring_expenses AS x
      WHERE x.shared_group_id = g.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.recurring_incomes AS x
      WHERE x.shared_group_id = g.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.budget_goals AS x
      WHERE x.shared_group_id = g.id
    )
)
SELECT
  (
    SELECT count(*)
    FROM public.shared_groups AS g
    WHERE g.id IN (SELECT id FROM target_ids)
  ) AS remaining_target_count,
  (SELECT count(*) FROM orphan_family_groups)
    AS remaining_orphan_family_count;
```

Exigir ambos os resultados iguais a zero.

### 4.2 Nenhum outro grupo removido

```sql
WITH target_ids(id) AS (
  VALUES
    ('35d36f8d-1d3c-4cc4-896a-46872bbe9b75'::uuid),
    ('55c7716c-1e38-48b9-978f-d16b52305310'::uuid),
    ('5d77b853-ff7f-4247-bc66-09b4ae32cf55'::uuid),
    ('cf7d4e2a-b925-404e-9ecc-9f814adf15b0'::uuid)
)
SELECT
  count(*) AS non_target_group_count,
  md5(
    coalesce(
      string_agg(g.id::text, ',' ORDER BY g.id),
      ''
    )
  ) AS non_target_group_id_fingerprint
FROM public.shared_groups AS g
WHERE g.id NOT IN (SELECT id FROM target_ids);
```

Compare os dois campos com o baseline do preflight. Igualdade confirma que os
grupos não alvo — incluindo grupos consistentes — continuam presentes.

### 4.3 Dependências não alteradas

```sql
SELECT
  (SELECT count(*) FROM public.expenses) AS all_expenses,
  (SELECT count(*) FROM public.incomes) AS all_incomes,
  (SELECT count(*) FROM public.recurring_expenses)
    AS all_recurring_expenses,
  (SELECT count(*) FROM public.recurring_incomes)
    AS all_recurring_incomes,
  (SELECT count(*) FROM public.budget_goals) AS all_budget_goals,
  (SELECT count(*) FROM public.expense_splits) AS all_expense_splits,
  (SELECT count(*) FROM public.budget_goal_alerts)
    AS all_budget_goal_alerts;
```

Compare cada contagem com o baseline. Todas devem permanecer idênticas.

## 5. Rollback

Se uma restauração for aprovada após o deploy:

1. interromper novas alterações relacionadas a grupos;
2. validar o snapshot JSON privado;
3. revisar os quatro registros e seus tipos;
4. preparar uma migration separada, transacional e revisada;
5. reinserir exatamente os metadados do snapshot;
6. validar IDs, timestamps, `created_by`, estado e códigos de convite;
7. executar postflight específico.

A restauração não envolve dados financeiros porque a aplicação só é permitida
quando todas as dependências estão vazias. Ainda assim, os códigos de convite e
metadados só podem ser recuperados do snapshot manual.

Não usar este documento como SQL de rollback e não executar reinserção manual
sem uma nova revisão.
