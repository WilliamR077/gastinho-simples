# Bug: campo "Valor" apaga ao digitar vírgula ou ponto na edição

## Causa raiz

Nos diálogos de edição, o campo de valor usa:

```tsx
<Input
  type="number"
  {...field}
  onChange={(e) => field.onChange(parseFloat(e.target.value))}
/>
```

Dois problemas combinados:

1. `<input type="number">` em pt-BR/Android rejeita vírgula — `e.target.value` vira `""`. `parseFloat("")` retorna `NaN`, que é gravado no form e re-renderizado como vazio. Resultado: o campo "some" ao apertar vírgula.
2. Estados intermediários como `"44."` também viram `NaN` em alguns navegadores móveis, com o mesmo efeito.

O formulário de **criação** (`expense-form.tsx`) não tem esse problema porque guarda o valor como string e só faz `parseFloat` no submit.

## Correção

Trocar `type="number"` por `inputMode="decimal"` (teclado numérico no mobile, aceita vírgula e ponto) e manter um estado de string local, convertendo só para número no momento certo. Aplicar o mesmo padrão em todos os diálogos de edição que sofrem do mesmo bug.

### Arquivos a alterar

- `src/components/expense-edit-dialog.tsx` — campo `amount`.
- `src/components/recurring-expense-edit-dialog.tsx` — campo `amount`.
- `src/components/income-edit-dialog.tsx` — campo `amount`.
- `src/components/recurring-income-edit-dialog.tsx` — campo `amount`.
- `src/components/budget-goal-edit-dialog.tsx` — campo de valor da meta.

### Padrão do novo `onChange`

```tsx
<Input
  type="text"
  inputMode="decimal"
  placeholder="0,00"
  value={field.value === 0 || field.value == null ? "" : String(field.value).replace(".", ",")}
  onChange={(e) => {
    // Aceita dígitos, uma vírgula OU um ponto. Mantém estado intermediário (ex.: "44,").
    const raw = e.target.value.replace(/[^\d.,]/g, "");
    // Normaliza para formato numérico (vírgula -> ponto) sem perder o que o usuário digitou.
    const normalized = raw.replace(",", ".");
    if (raw === "" || raw === "," || raw === ".") {
      field.onChange(0);
      return;
    }
    const num = parseFloat(normalized);
    if (!isNaN(num)) {
      field.onChange(num);
    }
    // Se ainda for inválido (ex.: termina em separador), não chama onChange:
    // o input continua mostrando o que o usuário digitou via valor não-controlado.
  }}
/>
```

Como o RHF re-renderiza o `value`, para permitir estados intermediários (`"44,"`) o input precisa ser **não-controlado** durante a digitação. Implementação: manter um `useState<string>` local sincronizado com `field.value` no `form.reset`, e gravar no form somente quando a string parsear para número válido.

### Detalhe de implementação por diálogo

Em cada arquivo:
1. Adicionar `const [amountText, setAmountText] = useState("")`.
2. No `useEffect` que faz `form.reset`, também setar `setAmountText(String(expense.amount).replace(".", ","))`.
3. Substituir o `<Input>` do `amount` por versão com `inputMode="decimal"`, `value={amountText}`, `onChange` que atualiza `amountText` e tenta `field.onChange(parseFloat(normalized))` quando válido.
4. Manter `FormMessage` para validação Zod (positive).

## Fora de escopo

- Formulários de criação (não têm o bug).
- `expense-filters.tsx`, `compact-filter-bar.tsx`, `spreadsheet-import-sheet.tsx`, `card-manager.tsx` — não foram reportados; alguns são filtros numéricos puros.
- Backend, RLS, Supabase, billing, dependências.

## Checklist de teste manual

- [ ] Editar despesa → apagar valor → digitar `44,25` → campo mostra `44,25` e salva como 44.25.
- [ ] Editar despesa → digitar `44.25` (ponto) → idem.
- [ ] Editar despesa → digitar `44,` → campo NÃO some; ao continuar digitando `25` fica `44,25`.
- [ ] Editar despesa → apagar tudo → mensagem de erro "Valor deve ser positivo" aparece.
- [ ] Mesma bateria em despesa fixa, receita, receita fixa e meta.
- [ ] Criar nova despesa continua funcionando como antes.
