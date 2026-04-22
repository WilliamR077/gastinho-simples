

# Plano final de execução: finalizar suporte ao método "Dinheiro" (cash)

## 1. Escopo e estado atual

A fase 1–3 do plano aprovado já foi executada (fonte única em `src/lib/payment-methods.ts`, migration aplicada, 7 forms refatorados, charts e PDF atualizados). Faltam **9 arquivos** para fechar a entrega: visualização (3), filtros (2), importação/exportação (3) e billing (1). Esta segunda passada conclui a entrega e devolve o fechamento solicitado.

## 2. Mudanças por arquivo

### Visualização — substituir maps locais por helpers centralizados

**`src/components/expense-summary.tsx`**
- Trocar acumulador fixo `{ pix: 0, debit: 0, credit: 0, total: 0 }` por inicialização derivada de `PAYMENT_METHOD_LIST` (ficará `{ pix, debit, credit, cash, total }`).
- Substituir array literal `paymentMethods` pelos itens derivados de `PAYMENT_METHOD_LIST`, mapeando `cardTotals` por método: `credit→creditCardTotals`, `debit→debitCardTotals`, demais → `{}`.
- Ícone derivado de `paymentMethodIcon(key)` com cor inline `style={{ color: paymentMethodColor(key) }}`. Remover `colorClass` por método (o helper já entrega cor exata).
- Manter cor lime para `cash` na linha "Dinheiro" (sem cartões agrupados).

**`src/components/expense-list.tsx`**
- Remover `paymentMethodConfig` local (objeto de 3 entradas).
- Linha 110–111: trocar por `const Icon = paymentMethodIcon(expense.payment_method)` e usar `paymentMethodLabel(expense.payment_method)` na linha 147.

**`src/components/transaction-detail-sheet.tsx`**
- Remover `paymentMethodLabels` (linha 50–54) e `paymentMethodIcons` (linha 56–60) locais.
- Importar `paymentMethodLabel`, `paymentMethodIcon` da fonte única.
- Linhas 317–318: usar os helpers diretamente.
- Linha 439: comparação `payment_method === "credit"` para mostrar bloco de fatura — manter, mas trocar para `affectsCardBilling(expense.payment_method)` (conceito de domínio mais correto). Adicionar comentário `// Fatura aparece apenas para métodos que afetam billing de cartão`.

**`src/components/recurring-expense-list.tsx`**
- Remover `paymentMethodConfig` local (linha 29–33).
- Substituir por `paymentMethodIcon` e `paymentMethodLabel` da fonte única (linhas 92–93 e 126).

### Filtros — adicionar opção "Dinheiro" derivada de PAYMENT_METHOD_LIST

**`src/components/compact-filter-bar.tsx`** (linhas 260–266) e **`src/components/expense-filters.tsx`** (linhas 289–295)
- Substituir os 3 `<SelectItem>` hardcoded por `.map()` sobre `PAYMENT_METHOD_LIST`, preservando o item `"all"` no topo.
- Resultado: filtro passa a oferecer 4 opções (Crédito, Débito, PIX, Dinheiro) na ordem de `displayOrder`.

### Importação — sem fallback silencioso

**`src/services/spreadsheet-import-service.ts`**
- Importar `parsePaymentMethodAlias` da fonte única.
- Reescrever `mapPaymentMethod(value)`:
  - Se `value` vazio/null → retornar `{ method: "pix", error: null }` (default documentado e preservado).
  - Caso contrário, chamar `parsePaymentMethodAlias`. Se `method === null` → retornar `{ method: null, error: 'Forma de pagamento não reconhecida: "X". Aceitos: Crédito, Débito, PIX, Dinheiro.' }`.
- Em `mapRowsToExpenses`: quando o erro vier preenchido, push em `errors` da linha e marcar `isValid: false`. A linha continua aparecendo na pré-visualização para o usuário corrigir manualmente.
- Remover o `PAYMENT_MAPPINGS` local (já duplicado nos `importAliases` da fonte única).

**`src/components/spreadsheet-import-sheet.tsx`** (linhas 282–286)
- Substituir array literal `paymentMethods` por `PAYMENT_METHOD_LIST.map(m => ({ value: m.value, label: m.label }))` para incluir "Dinheiro" no select de edição da pré-visualização.
- Não precisa mudar UI de erro: o componente já exibe `expense.errors` em vermelho na célula de descrição (linha 547). Usuário verá a mensagem clara e poderá trocar o select para o método correto.

### Exportação — usar paymentMethodLabel

**`src/pages/Settings.tsx`** (linhas 138–139, 147–148, 261–262)
- Importar `paymentMethodLabel` da fonte única.
- Trocar os 3 ternários por `paymentMethodLabel(exp.payment_method as PaymentMethod)`.
- Para CSV linha 261–262 (que usa "Cartão" em vez de "Crédito"): manter texto idêntico ao atual usando `paymentMethodLabel` (que retornará "Crédito"/"Débito"/"PIX"/"Dinheiro"). Isto é uma melhoria deliberada: Crédito é mais preciso que "Cartão" (que poderia significar débito também).
- Para o XLSX linhas 138–139 e 147–148 (que usa "Cartão de Crédito"/"Cartão de Débito"): manter os textos antigos via map local ou aceitar a normalização para os labels canônicos. **Decisão:** normalizar para os labels canônicos da fonte única (consistência total, sem fallback).

### Billing — usar conceito de domínio

**`src/pages/Index.tsx`** (linhas 1508 e 1833)
- Trocar `expense.payment_method !== "credit"` por `!affectsCardBilling(expense.payment_method)`.
- Adicionar import de `affectsCardBilling`.
- Adicionar comentário curto: `// Modo fatura mostra apenas métodos que afetam billing de cartão`.

**`src/utils/billing-period.ts`, `src/utils/credit-card-spend.ts`, `src/utils/card-limit-view-model.ts`**
- Manter as comparações `=== "credit"` (são corretas: a lógica de fatura/limite só se aplica a crédito; débito/PIX/cash são naturalmente excluídos).
- Adicionar comentário `// Apenas crédito gera fatura/limite — outros métodos (debit/pix/cash) são naturalmente ignorados` em cada local.

## 3. Validação após edição

1. **Typecheck** via `tsc --noEmit` (verificar que nenhum `Record<PaymentMethod, X>` fechado quebrou).
2. **Lint** via `eslint`.
3. **Build** via `vite build`.
4. **Smoke test manual** seguindo a checklist do plano original (criar cash, editar credit→cash limpa cartão+parcelas, filtro mostra Dinheiro, PDF/CSV mostra "Dinheiro", importação rejeita "carteira virtual" com erro claro, billing ignora cash).

## 4. Fechamento entregue ao usuário

Ao final, devolverei mensagem com:

1. **Lista exata de arquivos alterados** nesta passada (9) e os já alterados na primeira passada (referência).
2. **Confirmação item-a-item** dos 6 pontos restantes do plano original.
3. **Resultado de typecheck/lint/build** (saída literal dos comandos).
4. **Checklist dos casos de teste obrigatórios** (marcado como ✅ verificado por inspeção de código + ⚠ requer teste manual no preview, com instrução clara do que testar).
5. **Confirmação explícita** dos 5 invariantes:
   - cash NÃO entra em billing/fatura (`affectsCardBilling("cash") === false`, comparações em `Index.tsx`/`billing-period.ts`/`credit-card-spend.ts`/`card-limit-view-model.ts` excluem cash).
   - cash NÃO exige cartão (`requiresCard("cash") === false`, forms ocultam o campo, payload final grava `card_id: null`).
   - cash NÃO permite parcelamento (`allowsInstallments("cash") === false`, forms ocultam parcelas, payload força `installments: 1`).
   - Importação NÃO faz fallback silencioso (parser retorna `null` para alias desconhecido, linha vai para preview marcada como inválida com mensagem clara).
   - PDF/CSV exibem "Dinheiro" (todos os ternários removidos, lookup via `paymentMethodLabel` da fonte única).

## 5. Lista final de arquivos a alterar nesta passada

1. `src/components/expense-summary.tsx`
2. `src/components/expense-list.tsx`
3. `src/components/transaction-detail-sheet.tsx`
4. `src/components/recurring-expense-list.tsx`
5. `src/components/compact-filter-bar.tsx`
6. `src/components/expense-filters.tsx`
7. `src/services/spreadsheet-import-service.ts`
8. `src/components/spreadsheet-import-sheet.tsx`
9. `src/pages/Settings.tsx`
10. `src/pages/Index.tsx`
11. `src/utils/billing-period.ts` (apenas comentários de documentação)
12. `src/utils/credit-card-spend.ts` (apenas comentários de documentação)
13. `src/utils/card-limit-view-model.ts` (apenas comentários de documentação)

**Total nesta passada:** 10 arquivos modificados + 3 anotados com comentários de documentação. Nenhum arquivo novo, nenhuma migration adicional.

