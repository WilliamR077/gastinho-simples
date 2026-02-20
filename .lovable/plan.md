

## Plano: Mover despesas para pessoal de TODOS os membros ao excluir grupo

### Problema

Na funcao `delete_group_and_data`, quando a acao e `move_to_personal`, apenas as despesas do dono do grupo sao movidas para pessoal. As despesas dos outros membros sao deletadas, fazendo com que eles percam seus registros.

### Solucao

Alterar a funcao `delete_group_and_data` no banco de dados para que, na acao `move_to_personal`, o `shared_group_id` seja removido (setado como `NULL`) de TODOS os registros do grupo, nao apenas do dono.

### Mudanca na funcao SQL

O trecho atual do `move_to_personal`:

```text
-- Mover dados do owner para pessoal
UPDATE expenses SET shared_group_id = NULL WHERE shared_group_id = group_id_param AND user_id = caller_id;
-- ... (mesma logica para recurring_expenses, incomes, etc.)

-- Deletar dados dos outros membros
DELETE FROM expenses WHERE shared_group_id = group_id_param AND user_id != caller_id;
-- ... (mesma logica para outras tabelas)
```

Sera substituido por:

```text
-- Mover dados de TODOS os membros para pessoal
UPDATE expenses SET shared_group_id = NULL WHERE shared_group_id = group_id_param;
UPDATE recurring_expenses SET shared_group_id = NULL WHERE shared_group_id = group_id_param;
UPDATE incomes SET shared_group_id = NULL WHERE shared_group_id = group_id_param;
UPDATE recurring_incomes SET shared_group_id = NULL WHERE shared_group_id = group_id_param;
UPDATE budget_goals SET shared_group_id = NULL WHERE shared_group_id = group_id_param;

-- Remover alertas de metas do grupo (nao faz sentido mover alertas)
DELETE FROM budget_goal_alerts WHERE goal_id IN (
  SELECT id FROM budget_goals WHERE shared_group_id = group_id_param
);
```

Nao precisa mais do bloco de DELETE dos outros membros, pois todos os dados sao movidos.

### Resultado

| Cenario | Antes | Depois |
|---------|-------|--------|
| Dono exclui grupo (mover) | So despesas do dono movem | Despesas de todos movem |
| Membro do grupo | Perde suas despesas | Mantem suas despesas como pessoais |

### Arquivo afetado

| Arquivo | Mudanca |
|---------|---------|
| Migracao SQL | Recriar funcao `delete_group_and_data` com UPDATE sem filtro de user_id |

Nenhum arquivo de codigo precisa mudar, apenas a funcao no banco.
