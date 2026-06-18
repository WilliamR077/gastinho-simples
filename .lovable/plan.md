## Objetivo
Migrar todos os locais restantes que ainda usam `email.split('@')[0]` para o helper `getMemberDisplayName`, garantindo que o `display_name` do `profiles` apareça em transações, divisões, relatórios e PDFs.

## Lugares a ajustar

1. **`src/utils/report-view-model.ts`** (linha ~432)
   - No bloco `memberData`, ao montar `mTotals`, usar `getMemberDisplayName(member)` em vez de `email.split('@')[0]`. Preservar o campo `email` para compatibilidade.

2. **`src/components/expense-list.tsx`** (linha ~36)
   - Reescrever `getUserDisplayName(userId, members)` para delegar a `getMemberDisplayName(member)` (retornando `null` se membro não encontrado).

3. **`src/components/recurring-expense-list.tsx`** (linha ~27) — mesma refatoração.
4. **`src/components/recurring-income-list.tsx`** (linha ~23) — mesma refatoração.
5. **`src/components/income-list.tsx`** (linha ~37) — mesma refatoração.

6. **`src/components/transaction-detail-sheet.tsx`**
   - `getUserDisplayName` (linha 57): delegar a `getMemberDisplayName`.
   - Render de splits (linha ~489): resolver o membro em `groupMembers` por `s.user_id` e usar `getMemberDisplayName(member ?? { user_email: s.user_email })`.

7. **`src/components/expense-split-section.tsx`**
   - `getMemberName` (linha 131): usar `getMemberDisplayName(member, '?')`.
   - Preview equal split (linha ~256): trocar `p.email.split('@')[0]` por lookup em `groupMembers` por `p.userId` + `getMemberDisplayName`, com fallback para `p.email`.

8. **`src/components/unified-expense-form-sheet.tsx`** (linhas ~659 e ~688)
   - Resolver membro a partir de `groupMembers` por `m.user_id` (ou usar `m` direto se já é membro) e usar `getMemberDisplayName(m, '?')`.

## Não-mudanças
- `src/utils/member-display.ts`: a única ocorrência restante de `email.split("@")[0]` permanece — é o fallback canônico do helper.
- `pdf-export-service.ts`: não usa o split diretamente; consome o `report-view-model`, então herdará a correção automaticamente.

## Verificação
Após as edições: `rg "split\(['\"]@['\"]" src/` deve retornar apenas `src/utils/member-display.ts`.
