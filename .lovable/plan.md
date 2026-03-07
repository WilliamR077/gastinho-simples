

## Plano: Corrigir banner ads cobrindo UI + habilitar Premium Anual

### A) Banner de anúncios cobrindo UI

**Problema**: O banner do AdMob (320x50, fixo no bottom) sobrepõe botões em telas específicas.

**Solução**:

#### 1. Esconder banner em telas sensíveis

- **`src/components/app-lock-screen.tsx`**: No `useEffect` de mount, chamar `adMobService.hideBanner()`. No cleanup (unmount/unlock), chamar `adMobService.showBanner()`.

- **`src/components/app-menu-drawer.tsx`**: Quando `open` mudar para `true`, chamar `adMobService.hideBanner()`. Quando fechar (`false`), chamar `adMobService.showBanner()`.

#### 2. Reservar espaço nas demais telas

- **`src/pages/Index.tsx`**: Já tem `pb-24` para o FAB. Verificar se é suficiente (banner = 50px + margem). Ajustar para `pb-32` se necessário para acomodar banner + FAB.

- **Páginas sem FAB** (Settings, Reports, Account, Cards, Subscription): Adicionar `pb-20` ao container principal para que o conteúdo final não fique atrás do banner. Criar uma constante ou utility class `AD_BANNER_PADDING = "pb-20"` para consistência.

---

### B) Premium Anual no app

**Problema**: `purchaseWithStore` pega `product.offers[0]` sempre — só mostra o mensal. O produto Premium no Google Play tem 2 base plans (mensal e anual) que aparecem como offers diferentes.

**Solução**:

#### 1. `src/pages/Subscription.tsx` — Toggle Mensal/Anual no card Premium

- Adicionar state `premiumBillingPeriod: "monthly" | "yearly"` (default: `"monthly"`)
- No card Premium (tanto na visão gratuita quanto na de upgrade), renderizar toggle pill:
  - "Mensal — R$ 14,90/mês"
  - "Anual — R$ 118,80/ano (≈ R$ 9,90/mês)" com badge "Economia 33%"
- Ao clicar em "Ter Acesso Completo ⭐", passar `premiumBillingPeriod` para `handlePurchase`
- Atualizar `handlePurchase` para passar o período: `billingService.purchase(productId, planTier, premiumBillingPeriod)`

#### 2. `src/services/billing-service.ts` — Selecionar offer correta

- Atualizar assinatura de `purchase()` para aceitar `billingPeriod?: "monthly" | "yearly"`
- Em `purchaseWithStore()`: quando `billingPeriod === "yearly"`, iterar `product.offers` e encontrar a offer cujo `pricingPhases[0].billingPeriod` contém `"P1Y"` (ISO 8601 para 1 ano). Se não encontrar, fazer fallback para `offers[0]`.
- Quando `billingPeriod === "monthly"` (ou undefined), buscar offer com `billingPeriod` contendo `"P1M"`, fallback para `offers[0]`.
- Se o produto só tiver 1 offer (anual não configurado), esconder o toggle na UI — expor método `getAvailableOffers(productId)` que retorna quais períodos existem.

#### 3. Verificação de offers disponíveis

- Adicionar método `getProductOffers(productId): { monthly?: CdvPurchaseOffer, yearly?: CdvPurchaseOffer }`
- Na `Subscription.tsx`, chamar esse método após init para saber se deve mostrar o toggle anual. Se `yearly` não existir, esconder a opção.

---

### Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `src/components/app-lock-screen.tsx` | Hide/show banner on mount/unmount |
| `src/components/app-menu-drawer.tsx` | Hide/show banner on open/close |
| `src/pages/Index.tsx` | Ajustar padding-bottom |
| `src/pages/Settings.tsx` | Adicionar padding-bottom |
| `src/pages/Reports.tsx` | Adicionar padding-bottom |
| `src/pages/Account.tsx` | Adicionar padding-bottom |
| `src/pages/Cards.tsx` | Adicionar padding-bottom |
| `src/pages/Subscription.tsx` | Toggle mensal/anual no Premium, usar offers |
| `src/services/billing-service.ts` | Aceitar billingPeriod, selecionar offer correta |

