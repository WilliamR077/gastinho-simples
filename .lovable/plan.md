

## Plano: Adicionar toggle Mensal/Anual no card Premium da Landing page

### Mudança

No `src/pages/Landing.tsx`, no card Premium da seção "Planos & Preços":

1. Adicionar state `premiumBillingPeriod: "monthly" | "yearly"` (default `"monthly"`)
2. No card Premium (quando `tierKey === "premium"`), inserir o toggle Mensal/Anual antes da lista de features — mesmo visual do `Subscription.tsx`
3. Atualizar o preço exibido dinamicamente:
   - Mensal: `R$ 14,90` `/mês`
   - Anual: `R$ 118,80` `/ano` + texto `≈ R$ 9,90/mês`
4. Badge `-33%` no botão "Anual"

O toggle sempre aparece na Landing (diferente da Subscription que depende de `hasYearlyOffer` do store), pois a Landing é informativa e não faz compra.

### Arquivo impactado

| Arquivo | Mudança |
|---|---|
| `src/pages/Landing.tsx` | State + toggle + preço dinâmico no card Premium |

