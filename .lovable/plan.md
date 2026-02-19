

## Plano: Corrigir exclusao de despesas ao deletar grupo

### Problema

Quando o dono exclui o grupo e escolhe "Excluir todas as despesas", a politica de RLS do banco de dados so permite que cada usuario delete suas proprias despesas (`auth.uid() = user_id`). Resultado: as despesas dos outros membros nao sao deletadas e ficam "soltas" na conta pessoal deles.

### Solucao

Criar uma funcao SQL com `SECURITY DEFINER` que executa a exclusao de todas as despesas do grupo, ignorando RLS. O codigo do app vai chamar essa funcao em vez de fazer os deletes diretamente.

### Mudancas

**1. Nova funcao SQL no banco (migration)**

Criar `delete_group_and_data(group_id_param, action_param)` com SECURITY DEFINER:

```text
- Verifica se o usuario atual e o owner do grupo
- Se action = 'delete_all': deleta TODAS as despesas, recorrentes, receitas, receitas recorrentes e metas do grupo (de todos os membros)
- Se action = 'move_to_personal': move apenas as despesas do owner para pessoal, e deleta as dos outros membros
- Deleta os membros do grupo
- Deleta o grupo
```

Essa funcao roda com permissoes elevadas, entao consegue deletar despesas de todos os membros.

**2. `src/hooks/use-shared-groups.tsx`**

Substituir os deletes manuais (linhas 374-411) por uma chamada RPC:

```text
const { error } = await supabase.rpc('delete_group_and_data', {
  group_id_param: groupId,
  action_param: action
});
```

Isso simplifica o codigo e garante que a exclusao funcione para todos os membros.

### Comportamento esperado apos a mudanca

| Acao | Despesas do dono | Despesas dos membros |
|------|-----------------|---------------------|
| Excluir todas | Deletadas | Deletadas |
| Mover para pessoal | Movidas para conta pessoal do dono | Deletadas (nao faz sentido irem para o pessoal do dono) |

Nota: Na opcao "mover para pessoal", so faz sentido mover as despesas que o proprio dono criou. As despesas dos outros membros serao deletadas, ja que nao pertencem ao dono.

### Tambem inclui receitas (incomes)

O grupo tambem pode ter receitas (`incomes`) e receitas recorrentes (`recurring_incomes`) associadas. A funcao vai limpar tudo.

### Resumo

| Local | Mudanca |
|-------|---------|
| Migration SQL | Criar funcao `delete_group_and_data` com SECURITY DEFINER |
| `src/hooks/use-shared-groups.tsx` | Substituir deletes manuais por chamada RPC |

