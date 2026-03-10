

## Plano: Modal não-bloqueante com destaque no botão + build errors fix

### Problema
1. Na fase "arrived", o modal Dialog bloqueia toda interação — o usuário não consegue clicar no botão "+" da página
2. O modal não destaca visualmente onde está o botão
3. Build errors nos edge functions (`err` is of type `unknown`)

### Solução

**1. Trocar Dialog por banner flutuante nas fases "arrived" e "form-open"**

Quando `subPhase` é "arrived" ou "form-open", em vez de renderizar um `<Dialog>` modal (que bloqueia cliques), renderizar um **banner fixo na parte inferior da tela** que não bloqueia interação com a página.

**2. Destacar o botão "Adicionar Cartão"**

Adicionar um `data-onboarding="add-card-btn"` ao botão de adicionar cartão em `card-manager.tsx`. Na fase "arrived", aplicar um efeito de spotlight/pulse via CSS no botão alvo.

**3. Manter Dialog apenas para fases "navigate" e "completed"**

- `navigate`: Dialog modal com botão "Ir para Cartões" (como está)
- `arrived`: Banner flutuante no bottom + spotlight no botão +
- `form-open`: Banner flutuante com dicas sobre os campos
- `completed`: Dialog modal com "Adicionar outro" / "Prosseguir"

### Mudanças

**`src/components/onboarding-tour.tsx`**
- Fases "arrived" e "form-open": renderizar `<div>` fixo no bottom em vez de `<Dialog>`
- Adicionar lógica de spotlight: buscar elemento `[data-onboarding="add-card-btn"]` e aplicar classe `ring-4 ring-primary animate-pulse`
- Fases "navigate" e "completed": manter Dialog como está

**`src/components/card-manager.tsx`**
- Adicionar `data-onboarding="add-card-btn"` no botão "Adicionar Cartão"

**`supabase/functions/admin-dashboard/index.ts`**
- Cast `err` as `Error`: `(err as Error).message`

**`supabase/functions/admin-notifications/index.ts`**
- Cast `err` as `Error`: `(err as Error).message`

**`supabase/functions/admin-subscriptions/index.ts`**
- Cast `err` as `Error`: `(err as Error).message`

### Layout do banner flutuante (fase arrived)

```text
┌─────────────────────────────────────────────┐
│  Página de Cartões (interativa)             │
│                          [+ Adicionar] ← pulse/destaque
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│ 🏦 Passo 1/7 │ Clique em "Adicionar Cartão"│
│              acima para cadastrar │ [Sair]  │
└─────────────────────────────────────────────┘
```

