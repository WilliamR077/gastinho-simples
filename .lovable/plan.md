

## Plano: Entrada Parcelada

### Estratégia

Replicar o padrão de despesas parceladas (`installment_group_id`, `installment_number`, `total_installments`) para `incomes`. Gerar N registros na criação. No detalhe, buscar as demais parcelas do mesmo grupo para exibir histórico/próximas.

---

### 1. Migração SQL

```sql
ALTER TABLE incomes ADD COLUMN installment_group_id uuid DEFAULT NULL;
ALTER TABLE incomes ADD COLUMN installment_number integer DEFAULT 1;
ALTER TABLE incomes ADD COLUMN total_installments integer DEFAULT 1;
```

Sem nova tabela. RLS existente já cobre.

### 2. Tipos — `src/types/income.ts`

Adicionar ao `Income`: `installment_group_id?: string | null`, `installment_number?: number`, `total_installments?: number`.

### 3. Formulário — `src/components/unified-income-form-sheet.tsx`

- Expandir `IncomeType` para `"monthly" | "recurring" | "installment"`
- Adicionar terceira opção no RadioGroup: "Entrada Parcelada"
- Quando `installment`:
  - Campo "Quantidade de parcelas" (min 2, max 48)
  - Campo "Primeira data" (date picker, reusa o existente)
  - Preview das parcelas: lista `Parcela 1/N — mês/ano — R$ X`
  - Validação: parcelas < 2 → toast "Use entrada do mês para um único recebimento"
- No submit: gerar N registros com `installment_group_id` compartilhado, descrição `"Desc (1/N)"`, datas incrementando mês a mês

### 4. Lista — `src/components/income-list.tsx`

Quando `income.total_installments > 1`: mostrar badge discreto `X/N` na segunda linha (ex: "1/3").

### 5. Detalhe — `src/components/transaction-detail-sheet.tsx`

Quando `income.total_installments > 1`:
- Mostrar "Tipo: Entrada Parcelada"
- Mostrar "Parcela X de N"
- **Buscar demais parcelas** do mesmo `installment_group_id` via query ao abrir o detalhe
- Listar todas as parcelas do conjunto: número, mês/data, valor, com destaque na parcela atual
- Usar `Collapsible` para não poluir a UI (expandir "Ver todas as parcelas")

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | 3 colunas em `incomes` |
| `src/types/income.ts` | 3 campos no `Income` |
| `src/components/unified-income-form-sheet.tsx` | Tipo `installment`, campos, preview, multi-insert |
| `src/components/income-list.tsx` | Badge parcela X/N |
| `src/components/transaction-detail-sheet.tsx` | Seção parcela + lista de parcelas do conjunto |

