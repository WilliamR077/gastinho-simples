# Bloco F (mini-fix) — Cartão opcional na edição de despesa

## Bug reportado
Ao **editar** uma despesa em Crédito/Débito, o app obriga selecionar um cartão. Se o cartão original foi removido (ou está indisponível por limite de plano), o usuário fica travado e não consegue salvar. No **cadastro novo**, o cartão já é opcional ("Selecione o cartão (opcional)" / "Sem cartão selecionado. A despesa será salva sem vínculo a um cartão.").

A inconsistência está só na edição.

## Causa
`src/components/expense-edit-dialog.tsx` — `handleSubmit` (linhas 174–178):
```
if (requiresCard(data.paymentMethod) && !sanitizedCardId) {
  form.setError("cardId", { message: "Selecione um cartão" });
  return;
}
```
e o `<SelectValue placeholder="Selecione o cartão" />` (linha 346), sem helper text.

O formulário de criação (`expense-form.tsx`, `expense-form-sheet.tsx`, `unified-expense-form-sheet.tsx`) já trata cartão como opcional: `requiresCard(paymentMethod) ? (cardId || undefined) : undefined` — sem bloqueio.

## Escopo da correção (somente UI/validação do dialog de edição)

Arquivo: **`src/components/expense-edit-dialog.tsx`**

1. Remover o bloco de validação que força `cardId` (linhas 174–178). Manter `sanitizedCardId = requiresCard(...) ? data.cardId : undefined` para garantir que métodos sem cartão (pix/dinheiro) nunca persistem `card_id`.
2. Trocar placeholder do select para `"Selecione o cartão (opcional)"`.
3. Adicionar helper text abaixo do select, igual ao formulário de criação:  
   `"Sem cartão selecionado. A despesa será salva sem vínculo a um cartão."` (exibido quando `requiresCard(paymentMethod) && !cardId`).
4. Manter todo o resto: lógica de parcelas, split em grupo, denormalização, sanitização para pix/cash.

## Fora de escopo (não mexer agora)
- `recurring-expense-edit-dialog.tsx` tem o mesmo padrão de bloqueio, mas o usuário não reportou esse fluxo. Posso aplicar o mesmo ajuste em um próximo passo, com sua aprovação separada.
- Nenhuma alteração em backend, RLS, Edge Functions, billing, Auth Guards, PIN, biometria, importador ou dependências.
- Nenhuma mudança de layout além do placeholder e da linha de helper.

## Validação manual após implementação
1. Editar despesa em Crédito **sem trocar nada** → salva normalmente.
2. Editar despesa em Crédito e **deixar cartão vazio** → salva sem cartão, despesa fica sem vínculo.
3. Editar despesa em Crédito e **trocar para outro cartão válido** → salva com o novo cartão.
4. Editar despesa em Crédito de uma série parcelada → continua respeitando regras de parcelas.
5. Editar despesa em PIX/Dinheiro → cartão não aparece, salva normalmente.
6. Em grupo compartilhado → split continua funcionando.
7. Criar nova despesa em Crédito sem cartão → continua funcionando como hoje (regressão zero).

## Critério de aprovação
Edição permite salvar Crédito/Débito sem cartão, com helper text claro, e PIX/Dinheiro continuam sem persistir `card_id`.
