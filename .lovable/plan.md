

## Plano: Ajustes de Assinaturas — planos, limites, gates e upsell

### Estado atual vs. mudanças necessárias

A maioria dos gates já existe (cartões, metas, exportar PDF/Excel, períodos de relatório, grupos). As mudanças são:

---

### 1. `src/types/subscription.ts` — Ajustar features

- **Preço no_ads**: `R$ 4,90/mês` → `R$ 3,90/mês`
- **importSpreadsheet**: mudar para `true` em `free` e `no_ads` (importar é liberado para todos)
- **importLimit**: dar limite generoso para free (ex: 100) e no_ads (ex: 100)

### 2. `src/components/app-header.tsx` — Badge de plano

- Importar `useSubscription`
- Ao lado do logo, renderizar:
  - Premium: `<Badge>⭐ Premium</Badge>`
  - Sem Anúncios: `<Badge variant="secondary">Sem anúncios</Badge>`
  - Gratuito: nada

### 3. Gates — Padronizar modais de upgrade

Criar componente reutilizável `src/components/upgrade-dialog.tsx`:
- Props: `open`, `onOpenChange`, `title`, `description`, `features?: string[]`
- CTA primário: "Virar Premium ⭐" → navega para `/subscription`
- CTA secundário: "Agora não"

Atualizar os gates existentes para usar copy consistente:

| Local | Copy do modal |
|---|---|
| `period-selector.tsx` (Ano/Trim/Custom) | "Disponível no Premium" + "Veja relatórios por trimestre, ano e períodos personalizados." |
| `Reports.tsx` (Exportar PDF) | "Exportar PDF é Premium" + "Gere um PDF espelho dos relatórios." |
| `Settings.tsx` (Exportar Excel/PDF) | "Exportar dados é Premium" |
| `card-manager.tsx` (3º cartão) | "Cartões ilimitados no Premium" |
| `budget-goal-form-sheet.tsx` (2ª meta) | "Metas ilimitadas no Premium" |
| `create-group-dialog.tsx` (criar grupo) | "Crie até 3 grupos no Premium" |

A maioria já tem modal — apenas padronizar textos e CTA "Virar Premium ⭐".

### 4. Upsell banner discreto — Novo componente

`src/components/upsell-banner.tsx`:
- Só renderiza para `free` e `no_ads`
- Verifica `localStorage` para "última vez mostrado" — só mostra se > 7 dias
- Verifica se usuário tem ≥ 10 gastos (receber como prop `expenseCount`)
- Copys alternadas (usar `Date.now() % 2` para alternar)
- Botão "Ver Premium" + "X" para fechar
- Inserir no `Index.tsx` abaixo do `BalanceSummary`

### 5. Página de Planos — `Subscription.tsx`

Atualizar `renderPlanFeatures`:
- Gratuito: "Relatórios: mês atual (todos os gráficos)", "Importar planilha", "Participar de grupos"
- Sem Anúncios: "Tudo do Gratuito + sem anúncios"
- Premium: lista completa conforme spec

### 6. `src/pages/Settings.tsx` — Import liberado

O gate de import já usa `canImportSpreadsheet` — ao mudar para `true` no `subscription.ts`, já funciona. Apenas verificar se o botão não mostra Lock icon para free.

---

### Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `src/types/subscription.ts` | Preço no_ads, importSpreadsheet=true para todos |
| `src/components/app-header.tsx` | Badge de plano |
| `src/components/upgrade-dialog.tsx` | Novo componente reutilizável de modal upgrade |
| `src/components/upsell-banner.tsx` | Novo banner discreto de upsell |
| `src/pages/Index.tsx` | Inserir UpsellBanner |
| `src/pages/Subscription.tsx` | Atualizar textos dos planos |
| `src/components/card-manager.tsx` | Padronizar copy do modal de upgrade |
| `src/components/budget-goal-form-sheet.tsx` | Padronizar copy |
| `src/components/period-selector.tsx` | Padronizar copy |
| `src/pages/Reports.tsx` | Padronizar copy |
| `src/pages/Settings.tsx` | Remover gate de import (já automático), padronizar export copy |

