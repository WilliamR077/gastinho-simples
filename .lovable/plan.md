

## Plano: FAB nativo e sem sobreposição

Apenas UI/estilo — sem alterar lógica, dados ou rotas.

---

### 1. Reposicionar FAB e corrigir safe-area

**Arquivo: `src/components/floating-action-button.tsx`**

O FAB já está em `bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)]` (96px). Manter essa posição, que já respeita safe-area.

### 2. Estética consistente ao abrir menu

**Arquivo: `src/components/floating-action-button.tsx`**

Problema atual: quando aberto, o FAB fica `bg-destructive` (vermelho) com `rotate-45`, criando contraste estranho com os botões coloridos do menu (verde, âmbar, vermelho).

Alteração:
- Quando aberto, usar `bg-muted-foreground` (cinza neutro) em vez de `bg-destructive`, eliminando o choque visual vermelho-sobre-verde
- Trocar `rotate-45` por `rotate-0` e usar ícone `X` direto (já é feito, então remover a rotação desnecessária)
- Resultado: botão de fechar neutro e discreto, sem competir com as opções do menu

Linha 83-84:
```tsx
// De:
isOpen ? "bg-destructive hover:bg-destructive/90 rotate-45" : "bg-primary hover:bg-primary/90"

// Para:
isOpen ? "bg-muted-foreground hover:bg-muted-foreground/90" : "bg-primary hover:bg-primary/90"
```

### 3. Auto-hide ao rolar (premium feel)

**Arquivo: `src/components/floating-action-button.tsx`**

Adicionar lógica de scroll direction detection:
- State: `visible` (default true)
- `useEffect` com scroll listener que compara `scrollY` com valor anterior
- Rolar para baixo → `visible = false` (esconde FAB com `translate-y-24 opacity-0`)
- Rolar para cima → `visible = true` (mostra FAB com transição suave)
- Quando menu está aberto (`isOpen`), sempre visível

```tsx
const [visible, setVisible] = useState(true);
const lastScrollY = useRef(0);

useEffect(() => {
  const onScroll = () => {
    const currentY = window.scrollY;
    setVisible(currentY < lastScrollY.current || currentY < 100);
    lastScrollY.current = currentY;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}, []);
```

Aplicar no container principal:
```tsx
className={cn(
  "fixed bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)] right-6 z-40 flex flex-col items-end gap-2 pointer-events-none transition-all duration-300",
  !visible && !isOpen && "translate-y-24 opacity-0"
)}
```

### 4. Padding inferior já configurado

O `pb-44` (176px) no container principal do `Index.tsx` já garante espaço suficiente para o FAB em `bottom-24` (96px) + altura do FAB (56px) + margem. Sem alteração necessária.

---

### Resumo de alterações

| Arquivo | Mudança |
|---|---|
| `floating-action-button.tsx` | FAB aberto: cor neutra (bg-muted-foreground), remover rotate-45; auto-hide ao rolar para baixo com transição suave |

1 arquivo, ~15 linhas alteradas. Sem alteração de lógica.

