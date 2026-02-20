
## Plano: Corrigir texto do dialog de exclusao de grupo

### O que sera feito

Atualizar o texto da opcao "Mover para meus gastos pessoais" no dialog de exclusao de grupo para refletir que as despesas de **todos** os membros serao movidas para suas respectivas contas pessoais, nao apenas para a conta de quem esta excluindo.

### Mudanca

| Arquivo | Mudanca |
|---------|---------|
| `src/components/delete-group-dialog.tsx` | Alterar o texto da descricao da opcao `move_to_personal` |

### De/Para

**Antes:**
> "Todas as despesas e metas do grupo serao transferidas para sua conta pessoal"

**Depois:**
> "As despesas de cada membro serao movidas para a conta pessoal de cada um. As metas do grupo serao removidas."

### Detalhes tecnicos

Apenas uma linha de texto alterada no arquivo `src/components/delete-group-dialog.tsx`, linha 65.
