# Plano — Gerenciar cartões direto do campo "Cartão"

## Objetivo
Replicar o padrão do campo de Categoria (CategorySelector → CategoryManager) no campo Cartão dos formulários de despesa. Ao abrir o select de cartões, o usuário verá uma opção "Gerenciar cartões..." que abre um modal com a mesma experiência da página `/cards`, sem precisar sair do formulário.

## Escopo

### Em escopo
- Criar componente reutilizável `CardSelector` (UI do campo de cartão + botão "Gerenciar cartões..." dentro do SelectContent).
- Criar wrapper `CardManagerSheet` que abre um Sheet bottom contendo o componente `CardManager` existente, sem duplicar lógica.
- Substituir o bloco atual de seleção de cartão (Select + Alert "cadastrar cartão agora →") nestes formulários para usar `CardSelector`:
  - `src/components/expense-form-sheet.tsx`
  - `src/components/expense-form.tsx`
  - `src/components/unified-expense-form-sheet.tsx`
  - `src/components/expense-edit-dialog.tsx`
  - `src/components/recurring-expense-form-sheet.tsx`
  - `src/components/recurring-expense-form.tsx`
  - `src/components/recurring-expense-edit-dialog.tsx`
- Após fechar o modal de gerenciamento, recarregar a lista de cartões e:
  - manter o `cardId` atual se o cartão ainda existir e for compatível com o `paymentMethod`;
  - se um único novo cartão compatível foi criado durante a sessão do modal, pré-selecioná-lo (conveniência);
  - caso contrário, manter o select vazio (cartão continua opcional, conforme correção anterior).
- Respeitar o limite do plano: o botão "Adicionar Cartão" dentro do modal continua usando a mesma checagem de `useSubscription` já existente em `CardManager` (redireciona para `/subscription` se atingiu o limite). Nenhuma mudança em billing.

### Fora de escopo
- Backend, Supabase, Edge Functions, RLS, rate limit, PIN, Auth Guards, billing, dependências.
- Mudanças em CategorySelector/CategoryManager.
- Mudanças na página `/cards` em si.
- Mudanças no fluxo de receitas (não há campo de cartão lá).
- Refatorar `CardManager` (será reaproveitado como está, apenas embrulhado em Sheet).

## Detalhes técnicos

### Novo componente: `src/components/card-selector.tsx`
Props:
```
{
  value: string;                    // cardId atual ("" = sem cartão)
  onValueChange: (id: string) => void;
  paymentMethod: PaymentMethod;     // para filtrar credit/debit/both
  className?: string;
  onboardingTarget?: string;
}
```
Comportamento:
- Carrega `cards` via supabase (mesma query usada hoje nos forms: `user_id`, `is_active=true`).
- Filtra por `paymentMethod` (mesma lógica de `getAvailableCards`).
- Renderiza `<Select>` com placeholder "Selecione o cartão (opcional)".
- Sempre exibe um `<Separator />` + `<Button variant="ghost">` "Gerenciar cartões..." no final do `SelectContent`.
- Se a lista filtrada está vazia, mostra uma `<Alert>` curta acima do botão: "Você ainda não tem cartões cadastrados." + CTA "Cadastrar cartão" que abre o `CardManagerSheet` (em vez de navegar para `/cards`).
- Mantém helper text "Sem cartão selecionado. A despesa será salva sem vínculo a um cartão." quando `value` está vazio.
- Ao fechar o `CardManagerSheet`, recarrega `cards` e aplica a lógica de pré-seleção descrita acima.

### Novo componente: `src/components/card-manager-sheet.tsx`
```
<Sheet open onOpenChange>
  <SheetContent side="bottom" className="h-[90dvh] ... flex flex-col p-0">
    <SheetHeader>... "Gerenciar Cartões"</SheetHeader>
    <div className="flex-1 overflow-y-auto px-4 pb-6">
      <CardManager />
    </div>
  </SheetContent>
</Sheet>
```
- Sem nenhuma alteração no componente `CardManager`.
- Safe-area inferior para não cortar botões em Android.

### Integração nos formulários
Cada formulário hoje renderiza algo como:
```
{requiresCard(paymentMethod) && (
  <div>... Select de cartões + Alert "cadastrar agora →" ...</div>
)}
```
Substituir por:
```
{requiresCard(paymentMethod) && (
  <CardSelector
    value={cardId}
    onValueChange={setCardId}
    paymentMethod={paymentMethod}
  />
)}
```
Remover dos forms: estado `cards`, `loadCards`, `getAvailableCards`, import de `useNavigate` se não usado em outro lugar, e o Alert/CTA antigo (passa para dentro do `CardSelector`).

### Comportamento de cartão opcional (mantido)
Nenhuma alteração na lógica de submit: `requiresCard(paymentMethod) ? (cardId || undefined) : undefined`. Continua possível salvar despesa Crédito/Débito sem cartão (correção do bug anterior preservada).

## Critérios de aprovação
1. Em qualquer form de despesa (nova, edição, recorrente), ao selecionar "Crédito" ou "Débito", o select de cartão mostra os cartões compatíveis + opção "Gerenciar cartões...".
2. Clicar em "Gerenciar cartões..." abre um Sheet com a mesma experiência da página `/cards` (criar, editar, excluir, ver limites, com respeito ao limite do plano).
3. Ao fechar o Sheet, a lista no select é atualizada automaticamente; se o usuário criou um único cartão novo compatível, ele já fica pré-selecionado.
4. Salvar despesa sem cartão continua funcionando (Crédito/Débito); Pix/Dinheiro continuam sem mostrar o campo.
5. Limite de cartões do plano free continua sendo respeitado dentro do modal (mesmo fluxo de upgrade já existente).
6. Nenhuma alteração em backend, Supabase, RLS, Edge Functions, billing, PIN, Auth Guards, dependências, ou no fluxo de importação/exportação de planilhas.

## Checklist manual sugerido
- [ ] Nova despesa → Crédito → "Gerenciar cartões..." → criar cartão → fechar → cartão novo aparece e fica selecionado.
- [ ] Nova despesa → Débito → mesmo fluxo.
- [ ] Edição de despesa Crédito com cartão excluído → abrir modal, criar novo → seleciona ou deixa vazio; salvar funciona.
- [ ] Plano free com limite atingido → botão "Adicionar Cartão" dentro do modal mostra aviso de upgrade.
- [ ] Despesa recorrente (form e edição) → mesmo comportamento.
- [ ] Pix/Dinheiro → campo de cartão segue oculto.
- [ ] Página `/cards` continua funcionando idêntica.

Aguardando aprovação para implementar.
