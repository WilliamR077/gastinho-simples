# Plano: Permitir despesa de crédito sem cartão cadastrado

## Problema

Quando o usuário escolhe um método que exige cartão (crédito ou débito) e **não** tem cartão cadastrado (ou simplesmente não seleciona nenhum), o botão "Adicionar Despesa" **fica habilitado visualmente** (`disabled` não inclui `cardId`), mas o `handleSubmit` aborta silenciosamente:

```ts
if (requiresCard(paymentMethod) && !cardId) {
  return  // ← falha silenciosa, parece bug
}
```

Resultado: clique no botão não faz nada, sem aviso.

Isso ocorre nos **3 formulários de despesa**:
- `src/components/expense-form.tsx` (linha 156)
- `src/components/expense-form-sheet.tsx` (linha 206)
- `src/components/unified-expense-form-sheet.tsx` (linha 304)

## Solução

Voltar ao comportamento anterior em que **cartão é opcional** para despesas de crédito/débito, mas com um nudge claro para cadastrar cartões — sem bloquear o usuário.

### Mudanças funcionais

1. **Remover o bloqueio silencioso** no `handleSubmit` dos 3 formulários — não tratar mais `requiresCard && !cardId` como erro. A despesa é gravada com `cardId = undefined`.
2. **Manter `sanitizedCardId`** como está: `requiresCard(paymentMethod) ? (cardId || undefined) : undefined`. Já cobre o caso de cartão vazio.
3. **Adicionar aviso visual (Alert)** logo abaixo do `<Select>` de cartão **quando o método exige cartão e não há cartões cadastrados** (lista vazia em `getAvailableCards()`):

   ```
   ⚠️ Você ainda não tem cartões cadastrados.
   [Cadastrar cartão agora →]   ← link navega para /cards
   ```

   Visual: usar `<Alert>` com `AlertTriangle` em tom de aviso (warning, não destrutivo) e um link/Button `variant="link"` apontando para `/cards`.

4. **Mostrar um aviso mais leve** quando há cartões cadastrados, mas o usuário não selecionou nenhum:

   ```
   ℹ️ Sem cartão selecionado. A despesa será salva sem vínculo a um cartão.
   ```

   Texto pequeno em `text-muted-foreground`, sem alerta cheio. Permite ao usuário entender por que a fatura/limite não vai aparecer.

5. **Botão "Adicionar Despesa" continua habilitado** com a regra atual (`description + amount + paymentMethod`). Não bloqueia por cartão.

### Comportamento por contexto

| Situação | Botão | Aviso |
|---|---|---|
| Crédito/Débito + tem cartões + selecionou um | habilitado | nenhum |
| Crédito/Débito + tem cartões + não selecionou | habilitado | aviso leve "será salva sem vínculo" |
| Crédito/Débito + sem cartões cadastrados | habilitado | Alert com link "Cadastrar cartão agora" → `/cards` |
| Outros métodos (pix, dinheiro, boleto…) | habilitado | nenhum (Select de cartão não aparece) |

### Detalhes técnicos

- Em `unified-expense-form-sheet.tsx` e `expense-form-sheet.tsx` o sheet fecha após salvar; o navegador para `/cards` deve fechar o sheet primeiro (`onOpenChange(false)` antes do `navigate`).
- Em `expense-form.tsx` (form inline da página) basta `navigate("/cards")`.
- Usar `useNavigate` do `react-router-dom` (já importado no projeto).
- Reutilizar componente `<Alert>` do `@/components/ui/alert` (já usado no `expense-form.tsx` para budget warnings).
- A despesa salva sem `card_id` continua válida no schema (coluna `card_id` em `expenses` é nullable, conforme uso atual).

### Casos de teste

1. Usuário sem cartões → escolhe crédito → vê alerta "Cadastre seu cartão" + link → clica em "Adicionar Despesa" → despesa criada sem `card_id`.
2. Usuário com cartões → escolhe crédito → não seleciona cartão → vê texto "será salva sem vínculo" → consegue salvar.
3. Usuário com cartões → escolhe crédito → seleciona cartão → fluxo normal (fatura/limite aparecem).
4. Usuário escolhe Pix → nenhum aviso, sem campo de cartão, botão habilita normalmente.
5. Link "Cadastrar cartão agora" navega para `/cards` (e fecha sheet quando aplicável).

## Arquivos alterados

1. `src/components/expense-form.tsx` — remover bloqueio + adicionar avisos.
2. `src/components/expense-form-sheet.tsx` — remover bloqueio + adicionar avisos + fechar sheet ao navegar.
3. `src/components/unified-expense-form-sheet.tsx` — remover bloqueio + adicionar avisos + fechar sheet ao navegar.

**Total:** 3 arquivos. Sem mudança de schema, sem migration.
