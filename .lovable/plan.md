

# Plano: Agrupar parcelas no relatório "Maiores Gastos"

## Problema

Em visualizações de **trimestre / ano / personalizado / todo o histórico**, o Top 10 fica poluído por parcelas individuais da mesma compra (ex: "Notebook 1/8", "Notebook 2/8", "Notebook 3/8"…), distorcendo o ranking — o usuário vê o mesmo notebook ocupando várias posições em vez de ver suas compras realmente maiores.

Na visualização **mensal**, faz sentido manter a parcela individual, pois representa o impacto real daquele mês.

## Solução

Comportamento **dependente do período**:

- **`month`** → mantém como está hoje (parcela individual, ex: "Notebook (3/8)" R$ 320,52).
- **`quarter` / `year` / `custom` / `all`** → agrupar parcelas que pertencem ao mesmo `installment_group_id` em uma única linha, somando os valores das parcelas **que caem dentro do período selecionado**.

### Formato da linha agrupada

- **Descrição**: nome base sem o "(x/y)" + sufixo `(Nx)` indicando quantas parcelas foram somadas naquele período.
  - Ex: `"Notebook (3 parcelas)"`
- **Subtítulo (linha 2)**: range de datas das parcelas somadas.
  - Ex: `"01/04 → 01/06"` (primeira parcela até última no período)
- **Valor**: soma das parcelas dentro do período.
- **Tooltip / disclaimer**: badge ou texto pequeno indicando "x de N parcelas" para deixar claro que pode haver mais parcelas fora do período.
  - Ex: `"3 de 8 parcelas no período"`

Despesas avulsas (sem `installment_group_id`) e fixas (recorrentes) seguem inalteradas.

Se o grupo de parcelas tem **apenas 1 parcela** dentro do período, exibir como linha normal (sem agrupamento), pois agrupar 1 item não agrega valor.

## Mudanças

### 1. `src/utils/report-view-model.ts`

**a) Estender `TopExpenseItem`:**
```ts
type TopExpenseItem = {
  description: string;
  amount: number;
  date: string;
  type: 'expense' | 'recurring' | 'installment-group';
  dayOfMonth?: number;
  // novos campos para grupos de parcelas:
  installmentsInPeriod?: number;
  totalInstallments?: number;
  dateRange?: { start: string; end: string };
};
```

**b) Refatorar bloco "Top expenses" (linhas 518–522):**

- Se `periodType === 'month'`: manter lógica atual.
- Senão:
  1. Separar `filteredExpenses` em:
     - **avulsas** (sem `installment_group_id`)
     - **parceladas** (com `installment_group_id`)
  2. Agrupar parceladas por `installment_group_id`, somando `amount`, contando parcelas, capturando `min(expense_date)` e `max(expense_date)` e usando `total_installments` da primeira para o "x de N".
  3. Para grupos com 1 parcela no período → tratar como avulsa (manter descrição original com "(x/y)" para clareza).
  4. Para grupos com 2+ parcelas → criar item `type: 'installment-group'` com descrição base limpa (remover sufixo `"(n/m)"` via regex `/\s*\(\d+\/\d+\)\s*$/`) e adicionar `(Nx parcelas)`.
  5. Concatenar avulsas + grupos + recorrentes, ordenar por `amount` desc, slice(10).

### 2. `src/components/reports-accordion.tsx` (linhas 477–496)

Atualizar render do item para suportar o novo tipo:

```tsx
<p className="text-xs text-muted-foreground">
  {e.type === 'recurring' && `Fixa • Dia ${e.dayOfMonth}`}
  {e.type === 'expense' && format(parseLocalDate(e.date), "dd/MM")}
  {e.type === 'installment-group' && (
    <>
      {format(parseLocalDate(e.dateRange!.start), "dd/MM")} → {format(parseLocalDate(e.dateRange!.end), "dd/MM")}
      <span className="ml-1 text-[10px] opacity-75">
        ({e.installmentsInPeriod} de {e.totalInstallments} parcelas)
      </span>
    </>
  )}
</p>
```

Adicionar disclaimer geral no topo do accordion (apenas quando `periodType !== 'month'` e existir algum grupo agrupado):
```tsx
<p className="text-xs text-muted-foreground mb-3">
  Compras parceladas são somadas pelas parcelas que caem neste período.
</p>
```

### 3. `src/services/pdf-export-service.ts` (linhas 624–657)

Espelhar a UI: na coluna "Data", mostrar o range para `installment-group` e adicionar a contagem `"(3 de 8)"` na descrição. Manter mesmo disclaimer logo acima da tabela.

## Casos de teste

1. **Mês de abril** com parcela 1/8 do Notebook → aparece como hoje: `"Notebook (1/8) — 01/04 — R$ 320,52"`.
2. **Ano 2026** com 8 parcelas do Notebook (todas no ano) → uma única linha: `"Notebook (8 parcelas) — 01/04 → 01/11 — R$ 2.564,16 — (8 de 8)"` no topo do ranking.
3. **Trimestre Q2/2026** com parcelas 1, 2 e 3 → `"Notebook (3 parcelas) — 01/04 → 01/06 — R$ 961,56 — (3 de 8)"`.
4. **Custom 1/4 → 30/4** com só parcela 1 → linha normal sem agrupamento (mantém "1/8").
5. Despesas fixas e avulsas continuam aparecendo igual.
6. Top 10 nunca mostra a mesma compra parcelada duplicada em períodos > mês.

## Arquivos alterados

1. `src/utils/report-view-model.ts` — agrupamento + novo tipo no `TopExpenseItem`.
2. `src/components/reports-accordion.tsx` — render condicional + disclaimer.
3. `src/services/pdf-export-service.ts` — paridade com UI.

**Total:** 3 arquivos. Sem migration, sem mudança de schema.

