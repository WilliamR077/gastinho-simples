

## Plano: Ajustes finos no Header e Menu Drawer

### Alteracoes em `src/components/app-header.tsx`

1. **Logo maior e mais colada a esquerda**:
   - Mudar de `h-9 sm:h-10` para `h-11 sm:h-12` para ficar legivel
   - Reduzir padding esquerdo no container: trocar `px-4` por `px-2 sm:px-4` para colar mais no canto

2. **Remover o mes central** ("Fevereiro de 2026"):
   - Deletar linhas 41-44 (o `<span>` com `monthLabel`)
   - Remover imports de `format`, `date-fns` e `ptBR` (ficam sem uso)
   - Remover `currentMonth` da interface de props (ja nao sera usado)
   - Mudar layout de `justify-between` para `justify-between` mantido, mas sem o elemento central o logo e botoes ficam nos extremos naturalmente

3. **Botoes mais colados a direita no desktop**:
   - Reduzir padding direito: trocar `px-4` por `px-2 sm:px-4` ja resolve, ou usar `pr-2 sm:pr-3`
   - Reduzir gap dos botoes de `gap-1` para `gap-0.5` no desktop para ficarem mais juntos

### Alteracoes em `src/components/app-menu-drawer.tsx`

4. **Trocar titulo "Menu" pelo logo do Gastinho**:
   - No `SheetHeader`, remover `<SheetTitle>Menu</SheetTitle>`
   - Substituir por uma `<img>` com o logo (`/lovable-uploads/06a1acc2-f553-41f0-8d87-32d25b4e425e.png`) com tamanho `h-10 w-auto`
   - Manter `<SheetTitle className="sr-only">Menu</SheetTitle>` para acessibilidade (screen readers)

### Alteracoes em `src/pages/Index.tsx`

5. **Remover prop `currentMonth` do `<AppHeader>`** ja que nao sera mais usado no header

### Resumo visual

```text
ANTES:
+--[px-4]--[Logo h-9]----[Fev 2026]----[📊][👁][☰]--[px-4]--+

DEPOIS:
+--[px-2]--[Logo h-12]------------------[📊][👁][☰]--[px-2]--+
```

Drawer antes: titulo "Menu"
Drawer depois: logo Gastinho Simples (imagem)

