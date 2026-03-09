

## Plano: Atualizar tutorial para refletir novo layout

### Problema
Dois passos do tour apontam para elementos que agora estão escondidos:
- **`cards-button`** — movido para dentro do menu lateral (Drawer)
- **`calculator-button`** — dentro do FAB expandido (só aparece ao clicar no "+")

O tour usa `querySelector` para encontrar os alvos. Se o elemento não existe no DOM visível, o tooltip fica centralizado na tela sem spotlight — experiência confusa.

### Solução

**Arquivo: `src/hooks/use-product-tour.tsx`**

Atualizar a lista `tourSteps` para refletir o layout atual:

1. **Passo "Cartões"** — trocar target de `cards-button` para o botão do menu (hamburger). Atualizar título e descrição para explicar que Cartões, Configurações e Lembretes estão no menu lateral.

2. **Passo "Calculadora"** — trocar target de `calculator-button` para `fab-main-button`. Atualizar descrição para mencionar que ao abrir o "+" aparecem opções incluindo calculadora.

3. **Reordenar** — mover o passo do menu lateral para logo após o passo de Relatórios (que já está no header), criando um fluxo natural: header → menu → conteúdo → FAB.

### Steps finais propostos (13 passos → ~11-12)

| # | Target | Título resumido |
|---|--------|----------------|
| 1 | welcome | Bem-vindo |
| 2 | context-selector | Grupos |
| 3 | month-navigator | Meses |
| 4 | expense-filters | Filtros |
| 5 | category-summary | Categorias |
| 6 | expense-summary | Resumo pagamento |
| 7 | tabs | Abas |
| 8 | reports-button | Relatórios (header) |
| 9 | values-toggle | Esconder valores (header) |
| 10 | menu-button* | Menu lateral (cartões, config, lembretes) |
| 11 | fab-main-button | Botão + (despesa, entrada, meta, calculadora) |
| 12 | fab-main-button | Tudo pronto! |

*Requer adicionar `data-tour="menu-button"` no botão hamburger do header.

### Mudanças por arquivo

| Arquivo | Ação |
|---|---|
| `src/hooks/use-product-tour.tsx` | Atualizar `tourSteps` (targets, títulos, descrições) |
| `src/components/app-header.tsx` | Adicionar `data-tour="menu-button"` no botão do menu hamburger |

