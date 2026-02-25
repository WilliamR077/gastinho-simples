

## Plano: Corrigir logo esticada no Menu Drawer

O problema é que a imagem do logo está usando `h-10 w-auto` mas o `SheetHeader` provavelmente está esticando ela horizontalmente. A solução é limitar a largura máxima e garantir que a proporção seja mantida com `object-contain`.

### Alteração em `src/components/app-menu-drawer.tsx` (linha 112)

Trocar:
```
className="h-10 w-auto"
```

Por:
```
className="h-10 max-w-[160px] object-contain"
```

Isso limita a largura máxima a 160px e usa `object-contain` para manter a proporção original da imagem, evitando o esticamento.

