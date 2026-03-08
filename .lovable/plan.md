

## Plano: Responsividade dos Relatórios + Banner ads em telas sensíveis

### Problema 1: Banner de anúncios na tela de PIN/Biometria

A imagem mostra que o banner ainda aparece na tela de desbloqueio. O código em `app-lock-screen.tsx` já tem `adMobService.hideBanner()` no useEffect, e `app-menu-drawer.tsx` também já tem a lógica. Porém, o `hideBanner()` é assíncrono e pode falhar silenciosamente, ou o banner pode ser re-exibido por outra parte do código.

**Solução**: Reforçar a chamada — além do `hideBanner()`, chamar `removeBanner()` (que remove completamente em vez de apenas esconder). Também adicionar um segundo `useEffect` com intervalo curto para garantir que o banner foi removido (retry). No cleanup, usar `showBanner()` normalmente.

### Problema 2: Responsividade da página de Relatórios com zoom

O header está com `flex items-center justify-between` e o botão "Exportar" + título "Relatórios" competem por espaço. Com zoom alto, os elementos transbordam.

**Mudanças em `src/pages/Reports.tsx`**:
- Header: usar `flex-wrap gap-2` para permitir quebra. Reduzir tamanho do título para `text-lg` no mobile.
- Botão Exportar: usar apenas ícone em telas pequenas (esconder texto "Exportar" com `hidden sm:inline`).
- Container: usar `px-3` em vez de `px-4` para dar mais respiro.

**Mudanças em `src/components/period-selector.tsx`**:
- O ToggleGroup com 4 itens (Mês, Ano, Trimestre, Personalizado) transborda com zoom. Usar `text-xs` e permitir scroll horizontal ou reduzir padding dos itens. Adicionar `overflow-x-auto` no container e `flex-shrink-0 whitespace-nowrap` nos itens, ou usar `min-w-0` com texto menor.

### Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `src/components/app-lock-screen.tsx` | Usar `removeBanner()` em vez de `hideBanner()` para garantir remoção total |
| `src/components/app-menu-drawer.tsx` | Usar `removeBanner()` quando abrir, `showBanner()` ao fechar |
| `src/pages/Reports.tsx` | Header responsivo: flex-wrap, título menor, botão Exportar compacto no mobile |
| `src/components/period-selector.tsx` | ToggleGroup com overflow-x-auto e itens menores para acomodar zoom |

