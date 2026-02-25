

## Plano: Refatorar a App Bar do Index

### Situacao atual
O header em `src/pages/Index.tsx` (linhas 1493-1554) renderiza uma fileira de botoes inline: Relatorios, Cartoes, Configuracoes, Conta, Sair, Lembretes, Olho, Tema. No mobile ficam apertados e sem hierarquia visual.

### O que sera feito

**1. Criar componente `src/components/app-header.tsx`**

Novo componente dedicado que encapsula toda a logica do header. Recebe via props: `currentMonth`, `onMonthChange`, `recurringExpenses`, e `onSignOut`.

Layout:
```text
+------------------------------------------------------+
| [Logo]          Fevereiro de 2026      [📊] [👁] [☰] |
+------------------------------------------------------+
```

- **Esquerda**: Logo clicavel (navega para `/`), menor que o atual (h-10 em vez de h-20)
- **Centro**: Mes atual formatado (usando `format` do date-fns). No mobile, fonte menor
- **Direita**: 3 icon-buttons com area de toque de 44x44px:
  - `BarChart3` - navega para `/reports`
  - `Eye`/`EyeOff` - toggle de visibilidade (usa `useValuesVisibility`)
  - `Menu` (hamburger) - abre o drawer "Mais"

**2. Criar componente `src/components/app-menu-drawer.tsx`**

Drawer/Sheet lateral (usa o componente Sheet existente, side="right") com os itens secundarios:

- Cartoes (`CreditCard` icon, navega para `/cards`)
- Configuracoes (`Settings` icon, navega para `/settings`)
- Conta (`User` icon, navega para `/account`)
- Lembretes (`Bell` icon, abre o RemindersDrawer - com badge de contagem)
- Tema (`Moon`/`Sun` toggle inline com Switch)
- Separador (`<Separator />`)
- Sair (cor `text-destructive`, icone `LogOut`, fixo no rodape do drawer)

**3. Atualizar `src/pages/Index.tsx`**

- Remover toda a secao do header atual (linhas 1493-1555)
- Substituir pelo novo `<AppHeader />` com estilo `sticky top-0 z-40 bg-background/95 backdrop-blur`
- Remover o `MonthNavigator` separado pois o mes ja esta no header
- Manter `ContextSelector` logo abaixo do header
- Remover imports nao utilizados (`ThemeToggle`, `ValuesVisibilityToggle`, `RemindersButton`, `LogOut`, `User`, `CreditCard`, `Settings` do topo)

### Detalhes tecnicos

- O header usa `position: sticky` para ficar fixo ao rolar
- Icon-buttons usam classe `h-11 w-11 touch-manipulation` para area de toque confortavel no mobile
- O drawer do menu usa o componente `Sheet` (side="right") que ja existe no projeto
- O `RemindersButton` sera adaptado: em vez de renderizar seu proprio botao no header, a logica de contagem de lembretes sera reutilizada dentro do drawer como um item de menu com badge
- O toggle de tema dentro do drawer usa o componente `Switch` existente com `useTheme`
- O botao "Sair" fica separado por `<Separator />` e com `text-destructive` para destaque visual de acao perigosa
- Navegacao por mes (setas esquerda/direita) permanece como `MonthNavigator` abaixo do header, nao muda

### Arquivos criados
- `src/components/app-header.tsx`
- `src/components/app-menu-drawer.tsx`

### Arquivos modificados
- `src/pages/Index.tsx` (remover header antigo, usar novos componentes)

