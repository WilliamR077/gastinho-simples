# PÓS-TOOLS P1 — segurança de parcelas durante leitura

## Causa raiz

O defeito estava em `src/pages/Index.tsx`, nos loaders `loadExpenses` e `loadIncomes`. O `useEffect` dependente de `user` e `currentContext` inicia esses loaders em paralelo com outras consultas. Cada loader faz um `SELECT` limitado ao contexto pessoal (`shared_group_id IS NULL`) ou ao grupo selecionado (`shared_group_id = currentContext.groupId`).

Depois da resposta, o cliente montava um conjunto de `installment_group_id` que continham a parcela 1. Toda linha com `installment_number > 1` cuja parcela 1 não estivesse no mesmo resultado era classificada como órfã. O código então removia essas linhas do estado e disparava, sem confirmação e sem `await`, `DELETE ... IN (ids)` em `expenses` ou `incomes`.

Essa inferência é inválida por construção. A série não é um registro pai: é apenas um UUID repetido nas linhas. Não existe FK de uma parcela para a parcela 1, nem constraint que transforme a ausência em um snapshot do cliente em prova de ausência no banco. Um resultado restrito por contexto, RLS, resposta concorrente, transição de sessão ou qualquer carregamento incompleto não prova orfandade. O loader também não possuía guarda de loading/fetching, completude, identidade da requisição ou confirmação do usuário.

Reprodução lógica comprovada pelo teste de regressão: forneça ao loader um resultado contendo somente a parcela 2 de uma série. Antes da correção, ela entrava em `orphanExpenses`/`orphans`, era retirada da lista e gerava `.delete().in("id", [id])`. A asserção principal da suíte proíbe `.delete()` dentro dos dois loaders e falha sobre o código anterior.

Filtros de mês, categoria e cartão são aplicados posteriormente na interface e não eram prova de completude. A troca de grupo altera diretamente a consulta; trocas rápidas podem manter respostas concorrentes. Em erro, o loader cai no `catch`; antes da correção, qualquer resposta bem-sucedida porém parcial ainda era destrutiva. Não há React Query neste fluxo: o cache relevante é o estado React local.

## Risco

O risco era perda silenciosa e permanente de dados financeiros. A remoção visual ocorria imediatamente e o `DELETE` era fire-and-forget, sem toast específico, rollback ou confirmação. Despesas e receitas parceladas eram afetadas. Contexto compartilhado, transições de conta/grupo, respostas parciais e séries temporariamente incompletas ampliavam o risco.

## Modelo real e caminhos de exclusão

- `expenses`: PK `id`; parcelas usam `installment_group_id`, `installment_number` e `total_installments`. Há check de faixa do número da parcela, mas não há tabela de série nem FK para a parcela 1. `user_id` referencia `auth.users` com `ON DELETE CASCADE`. `expense_splits.expense_id` referencia `expenses.id` com `ON DELETE CASCADE`.
- `incomes`: PK `id`; usa os mesmos três campos de parcelamento, igualmente sem tabela pai/FK de série. `shared_group_id` referencia o grupo com `ON DELETE SET NULL` na definição da tabela.
- A criação gera várias linhas com o mesmo `installment_group_id`. A edição da primeira parcela pode atualizar as linhas irmãs. Parcelas secundárias não podem iniciar a exclusão da série pela UI.
- RLS autoriza `SELECT` e `DELETE` conforme usuário/grupo, mas nenhuma policy executa mutação. Os triggers encontrados apenas atualizam `updated_at`; nenhum `SELECT` dispara trigger ou cleanup.

Inventário dos caminhos capazes de alcançar parcelas:

1. `Index.tsx`, cleanup em `loadExpenses` e `loadIncomes`: exclusão automática baseada em comparação de lista parcial; removida nesta P1.
2. `Index.tsx`, `deleteExpense` e `deleteIncome`: exclusão explícita de um lançamento ou, a partir da parcela 1, da série por `installment_group_id`; preservada. `ExpenseList` e `IncomeList` exigem `AlertDialog`, oferecem cancelar e avisam quando toda a série será removida. A mutação ocorre antes da alteração de estado; falha preserva o cache local.
3. `delete_group_and_data`: operação de domínio destrutiva e explícita de exclusão de grupo, com verificação de proprietário no banco; pode remover despesas/receitas do grupo. Preservada fora do escopo.
4. `delete-user-account`, `admin-dashboard` e cascade de `auth.users`: exclusão administrativa/de conta, capaz de remover lançamentos do usuário. Preservada fora do fluxo de leitura.
5. Tools MCP `delete-expense` e `delete-income` (e o bundle gerado): ferramentas explicitamente destrutivas, com ID, autorização e controle de concorrência; nenhuma tool de leitura contém cleanup. Nenhum arquivo MCP foi alterado.
6. Migration histórica `20260424014557_...sql`: limpeza de parcelas sem número 1 executada uma única vez quando aquela migration foi aplicada. É um caminho histórico/legado, não executado por leitura e não foi alterado.
7. Cascades legítimos: exclusão de usuário remove `expenses`; exclusão de uma despesa remove seus `expense_splits`. Não há cascade entre parcelas da mesma série.
8. Deletes de `expense_splits` durante edição, receitas/despesas recorrentes, categorias, notificações e outros registros não excluem parcelas financeiras por comparação de listas.

## Correção

Os dois blocos de detecção/limpeza foram removidos integralmente. `loadExpenses` agora preserva todas as linhas retornadas e apenas anexa splits; `loadIncomes` entrega todas as linhas retornadas ao estado. Nenhum fluxo de leitura executa `DELETE`, RPC mutável, marcação de remoção ou poda destrutiva.

Não foi adicionada observação de “órfãos”, pois o cliente não possui evidência completa para produzir um diagnóstico confiável. Uma auditoria futura, se necessária, deve ser read-only e executada sobre o conjunto completo no banco. Qualquer limpeza posterior deve ser uma RPC/job administrativo separado, defensivo, autorizado e nunca derivado de listas do frontend.

As exclusões explícitas existentes foram preservadas sem ampliar comportamento. Não foi necessária migration.

## Testes

`npm run test:p1:installment-safety` valida estruturalmente que os loaders não contêm DELETE, escrita, RPC ou cleanup e modela 18 estados: primeiro render vazio; loading; fetching; erro; resposta parcial; paginação incompleta; filtro; troca de mês, grupo e usuário; logout/login; cache não hidratado e anterior; refresh concorrente; realtime antecipado; ordem de chegada de parcela/parent; parent temporariamente ausente.

Em todos eles, há zero DELETE, zero RPC mutável, zero marcação de remoção e zero poda de cache. A suíte também confirma as exclusões explícitas por ID/série, confirmação/cancelamento, preservação do estado quando a mutação falha, 64 migrations, ausência de alteração MCP/migration histórica e escopo exato de arquivos.

Limite: a suíte é local e determinística; não escreve no banco remoto e não substitui o smoke controlado após publicação.

## Deploy futuro

Após revisão, criar um commit específico e publicar somente o frontend. Não há migration ou `db push` para esta correção.

## Smoke futuro

Usar apenas uma série temporária, sem dados financeiros importantes:

1. Registrar os IDs e valores atuais das parcelas da série de teste.
2. Abrir a lista.
3. Trocar mês e filtros.
4. Alternar entre contexto pessoal e grupos.
5. Atualizar a página.
6. Simular rede lenta no DevTools.
7. Navegar antes do carregamento terminar.
8. Confirmar que nenhuma parcela desaparece.
9. Confirmar no Network que não houve requisição DELETE durante leitura/refresh.
10. Cancelar uma tentativa de exclusão e confirmar zero DELETE.
11. Excluir explicitamente um único registro temporário e confirmar que somente o escopo anunciado foi removido.
12. Confirmar que todas as demais parcelas permanecem inalteradas.

Critério de aprovação: nenhuma mutação durante leitura e exatamente uma mutação, no ID ou grupo anunciado, após confirmação explícita.
