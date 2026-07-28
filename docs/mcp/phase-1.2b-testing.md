# Fase MCP 1.2B — roteiro de revisão

Esta fase adiciona somente `delete_expense` e `delete_income`.

## Semântica

Não existe soft delete nas tabelas `expenses` e `incomes`. As duas operações
são definitivas, não oferecem restauração e excluem exclusivamente o UUID
informado.

Ambas exigem:

- `expected_updated_at` copiado de uma leitura recente;
- `confirm_delete=true`;
- `confirm_single_installment_delete=true` quando o registro possui metadados
  de parcelamento.

`expense_splits` referencia `expenses(id)` com `ON DELETE CASCADE`. Essa é a
única cascata filha encontrada e é executada pelo banco. Cartões, categorias,
grupos, metas, alertas, templates e outras parcelas não são excluídos.

## Validação local

```text
npx tsc --noEmit
npm run build
npm run build:mcp
npm run check:mcp-bundle
npm run test:mcp:1.2b
```

Todas as suítes MCP anteriores e o lint direcionado também devem passar.

## Verificações manuais posteriores

1. Localizar um lançamento de teste e copiar exatamente seu `updated_at`.
2. Chamar a tool sem `confirm_delete=true` e confirmar que nada foi removido.
3. Confirmar a exclusão e verificar `PERMANENT_DELETION`.
4. Repetir com um `updated_at` antigo e confirmar `CONCURRENT_MODIFICATION`.
5. Em uma parcela de teste, confirmar primeiro o bloqueio e depois excluir
   somente a linha selecionada com a confirmação específica.
6. Confirmar que UUID inexistente e UUID alheio produzem `RESOURCE_NOT_FOUND`.

Não executar esse roteiro em dados reais sem autorização explícita.
